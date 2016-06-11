Installation
============

`git-deps` requires [pygit2](http://www.pygit2.org/), which in return
requires [libgit2](https://libgit2.github.com/).  `git-deps` and
pygit2 are both Python modules, but libgit2 is not.  This means
that there are a few ways to approach installation, detailed below.
Corrections and additions to these instructions are very welcome!

## Option 1: Install pygit2 and libgit2 from OS packages, and `git-deps` as a Python module

if you are using Linux, there is a good chance that your distribution
already offers packages for both pygit2 and libgit2, in which case
installing pygit2 from packages should also automatically install
libgit2.  For example, on openSUSE, just do:

    sudo zypper install python-pygit2

or on Debian:

    sudo apt-get install python-pygit2

and then install `git-deps`:

    pip install git-deps

## Option 2: Install libgit2 from OS packages, and `git-deps` / pygit2 as Python modules

In this case it should be enough to install libgit2 via your
distribution's packaging tool, e.g. on openSUSE:

    sudo zypper install libgit2-22

Then install `git-deps` which should also automatically install pygit2:

    pip install git-deps

## Option 3: Install everything from source

First follow
[the installation instructions for pygit2](http://www.pygit2.org/install.html).

Then clone this repository and follow the standard Python module
installation route, e.g.

    python setup.py install

## Option 4: Installation via Docker

Rather than following the above manual steps, you can try
[an alternative approach created by Paul Wellner Bou which facilitates running `git-deps` in a Docker container](https://github.com/paulwellnerbou/git-deps-docker).
This has been tested on Ubuntu 14.10, where it was used as a way to
circumvent difficulties with installing libgit2 >= 0.22.

## Check installation

Now `git-deps` should be on your `$PATH`, which means that executing
`git deps` (with a space, not a hyphen) should also work.

## Install support for web-based graph visualization (`--serve` option)

If you want to use the shiny new graph visualization web server
functionality, you will need to install some additional dependencies:

*   As `root`, install the command line version of `browserify` with

         npm install -g browserify
*   To install the required Javascript libraries, you will need
    [`npm`](https://www.npmjs.com/) installed, and then type:

        cd git_deps/html
        npm install
        browserify -t coffeeify -d js/git-deps-graph.coffee -o js/bundle.js

    (If you are developing `git-deps` then replace `browserify` with
    `watchify -v` in order to continually regenerate `bundle.js`
    whenever any of the input files change.)
*   You will need the [Flask](http://flask.pocoo.org/) Python
    module installed.

Then `git deps --serve` should work.
