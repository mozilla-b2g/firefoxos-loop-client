(function(exports) {
  'use strict';

  var debug = Config.debug;

  var _perfDebug = Config.performanceLog.enabled;
  var _perfBranch = 'CallScreen';

  var _call = null;
  var _isCallTerminated = false;
  var _wasAlerting = false;
  var _isCallManagerInitialized = false;
  var _session;
  var _publisher;
  var _subscriber;
  var _peersInSession = 0;
  var _publishersInSession = 0;
  var _connectionTimeout;
  var _callProgressHelper = null;
  var _callee;
  var _calleeJoined = false;
  var _isCalleeUnavailable = true;
  var _speakerManager;
  var _onhold = function noop() {};
  var _onpeeronhold = function noop() {};
  var _onpeerresume = function noop() {};
  var _onpeerbusy = function noop() {};
  var _onpeerreject = function noop() {};
  var _onpeercancel = function noop() {};
  var _onpeerunavailable = function noop() {};
  var _onpeerended = function noop() {};
  var _oncallfailed = function noop() {};
  var _publishAudio = true;
  var _publishVideo = true;
  var _useSpeaker = true;
  var _subscribeToAudio = true;
  var _subscribeToVideo = true;
  var _isVideoCall = false;
  var _peersConnection = null;
  var _acm = navigator.mozAudioChannelManager;
  var _videoCodecName = 'unknown';
  var _audioCodecName = 'unknown';

  // These strings will be found in SDP answer if H264 video codec is used
  const H264_STRING_126 = 'a=rtpmap:126 H264';
  const H264_STRING_97 = 'a=rtpmap:97 H264';
  // This string will be found in SDP answer if VP8 video codec is used
  const VP8_STRING = 'a=rtpmap:120 VP8';
  // This string will be found in SDP answer if OPUS audio codec is used
  const OPUS_STRING = 'a=rtpmap:109 opus';

  const TIMEOUT_SHIELD = 5000;

  const MEAN_ELEMENTS = 16;
  const TIME_INTERVAL_SECONDS = 3;

  /**
   * Send the signal given as the parameter to the remote party.
   *
   * @param {Object} data The object containing the signal to send.
   */
  function _sendSignaling(data) {
    if (data && _session && _peersConnection) {
      _session.signal(
        {
          to: _peersConnection,
          data: JSON.stringify(data)
        }
      );
    }
  }

  function _dispatchNetworkError() {
    _oncallfailed({reason: 'networkDisconnected'});
  }

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
    _sendSignaling({messageType: 'progress', state: 'held'});
    AudioCompetingHelper.leaveCompetition();
  }

  function _onHeadPhonesChange() {
    CallScreenUI.headphonesPresent = _acm.headphones;
  }

  function _handleHeadPhonesChange() {
    _acm && _acm.addEventListener('headphoneschange', _onHeadPhonesChange);
  }

  function _removeHeadPhonesChangeHandler() {
    _acm && _acm.removeEventListener('headphoneschange', _onHeadPhonesChange);
  }

  
  /**
   * Helper function. Handles call progress protocol state changes.
   *
   * @param {Object} callProgressHelper CallProgressHelper object.
   */
  function _handleCallProgress(callProgressHelper) {
    var state = callProgressHelper && callProgressHelper.state || 'unknown';
    _perfDebug && PerfLog.log(_perfBranch, 'Call progress ' + state +
      ' received through websocket');

    switch(state) {
      case 'alerting':
        _wasAlerting = true;
        if (!_callee) {
          // If we are the caller party and the alerting state is reached it
          // means the callee party will be alerted as well so the callee party
          // is available.
          _isCalleeUnavailable = false;
          CallScreenUI.setCallStatus('calling');
          return;
        }
        if (_callee && _calleeJoined) {
          _perfDebug && PerfLog.log(_perfBranch,
            'We send "accept" event through websocket');
          callProgressHelper.accept();
        }
        break;
      case 'connecting':
        _perfDebug && PerfLog.log(_perfBranch,
          'Peer hanged up. "connecting" event received');
        _perfDebug && PerfLog.log(_perfBranch,
          'We send "mediaUp" event through websocket');
        _perfDebug && PerfLog.milestone(_perfBranch, 'Peer hanged up');
        callProgressHelper.mediaUp();
        break;
      case 'connected':
        // A "connected" notification from the server means that both peers has
        // successfully published their streams, but that doesn't mean that the
        // remote stream is still available. In order to have a better UX, we
        // show a "Connecting"-like message in the screen that will be removed
        // once the remote media is successfully aquired.
        _perfDebug && PerfLog.log(_perfBranch,
          'Setting visual call status to "connecting"');
        CallScreenUI.setCallStatus('connecting');
        break;
      case 'error':
      case 'terminated':
        if (_wasAlerting) {
          CallManager.terminate();
        } else {
          _callProgressHelper.onstatechange = null;
          CallManager.terminate().then(function() {
            if (_callee) {
              CallManager.leaveCall();
              Ringer.stop();
            }
          });
        }
       break;
      default:
        break;
    }
  }

  /**
   * Helper function. Handles call progress protocol state changes when
   * terminating the call.
   */
  function _handleCallTermination(error) {
    var reason;
    switch (_callProgressHelper.state) {
      case 'unknown':
      case 'init':
      case 'alerting':
        if (_callee) {
          reason =
            (error && (error.reason === 'gum')) ? 'media-fail' : 'reject';
          _callProgressHelper.terminate(reason, function() {
            _callProgressHelper = null;
          });
        } else {
          _callProgressHelper.terminate('cancel', function() {
            _callProgressHelper.finish();
            _callProgressHelper = null;
          });
        }
        break;
      case 'terminated':
        reason = _callProgressHelper.reason;
        _callProgressHelper.finish();
        _callProgressHelper = null;

        if (!reason) {
          _onpeercancel();
          return;
        }
        switch (reason) {
          case 'busy':
            _onpeerbusy();
            break;
          case 'reject':
            _onpeerreject();
            break;
          case 'cancel':
          case 'timeout':
            if (!_callee && _isCalleeUnavailable) {
              _onpeerunavailable();
            } else {
              _onpeercancel();
            }
            break;
          case 'media-fail':
            _onpeerended();
            break;
          default:
            _onpeercancel();
            break;
        }
        break;
      default:
        _callProgressHelper.finish();
        _callProgressHelper = null;
        break;
    }
  }

  var CallManager = {
    init: function(params) {
      if (_call) {
        return;
      }

      _perfDebug && PerfLog.startTracing(_perfBranch);

      _call = params.call;
      _callee = params.type === 'incoming' ? true : false;
      _callProgressHelper = new CallProgressHelper(_call.callId,
                                                   _call.progressURL,
                                                   _call.websocketToken);

      if (_isCallTerminated) {
        _callProgressHelper.onready = function onReady(evt) {
          window.dispatchEvent(new CustomEvent('callmanager-initialized'));
        };
        
        _isCallTerminated = false;
        return;
      }

      _callProgressHelper.onerror = function onError(evt) {
        _handleCallProgress(_callProgressHelper);
      };
      
      _callProgressHelper.onready = function onReady(evt) {
        _isCallManagerInitialized = true;
        window.dispatchEvent(new CustomEvent('callmanager-initialized'));
        _handleCallProgress(_callProgressHelper);
      };

      if (params.type === 'outgoing') {
        CallManager.join(params.video, params.frontCamera);
      }

      // Update contact name for incoming/outgoing calls. Outgoing calls because
      // identities are retrieved from server for "loop-call" activities
      var identities = params.identities;
      identities && CallScreenUIMinified.updateIdentityInfo(identities);
    },

    toggleVideo: function(isVideoOn) {
      if (!_publisher) {
        debug && console.error('No publisher in this call');
        return;
      }

      _publisher.publishVideo(isVideoOn);
      _publishVideo = isVideoOn;
    },

    toggleSpeaker: function(isSpeakerOn) {
      if (!isSpeakerOn) {
        isSpeakerOn = false;
      }
      if (!_speakerManager) {
        _speakerManager = new window.MozSpeakerManager();
      }
      _speakerManager.forcespeaker = isSpeakerOn;
      _useSpeaker = isSpeakerOn;
    },

    toggleMic: function(isMicOn) {
      if (!_publisher) {
        debug && console.error('No publisher in this call');
        return;
      }
      _publisher.publishAudio(isMicOn);
      _publishAudio = isMicOn;
    },

    join: function(isVideoCall, frontCamera) {

      _perfDebug && PerfLog.log(_perfBranch, 'CallManager.join');

      _useSpeaker = _isVideoCall = isVideoCall && isVideoCall != 'false';

      AudioCompetingHelper.init();
      AudioCompetingHelper.addListener('mozinterruptbegin', _hold);
      AudioCompetingHelper.compete();

      Countdown.reset();

      _publishVideo = _subscribeToVideo = _isVideoCall;

      var mode = (frontCamera && frontCamera != 'false') ? 'user':'environment';
      var cameraConstraint = {facingMode: mode, require: ['facingMode']};
      var constraints = {
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

          _perfDebug && PerfLog.log(_perfBranch, 'streamPropertyChanged ' + event.changedProperty);

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
          _perfDebug && PerfLog.log(_perfBranch, 'connectionCreated');
          _peersInSession += 1;
        },
        // Fired when an existing peer is disconnected from the session.
        connectionDestroyed: function(event) {
          _peersInSession -= 1;
          if ((_peersInSession === 1) &&
              (event.reason === 'networkDisconnected')) {
            // The network connection terminated abruptly (for example, the
            // client lost their internet connection).
            _dispatchNetworkError();
            return;
          }
          if (_peersInSession === 1) {
            // We are alone in the session now so lets disconnect.
            _onpeerended();
          }
        },
        // Fired when a peer publishes the media stream.
        streamCreated: function(event) {
          if (_perfDebug) {
            PerfLog.log(_perfBranch, 'We got the notification about the ' +
                        'remote stream creation');
            PerfLog.log(_perfBranch, 'Subscribing to remote stream');
            PerfLog.milestone(_perfBranch, 'Remote stream created');
            var container = document.getElementById('fullscreen-video');
            var observer = new MutationObserver(function(mutations) {
              mutations.forEach(function(mutation) {
                if (mutation.type == 'childList') {
                  var listening = false;
                  for (var i = 0, l = mutation.addedNodes.length; i < l; i++) {
                    var remoteVideo = container.querySelector('video');
                    if (!remoteVideo || listening) {
                      continue;
                    }
                    listening = true;
                    observer.disconnect();
                    var oncanplaythrough = function() {
                      remoteVideo.removeEventListener('canplaythrough',
                                                      oncanplaythrough);
                      PerfLog.log(_perfBranch, 'Remote video is playing');
                    };
                    remoteVideo.addEventListener('canplaythrough',
                                                 oncanplaythrough);
                  };
                }
              });
            });
            var config = { attributes: false, childList: true, characterData: false };
            observer.observe(container, config);
          }

          // As we don't have multi party calls yet there will be only one peer.
          _peersConnection = event.stream.connection;
          _subscriber =
            _session.subscribe(
              event.stream,
              'fullscreen-video',
              {
                audioVolume: 100,
                width: "100%",
                height: "100%",
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
              _perfDebug && PerfLog.log(_perfBranch,
                'Received "loaded" event from remote stream');
              CallScreenUI.setCallStatus('connected');

              if (_perfDebug) {
                var meanFPS = 0;
                var videoWidth = 640;
                var videoHeight = 480;
                var previousMozFrames = 0;
                var remoteVideoContainer =
                  document.getElementById('fullscreen-video');
                var remoteVideoElement =
                  remoteVideoContainer.querySelector('video');

                if (remoteVideoElement) {
                  window.setInterval(function () {
                    var fps = (remoteVideoElement.mozPaintedFrames - previousMozFrames) / TIME_INTERVAL_SECONDS;
                    // mean of the last 16 fps
                    meanFPS = (meanFPS * (MEAN_ELEMENTS - 1) + fps) / MEAN_ELEMENTS;
                    debug && console.log('fps = ' + meanFPS);

                    // same with video width and height
                    videoWidth = (videoWidth * (MEAN_ELEMENTS - 1) + remoteVideoElement.videoWidth) / MEAN_ELEMENTS;
                    videoHeight = (videoHeight * (MEAN_ELEMENTS - 1) + remoteVideoElement.videoHeight) / MEAN_ELEMENTS;
                    debug && console.log(
                      'videoWidth = ' + remoteVideoElement.videoWidth + ', ' +
                      'videoHeight = ' + remoteVideoElement.videoHeight
                    );

                    previousMozFrames = remoteVideoElement.mozPaintedFrames;
                  }, TIME_INTERVAL_SECONDS * 1000);
                }
              }
            }
          });
          _publishersInSession += 1;
          // Update the UI with the remote video status
          CallScreenUI.updateRemoteVideo(event.stream.hasVideo);

          // Toggle local video
          CallManager.toggleVideo(_publishVideo);
          CallManager.toggleMic(_publishAudio);
          CallManager.toggleSpeaker(_useSpeaker);
        },
        // Fired when a peer stops publishing the media stream.
        streamDestroyed: function(event) {
          // As we don't have multi party calls yet there will be only one peer.
          _peersConnection = null;
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
          debug && console.log('Session connect error ' + e.message);
          return;
        }

        _perfDebug && PerfLog.log(_perfBranch, 'Session onconnect');
        CallScreenUI.removeFakeVideo();
        _publisher = _session.publish(
          'local-video',
          {
            width: 400,
            height:300,
            mirror: frontCamera && (frontCamera != 'false'),
            style:{
              nameDisplayMode: 'off',
              buttonDisplayMode: 'off',
              showMicButton: false,
              showSettingsButton: false
            }
          },
          function onPublish(ee) {
            if (ee) {
              debug && console.log('Session publish error ' + ee.message);
            }

            // Once published we set the video properly according our setting
            CallManager.toggleVideo(_publishVideo);

            _perfDebug && PerfLog.log(_perfBranch, 'Session onpublish');

            var container =  document.querySelector('.OT_publisher');
            if (!container) {
              return;
            }

            var localVideo = container.querySelector('video');
            if (_perfDebug) {
              var onplaying = function() {
                localVideo.removeEventListener('playing', onplaying);
                _perfDebug && PerfLog.log(_perfBranch, 'Local video playing');
              };
              localVideo.addEventListener('playing', onplaying);
            }

            _publishersInSession += 1;
        });
      });

      if (_callee) {
        _calleeJoined = true;
      }

      window.addEventListener('offline', _dispatchNetworkError);
      _handleCallProgress(_callProgressHelper);
      _callProgressHelper.onstatechange = function onStateChange(evt) {
        _handleCallProgress(_callProgressHelper);
      };

      _handleHeadPhonesChange();
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

    get headphonesPresent() {
      return _acm && _acm.headphones;
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
      _sendSignaling({messageType: 'progress', state: 'resumed'});
      AudioCompetingHelper.addListener('mozinterruptbegin', _hold);
      AudioCompetingHelper.compete();
    },

    set onpeerbusy(onpeerbusy) {
      _onpeerbusy = onpeerbusy;
    },

    set onpeerreject(onpeerreject) {
      _onpeerreject = onpeerreject;
    },

    set onpeercancel(onpeercancel) {
      _onpeercancel = onpeercancel;
    },

    set onpeerunavailable(onpeerunavailable) {
      _onpeerunavailable = onpeerunavailable;
    },

    set onpeerended(onpeerended) {
      _onpeerended = onpeerended;
    },

    set oncallfailed(oncallfailed) {
      _oncallfailed = oncallfailed;
    },

    terminate: function(error) {
      return new Promise(function(resolve, reject) {
        _perfDebug && PerfLog.stopTracing(_perfBranch);

        if (_publisher.answerSDP) {
          var description;
          description = _publisher.answerSDP;
          if (description.indexOf(H264_STRING_126) != -1 ||
              description.indexOf(H264_STRING_97) != -1) {
            _videoCodecName = 'H264';
          } else if (description.indexOf(VP8_STRING) != -1) {
            _videoCodecName = 'VP8';
          } else {
            _videoCodecName = 'unknown';
          }
          debug && console.log("Video Codec used: " + _videoCodecName);
          if (description.indexOf(OPUS_STRING) != -1) {
            _audioCodecName = 'OPUS';
          } else {
            _audioCodecName = 'unknown';
          }
          debug && console.log("Audio Codec used: " + _audioCodecName);
        }
        window.removeEventListener('offline', _dispatchNetworkError);
        _removeHeadPhonesChangeHandler();

        function _resolvePromise(error) {
          _callProgressHelper && _handleCallTermination(error);
          resolve();
        }

        function _waitForInitialized(error) {
          var secureTimeout = setTimeout(
            function() {
              _resolvePromise(error);
            },
            TIMEOUT_SHIELD
          );
          window.addEventListener(
            'callmanager-initialized',
            function onInitialized() {
              clearTimeout(secureTimeout);
              window.removeEventListener('callmanager-initialized', onInitialized);
              _resolvePromise(error);
            }
          );
        }

        _calleeJoined = false;

        if (_callProgressHelper) {
          if (_isCallManagerInitialized) {
            _resolvePromise(error);
          } else {
            _waitForInitialized(error);
          }
        } else {
          _isCallTerminated = true;
          _waitForInitialized(error);
        }

        try {
          _session.disconnect();
        } catch(e) {
          debug && console.log('Session is not available to disconnect ' + e);
        }

        if (AudioCompetingHelper) {
	  AudioCompetingHelper.leaveCompetition();
	  AudioCompetingHelper.destroy();
        }
      });
    },

    leaveCall: function(error) {
      // Stop the countdown
      var duration = Countdown.stop();
      var connected = false;

      if (duration > 0) {
        connected = true;
      }

      function sendParams(message, feedback) {
        var params = {
          call: _call,
          duration: duration,
          connected: connected,
          video: _isVideoCall,
          videoCodecName: _videoCodecName,
          audioCodecName: _audioCodecName,
          feedback: feedback || null
        };

        if (error) {
          params.error = error;
        }

        // Send result to the Controller
        var message = {
          id: 'call_screen',
          message: message,
          params: params
        };

        _call = {};

        ControllerCommunications.send(message);
      }

      // Send hangout message to Controller
      sendParams('hangout');

      // Shield against weird states. If we have no action in
      // 10 seconds, we close the attention screen. This was
      // requested by UX.
      var shieldErrorTimeout = setTimeout(function() {
        sendParams('close');
      }, 10000);

      // If the call was connected and there is no error
      // we wait for the feedback to send it to the controller.
      if (connected && (!error || !error.reason)) {
        if (CallScreenUI.isStatusBarShown()) {
          clearTimeout(shieldErrorTimeout);
          sendParams('close');
        } else {
          CallScreenUI.showFeedback(function onFeedback(feedback) {
            clearTimeout(shieldErrorTimeout);
            if (!feedback) {
              sendParams('close');
            } else {
              sendParams('feedback', feedback);
            }
          });
        }
      } else {
        clearTimeout(shieldErrorTimeout);
        sendParams('close');
      }
    }
  };

  exports.CallManager = CallManager;
}(this));
