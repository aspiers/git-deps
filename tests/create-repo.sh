#!/bin/bash

here=$(dirname $0)
test_repo=$here/test-repo

new_file () {
    cat <<EOF > $1
one
two
three
four
five
six
seven
eight
nine
ten
EOF

    git add $1
    git commit -m "create $1"
    tag $1
}

tag () {
    git tag "$@"
    echo -n "Hit Enter to continue ..."
    read
}

edit () {
    file="$1"
    line="$2"
    new="$3"
    sed -i "s/^$line.*/$line $new/" $file
    git commit -am "$file: change $line to $line $new"
    tag $file-$line-$new
}

main () {
    rm -rf $test_repo
    mkdir $test_repo
    cd $test_repo

    git init
    git config user.email git-test@fake.address

    # Start with two independently committed files
    for f in file-{a,b}; do
        new_file $f
    done

    # Now start making changes
    edit file-a three foo  # depends on file-a tag
    edit file-b three bar  # depends on file-b tag

    # Change non-overlapping part of previously changed file
    edit file-a eight foo  # depends on file-a tag

    # Change previously changed line
    edit file-a three baz  # depends on file-a-three-a tag
}

feature () {
    cd $test_repo

    # Start a feature branch
    git checkout -b feature file-b-three-bar
    new_file file-c
    edit file-c four foo
    edit file-c ten qux

    git checkout master
}

# For demonstrating a backporting use-case
port () {
    cd $test_repo

    # Add some more commits to master
    edit file-b four qux
    edit file-a two wibble
    edit file-a nine wobble

    # Start a stable branch
    git checkout -b stable file-a-three-foo
    edit file-a three blah

    git checkout master
}

case "$1" in
    feature)
        feature
        ;;
    port)
        main
        port
        ;;
    *)
        main
        ;;
esac

exit 0
