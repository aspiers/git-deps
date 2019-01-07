History of `git-deps`
=======================

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
