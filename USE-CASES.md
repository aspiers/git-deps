`git-deps` use cases
======================

Several use cases for `git-deps` are listed in detail below.  They are
also [mentioned in the presentation I gave in September
2018](https://aspiers.github.io/denver-git-automagic-sept-2018/#/git-deps-motivation)
(see also [the video](https://youtu.be/f6anrSKCIgI?t=216)).

- [Use case 1: porting between branches](#use-case-1-porting-between-branches)
- [Use case 2: splitting a patch series into independent topics](#use-case-2-splitting-a-patch-series-into-independent-topics)
- [Use case 3: aiding collaborative communication](#use-case-3-aiding-collaborative-communication)
- [Use case 4: automatic squashing of fixup commits](#use-case-4-automatic-squashing-of-fixup-commits)
- [Use case 5: rewriting commit history](#use-case-5-rewriting-commit-history)

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

### Use case 2: splitting a patch series into independent topics

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

In fact this technique is sufficiently useful but tedious to do
manually that I wrote a whole separate tool
[`git-explode`](https://github.com/aspiers/git-explode) to automate
the process.  It uses `git-deps` as a library module behind the scenes
for the dependency inference.  See [the
`README`](https://github.com/aspiers/git-explode/blob/master/README.rst)
for more details.

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

### Use case 5: rewriting commit history

It is often useful to reorder or rewrite commit history within private
branches, as part of a history polishing process which ensures that
eventually published history is of a high quality (see ["On Sausage
Making"](https://sethrobertson.github.io/GitBestPractices/#sausage)).

However reordering or removing commits can cause conflicts.  Whilst
`git-deps` can programmatically predict whether operations such as
merge / rebase / cherry-pick would succeed, actually it's probably
cheaper and more reliable simply to perform the operation and then
roll back.  However `git-deps` could be used to detect ways to avoid
these conflicts, for example reordering or removing a commit's
dependencies along with the commit itself.  In the future tools could
be built on top of `git-deps` to automate these processes.

### Other uses

I'm sure there are other use cases I haven't yet thought of.  If you
have any good ideas, [please submit them](CONTRIBUTING.md)!
