#!/usr/bin/python

from __future__ import print_function

import logging
import logging.handlers
import os
import re
import subprocess
import sys
import urllib
from urlparse import urlparse

from git_deps.utils import abort


def usage():
    abort("usage: git-handler URL")


def get_logger():
    logger = logging.getLogger('foo')
    # logger.setLevel(logging.DEBUG)

    slh = logging.handlers.SysLogHandler(address='/dev/log')
    slf = logging.Formatter('gitfile-handler: %(message)s')
    slh.setFormatter(slf)
    logger.addHandler(slh)
    logger.addHandler(logging.StreamHandler())

    return logger


def main(args):
    if len(args) != 1:
        usage()

    logger = get_logger()

    url = args[0]
    logger.debug("received URL: %s" % url)
    if re.search(r'%23', url):
        # Uh-oh, double-encoded URIs!  Some versions of Chrome
        # encode the value you set location.href too.
        url = urllib.unquote(url)
        logger.debug("unquoted: %s" % url)
    url = urlparse(url)
    logger.debug("parsed: %r" % repr(url))

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
