#!/bin/bash

echo_abort()
{
  echo "Need to provide the destination folder."
  echo "You might want to move the app to your <GAIA_HOME>/outoftree_apps/ folder."
  echo "Abort."
}

#set -x

if [ $# -eq 0 ]; then
  echo_abort
  exit -1
fi

# Delete and create the deliver destination dir.
rm -rf deliver && mkdir deliver

# Create dir where to copy the app to.
mkdir deliver/loop.dev.mozaws.net

# Pack application.zip file.
zip -r deliver/loop.dev.mozaws.net/application.zip manifest.webapp \
                                                         index.html \
                                                         js \
                                                         libs \
                                                         locales \
                                                         call_screen \
                                                         style \
                                                         resources
# Add some other files.
cp update.webapp deliver/loop.dev.mozaws.net/
cp metadata.json deliver/loop.dev.mozaws.net/

# Move the app to the destination folder.
cp -r deliver/ $1

echo "Done, you should reinstall Gaia now."
