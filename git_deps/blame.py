import subprocess
import re
from dataclasses import dataclass

# The following classes are introduced to imitate their counterparts in pygit2,
# so that the output of 'blame_via_subprocess' can be swapped with pygit2's own
# blame output.

@dataclass
class GitRef:
    """
    A reference to a commit
    """
    hex: str

@dataclass
class BlameHunk:
    """
    A chunk of a blame output which has the same commit information
    for a consecutive set of lines
    """
    orig_commit_id: GitRef
    orig_start_line_number: int
    final_start_line_number: int
    lines_in_hunk: int = 1


def blame_via_subprocess(path, commit, start_line, num_lines):
    """
    Generate a list of blame hunks by calling 'git blame' as a separate process.
    This is a workaround for the slowness of pygit2's own blame algorithm.
    See https://github.com/aspiers/git-deps/issues/1
    """
    cmd = [
        'git', 'blame',
        '--porcelain',
        '-L', "%d,+%d" % (start_line, num_lines),
        commit, '--', path
    ]
    output = subprocess.check_output(cmd, universal_newlines=True)

    current_hunk = None
    for line in output.split('\n'):
        m = re.match(r'^([0-9a-f]{40}) (\d+) (\d+) (\d+)$', line)

        if m: # starting a new hunk
            if current_hunk:
                yield current_hunk
            dependency_sha1, orig_line_num, line_num, length = m.group(1, 2, 3, 4)
            orig_line_num = int(orig_line_num)
            line_num = int(line_num)
            length = int(length)
            current_hunk = BlameHunk(
                orig_commit_id=GitRef(dependency_sha1),
                orig_start_line_number = orig_line_num,
                final_start_line_number = line_num,
                lines_in_hunk = length
            )

    if current_hunk:
        yield current_hunk
