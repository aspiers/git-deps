#!/bin/bash

here=$(dirname $0)

test_repo=$here/test-repo

rm -rf $test_repo
mkdir $test_repo
cd $test_repo

git init
git config user.email git-deps-test@fake.address

# Start with three independently committed files

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
git commit -m 'one'
git tag one

for f in two three; do
    cp one $f
    git add $f
    git commit -m "$f"
    git tag "$f"
done

# Now start making changes

sed -i 's/three/three a/' one
git commit -am 'one: change three to three a'
git tag one-three-a  # depends on one

sed -i 's/three/three a/' two
git commit -am 'two: change three to three a'
git tag two-three-a  # depends on two

# Change non-overlapping part of previously changed file
sed -i 's/eight/eight a/' one
git commit -am 'one: change eight to eight a'
git tag one-eight-a  # depends on one

# Change previously changed line
sed -i 's/three a/three b/' one
git commit -am 'one: change three a to three b'
git tag one-three-b  # depends on one-three-a

