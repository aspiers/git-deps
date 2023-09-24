
from git_deps.blame import blame_via_subprocess, BlameHunk, GitRef

def test_blame_via_subprocess():
    hunks = list(blame_via_subprocess(
        'INSTALL.md',
        '04f5c095d4eccf5808db6dbf90c31a535f7f371c',
        12, 4))

    expected_hunks = [
        BlameHunk(
            GitRef('6e23a48f888a355ad7e101c797ce1b66c4b7b86a'),
            orig_start_line_number=12,
            final_start_line_number=12,
            lines_in_hunk=2),
        BlameHunk(
            GitRef('2c9d23b0291157eb1096384ff76e0122747b9bdf'),
            orig_start_line_number=10,
            final_start_line_number=14,
            lines_in_hunk=2)
    ]

    assert hunks == expected_hunks

