'use strict';

var mountFolder = function (connect, dir) {
  return connect.static(require('path').resolve(dir));
};

module.exports = function(grunt) {
  [
    'grunt-contrib-clean',
    'grunt-contrib-compress',
    'grunt-contrib-connect',
    'grunt-contrib-copy',
    'grunt-bower-task',
    'grunt-firefoxos',
    'grunt-git-describe',
    'grunt-html-build',
    'grunt-mocha'
  ].forEach(grunt.loadNpmTasks);

  grunt.initConfig({
    connect: {
      test: {
        options: {
          port: 9002,
          middleware: function (connect) {
            return [
              mountFolder(connect, '.tmp'),
              mountFolder(connect, 'test'),
              mountFolder(connect, 'app')
            ];
          }
        }
      }
    },

    mocha: {
      all: {
        options: {
          run: true,
          urls: ['http://127.0.0.1:9002/index.html'],
          bail: true,
          logErrors: true,
          reporter: 'Spec'
        }
      }
    },

    clean: {
      server: [
        '.tmp'
      ],
      preTest: [
        'test/index.html'
      ],
      postTest: [
        'src/'
      ],
      app: [
        'application.zip'
      ]
    },

    copy: {
      test: {
        files: [{
          expand: true,
          cwd: 'src',
          src: ['index.template.html'],
          dest: 'test',
          rename: function() {
            return 'test/index.html';
          }
        }]
      },
      build: {
          expand: true,
          cwd: 'app',
          src: ['**'],
          dest: 'build'
      },
      deliver: {
          expand: true,
          cwd: '.',
          src: ['application.zip', 'metadata.json'],
          dest: '<%= (process.env.GAIA_OUTOFTREE_DIR || "deliver") + "/" + grunt.config.get("origin") %>'
      }
    },

    // We use htmlbuild to add the tests dependencies to test/index.html
    // This avoid us to manually add the dependencies every time we add a
    // new test or script file.
    htmlbuild: {
      src: 'test/index.template.html',
      // "dest" is not working with the current htmlbuild version, so we need
      // to manually move src/index.html to test/index.html
      // dest: 'test/',
      options: {
        beautify: true,
        relative: true,
        scripts: {
          libs: 'app/libs/*.js',
          tokbox: 'app/libs/tokbox/**/*.js',
          helpers: 'app/js/helpers/*.js',
          screens: 'app/js/screens/*.js',
          js: 'app/js/*.js',
        }
      }
    },

    'git-describe': {
      options: {
        prop: 'meta.revision',
        failOnError: false
      },
      me: {}
    },

    bower: {
      install: {
        options: {
          targetDir: 'build/libs/components/',
          verbose: true,
          copy: false
        }
      }
    },

    compress: {
      release: {
        options: {
          archive: 'application.zip',
        },
        files: [{
          cwd: 'build',
          expand: true,
          src: '**/*'
        }]
      }
    },

    ffospush: {
      app: {
        appId: 'loop.services.mozilla.org',
        zip: 'application.zip'
      }
    }

  });

  grunt.registerTask('test', 'Launch tests in shell with PhantomJS', [
    'clean:server',
    'clean:preTest',
    'htmlbuild',
    'copy:test',
    'clean:postTest',
    'connect:test',
    'mocha'
  ]);

  grunt.registerTask('saveRevision', function() {
    // By default we enter the unknown string (in case someone uses a zip)
    // if this is git repo, it will be overwritten later on
    grunt.file.write('build/js/version.js', "Version = { id: 'unknown' };");
    grunt.event.once('git-describe', function (rev) {
      grunt.file.write('build/js/version.js', 'Version = { id: \'' +
        rev.object + '\' };');
    });
    grunt.task.run('git-describe');
  });

  grunt.registerTask('configureProduction', function() {
    grunt.option("loopServer", "production");
    grunt.option("metrics", "production");
    grunt.option("debug", false);
    grunt.option("enforceDevices", true);
    grunt.option("performanceLog", "false");
  });

  grunt.registerTask('configureDevelopment', function() {
    grunt.option("loopServer", "development");
    grunt.option("metrics", "stage");
    grunt.option("debug", true);
    grunt.option("enforceDevices", false);
    grunt.option("performanceLog", "persistent");
  });

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

  grunt.registerTask('configure', function() {
    // Device Compatibilty Configuration, when enabled, only
    // the ALCATELOneTouch6015X is allowed
    var enforceDevices = grunt.option('enforceDevices') || false;
    if (enforceDevices) {
      var compatibilityF = "build/compatibility.json";
      var compatibility = grunt.file.readJSON(compatibilityF);
      compatibility.device.names = ["ALCATELOneTouch6015X"];
      grunt.file.write(compatibilityF, JSON.stringify(compatibility, null, 2));
    }

    // Read manifest and config files and some configuration operations require
    // changes in both of them
    var manifestFile = "build/manifest.webapp";
    var manifest = grunt.file.readJSON(manifestFile); //get file as a string

    var configFile = "build/js/config.js";
    var config = grunt.file.read(configFile); //get file as a string

    // Configure debug parameter, just require changes in config.js
    var debug = grunt.option('debug') || false;
    var DEBUG_DEF_VAL = false;
    if (debug) {
      config = config.replace("debug: " + DEBUG_DEF_VAL + ",", "debug: true,");
    } else {
      config = config.replace("debug: " + DEBUG_DEF_VAL + ",", "debug: false,");
    }

    // Configure loop version, require changes in config.js for telemetry report
    // and manifest.webapp for marketplace
    var version = grunt.option('loopVersion');
    var VERSION_DEF_VAL = "1.1d";
    if (version != undefined) {
      config = config.replace("version: '" + VERSION_DEF_VAL + "',", 
                              "version: '" + version + "',");
      manifest.version = version;
      // And we write the same version in the version.js
      grunt.file.write('build/js/version.js', 'Version = { id: \'' + 
                       version + '\' }');
    }

    // Configure loop server, require changes in config.js for server config 
    // and manifest.webapp for app origin
    var loopServer = grunt.option('loopServer') || "production";
    var SERVER_DEF_VAL = "server_url: 'https://loop.services.mozilla.com'";
    var appOrigin = "loop.services.mozilla.com";
    var port = "";
    var protocol = "https";
    switch (loopServer) {
      case "stage":
        appOrigin = "loop.stage.mozaws.net";
        break;
      case "development":
        appOrigin = "loop-dev.stage.mozaws.net";
        break;
      case "production":
        appOrigin = "loop.services.mozilla.com";
        break;
      default:
        // Check if the configuration parameter includes a valid URL, if so,
        // we will configure it as the loop server, otherwise, fallback to 
        // default
        var url = require('url')
        var serverUrl = url.parse(loopServer);
        if (serverUrl.hostname != null){
          appOrigin = serverUrl.hostname;
          if (serverUrl.port != null) {
            port = ":" + serverUrl.port;
          }
          if (serverUrl.protocol == "http:") {
            config = config.replace("allowUnsecure: false",
                                    "allowUnsecure: true");
            protocol = "http"
          }
        }
        break;
    }
    config = config.replace(SERVER_DEF_VAL, "server_url: '" + protocol + "://" +
                            appOrigin + port + "'");
    manifest.origin = "app://" + appOrigin;
    grunt.config.set("origin", appOrigin);

    // Configure performance logs, require changes in config.js
    var performanceLog = grunt.option('performanceLog') || "disabled";
    var perfConfig = " performanceLog: { enabled: false, persistent: false}";
    switch (performanceLog) {
      case "persistent":
        perfConfig = " performanceLog: { enabled: true, persistent: true}";
        break;
      case "enabled":
        perfConfig = " performanceLog: { enabled: true, persistent: false}";
        break;
      case "disabled":
        perfConfig = " performanceLog: { enabled: false, persistent: false}";
        break;
    }
    config = config.replace(
                /\/\/.*?cfg perfLog\n\s*(.*?):((?:.|\s)*?)(?=(,?)\s*\/\/ end)/,
                                          "// cfg perfLog" + "\n" + perfConfig);

    // Configure metrics (telemetry and input.mozilla), changes only config.js
    var metrics = grunt.option('metrics') || "stage";
    var metricsConfig = "  metrics: { enabled: false, feedback: { " +
        "serverUrl: 'https://input.allizom.org/api/v1/feedback'}, telemetry:" +
        " { serverUrl: 'https://fxos.telemetry.mozilla.org/submit/telemetry'}}";
    switch (metrics) {
      case "production":
        metricsConfig = "  metrics: { enabled: true, feedback: { " +
        "serverUrl: 'https://input.mozilla.org/api/v1/feedback'}, telemetry:" +
        " { serverUrl: 'https://fxos.telemetry.mozilla.org/submit/telemetry'}}";
        break;
      case "stage":
        metricsConfig = "  metrics: { enabled: true, feedback: { " +
        "serverUrl: 'https://input.allizom.org/api/v1/feedback'}, telemetry:" +
        " { serverUrl: 'https://fxos.telemetry.mozilla.org/submit/telemetry'}}";
        break;
      case "disabled":
        metricsConfig = "  metrics: { enabled: false, feedback: { " +
        "serverUrl: 'https://input.allizom.org/api/v1/feedback'}, telemetry:" +
        " { serverUrl: 'https://fxos.telemetry.mozilla.org/submit/telemetry'}}";
        break;
    }
    config = config.replace(
               /\/\/.*?cfg metrics\n\s*(.*?):((?:.|\s)*?)(?=(,?)\s*\/\/ end)/,
                                       "// cfg metrics" + "\n" + metricsConfig);

    grunt.file.write(configFile, config);
    grunt.file.write(manifestFile, JSON.stringify(manifest, null, 2));
  });


  grunt.registerTask('build', 'Build app for dev', [
    'bower:install',
    'copy:build',
    'saveRevision',
    'configure',
    'compress:release',
    'ffospush:app'
  ]);

  grunt.registerTask('buildProduction', 'Build app for dev', [
    'bower:install',
    'copy:build',
    'configureProduction',
    'saveRevision',
    'configure',
    'compress:release',
    'ffospush:app'
  ]);

  grunt.registerTask('buildDevelopment', 'Build app for dev', [
    'bower:install',
    'copy:build',
    'configureDevelopment',
    'saveRevision',
    'configure',
    'compress:release',
    'ffospush:app'
  ]);

  grunt.registerTask('release', 'Build app for release', [
    'clean',
    'copy:build',
    'bower:install',
    'saveRevision',
    'test',
    'configure',
    'compress:release',
    'copy:deliver',
    'embed-in-gaia'
  ]);

  grunt.registerTask('releaseProduction', 'Build app for release', [
    'clean',
    'copy:build',
    'configureProduction',
    'bower:install',
    'saveRevision',
    'test',
    'configure',
    'compress:release',
    'copy:deliver',
    'embed-in-gaia'
  ]);

  grunt.registerTask('releaseDevelopment', 'Build app for release', [
    'clean',
    'copy:build',
    'configureDevelopment',
    'bower:install',
    'saveRevision',
    'test',
    'configure',
    'compress:release',
    'copy:deliver',
    'embed-in-gaia'
  ]);

  grunt.registerTask('default', ['build']);
};
