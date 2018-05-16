#!/usr/bin/env python
# -*- coding: utf-8 -*-

# import pytest

from git_deps.gitutils import GitUtils


def test_abbreviate_sha1():
    sha1 = GitUtils.abbreviate_sha1("HEAD")
    assert len(sha1) == 7
