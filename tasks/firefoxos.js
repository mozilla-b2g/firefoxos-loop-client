'use strict';

module.exports = function (grunt) {
  var path = require('path');
  var Promise = require('promise');
  var localPort = 'tcp:6000';
  var remotePort = 'localfilesystem:/data/local/debugger-socket';
  var portForwarded = false;
  var ADB = require('adb').DebugBridge;
  var adb = new ADB();

  grunt.registerMultiTask('ffospush', 'Pushes an app to the device', function () {
    var done = this.async();

    var connect = require('node-firefox-connect');
    var installApp = require('node-firefox-install-app');

    var port = this.data.localPort || this.localPort;
    var portNumber = port.split(':')[1];
    var appPath = this.data.appPath || "./build/";

    ensurePortForwarded().then(function onForward() {
      console.log('Please be patient as this may take some time'.blue);
      connect(portNumber).then(function(client) {
        installApp({appPath: appPath, client: client }).then(
          function(appId) {
              
            console.log('App successfully installed'.green);
            console.log('appId = ' + appId);
            done();
          }, function(error) {
            console.error('App could not be installed: ', error);
            done();
          });
      }, function(error) {
        console.error("Connection Failed: ", error)
        done();
      });
    });
  });

  grunt.registerMultiTask('ffosstop', 'Stops an application', function () {
    var done = this.async();
    console.log("Starting interaction with the device, please accept the prompts on it (if any)".blue)
    console.log("You can disable the prompts in the device by setting the property devtools.debugger.prompt-connection to false".blue)

    var connect = require('node-firefox-connect');
    var stopApp = require('node-firefox-stop-app');

    var port = this.data.localPort || this.localPort;
    var portNumber = port.split(':')[1];

    var manifestLocation = "app://" + this.data.appId + "/manifest.webapp";
    ensurePortForwarded(port).then(function onForward() {
      connect(portNumber).then(
        function(client) {
          stopApp({ client: client, manifestURL: manifestLocation }).then(
            function(result) {
              console.log('App stopped successfully'.green);
              done();
            }, function(err) {
              console.error('Could not stop app', err);
              done();
          });
       }, function(err){
          console.error("Could not connect ", err);
          done();
       });
    });
  });

  grunt.registerMultiTask('ffoslaunch', 'Launches an application', function () {
    var done = this.async();

    var connect = require('node-firefox-connect');
    var launchApp = require('node-firefox-launch-app');

    var manifestLocation = "app://" + this.data.appId + "/manifest.webapp";
    var port = this.data.localPort || this.localPort;
    var portNumber = port.split(':')[1];

    ensurePortForwarded(port).then(function onForward() {
      connect(portNumber).then(
        function(client) {
          launchApp({ client: client, manifestURL: manifestLocation }).then(
            function(result) {
              console.log('App launched successfully'.green);
              done();
            }, function(err) {
              console.error('Could not launch app', err);
              done();
          });
      }, function(err){
        console.error("Could not connect ", err);
       done();
      });
    });
  });

  function ensurePortForwarded(port) {
    if (!portForwarded) {
      portForwarded = true;
      return new Promise(function(resolve) {
        adb.forward(port, remotePort, resolve);
      });
    } else {
      return Promise.resolve();
    }
  }
};

