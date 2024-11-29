import re
import subprocess

import pygit2

from git_deps.utils import abort, standard_logger
from git_deps.gitutils import GitUtils
from git_deps.listener.base import DependencyListener
from git_deps.errors import InvalidCommitish
from git_deps.blame import blame_via_subprocess


class DependencyDetector(object):
    """Class for automatically detecting dependencies between git
    commits.  A dependency is inferred by diffing the commit with each
    of its parents, and for each resulting hunk, performing a blame to
    see which commit was responsible for introducing the lines to
    which the hunk was applied.

    Dependencies can be traversed recursively, building a dependency
    tree represented (conceptually) by a list of edges.
    """

    def __init__(self, options, repo=None, logger=None):
        self.options = options

        if logger is None:
            self.logger = standard_logger(self.__class__.__name__,
                                          options.debug)

        if repo is None:
            self.repo = GitUtils.get_repo()
        else:
            self.repo = repo

        # Nested dict mapping dependents -> dependencies -> files
        # causing that dependency -> numbers of lines within that file
        # causing that dependency.  The first two levels form edges in
        # the dependency graph, and the latter two tell us what caused
        # those edges.
        self.dependencies = {}

        # A TODO list (queue) and dict of dependencies which haven't
        # yet been recursively followed.  Only useful when recursing.
        self.todo = []
        self.todo_d = {}

        # An ordered list and dict of commits whose dependencies we
        # have already detected.
        self.done = []
        self.done_d = {}

        # A cache mapping SHA1s to commit objects
        self.commits = {}

        # Memoization for branch_contains()
        self.branch_contains_cache = {}

        # Callbacks to be invoked when a new dependency has been
        # discovered.
        self.listeners = []

    def add_listener(self, listener):
        if not isinstance(listener, DependencyListener):
            raise RuntimeError("Listener must be a DependencyListener")
        self.listeners.append(listener)
        listener.set_detector(self)

    def notify_listeners(self, event, *args):
        for listener in self.listeners:
            fn = getattr(listener, event)
            fn(*args)

    def seen_commit(self, rev):
        return rev in self.commits

    def get_commit(self, rev):
        if rev in self.commits:
            return self.commits[rev]

        self.commits[rev] = GitUtils.ref_commit(self.repo, rev)

        return self.commits[rev]

    def find_dependencies(self, dependent_rev, recurse=None):
        """Find all dependencies of the given revision, recursively traversing
        the dependency tree if requested.
        """
        if recurse is None:
            recurse = self.options.recurse

        try:
            dependent = self.get_commit(dependent_rev)
        except InvalidCommitish as e:
            abort(e.message())

        self.todo.append(dependent)
        self.todo_d[str(dependent.id)] = True

        first_time = True

        while self.todo:
            sha1s = [str(commit.id)[:8] for commit in self.todo]
            if first_time:
                self.logger.info("Initial TODO list: %s" % " ".join(sha1s))
                first_time = False
            else:
                self.logger.info("  TODO list now: %s" % " ".join(sha1s))
            dependent = self.todo.pop(0)
            dependent_sha1 = str(dependent.id)
            del self.todo_d[dependent_sha1]
            self.logger.info("  Processing %s from TODO list" %
                             dependent_sha1[:8])

            if dependent_sha1 in self.done_d:
                self.logger.info("  %s already done previously" %
                                 dependent_sha1)
                continue

            self.notify_listeners('new_commit', dependent)

            if dependent.parents: # the root commit does not have parents
                parent = dependent.parents[0]
                self.find_dependencies_with_parent(dependent, parent)

            self.done.append(dependent_sha1)
            self.done_d[dependent_sha1] = True
            self.logger.info("  Found all dependencies for %s" %
                             dependent_sha1[:8])
            # A commit won't have any dependencies if it only added new files
            dependencies = self.dependencies.get(dependent_sha1, {})
            self.notify_listeners('dependent_done', dependent, dependencies)

        self.logger.info("Finished processing TODO list")
        self.notify_listeners('all_done')

    def find_dependencies_with_parent(self, dependent, parent):
        """Find all dependencies of the given revision caused by the
        given parent commit.  This will be called multiple times for
        merge commits which have multiple parents.
        """
        self.logger.info("    Finding dependencies of %s via parent %s" %
                         (str(dependent.id)[:8], str(parent.id)[:8]))
        diff = self.repo.diff(parent, dependent,
                              context_lines=self.options.context_lines)
        for patch in diff:
            path = patch.delta.old_file.path
            self.logger.info("      Examining hunks in %s" % path)
            for hunk in patch.hunks:
                self.blame_diff_hunk(dependent, parent, path, hunk)

    def blame_diff_hunk(self, dependent, parent, path, hunk):
        """Run git blame on the parts of the hunk which exist in the
        older commit in the diff.  The commits generated by git blame
        are the commits which the newer commit in the diff depends on,
        because without the lines from those commits, the hunk would
        not apply correctly.
        """
        line_range_before = "-%d,%d" % (hunk.old_start, hunk.old_lines)
        line_range_after = "+%d,%d" % (hunk.new_start, hunk.new_lines)
        self.logger.info("        Blaming hunk %s @ %s (listed below)" %
                         (line_range_before, str(parent.id)[:8]))

        if not self.tree_lookup(path, parent):
            # This is probably because dependent added a new directory
            # which was not previously in the parent.
            return

        blame = self.run_blame(hunk, parent, path)

        dependent_sha1 = str(dependent.id)
        self.register_new_dependent(dependent, dependent_sha1)

        line_to_culprit = {}

        for blame_hunk in blame:
            self.process_blame_hunk(dependent, dependent_sha1, parent,
                                   path, blame_hunk, line_to_culprit)

        self.debug_hunk(line_range_before, line_range_after, hunk,
                        line_to_culprit)

    def process_blame_hunk(self, dependent, dependent_sha1, parent,
                          path, blame_hunk, line_to_culprit):

        orig_line_num = blame_hunk.orig_start_line_number
        line_num = blame_hunk.final_start_line_number
        dependency_sha1 = blame_hunk.orig_commit_id.hex
        line_representation = f"{dependency_sha1} {orig_line_num} {line_num}"

        self.logger.debug(f"          ! {line_representation}")

        dependency = self.get_commit(dependency_sha1)
        for i in range(blame_hunk.lines_in_hunk):
            line_to_culprit[line_num + i] = str(dependency.id)

        if self.is_excluded(dependency):
            self.logger.debug(
                "          Excluding dependency %s from line %s (%s)" %
                (dependency_sha1[:8], line_num,
                 GitUtils.oneline(dependency)))
            return

        if dependency_sha1 not in self.dependencies[dependent_sha1]:
            self.process_new_dependency(dependent, dependent_sha1,
                                        dependency, dependency_sha1,
                                        path, line_num)

        self.record_dependency_source(parent,
                                      dependent, dependent_sha1,
                                      dependency, dependency_sha1,
                                      path, line_num, line_representation)

    def debug_hunk(self, line_range_before, line_range_after, hunk,
                   line_to_culprit):
        diff_format = '          | %8.8s %5s %s%s'
        hunk_header = '@@ %s %s @@' % (line_range_before, line_range_after)
        self.logger.debug(diff_format % ('--------', '-----', '', hunk_header))
        line_num = hunk.old_start
        for line in hunk.lines:
            if "\n\\ No newline at end of file" == line.content.rstrip():
                break
            if line.origin == '+':
                rev = ln = ''
            else:
                rev = line_to_culprit[line_num]
                ln = line_num
                line_num += 1
            self.logger.debug(diff_format %
                              (rev, ln, line.origin, line.content.rstrip()))

    def register_new_dependent(self, dependent, dependent_sha1):
        if dependent_sha1 not in self.dependencies:
            self.logger.info("          New dependent: %s" %
                             GitUtils.commit_summary(dependent))
            self.dependencies[dependent_sha1] = {}
            self.notify_listeners("new_dependent", dependent)

    def run_blame(self, hunk, parent, path):
        if self.options.pygit2_blame:
            return self.repo.blame(path,
                        newest_commit=str(parent.id),
                        min_line=hunk.old_start,
                        max_line=hunk.old_start + hunk.old_lines - 1)
        else:
            return blame_via_subprocess(path,
                        str(parent.id),
                        hunk.old_start,
                        hunk.old_lines)

    def is_excluded(self, commit):
        if self.options.exclude_commits is not None:
            for exclude in self.options.exclude_commits:
                if self.branch_contains(commit, exclude):
                    return True
        return False

    def process_new_dependency(self, dependent, dependent_sha1,
                               dependency, dependency_sha1,
                               path, line_num):
        if not self.seen_commit(dependency):
            self.notify_listeners("new_commit", dependency)
            self.dependencies[dependent_sha1][dependency_sha1] = {}

        self.notify_listeners("new_dependency",
                              dependent, dependency, path, line_num)

        self.logger.info(
            "          New dependency %s -> %s via line %s (%s)" %
            (dependent_sha1[:8], dependency_sha1[:8], line_num,
             GitUtils.oneline(dependency)))

        if dependency_sha1 in self.todo_d:
            self.logger.info(
                "        Dependency on %s via line %s already in TODO"
                % (dependency_sha1[:8], line_num,))
            return

        if dependency_sha1 in self.done_d:
            self.logger.info(
                "        Dependency on %s via line %s already done" %
                (dependency_sha1[:8], line_num,))
            return

        if dependency_sha1 not in self.dependencies:
            if self.options.recurse:
                self.todo.append(dependency)
                self.todo_d[str(dependency.id)] = True
                self.logger.info("  + Added %s to TODO" %
                                 str(dependency.id)[:8])

    def record_dependency_source(self, parent,
                                 dependent, dependent_sha1,
                                 dependency, dependency_sha1,
                                 path, line_num, line):
        dep_sources = self.dependencies[dependent_sha1][dependency_sha1]

        if path not in dep_sources:
            dep_sources[path] = {}
            self.notify_listeners('new_path',
                                  dependent, dependency, path, line_num)

        if line_num in dep_sources[path]:
            abort("line %d already found when blaming %s:%s\n"
                  "old:\n  %s\n"
                  "new:\n  %s" %
                  (line_num, str(parent.id)[:8], path,
                   dep_sources[path][line_num], line))

        dep_sources[path][line_num] = line
        self.logger.debug("          New line for %s -> %s: %s" %
                          (dependent_sha1[:8], dependency_sha1[:8], line))
        self.notify_listeners('new_line',
                              dependent, dependency, path, line_num)

    def branch_contains(self, commit, branch):
        sha1 = str(commit.id)
        branch_commit = self.get_commit(branch)
        branch_sha1 = str(branch_commit.id)
        self.logger.debug("          Does %s (%s) contain %s?" %
                          (branch, branch_sha1[:8], sha1[:8]))

        if sha1 not in self.branch_contains_cache:
            self.branch_contains_cache[sha1] = {}
        if branch_sha1 in self.branch_contains_cache[sha1]:
            memoized = self.branch_contains_cache[sha1][branch_sha1]
            self.logger.debug("            %s (memoized)" % memoized)
            return memoized

        cmd = ['git', 'merge-base', sha1, branch_sha1]
        # self.logger.debug("   ".join(cmd))
        out = subprocess.check_output(cmd, universal_newlines=True).strip()
        self.logger.debug("          merge-base returned: %s" % out[:8])
        result = out == sha1
        self.logger.debug("            %s" % result)
        self.branch_contains_cache[sha1][branch_sha1] = result
        return result

    def tree_lookup(self, target_path, commit):
        """Navigate to the tree or blob object pointed to by the given target
        path for the given commit.  This is necessary because each git
        tree only contains entries for the directory it refers to, not
        recursively for all subdirectories.
        """
        segments = target_path.split("/")
        tree_or_blob = commit.tree
        path = ''
        while segments:
            dirent = segments.pop(0)
            if isinstance(tree_or_blob, pygit2.Tree):
                if dirent in tree_or_blob:
                    tree_or_blob = self.repo[tree_or_blob[dirent].id]
                    # self.logger.debug("  %s in %s" % (dirent, path))
                    if path:
                        path += '/'
                    path += dirent
                else:
                    # This is probably because we were called on a
                    # commit whose parent added a new directory.
                    self.logger.debug("        %s not in %s in %s" %
                                      (dirent, path, str(commit.id)[:8]))
                    return None
            else:
                self.logger.debug("        %s not a tree in %s" %
                                  (tree_or_blob, str(commit.id)[:8]))
                return None
        return tree_or_blob

    def edges(self):
        return [
            [(dependent, dependency)
             for dependency in self.dependencies[dependent]]
            for dependent in self.dependencies.keys()
        ]
