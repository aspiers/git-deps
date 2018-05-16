import re
import subprocess

import pygit2

from git_deps.utils import abort, standard_logger
from git_deps.gitutils import GitUtils
from git_deps.listener.base import DependencyListener
from git_deps.errors import InvalidCommitish


class DependencyDetector(object):
    """Class for automatically detecting dependencies between git commits.
    A dependency is inferred by diffing the commit with each of its
    parents, and for each resulting hunk, performing a blame to see
    which commit was responsible for introducing the lines to which
    the hunk was applied.

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
        self.todo_d[dependent.hex] = True

        first_time = True

        while self.todo:
            sha1s = [commit.hex[:8] for commit in self.todo]
            if first_time:
                self.logger.debug("Initial TODO list: %s" % " ".join(sha1s))
                first_time = False
            else:
                self.logger.debug("  TODO list now: %s" % " ".join(sha1s))
            dependent = self.todo.pop(0)
            dependent_sha1 = dependent.hex
            del self.todo_d[dependent_sha1]
            self.logger.debug("  Processing %s from TODO list" %
                              dependent_sha1[:8])

            if dependent_sha1 in self.done_d:
                self.logger.debug("  %s already done previously" %
                                  dependent_sha1)
                continue

            self.notify_listeners('new_commit', dependent)

            for parent in dependent.parents:
                self.find_dependencies_with_parent(dependent, parent)
            self.done.append(dependent_sha1)
            self.done_d[dependent_sha1] = True
            self.logger.debug("  Found all dependencies for %s" %
                              dependent_sha1[:8])
            # A commit won't have any dependencies if it only added new files
            dependencies = self.dependencies.get(dependent_sha1, {})
            self.notify_listeners('dependent_done', dependent, dependencies)

        self.logger.debug("Finished processing TODO list")
        self.notify_listeners('all_done')

    def find_dependencies_with_parent(self, dependent, parent):
        """Find all dependencies of the given revision caused by the given
        parent commit.  This will be called multiple times for merge
        commits which have multiple parents.
        """
        self.logger.debug("    Finding dependencies of %s via parent %s" %
                          (dependent.hex[:8], parent.hex[:8]))
        diff = self.repo.diff(parent, dependent,
                              context_lines=self.options.context_lines)
        for patch in diff:
            path = patch.delta.old_file.path
            self.logger.debug("      Examining hunks in %s" % path)
            for hunk in patch.hunks:
                self.blame_hunk(dependent, parent, path, hunk)

    def blame_hunk(self, dependent, parent, path, hunk):
        """Run git blame on the parts of the hunk which exist in the older
        commit in the diff.  The commits generated by git blame are
        the commits which the newer commit in the diff depends on,
        because without the lines from those commits, the hunk would
        not apply correctly.
        """
        line_range_before = "-%d,%d" % (hunk.old_start, hunk.old_lines)
        line_range_after = "+%d,%d" % (hunk.new_start, hunk.new_lines)
        self.logger.debug("        Blaming hunk %s @ %s" %
                          (line_range_before, parent.hex[:8]))

        if not self.tree_lookup(path, parent):
            # This is probably because dependent added a new directory
            # which was not previously in the parent.
            return

        cmd = [
            'git', 'blame',
            '--porcelain',
            '-L', "%d,+%d" % (hunk.old_start, hunk.old_lines),
            parent.hex, '--', path
        ]
        blame = subprocess.check_output(cmd, universal_newlines=True)

        dependent_sha1 = dependent.hex
        if dependent_sha1 not in self.dependencies:
            self.logger.debug("          New dependent: %s" %
                              GitUtils.commit_summary(dependent))
            self.dependencies[dependent_sha1] = {}
            self.notify_listeners("new_dependent", dependent)

        line_to_culprit = {}

        for line in blame.split('\n'):
            self.logger.debug("        !" + line.rstrip())
            m = re.match('^([0-9a-f]{40}) (\d+) (\d+)( \d+)?$', line)
            if not m:
                continue
            dependency_sha1, orig_line_num, line_num = m.group(1, 2, 3)
            line_num = int(line_num)
            dependency = self.get_commit(dependency_sha1)
            line_to_culprit[line_num] = dependency.hex

            if self.is_excluded(dependency):
                self.logger.debug(
                    "        Excluding dependency %s from line %s (%s)" %
                    (dependency_sha1[:8], line_num,
                     GitUtils.oneline(dependency)))
                continue

            if dependency_sha1 not in self.dependencies[dependent_sha1]:
                if not self.seen_commit(dependency):
                    self.notify_listeners("new_commit", dependency)
                    self.dependencies[dependent_sha1][dependency_sha1] = {}

                self.notify_listeners("new_dependency",
                                      dependent, dependency, path, line_num)

                self.logger.debug(
                    "          New dependency %s -> %s via line %s (%s)" %
                    (dependent_sha1[:8], dependency_sha1[:8], line_num,
                     GitUtils.oneline(dependency)))

                if dependency_sha1 in self.todo_d:
                    self.logger.debug(
                        "        Dependency on %s via line %s already in TODO"
                        % (dependency_sha1[:8], line_num,))
                    continue

                if dependency_sha1 in self.done_d:
                    self.logger.debug(
                        "        Dependency on %s via line %s already done" %
                        (dependency_sha1[:8], line_num,))
                    continue

                if dependency_sha1 not in self.dependencies:
                    if self.options.recurse:
                        self.todo.append(dependency)
                        self.todo_d[dependency.hex] = True
                        self.logger.debug("  + Added %s to TODO" %
                                          dependency.hex[:8])

            dep_sources = self.dependencies[dependent_sha1][dependency_sha1]

            if path not in dep_sources:
                dep_sources[path] = {}
                self.notify_listeners('new_path',
                                      dependent, dependency, path, line_num)

            if line_num in dep_sources[path]:
                abort("line %d already found when blaming %s:%s\n"
                      "old:\n  %s\n"
                      "new:\n  %s" %
                      (line_num, parent.hex[:8], path,
                       dep_sources[path][line_num], line))

            dep_sources[path][line_num] = line
            self.logger.debug("          New line for %s -> %s: %s" %
                              (dependent_sha1[:8], dependency_sha1[:8], line))
            self.notify_listeners('new_line',
                                  dependent, dependency, path, line_num)

        diff_format = '      |%8.8s %5s %s%s'
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

    def is_excluded(self, commit):
        if self.options.exclude_commits is not None:
            for exclude in self.options.exclude_commits:
                if self.branch_contains(commit, exclude):
                    return True
        return False

    def branch_contains(self, commit, branch):
        sha1 = commit.hex
        branch_commit = self.get_commit(branch)
        branch_sha1 = branch_commit.hex
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
                    tree_or_blob = self.repo[tree_or_blob[dirent].oid]
                    # self.logger.debug("  %s in %s" % (dirent, path))
                    if path:
                        path += '/'
                    path += dirent
                else:
                    # This is probably because we were called on a
                    # commit whose parent added a new directory.
                    self.logger.debug("        %s not in %s in %s" %
                                      (dirent, path, commit.hex[:8]))
                    return None
            else:
                self.logger.debug("        %s not a tree in %s" %
                                  (tree_or_blob, commit.hex[:8]))
                return None
        return tree_or_blob

    def edges(self):
        return [
            [(dependent, dependency)
             for dependency in self.dependencies[dependent]]
            for dependent in self.dependencies.keys()
        ]
