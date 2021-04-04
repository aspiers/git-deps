.. _release:

==================
 Maintainer guide
==================

This guide contains a playbook for tasks the maintainer will need to
perform.


Initial setup
=============

- Create a PyPI account

- Configure ``~/.pypirc`` with credentials

- ``pip install twine``


How to make a new release of git-deps
=====================================

- Ensure everything is committed and the git working tree is clean.

- Ensure all change have been pushed to the remote branch.

- Run ``tox`` to check everything is OK.

- Decide a new version, e.g.::

    version=1.1.0

  Release candidates should take the form ``1.2.3rc4``.

- ``git tag -s $version``

- ``tox -e sdist``

- ``twine upload .tox/dist/git-deps-$version.zip``

- Check the new version appears at `<https://pypi.org/project/git-deps/>`_.

- Test installation via at least one of the documented options, e.g.
  ``pip install git-deps`` within a virtualenv.

- Test / update the Docker-based installation.
