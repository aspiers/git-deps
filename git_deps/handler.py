#!/usr/bin/python

from __future__ import print_function

import os
import subprocess
import sys
from urlparse import urlparse


def abort(msg, exitcode=1):
    print(msg, file=sys.stderr)
    sys.exit(exitcode)


def usage():
    abort("usage: git-handler URL")


def main(args):
    if len(args) != 1:
        usage()

    url = args[0]

    if url.scheme != 'gitfile':
        abort("URL must use gitfile:// scheme")

    repo = os.path.join(url.netloc, url.path)
    rev = url.fragment
    os.chdir(repo)

    subprocess.Popen(['gitk', '--all', '--select-commit=%s' % rev])


def run():
    main(sys.argv[1:])


if __name__ == "__main__":
    run()
