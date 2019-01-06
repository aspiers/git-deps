[![Code Climate](https://codeclimate.com/github/aspiers/git-deps/badges/gpa.svg)](https://codeclimate.com/github/aspiers/git-deps)

git-deps
========

`git-deps` is a tool for performing automatic analysis of dependencies
between commits in a [git](http://git-scm.com/) repository.  Here's
a screencast demonstration:

[![YouTube screencast](./images/youtube-thumbnail.png)](http://youtu.be/irQ5gMMz-gE)

I also spoke about the tool in
[episode #32 of the GitMinutes podcast](http://episodes.gitminutes.com/2015/03/gitminutes-32-adam-spiers-on-git-deps.html).

- [Background theory](#background-theory)
- [Motivation](#motivation)
- [Textual vs. semantic (in)dependence](#textual-vs-semantic-independence)
- [Development / support / feedback](#development--support--feedback)
- [History](#history)
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

Sometimes it is useful to understand the nature of parts of this DAG,
as its nature will impact the success or failure of operations
including merge, rebase, cherry-pick etc.

### Use case 1: porting between branches

For example when porting a commit "A" between git branches via `git
cherry-pick`, it can be useful to programmatically determine in advance
the minimum number of other dependent commits which would also need to
be cherry-picked to provide the context for commit "A" to cleanly
apply.  Here's a quick demo!

[![YouTube porting screencast](./images/youtube-porting-thumbnail.png)](http://youtu.be/DVksJMXxVIM)

**CAVEAT**: `git-deps` is not AI and only does a textual dependency
analysis, therefore it does not guarantee there is no simpler way to
backport.  It also may infer more dependencies than strictly necessary
due the default setting of one line of fuzz (diff context).  Shrinking
this to zero lines may produce a more conservative dependency tree,
but it's also riskier and more likely to cause conflicts or even bad
code on cherry-pick.  git-deps just provides a first estimate.

Therefore combining it with human analysis of the commits in the
dependency tree is strongly recommended.  This may reveal
opportunities for selective pruning or other editing of commits during
the backport process which may be able to reduce the number of commits
which are required.

### Use case 2: splitting a patch series

Large patch series or pull requests can be quite daunting for project
maintainers, since they are hard to conquer in one sitting.  For this
reason it's generally best to keep the number of commits in any
submission reasonably small.  However during normal hacking, you might
accumulate a large number of patches before you start to contemplate
submitting any of them upstream.  In this case, `git-deps` can help
you determine how to break them up into smaller chunks.  Simply run

    git deps -e $upstream_branch -s

and then create a graph starting from the head of your local
development branch, recursively expanding all the dependencies.  This
will allow you to untangle things and expose subgraphs which can be
cleanly split off into separate patch series or pull requests for
submission.

### Use case 3: aiding collaborative communication

Another use case might be to better understand levels of specialism /
cross-functionality within an agile team.  If I author a commit which
modifies (say) lines 34-37 and 102-109 of a file, the authors of the
dependent commits are people I should potentially consider asking to
review my commit, since I'm effectively changing "their" code.
Monitoring those relationships over time might shed some light on how
agile teams should best coordinate efforts on shared code bases.

### Use case 4: automatic squashing of fixup commits

It is often desirable to amend an existing commit which is in the
current branch but not at its head.  This can be done by creating a
new commit which amends (only) the existing commit, and then use `git
rebase --interactive` in order to squash the two commits together into
a new one which reuses the commit message from the original.
`git-commit[1]` has a nice feature which makes this process convenient
even when the commit to be amended is not at the head of the current
branch.  It is described in [the `git-commit[1]` man
page](https://git-scm.com/docs/git-commit):

> `--fixup=<commit>`
>
> Construct a commit message for use with `rebase --autosquash`.  The
> commit message will be the subject line from the specified commit
> with a prefix of `"fixup! "`. See `git-rebase[1]` for details.

The corresponding details in the [`git-rebase[1]` man
page](https://git-scm.com/docs/git-rebase) are:

> `--autosquash, --no-autosquash`
>
> When the commit log message begins with `"squash! ..."` (or `"fixup!
> ..."`), and there is already a commit in the todo list that matches
> the same ..., automatically modify the todo list of `rebase -i` so
> that the commit marked for squashing comes right after the commit to
> be modified, and change the action of the moved commit from pick to
> squash (or fixup). A commit matches the ...  if the commit subject
> matches, or if the ...  refers to the commit’s hash. As a fall-back,
> partial matches of the commit subject work, too. The recommended way
> to create fixup/squash commits is by using the `--fixup`/`--squash`
> options of `git-commit(1)`

However, this process still requires manually determining which commit
should be passed to the `--fixup` option.  Fortunately `git-deps` can
automate this for us.  To eliminate this extra work, this repository
provides a simple script which wraps around `git-deps` to automate the
whole process.  First the user should ensure that any desired
amendments to the existing commit are staged in git's index.  Then
they can run the `git-fixup` script which performs the following
steps:

1. These staged amendments to existing commit are committed using
   temporary commit message.

2. `git deps HEAD^!` is run to determine which previously existing
   commit this new commit is intended to "patch".  This should only
   result in a single dependency, otherwise the script aborts with an
   error.

3. The temporary commit's message is amended into the correct `fixup`
   form.  On the next `git rebase --interactive` which includes the
   original commit to be amended, `git-rebase` will automatically set
   up the sequencer to apply the amendment (fixup) into the original.

In the future, this script could be extended to optionally run the
interactive `rebase`, so that the whole amendment process is taken
care of by `git-fixup`.

### Other uses

I'm sure there are other use cases I haven't yet thought of.  If you
have any good ideas, [please submit them](CONTRIBUTING.md)!

### Non-use cases

At first I thought that `git-deps` might provide a useful way to
programmatically predict whether operations such as merge / rebase /
cherry-pick would succeed, but actually it's probably cheaper and more
reliable simply to perform the operation and then roll back.


Installation
------------

Please see [the `INSTALL.md` file](INSTALL.md).

Usage
-----

Usage is fairly self-explanatory if you run `git deps -h`:

```
usage: git-deps [options] COMMIT-ISH [COMMIT-ISH...]

Auto-detects commits on which the given commit(s) depend.

optional arguments:
  -h, --help            Show this help message and exit
  -v, --version         show program's version number and exit
  -l, --log             Show commit logs for calculated dependencies
  -j, --json            Output dependencies as JSON
  -s, --serve           Run a web server for visualizing the dependency graph
  -b IP, --bind-ip IP   IP address for webserver to bind to [127.0.0.1]
  -p PORT, --port PORT  Port number for webserver [5000]
  -r, --recurse         Follow dependencies recursively
  -e COMMITISH, --exclude-commits COMMITISH
                        Exclude commits which are ancestors of the given COMMITISH (can be repeated)
  -c NUM, --context-lines NUM
                        Number of lines of diff context to use [1]
  -d, --debug           Show debugging
```

Currently you should run it from the root (i.e. top directory) of the
git repository you want to examine; this is a
[known limitation](https://github.com/aspiers/git-deps/issues/27).

By default it will output the SHA1s of all dependencies of the given
commit-ish(s), one per line.  With `--recurse`, it will traverse
dependencies of dependencies, and so on until it cannot find any more.
In recursion mode, two SHA1s are output per line, indicating that the
first depends on the second.

### Web UI for visualizing and navigating the dependency graph

If you run it with the `--serve` option and no COMMIT-ISH parameters,
then it will start a lightweight webserver and output a URL you can
connect to for dynamically visualizing and navigating the dependency
graph.

Optionally choose a commit-ish (the form defaults to `master`), click
the `Submit` button, and you should see a graph appear with one node
per commit.  By hovering the mouse over a node you will see more
details, and a little `+` icon will appear which can be clicked to
calculate dependencies of that commit, further growing the dependency
tree.  You can zoom in and out with the mousewheel, and drag the
background to pan around.

If you set up a MIME handler for the `gitfile://` protocol during
setup, [as documented](INSTALL.md) you will be able to double-click on
nodes to launch a viewer to inspect individual commits in more detail.

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

Please see [the CONTRIBUTING file](CONTRIBUTING.md).

History
-------

This tool was born from experiences at
[SUSEcon](http://www.susecon.com/) 2013, when I attempted to help a
colleague backport a bugfix in [OpenStack](http://www.openstack.org/)
[Nova](http://docs.openstack.org/developer/nova/) from the `master`
branch to a stable release branch.  At first sight it looked like it
would only require a trivial `git cherry-pick`, but that immediately
revealed conflicts due to related code having changed in `master`
since the release was made.  I manually found the underlying commit
which the bugfix required by using `git blame`, and tried another
`cherry-pick`.  The same thing happened again.  Very soon I found
myself in a quagmire of dependencies between commits, with no idea
whether the end was in sight.

In coffee breaks during the ensuing openSUSE conference at the same
venue, I feverishly hacked together a prototype and it seemed to work.
Then normal life intervened, and no progress was made for another
year.

Thanks to SUSE's generous [Hack Week](https://hackweek.suse.com/)
policy, I had the luxury of being able to spending some of early
January 2015 working to bring this tool to the next level.  I
submitted a
[Hack Week project page](https://hackweek.suse.com/11/projects/366)
and
[announced my intentions on the `git` mailing list](http://article.gmane.org/gmane.comp.version-control.git/262000).

Again in May 2018 I took advantage of another Hack Week to package
`git-deps` properly as a Python module in order to improve the
installation process.  This was in preparation for demonstrating the
software at [a Meetup
event](https://www.meetup.com/londongit/events/248694943/) of the [Git
London User Group](https://www.meetup.com/londongit/).

License
-------

Released under [GPL version 2](LICENSE.txt) in order to be consistent with
[`git`'s license](https://github.com/git/git/blob/master/COPYING), but
I'm open to the idea of dual-licensing if there's a convincing reason.
