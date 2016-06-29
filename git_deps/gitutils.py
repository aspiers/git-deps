import re
import subprocess


class GitUtils(object):
    @classmethod
    def abbreviate_sha1(cls, sha1):
        """Uniquely abbreviates the given SHA1."""

        # For now we invoke git-rev-parse(1), but hopefully eventually
        # we will be able to do this via pygit2.
        cmd = ['git', 'rev-parse', '--short', sha1]
        # cls.logger.debug(" ".join(cmd))
        out = subprocess.check_output(cmd).strip()
        # cls.logger.debug(out)
        return out

    @classmethod
    def describe(cls, sha1):
        """Returns a human-readable representation of the given SHA1."""

        # For now we invoke git-describe(1), but eventually we will be
        # able to do this via pygit2, since libgit2 already provides
        # an API for this:
        #   https://github.com/libgit2/pygit2/pull/459#issuecomment-68866929
        #   https://github.com/libgit2/libgit2/pull/2592
        cmd = [
            'git', 'describe',
            '--all',       # look for tags and branches
            '--long',      # remotes/github/master-0-g2b6d591
            # '--contains',
            # '--abbrev',
            sha1
        ]
        # cls.logger.debug(" ".join(cmd))
        out = None
        try:
            out = subprocess.check_output(cmd, stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as e:
            if e.output.find('No tags can describe') != -1:
                return ''
            raise

        out = out.strip()
        out = re.sub(r'^(heads|tags|remotes)/', '', out)
        # We already have the abbreviated SHA1 from abbreviate_sha1()
        out = re.sub(r'-g[0-9a-f]{7,}$', '', out)
        # cls.logger.debug(out)
        return out

    @classmethod
    def oneline(cls, commit):
        return commit.message.split('\n', 1)[0]

    @classmethod
    def refs_to(cls, sha1, repo):
        """Returns all refs pointing to the given SHA1."""
        matching = []
        for refname in repo.listall_references():
            symref = repo.lookup_reference(refname)
            dref = symref.resolve()
            oid = dref.target
            commit = repo.get(oid)
            if commit.hex == sha1:
                matching.append(symref.shorthand)

        return matching

    @classmethod
    def rev_list(cls, rev_range):
        cmd = ['git', 'rev-list', rev_range]
        return subprocess.check_output(cmd).strip().split('\n')
