#!/bin/sh

version=$(git describe --all --tags --long)
echo "Version = { id: '$version' };" > js/version.js

echo "Version updated to $version"