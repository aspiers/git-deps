#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
git-deps - automatically detect dependencies between git commits
Copyright (C) 2013 Adam Spiers <git@adamspiers.org>

The software in this repository is free software: you can redistribute
it and/or modify it under the terms of the GNU General Public License
as published by the Free Software Foundation, either version 2 of the
License, or (at your option) any later version.

This software is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
"""

from __future__ import print_function

import argparse
import json
import os
import sys

from git_deps import __version__
from git_deps.detector import DependencyDetector
from git_deps.errors import InvalidCommitish
from git_deps.gitutils import GitUtils
from git_deps.listener.json import JSONDependencyListener
from git_deps.listener.cli import CLIDependencyListener
from git_deps.server import serve
from git_deps.utils import abort


def parse_args():
    #####################################################################
    # REMINDER!!  If you change this, remember to update README.md too.
    #####################################################################
    parser = argparse.ArgumentParser(
        description='Auto-detects commits on which the given '
                    'commit(s) depend.',
        usage='%(prog)s [options] COMMIT-ISH [COMMIT-ISH...]',
        add_help=False
    )
    parser.add_argument('-h', '--help', action='help',
                        help='Show this help message and exit')
    parser.add_argument('-v', '--version', action='version',
                        version='git-deps {ver}'.format(ver=__version__))
    parser.add_argument('-l', '--log', dest='log', action='store_true',
                        help='Show commit logs for calculated dependencies')
    parser.add_argument('-j', '--json', dest='json', action='store_true',
                        help='Output dependencies as JSON')
    parser.add_argument('-s', '--serve', dest='serve', action='store_true',
                        help='Run a web server for visualizing the '
                        'dependency graph')
    parser.add_argument('-b', '--bind-ip', dest='bindaddr', type=str,
                        metavar='IP', default='127.0.0.1',
                        help='IP address for webserver to '
                        'bind to [%(default)s]')
    parser.add_argument('-p', '--port', dest='port', type=int, metavar='PORT',
                        default=5000,
                        help='Port number for webserver [%(default)s]')
    parser.add_argument('-r', '--recurse', dest='recurse', action='store_true',
                        help='Follow dependencies recursively')
    parser.add_argument('-e', '--exclude-commits', dest='exclude_commits',
                        action='append', metavar='COMMITISH',
                        help='Exclude commits which are ancestors of the '
                        'given COMMITISH (can be repeated)')
    parser.add_argument('-c', '--context-lines', dest='context_lines',
                        type=int, metavar='NUM', default=1,
                        help='Number of lines of diff context to use '
                        '[%(default)s]')
    parser.add_argument('-d', '--debug', dest='debug', action='store_true',
                        help='Show debugging')

    options, args = parser.parse_known_args()

    # Are we potentially detecting dependencies for more than one commit?
    # Even if we're not recursing, the user could specify multiple commits
    # via CLI arguments.
    options.multi = options.recurse

    if options.serve:
        if options.log:
            parser.error('--log does not make sense in webserver mode.')
        if options.json:
            parser.error('--json does not make sense in webserver mode.')
        if options.recurse:
            parser.error('--recurse does not make sense in webserver mode.')
        if len(args) > 0:
            parser.error('Specifying commit-ishs does not make sense in '
                         'webserver mode.')
    else:
        if len(args) == 0:
            parser.error('You must specify at least one commit-ish.')

    return options, args


def cli(options, args):
    detector = DependencyDetector(options)

    if options.json:
        listener = JSONDependencyListener(options)
    else:
        listener = CLIDependencyListener(options)

    detector.add_listener(listener)

    if len(args) > 1:
        options.multi = True

    for revspec in args:
        revs = GitUtils.rev_list(revspec)
        if len(revs) > 1:
            options.multi = True

        for rev in revs:
            try:
                detector.find_dependencies(rev)
            except KeyboardInterrupt:
                pass

    if options.json:
        print(json.dumps(listener.json(), sort_keys=True, indent=4))


def main(args):
    options, args = parse_args()
    # rev_list = sys.stdin.readlines()

    if options.serve:
        serve(options)
    else:
        sys.stdout = os.fdopen(sys.stdout.fileno(), 'w')
        try:
            cli(options, args)
        except InvalidCommitish as e:
            abort(e.message())


def run():
    main(sys.argv[1:])


if __name__ == "__main__":
    run()
