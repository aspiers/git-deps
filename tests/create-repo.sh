#!/bin/bash

here=$(dirname $0)

tag () {
    git tag "$@"
    echo -n "Hit Enter to continue ..."
    read
}

test_repo=$here/test-repo

rm -rf $test_repo
mkdir $test_repo
cd $test_repo

git init
git config user.email git-deps-test@fake.address

# Start with two independently committed files

for f in file-{a,b}; do
    cat <<EOF > $f
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

    git add $f
    git commit -m "create $f"
    tag $f
done

# Now start making changes

sed -i 's/three/three a/' file-a
git commit -am 'file-a: change three to three a'
tag file-a-three-a  # depends on file-a

sed -i 's/three/three a/' file-b
git commit -am 'file-b: change three to three a'
tag file-b-three-a  # depends on file-b

# Change non-overlapping part of previously changed file
sed -i 's/eight/eight a/' file-a
git commit -am 'file-a: change eight to eight a'
tag file-a-eight-a  # depends on file-a

# Change previously changed line
sed -i 's/three a/three b/' file-a
git commit -am 'file-a: change three a to three b'
tag file-a-three-b  # depends on file-a-three-a

