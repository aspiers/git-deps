Installation
============

`git-deps` requires [pygit2](http://www.pygit2.org/), which in return
requires [libgit2](https://libgit2.github.com/).  `git-deps` and
pygit2 are both Python modules, but libgit2 is not.  This means
that there are a few ways to approach installation, detailed below.
Corrections and additions to these instructions are very welcome!

Before you pick an option, it is very important to consider that [only
certain combinations of libgit2 and pygit2 will work
together](http://www.pygit2.org/install.html#version-numbers).

Also, Python 2.x is no longer supported for `git-deps`, although as of
April 2021 it may still work if you are lucky and know what you are
doing.

## Option 0 (easiest): let `pip` take care of everything

As mentioned in [`pygit2`'s installation
instructions](https://www.pygit2.org/install.html), `pip` 19.0 and
later can install binary wheels of `pygit2` which include `libgit2`.
This makes installation considerably easier, and should be as simple
as:

    sudo pip3 install git-deps

or just for the current user:

    pip3 install --user git-deps

For a per-user install, you will probably have to also ensure that you
have `~/.local/bin` on your path.  See [the `pip`
documentation](https://pip.pypa.io/en/stable/) if you are unsure how
this works.

Also note that it may be `pip` rather than `pip3` on your system, but
if so run `pip --version` to make sure that you aren't getting a
Python 2.x environment by mistake.

## Option 1: Install pygit2 and libgit2 from OS packages, and `git-deps` as a Python module

### Install OS packages

if you are using Linux, there is a good chance that your distribution
already offers packages for both pygit2 and libgit2, in which case
installing pygit2 from packages should also automatically install
libgit2.  For example, on openSUSE, just do something like:

    sudo zypper install python38-pygit2

Note that this assumes Python 3.8, which is the latest at the time of
writing.

Similarly, on Debian:

    sudo apt-get install python3-pygit2

pygit2's website also has installation instructions for
[Windows](http://www.pygit2.org/install.html#installing-on-windows)
and [Mac OS](http://www.pygit2.org/install.html#installing-on-os-x).

### Install `git-deps` via `pip`

Finally, install `git-deps` via `pip`, for example system-wide on
Linux via:

    sudo pip3 install git-deps

or just for the current user:

    pip3 install --user git-deps

(See the caveats in option 0 above about `pip` vs. `pip3` and per-user
installs.)

## Option 2: Install libgit2 from OS packages, and `git-deps` / pygit2 as Python modules

In this case it may be enough to install libgit2 via your
distribution's packaging tool, e.g. on openSUSE:

    sudo zypper install libgit2-24

Then install `git-deps` via `pip` as described in option 1 above.
This should also automatically install pygit2 as one of its
dependencies.  However be aware that this will pick a pygit2 version
based on [`requirements.txt`](requirements.txt) from `git-deps`, which
may not be compatible with the libgit2 you have installed from OS
packages.  This can be fixed by telling `pip install` which version of
pygit2 you want.  For example if you have installed libgit2
0.24.0, you could do:

    pip install pygit2==0.24 git-deps

## Option 3: Install everything from source

First follow
[the installation instructions for pygit2](http://www.pygit2.org/install.html).

Then clone this repository and follow the standard Python module
installation route, e.g.

    python setup.py install

or if you want to hack on git-deps:

    pip install -e .

## Option 4: Installation via Docker

Rather than following the above manual steps, you can try
[an alternative approach created by Paul Wellner Bou which facilitates running `git-deps` in a Docker container](https://github.com/paulwellnerbou/git-deps-docker).
This has been tested on Ubuntu 14.10, where it was used as a way to
circumvent difficulties with installing libgit2 >= 0.22.

## Check installation

Now `git-deps` should be on your `$PATH`, which means that executing
it and also `git deps` (with a space, not a hyphen) should both work.

## Install support for web-based graph visualization (`--serve` option)

The web-based graph visualization code uses Javascript and relies on
many third-party modules.  If you've installed `git-deps` via `pip`
then these files should all be magically installed without any extra
effort, so you can skip reading the rest of this section.

If however you are installing `git-deps` from source and you want to
use the shiny new graph visualization web server functionality, you
will need to fetch these Javascript libraries yourself.  Currently
only one approach to installation is listed below, but any Javascript
experts who have suggestions about other ways to install are [warmly
encouraged to submit them](CONTRIBUTING.md).

*   To install the required Javascript libraries, you will need
    [`npm`](https://www.npmjs.com/) installed, and then type:

        cd git_deps/html
        npm install
        node_modules/.bin/browserify -t coffeeify -d js/git-deps-graph.coffee -o js/bundle.js

    (If you are developing `git-deps` then replace `browserify` with
    `watchify -v` in order to continually regenerate `bundle.js`
    whenever any of the input files change.)

*   Optionally install `browserify` globally so that it's on your
    `$PATH` and therefore executable directly rather than having to
    specify the `node_modules/.bin` prefix.  For example (at least on
    Linux) you can use the `-g` option of `npm` by running this as
    `root`:

         npm install -g browserify

*   You will need the [Flask](http://flask.pocoo.org/) Python module
    installed, but that should have already been taken care of by the
    base installation described above (e.g. via `pip`).

Now you should be able to run `git deps --serve` and point your
browser at the URL it outputs.

### Setting up a `gitfile://` URL handler

It is possible to set a `gitfile://` URL handler so that if you
double-click any commit node on the dependency graph, your browser
will launch that handler with a URL which points to that commit within
the repository path on your local filesystem.  So if you configure
your browser desktop environment, you can have a program such as
[`gitk`](http://git-scm.com/docs/gitk) launch for viewing further
details of that commit.  Obviously this only makes sense when viewing
the graph via http://localhost.

On most Linux machines, this can be set up by first locating the
[Desktop
Entry](https://standards.freedesktop.org/desktop-entry-spec/latest/)
file which is provided in the distribution for convenient
installation:

    pip show -f git-deps | grep gitfile-handler.desktop

Once you have located it, it needs to be copied or symlinked into the
right location, e.g.

    ln -sf /usr/share/git_deps/gitfile-handler.desktop \
        ~/.local/share/applications

and then the desktop file has to be registered as a handler for the
`gitfile` protocol:

    xdg-mime default gitfile-handler.desktop x-scheme-handler/gitfile
