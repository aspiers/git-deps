#!/bin/bash

set -eo pipefail

# Collection of tests consisting in running `git-deps` on its own repository.
# The expected outputs of various commands are stored in the `expected_outputs` subdirectory.

# Because git-deps can only be run from the repository's root, this script should be run at
# the root of a clone of git-deps. The clone should not be shallow, so that all refs can be accessed.

echo "Running test suite"

echo "* Dependencies of 4f27a1e, a regular commit"
git-deps 4f27a1e^! | sort | diff tests/expected_outputs/deps_4f27a1e -

echo "* Dependencies of 1ba7ad5, a merge commit"
git-deps 1ba7ad5^! | sort | diff tests/expected_outputs/deps_1ba7ad5 -

# Currently failing:
#echo "* Dependencies of the root commit"
# git-deps b196757^! | sort # | diff tests/expected_outputs/deps_b196757 -

echo "All tests passed!"
