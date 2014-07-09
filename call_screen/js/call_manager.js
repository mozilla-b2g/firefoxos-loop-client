(function(exports) {
  'use strict';

  var _call = {};
  var _session;
  var _publisher;
  var _peersInSession = 0;
  var _publishersInSession = 0;
  var _connectionTimeout;
  

  var CallManager = {
    init: function() {
      // Get params from URL
      var query = window.location.search.slice(1);
      var urlParams = query.split('&');
      for (var i=0; i < urlParams.length; i++) {
        var keyValue = urlParams[i].split('=');
        _call[keyValue[0]] = decodeURIComponent(keyValue[1]);
      }

      var layout = _call.layout;
      var video = true; // TODO Get from the default one

      return {
        layout: layout,
        video: video
      };
    },
    toggleVideo: function(isVideoOn) {
      _publisher.publishVideo(isVideoOn);
    },
    join: function() {
      Countdown.reset();
      // Choose default camera
      var cameraConstraint =
        navigator.mozCameras.getListOfCameras().length > 1 ?
          {facingMode: 'user', require:['facingMode']} : true;

      var constraints = {
        // TODO Ask for facing mode if possible
        video: cameraConstraint,
        audio: true
      };
      Opentok.setConstraints(constraints);
      _session = TB.initSession(_call.apiKey, _call.sessionId);
      var that = this;
      _session.on({
        // Fired when a new peer is connected to the session.
        connectionCreated: function(event) {
          _peersInSession += 1;
          if (_peersInSession === 1) {
            // Lets wait 10 second until we hang up the call when no answer from
            // the called party.
            _connectionTimeout = setTimeout(function onTimeout() {
              if (_peersInSession > 1) {
                return;
              }
              that.stop();
            }, 10000);
          }

          if (_peersInSession > 1) {
            // Start counter
            Countdown.start();
          }

        },
        // Fired when an existing peer is disconnected from the session.
        connectionDestroyed: function(event) {
          _peersInSession -= 1;
          if (_peersInSession === 1) {
            // We are alone in the session now so lets disconnect.
            that.stop();
          }
        },
        // Fired when a peer publishes the media stream.
        streamCreated: function(event) {
          _session.subscribe(event.stream, 'fullscreen-video', null);
          _publishersInSession += 1;

          // Hack to fix OT Css
          var container =  document.querySelector('.OT_subscriber');
          if (!container) {
            return;
          }
          // Update the styles of the video strem
          container.style.width = '100%';
          container.style.height = '100%';
        },
        // Fired when a peer stops publishing the media stream.
        streamDestroyed: function(event) {
          _publishersInSession -= 1;
        }
      });


      _session.connect(_call.sessionToken, function(e) {
        if (e) {
          console.log('Session connect error ' + e.message);
          return;
        }
        _publisher = _session.publish('local-video', null, function onPublish(ee) {
          if (ee) {
            console.log('Session publish error ' + ee.message);
          }
          var container =  document.querySelector('.OT_publisher');
          if (!container) {
            return;
          }

          _publishersInSession += 1;
  
          container.style.width = '140%';
          container.querySelector('video').style.width = '140% !important';
        });
      });
    },
    stop: function() {
      try {
        _session.disconnect();
      } catch(e) {
        console.log('Session is not available to disconnect ' + e);
      }

      // Stop the countdown
      var duration = Countdown.stop();
      var connected = false;

      if (duration > 0) {
        connected = true;
      }
      
      // Send result to the Controller
      var hangoutMessage = {
        id: 'call_screen',
        message: 'hangout',
        params: {
          duration: duration,
          connected: connected
        }
      }
      ControllerCommunications.send(hangoutMessage);

      // Clean the call
      _call = {};
    }
  };

  exports.CallManager = CallManager;

}(this));
