from git_deps.listener.base import DependencyListener

from git_deps.gitutils import GitUtils


class JSONDependencyListener(DependencyListener):
    """Dependency listener for use when compiling graph data in a JSON
    format which can be consumed by WebCola / d3.  Each new commit has
    to be added to a 'commits' array.
    """

    def __init__(self, options):
        super(JSONDependencyListener, self).__init__(options)

        # Map commit names to indices in the commits array.  This is used
        # to avoid the risk of duplicates in the commits array, which
        # could happen when recursing, since multiple commits could
        # potentially depend on the same commit.
        self._commits = {}

        self._json = {
            'commits': [],
            'dependencies': [],
        }

    def get_commit(self, sha1):
        i = self._commits[sha1]
        return self._json['commits'][i]

    def add_commit(self, commit):
        """Adds the commit to the commits array if it doesn't already exist,
        and returns the commit's index in the array.
        """
        sha1 = commit.hex
        if sha1 in self._commits:
            return self._commits[sha1]
        title, separator, body = commit.message.partition("\n")
        commit = {
            'explored': False,
            'sha1': sha1,
            'name': GitUtils.abbreviate_sha1(sha1),
            'describe': GitUtils.describe(sha1),
            'refs': GitUtils.refs_to(sha1, self.repo()),
            'author_name': commit.author.name,
            'author_mail': commit.author.email,
            'author_time': commit.author.time,
            'author_offset': commit.author.offset,
            'committer_name': commit.committer.name,
            'committer_mail': commit.committer.email,
            'committer_time': commit.committer.time,
            'committer_offset': commit.committer.offset,
            # 'message': commit.message,
            'title': title,
            'separator': separator,
            'body': body.lstrip("\n"),
        }
        self._json['commits'].append(commit)
        self._commits[sha1] = len(self._json['commits']) - 1
        return self._commits[sha1]

    def new_commit(self, commit):
        self.add_commit(commit)

    def new_dependency(self, parent, child, path, line_num):
        ph = parent.hex
        ch = child.hex

        new_dep = {
            'parent': ph,
            'child': ch,
        }

        if self.options.log:
            pass  # FIXME

        self._json['dependencies'].append(new_dep)

    def dependent_done(self, dependent, dependencies):
        commit = self.get_commit(dependent.hex)
        commit['explored'] = True

    def json(self):
        return self._json
