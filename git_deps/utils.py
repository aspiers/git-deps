from __future__ import print_function

import sys


def abort(msg, exitcode=1):
    print(msg, file=sys.stderr)
    sys.exit(exitcode)
