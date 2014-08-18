(function(exports) {
  'use strict';

  var _call = null;
  var _session;
  var _publisher;
  var _subscriber;
  var _peersInSession = 0;
  var _publishersInSession = 0;
  var _connectionTimeout;
  var _callProgressHelper = null;
  var _callee;
  var _reason;
  var _speakerManager;
  var _onhold = function noop() {};
  var _onpeeronhold = function noop() {};
  var _onpeerresume = function noop() {};
  var _publishAudio = true;
  var _publishVideo = true;
  var _subscribeToAudio = true;
  var _subscribeToVideo = true;
  var _isVideoCall = false;

  /**
   * Set the current call on hold.
   */
  function _hold() {
    if (_publisher) {
      _publisher.publishAudio(false);
      _publisher.publishVideo(false);
    }
    if (_subscriber) {
      _subscriber.subscribeToAudio(false);
      _subscriber.subscribeToVideo(false);
    }
    _onhold();
    if (_session) {
      _session.signal(
        {
          data: JSON.stringify({messageType: 'progress', state: 'held'})
        }
      );
    }
    AudioCompetingHelper.leaveCompetition();
  }

  /**
   * Helper function. Handles call progress protocol state changes.
   *
   * @param {Object} callProgressHelper CallProgressHelper object.
   */
  function _handleCallProgress(callProgressHelper) {
    var state = callProgressHelper && callProgressHelper.state || 'unknown';
    switch(state) {
      case 'alerting':
        if (!_callee) {
          return;
        }
        callProgressHelper.accept();
        break;
      case 'connecting':
        callProgressHelper.mediaUp();
        break;
      case 'connected':
        // A "connected" notification from the server means that both peers has
        // successfully published their streams, but that doesn't mean that the
        // remote stream is still available. In order to have a better UX, we
        // show a "Connecting"-like message in the screen that will be removed
        // once the remote media is successfully aquired.
        CallScreenUI.setCallStatus('connecting');
        break;
      case 'error':
      case 'terminated':
        CallManager.stop();
        break;
      default:
        break;
    }
  }

  var CallManager = {
    init: function(params) {
      if (_call) {
        return;
      }
      AudioCompetingHelper.init();
      _call = params.call;
      _isVideoCall = params.video;
      _callee = params.type === 'incoming' ? true : false;
      // TODO: Send busy as reason in case we are in another webrtc call.
      _reason = _callee ?  'reject' : 'cancel';
      _callProgressHelper = new CallProgressHelper(_call.callId,
                                                   _call.progressURL,
                                                   _call.websocketToken);
      _callProgressHelper.onerror = function onError(evt) {
        _handleCallProgress(_callProgressHelper);
      };

      if (params.type === 'outgoing') {
        CallManager.join(params.video);
        CallScreenUI.setCallStatus('calling');
      } else {
        CallScreenUIMinified.updateIdentityInfo(params.identities);
      }
    },

    toggleVideo: function(isVideoOn) {
      if (!_publisher) {
        console.error('No publisher in this call');
        return;
      }

      if (!_speakerManager) {
        _speakerManager = new window.MozSpeakerManager();
      }
      _publisher.publishVideo(isVideoOn);
      _publishVideo = isVideoOn;
    },

    toggleSpeaker: function(isSpeakerOn) {
      if (!_subscriber) {
        console.error('No subscriber in this call');
        return;
      }
      _speakerManager.forcespeaker = isSpeakerOn;
    },

    toggleMic: function(isMicOn) {
      if (!_publisher) {
        console.error('No publisher in this call');
        return;
      }
      _publisher.publishAudio(isMicOn);
      _publishAudio = isMicOn;
    },

    join: function(isVideoCall) {
      
      _isVideoCall = isVideoCall || _isVideoCall;
      AudioCompetingHelper.clearListeners();
      AudioCompetingHelper.addListener('mozinterruptbegin', _hold);
      AudioCompetingHelper.compete();

      Countdown.reset();

      _publishVideo = _subscribeToVideo = _isVideoCall;

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
        streamPropertyChanged: function(event) {
          if (event.stream && event.stream.streamId !== _subscriber.stream.streamId) {
            return;
          }
          switch(event.changedProperty) {
            case 'hasVideo':
              CallScreenUI.updateRemoteVideo(event.newValue);
              break;
            case 'hasAudio':
              // TODO Check with UX if needed
              break;
          }

        },
        // Fired when a new peer is connected to the session.
        connectionCreated: function(event) {
          _peersInSession += 1;
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
          _subscriber =
            _session.subscribe(
              event.stream,
              'fullscreen-video',
              {
                style:{
                  nameDisplayMode: 'off',
                  buttonDisplayMode: 'off',
                  showMicButton: false,
                  showSettingsButton: false
                }
              }
            );
          _subscriber.on({
            loaded: function() {
              CallScreenUI.setCallStatus('connected');
            }
          });
          _publishersInSession += 1;
          // Update the UI with the remote video status
          CallScreenUI.updateRemoteVideo(event.stream.hasVideo);
          // Toggle local video
          CallManager.toggleVideo(isVideoCall);
          CallManager.toggleSpeaker(isVideoCall);
        },
        // Fired when a peer stops publishing the media stream.
        streamDestroyed: function(event) {
          _publishersInSession -= 1;
        },
        // Fired when a signal is received.
        signal: function(event) {
          var message = JSON.parse(event.data);
          if (message.messageType !== 'progress') {
            return;
          };
          switch (message.state) {
            case 'held':
              _onpeeronhold();
              break;
            case 'resumed':
              _onpeerresume();
              break;
          }
        }
      });
      
      // Connect asap in order to publish the video
      _session.connect(_call.sessionToken, function(e) {
        if (e) {
          console.log('Session connect error ' + e.message);
          return;
        }
         _publisher = _session.publish(
          'local-video',
          {
            width: 400,
            height:300,
            style:{
              nameDisplayMode: 'off',
              buttonDisplayMode: 'off',
              showMicButton: false,
              showSettingsButton: false
            }
          },
          function onPublish(ee) {
            if (ee) {
              console.log('Session publish error ' + ee.message);
            }
            var container =  document.querySelector('.OT_publisher');
            if (!container) {
              return;
            }
            
            container.querySelector('video').addEventListener('canplay', function() {
              CallScreenUI.removeFakeVideo();
            });
            _publishersInSession += 1;
        });
      });


      _handleCallProgress(_callProgressHelper);
      _callProgressHelper.onstatechange = function onStateChange(evt) {
        _handleCallProgress(_callProgressHelper);
      };
    },

    set onhold(onhold) {
      _onhold = onhold;
    },

    set onpeeronhold(onpeeronhold) {
      _onpeeronhold = onpeeronhold;
    },

    set onpeerresume(onpeerresume) {
      _onpeerresume = onpeerresume;
    },

    resume: function() {
      if (_publisher) {
        _publisher.publishAudio(_publishAudio);
        _publisher.publishVideo(_publishVideo);
      }
      if (_subscriber) {
        _subscriber.subscribeToAudio(_subscribeToAudio);
        _subscriber.subscribeToVideo(_subscribeToVideo);
      }
      if (_session) {
	_session.signal(
	  {
	    data: JSON.stringify({messageType: 'progress', state: 'resumed'})
	  }
	);
      }
      AudioCompetingHelper.addListener('mozinterruptbegin', _hold);
      AudioCompetingHelper.compete();
    },

    stop: function() {
      if (_callProgressHelper && ((_callProgressHelper.state !== 'connected') ||
          (_callProgressHelper.state !== 'closed'))) {
        _callProgressHelper.terminate(_reason);
      }
      AudioCompetingHelper.leaveCompetition();
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

      function onCallEnded() {
        // Send result to the Controller
        var hangoutMessage = {
          id: 'call_screen',
          message: 'hangout',
          params: {
            call: _call,
            duration: duration,
            connected: connected,
            video: _isVideoCall
          }
        };
        ControllerCommunications.send(hangoutMessage);
      }

      if (connected) {
        CallScreenUI.showFeedback(onCallEnded);
      } else {
        onCallEnded();
      }

      // Clean the call
      _call = {};
      _callProgressHelper && _callProgressHelper.finish();
      _callProgressHelper = null;
      AudioCompetingHelper.destroy();
    }
  };

  exports.CallManager = CallManager;
}(this));
