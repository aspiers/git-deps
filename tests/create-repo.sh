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
    git config user.email git-deps-test@fake.address

    # Start with two independently committed files
    for f in file-{a,b}; do
        new_file $f
    done

    # Now start making changes
    edit file-a three a  # depends on file-a tag
    edit file-b three a  # depends on file-b tag

    # Change non-overlapping part of previously changed file
    edit file-a eight a  # depends on file-a tag

    # Change previously changed line
    edit file-a three b  # depends on file-a-three-a tag
}

main
