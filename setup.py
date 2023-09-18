#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
    Setup file for git_deps.

    This file was generated with PyScaffold, a tool that easily
    puts up a scaffold for your new Python project. Learn more under:
    http://pyscaffold.readthedocs.org/
"""

import sys
from setuptools import setup


def setup_package():
    needs_sphinx = {'build_sphinx', 'upload_docs'}.intersection(sys.argv)
    sphinx = ['sphinx'] if needs_sphinx else []
    setup(
        setup_requires=[
            'six',
            'pyscaffold',
        ] + sphinx,
        long_description='README.md',
        long_description_content_type="text/markdown",
        use_pyscaffold=True
    )


if __name__ == "__main__":
    setup_package()
