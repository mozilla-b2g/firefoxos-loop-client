'use strict'

module.exports = function(grunt) {
  // Creates a version of the app ready to be installed via a make reset-gaia
  // What is required for this:
  //  - application.zip (name matters)
  //  - metadata.json (with the app metadata - including remote manifest URL 
  //                   for updates)
  //  - update.webapp (current manifest as hosted in the manifest URL - if
  //                   different content is available, it would consider it 
  //                   an update) - This is optional
  // These three files will be moved to a folder with the same name as the
  // app origin (e.g. loop.mozilla.services.com) and available in the deliver
  // directory
  grunt.registerTask('embed-in-gaia', function() {
    // To avoid this task being invoked directly
    if (!grunt.config.get('origin')) {
       console.error("The embed-in-gaia target cannot be run directly.\n"+
           "Please run grunt [release|releaseDevelopment|releaseProduction]\n");
       return;
    }

    var done = this.async();
    var https = require('https');
    var fs = require('fs');

    // We need to update the manifestURL attribute in the metedata.json file
    var manifestURL = grunt.option('manifestUrl') || false;
    var outputDir = (process.env.GAIA_OUTOFTREE_DIR || "./deliver") + "/" +
                    grunt.config.get('origin');
    var metadataF = outputDir + "/metadata.json";
    var metadata = grunt.file.readJSON(metadataF);
    if (manifestURL) {
      metadata.manifestURL = manifestURL;
      grunt.file.write(metadataF, JSON.stringify(metadata, null, 2));
    }

    // In any case, let's try to get the current manifest to check for updates
    var file = fs.createWriteStream(outputDir + "/update.webapp");

    var request = https.get(metadata.manifestURL, function(response) {
      response.pipe(file);
      done();
    });
    request.on('error', function(e) {
      console.log("Error " + e.message + " downloading current manifest: " +
                 metadata.manifestURL);
      done();
    });
  });
}

