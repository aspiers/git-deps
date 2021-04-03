=========
Changelog
=========

Version 1.1.0
=============

- Improve support for Python 3.

- ALGORITHM CHANGE: only diff tree with first parent.

   Running ``git deps`` on ``FOO^!`` is effectively answering the
   question "which commits would I need in order to be able to cleanly
   cherry-pick commit ``FOO``?"  Drilling down further, that could be
   rephrased more precisely as "which commits would I need in my
   current branch in order to be able to cleanly apply the diff which
   commit ``FOO`` applies to its parent?"

   However, in the case where ``FOO`` is a merge commit with multiple
   parents, typically the first parent ``P1`` is the parent which is
   contained by the merge's target branch ``B1``.  That means that the
   merge commit ``FOO`` has the effect of applying the diff between
   ``P1``'s tree and the ``FOO``'s tree to ``P1``.  This could be
   expressed as::

     tree(P1) + diff(tree(P1), tree(FOO)) == tree(FOO)

   Therefore the question ``git deps`` needs to answer when operating
   on a commit with multiple parents is "which commits would I need in
   my current branch in order to be able to cleanly apply
   ``diff(tree(P1), tree(FOO))`` to it?"

   However, the current algorithm runs the blame analysis not only on
   ``diff(tree(P1), tree(FOO))``, but on ``diff(tree(Px), tree(FOO))``
   for *every* parent.  This is problematic, because for instance if
   the target branch contains commits which are not on ``P2``'s
   branch, then::

     diff(tree(P2), tree(FOO))

   will regress any changes provided by those commits.  This will
   introduce extra dependencies which incorrectly answer the above
   question we are trying to answer.

   Therefore change the algorithm to only diff against the first parent.

   This is very similar in nature to the ``-m`` option of ``git cherry-pick``:

   https://stackoverflow.com/questions/12626754/git-cherry-pick-syntax-and-merge-branches/12628579#12628579

   In the future it may be desirable to add an analogous ``-m`` option
   to ``git deps``.

- Add ``git-fixup``.

- Allow clean interruption via ``Control+C``.

- Fix output buffering issue.

- Upgrade jQuery.

- Improve debugging output.

- Refactor internals.

- Improve documentation.

Version 1.0.2
=============

- Improve documentation.

- Add a guide for maintainers.

- Add a tox environment for sdist building.

Version 1.0.1
=============

- Update dagre Javascript module to address security issues.

- Documentation improvements.

- Avoid PyScaffold bug.

- Repackage Javascript modules using newer npm, to avoid problem
  with timestamps which causes building of wheels to fail:
  https://github.com/npm/npm/issues/19968

Version 1.0.0
=============

- Turned into a proper Python module, using PyScaffold.
