[![Code Climate](https://codeclimate.com/github/aspiers/git-deps/badges/gpa.svg)](https://codeclimate.com/github/aspiers/git-deps)

git-deps
========

`git-deps` is a tool for performing automatic analysis of dependencies
between commits in a [git](http://git-scm.com/) repository.  Here's
a screencast demonstration:

[![YouTube screencast](./images/youtube-thumbnail.png)](http://youtu.be/irQ5gMMz-gE)

I have [blogged about `git-deps` and related
tools](https://blog.adamspiers.org/2018/06/14/git-auto-magic/), and
also publically spoken about the tool several times:

- [a presentation at the openSUSE Summit in Nashville, Apr 2019](https://aspiers.github.io/nashville-git-automagic-april-2019/)
- [a presentation at the OpenStack PTG in Denver, Sept 2018](https://aspiers.github.io/denver-git-automagic-sept-2018/) ([watch the video](https://youtu.be/f6anrSKCIgI))
- [a presentation at the London Git User Meetup in May 2018](https://aspiers.github.io/london-git-automagic-may-2018/) ([watch the video](https://skillsmatter.com/skillscasts/11825-git-auto-magic))
- [episode #32 of the GitMinutes podcast in 2015](http://episodes.gitminutes.com/2015/03/gitminutes-32-adam-spiers-on-git-deps.html)


Contents
--------

- [Background theory](#background-theory)
- [Motivation](#motivation)
  - [Use case 1: porting between branches](USE-CASES.md#use-case-1-porting-between-branches)
  - [Use case 2: splitting a patch series into independent topics](USE-CASES.md#use-case-2-splitting-a-patch-series-into-independent-topics)
  - [Use case 3: aiding collaborative communication](USE-CASES.md#use-case-3-aiding-collaborative-communication)
  - [Use case 4: automatic squashing of fixup commits](USE-CASES.md#use-case-4-automatic-squashing-of-fixup-commits)
  - [Use case 5: rewriting commit history](USE-CASES.md#use-case-5-rewriting-commit-history)
- [Installation](INSTALL.md)
- [Usage](USAGE.md)
- [Textual vs. semantic (in)dependence](#textual-vs-semantic-independence)
- [Development / support / feedback](#development--support--feedback)
- [History](HISTORY.md)
- [Credits](#credits)
- [License](#license)


Background theory
-----------------

It is fairly clear that two git commits within a single repo can be
considered "independent" from each other in a certain sense, if they
do not change the same files, or if they do not change overlapping
parts of the same file(s).

In contrast, when a commit changes a line, it is "dependent" on not
only the commit which last changed that line, but also any commits
which were responsible for providing the surrounding lines of context,
because without those previous versions of the line and its context,
the commit's diff might not cleanly apply (depending on how it's being
applied, of course).  So all dependencies of a commit can be
programmatically inferred by running git-blame on the lines the commit
changes, plus however many lines of context make sense for the use
case of this particular dependency analysis.

Therefore the dependency calculation is impacted by a "fuzz" factor
parameter
(c.f. [patch(1)](http://en.wikipedia.org/wiki/Patch_(Unix))), i.e. the
number of lines of context which are considered necessary for the
commit's diff to cleanly apply.

As with many dependency relationships, these dependencies form edges
in a DAG (directed acyclic graph) whose nodes correspond to commits.
Note that a node can only depend on a subset of its ancestors.

### Caveat

It is important to be aware that any dependency graph inferred by
`git-deps` may be semantically incomplete; for example it would not
auto-detect dependencies between a commit A which changes code and
another commit B which changes documentation or tests to reflect the
code changes in commit A.  Therefore `git-deps` should not be used
with blind faith.  For more details, see [the section on Textual
vs. semantic (in)dependence](#textual-vs-semantic-independence) below.


Motivation
----------

Sometimes it is useful to understand the nature of parts of this
dependency graph, as its nature will impact the success or failure of
operations including merge, rebase, cherry-pick etc.  Please see [the
`USE-CASES.md` file](USE-CASES.md) for more details.


Installation
------------

Please see [the `INSTALL.md` file](INSTALL.md).


Usage
-----

Please see [the `USAGE.md` file](USAGE.md).


Textual vs. semantic (in)dependence
-----------------------------------

Astute readers will note that textual independence as detected by
`git-deps` is not the same as semantic / logical independence.
Textual independence means that the changes can be applied in any
order without incurring conflicts, but this is not a reliable
indicator of logical independence.

For example a change to a function and corresponding changes to the
tests and/or documentation for that function would typically exist in
different files.  So if those changes were in separate commits within
a branch, running `git-deps` on the commits would not detect any
dependency between them even though they are logically related,
because changes in different files (or even in different areas of the
same files) are textually independent.

So in this case, `git-deps` would not behave exactly how we might
want.  And for as long as AI is an unsolved problem, it is very
unlikely that it will ever develop totally reliable behaviour.  So
does that mean `git-deps` is useless?  Absolutely not!

Firstly, when [best
practices](https://crealytics.com/blog/5-reasons-keeping-git-commits-small/)
for [commit
structuring](https://wiki.openstack.org/wiki/GitCommitMessages#Structural_split_of_changes)
are adhered to, changes which are strongly logically related should be
placed within the same commit anyway.  So in the example above, a
change to a function and corresponding changes to the tests and/or
documentation for that function should all be within a single commit.
(Although this is not the only valid approach; for a more advanced
meta-history grouping mechanism, see
[`git-dendrify`](https://github.com/bennorth/git-dendrify).)

Secondly, whilst textual independence does not imply logical
independence, the converse is expected to be more commonly true:
logical independence often implies textual independence (or stated
another way, textual dependence often implies logical dependence).  So
while it might not be too uncommon for `git-deps` to fail to detect
the dependency between logically-related changes, it should be rarer
that it incorrectly infers a dependency between logically unrelated
changes.  In other words, its false negatives are generally expected
to be more common than its false positives.  As a result it is likely
to be more useful in determining a lower bound on dependencies than an
upper bound.  Having said that, more research is needed on this.

Thirdly, it is often unhelpful to allow [the quest for the perfect
become the enemy of the
good](https://en.wikipedia.org/wiki/Perfect_is_the_enemy_of_good) - a
tool does not have to be perfect to be useful; it only has to be
better than performing the same task without the tool.

Further discussion on some of these points can be found in [an old
thread from the git mailing
list](https://public-inbox.org/git/20160528112417.GD11256@pacific.linksys.moosehall/).

Ultimately though, ["the proof is in the
pudding"](https://en.wiktionary.org/wiki/the_proof_is_in_the_pudding),
so try it out and see!


Development / support / feedback
--------------------------------

Please see [the `CONTRIBUTING.md` file](CONTRIBUTING.md).


History
-------

Please see [the `HISTORY.md` file](HISTORY.md).


Credits
------

Special thanks to [SUSE](https://suse.com) for partially sponsoring
the development of this software.  Thanks also to everyone who has
contributed code, bug reports, and other feedback.


License
-------

Released under [GPL version 2](LICENSE.txt) in order to be consistent with
[`git`'s license](https://github.com/git/git/blob/master/COPYING), but
I'm open to the idea of dual-licensing if there's a convincing reason.
