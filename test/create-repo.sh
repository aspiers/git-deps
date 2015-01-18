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

cat <<EOF > one
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

git add one
git commit -m 'create file one'
tag one

for f in two; do
    cp one $f
    git add $f
    git commit -m "create file $f"
    tag "$f"
done

# Now start making changes

sed -i 's/three/three a/' one
git commit -am 'one: change three to three a'
tag one-three-a  # depends on one

sed -i 's/three/three a/' two
git commit -am 'two: change three to three a'
tag two-three-a  # depends on two

# Change non-overlapping part of previously changed file
sed -i 's/eight/eight a/' one
git commit -am 'one: change eight to eight a'
tag one-eight-a  # depends on one

# Change previously changed line
sed -i 's/three a/three b/' one
git commit -am 'one: change three a to three b'
tag one-three-b  # depends on one-three-a

