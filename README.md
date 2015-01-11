git-deps
========

`git-deps` is a tool for performing automatic analysis of dependencies
between commits in a [git](http://git-scm.com/) repository.

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

Motivation
----------

Sometimes it is useful to understand the nature of parts of this DAG,
as its nature will impact the success or failure of operations
including merge, rebase, cherry-pick etc.

For example when porting a commit "A" between git branches via git
cherry-pick, it can be useful to programmatically determine in advance
the minimum number of other dependent commits which would also need to
be cherry-picked to provide the context for commit "A" to cleanly
apply.

Another use case might be to better understand levels of specialism /
cross-functionality within an agile team.  If I author a commit which
modifies (say) lines 34-37 and 102-109 of a file, the authors of the
dependent commits forms a list which indicates the group of people I
should potentially consider asking to review my commit, since I'm
effectively changing "their" code.  Monitoring those relationships
over time might shed some light on how agile teams should best
coordinate efforts on shared code bases.

I'm sure there are other use cases I haven't yet thought of.  At first
I thought that it might provide a useful way to programmatically
predict whether operations such as merge / rebase / cherry-pick would
succeed, but actually it's probably cheaper and more reliable simply
to perform the operation and then roll back.

Note the dependency graph is likely to be semantically incomplete; for
example it would not auto-detect dependencies between a commit A which
changes code and another commit B which changes documentation or tests
to reflect the code changes in commit A.  (Although of course it's
usually best practice to logically group such changes together in a
single commit.)  But this should not stop it from being useful.

Installation
------------

Just copy or symlink `git-deps` so it's anywhere on your `$PATH`.

If you want to use the graph visualization web server functionality,
you will need to install some dependencies:

*   To install the required Javascript libraries, you will need
    [`npm`](https://www.npmjs.com/) installed, and then type:

        cd html
        npm install
        browserify -t coffeeify -d js/git-deps-graph.js -o js/bundle.js

*   You will need the [Flask](http://flask.pocoo.org/) Python
    module installed.

Usage
-----

The tool is not yet fully documented, but usage is fairly
self-explanatory if you run `git deps -h`.

Currently you should run it from the root (i.e. top directory) of the
git repository you want to examine; this is a
[known limitation](https://github.com/aspiers/git-deps/issues/27).

By default it will output all dependencies of the given commit-ish(s),
one per line.  With `--recurse`, it will traverse dependencies of
dependencies, and so on until it cannot find any more.  In recursion
mode, two SHA1s are output per line, indicating that the first depends
on the second.

If you run with the `--serve` option then it will start a lightweight
webserver and output a URL you can connect to for dynamically
visualizing and navigating the dependency graph.

Development / support / feedback
--------------------------------

Any kind of feedback is very welcome; please first check that your bug
/ issue / enhancement request is not already listed here:

*   https://github.com/aspiers/git-deps/issues

and if not then file a new issue.  If you prefer, you can mail
[the `git` mailing list](http://vger.kernel.org/vger-lists.html#git)
and cc: me `<git at adamspiers dot org>`.

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
policy, I have the luxury of being able to spending some of early
January 2015 working to bring this tool to the next level.  I have
submitted a
[Hack Week project page](https://hackweek.suse.com/11/projects/366)
and
[announced my intentions on the `git` mailing list](http://article.gmane.org/gmane.comp.version-control.git/262000).
