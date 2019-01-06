How to use `git-deps`
=======================

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


Web UI for visualizing and navigating the dependency graph
----------------------------------------------------------

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
