from __future__ import print_function

import logging
import sys


def abort(msg, exitcode=1):
    print(msg, file=sys.stderr)
    sys.exit(exitcode)


def debug_logger(name):
    log_format = '%(asctime)-15s %(levelname)-6s %(message)s'
    date_format = '%b %d %H:%M:%S'
    formatter = logging.Formatter(fmt=log_format, datefmt=date_format)
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(formatter)
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    logger.addHandler(handler)
    return logger
