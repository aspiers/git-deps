import subprocess

from git_deps.listener.base import DependencyListener


class CLIDependencyListener(DependencyListener):
    """Dependency listener for use when running in CLI mode.

    This allows us to output dependencies as they are discovered,
    rather than waiting for all dependencies to be discovered before
    outputting anything; the latter approach can make the user wait
    too long for useful output if recursion is enabled.
    """

    def __init__(self, options):
        super(CLIDependencyListener, self).__init__(options)

        # Count each mention of each revision, so we can avoid duplicating
        # commits in the output.
        self._revs = {}

    def new_commit(self, commit):
        rev = commit.hex
        if rev not in self._revs:
            self._revs[rev] = 0
        self._revs[rev] += 1

    def new_dependency(self, dependent, dependency, path, line_num):
        dependent_sha1 = dependent.hex
        dependency_sha1 = dependency.hex

        if self.options.multi:
            if self.options.log:
                print("%s depends on:" % dependent_sha1)
            else:
                print("%s %s" % (dependent_sha1, dependency_sha1))
        else:
            if not self.options.log and self._revs[dependency_sha1] <= 1:
                print(dependency_sha1)

        if self.options.log and self._revs[dependency_sha1] <= 1:
            cmd = [
                'git',
                '--no-pager',
                '-c', 'color.ui=always',
                'log', '-n1',
                dependency_sha1
            ]
            print(subprocess.check_output(cmd))
            # dependency = detector.get_commit(dependency_sha1)
            # print(dependency.message + "\n")

        # for path in self.dependencies[dependency]:
        #     print("  %s" % path)
        #     keys = sorted(self.dependencies[dependency][path].keys()
        #     print("    %s" % ", ".join(keys)))
