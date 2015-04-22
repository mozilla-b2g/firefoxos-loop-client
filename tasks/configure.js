'use strict'

module.exports = function(grunt) {

  var FEEDBACK_SERVER_STAGE = 'https://input.allizom.org/api/v1/feedback';
  var FEEDBACK_SERVER_PRODUCTION = 'https://input.mozilla.org/api/v1/feedback';
  var TELEMETRY_SERVER = 'https://fxos.telemetry.mozilla.org/submit/telemetry';

  grunt.registerTask('configureProduction', function() {
    grunt.option("loopServer", "production");
    grunt.option("metrics", "production");
    grunt.option("debug", false);
    grunt.option("enforceDevices", false);
    grunt.option("performanceLog", "false");
  });

  grunt.registerTask('configureDevelopment', function() {
    grunt.option("loopServer", "development");
    grunt.option("metrics", "stage");
    grunt.option("debug", true);
    grunt.option("enforceDevices", false);
    grunt.option("performanceLog", "persistent");
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
    // Note that this is frugly because config.js currently is frugly. Config is
    // defined as a global object without any context, so it'll end in
    // window. But OTProperties on the other hand is explicitly defined as
    // window.OTProperties. To make this short, if the config file format
    // changes at some point, this *will* have to be changed also.
    var wConfig = (
      new Function(
        "window",
        grunt.file.read(configFile) +
        "; return { Config: Config, OTProperties: window.OTProperties };")
      )({});

    var config = wConfig.Config;

    // Configure debug parameter, just require changes in config.js
    config.debug = grunt.option('debug') || false;

    // Configure loop version, require changes in config.js for telemetry report
    // and manifest.webapp for marketplace
    var version = grunt.option('loopVersion');
    if (version != undefined) {
      config.version = version;
      manifest.version = version;
    }

    // Configure loop server, require changes in config.js for server config
    // and manifest.webapp for app origin
    var loopServer = grunt.option('loopServer') || "production";
    var appOrigin = "loop.services.mozilla.com";
    var port = "";
    var protocol = "https";
    var locales, i;
    switch (loopServer) {
      case "stage":
        appOrigin = "loop.stage.mozaws.net";
        manifest.name = "Hello Stage";
        locales = manifest.locales;
        for (i in locales) {
          locales[i].name = "Hello Stage";
        }
        break;
      case "development":
        appOrigin = "loop-dev.stage.mozaws.net";
        manifest.name = "Hello Dev";
        locales = manifest.locales;
        for (i in locales) {
          locales[i].name = "Hello Dev";
        }
        break;
      case "production":
        appOrigin = "loop.services.mozilla.com";
        break;
      default:
        // Check if the configuration parameter includes a valid URL, if so,
        // we will configure it as the loop server, otherwise, fallback to 
        // default
        var url = require('url');
        var serverUrl = url.parse(loopServer);
        if (serverUrl.hostname != null) {
          appOrigin = serverUrl.hostname;
          manifest.name = "Hello " + appOrigin;
          locales = manifest.locales;
          for (i in locales) {
            locales[i].name = "Hello " + appOrigin;
          }
          if (serverUrl.port != null) {
            port = ":" + serverUrl.port;
          }
          if (serverUrl.protocol == "http:") {
            config.allowUnsecure = true;
            protocol = "http";
          }
        }
        break;
    }
    config.server_url = protocol + "://" + appOrigin + port;
    manifest.origin = "app://" + appOrigin;
    grunt.config.set("origin", appOrigin);

    // Configure performance logs, require changes in config.js
    config.performanceLog.enabled = false;
    config.performanceLog.persistent = false;
    var performanceLog = grunt.option('performanceLog') || "disabled";
    switch (performanceLog) {
      case "persistent":
        config.performanceLog.enabled = true;
        config.performanceLog.persistent = true;
        break;
      case "enabled":
        config.performanceLog.enabled = true;
        break;
    }

    // Configure metrics (telemetry and input.mozilla), changes only config.js
    config.metrics.enabled = false;
    config.metrics.feedback.serverUrl = FEEDBACK_SERVER_STAGE;
    config.metrics.telemetry.serverUrl = TELEMETRY_SERVER;
    var metrics = grunt.option('metrics') || "stage";
    switch (metrics) {
      case "stage":
        config.metrics.enabled = true;
        break;
      case "production":
        config.metrics.enabled = true;
        config.metrics.feedback.serverUrl = FEEDBACK_SERVER_PRODUCTION;
        break;
    }

    grunt.file.write(configFile, JSON.stringify(config, null, 2));
    grunt.file.write(configFile,
                     "Config = " + JSON.stringify(config, null, 2) +
                     ";\n\nwindow.OTProperties = " +
                     JSON.stringify(wConfig.OTProperties, null, 2) + ";\n");
    grunt.file.write(manifestFile, JSON.stringify(manifest, null, 2));
  });
}

