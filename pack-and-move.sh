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
mkdir deliver/loop.services.mozilla.com

# Pack application.zip file.
zip -r deliver/loop.services.mozilla.com/application.zip manifest.webapp \
                                                         launcher.html \
                                                         js \
                                                         libs \
                                                         locales \
                                                         locales-obj \
                                                         sketch_loop \
                                                         style \
                                                         test_app \
                                                         resources
# Add some other files.
cp update.webapp deliver/loop.services.mozilla.com/
cp metadata.json deliver/loop.services.mozilla.com/

# Move the app to the destination folder.
cp -r deliver/loop.services.mozilla.com/ $1

echo "Done, you should reinstall Gaia now."
