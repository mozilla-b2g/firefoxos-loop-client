#!/bin/sh

version=$(git rev-parse --short HEAD)
mkdir -p output
zip -r output/application_$version.zip manifest.webapp \
                                       index.html \
                                       js \
                                       libs \
                                       locales \
                                       call_screen \
                                       style \
                                       resources > /dev/null 2>&1

