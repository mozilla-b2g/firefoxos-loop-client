/* exported CallScreenManager */

'use strict';

(function(exports) {
  var debug = Config.debug;

  // Global flag to indicate that we are in a call and so we will be rejecting
  // any incoming call with the 'busy' state and forbiding any outgoing call
  // until we support multi-party calls.
  var _inCall = false;
  var _callType = null;
  var _params = null;
  var _isWaitingFeedback = false;

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  function _ensureGum(frontCamera) {
    return new Promise(function(resolve, reject) {
      var mode = frontCamera ? 'user' : 'environment';
      var cameraConstraints = {facingMode: mode, require: ['facingMode']};

      navigator.mozGetUserMedia(
        {
          video: cameraConstraints,
          audio: true
        },
        function(stream) {
          stream.stop();
          resolve();
        },
        reject
      );
    });
  }

  function _onAttentionLoaded(attention, callback) {
    if (typeof callback !== 'function') {
      console.error('Error when waiting for attention onload');
      return;
    }

    // Flag for handling both methods
    var isAttentionLoaded = false;

    // Method to use when available. Currently is not working
    // so tracked in bug XXX
    function _onloaded() {
      // Update flag
      isAttentionLoaded = true;
      _inCall = true;
      // Execute CB
      callback();
    }

    attention.onload = function() {
      _onloaded();
    };



    // Workaround while the bug is being fixed
    window.addEventListener(
      'message',
      function onPingMessageListener(event) {
        try {
          var pongObjectCandidate = JSON.parse(event.data);
          if (pongObjectCandidate.message === 'pong') {
            attention.onload = null;
            window.removeEventListener('message', onPingMessageListener);
            _onloaded();
          }
        } catch(e) {
          console.error('Message from iFrame not related with Loop ' + e);
        }
      }
    );

    // Function to fake the 'onload' method which is not working
    var pingMessage = {
      id: 'controller',
      message: 'ping'
    };

    function _fakeLoaded() {
      if (isAttentionLoaded) {
        return;
      }
      // Send to the attention screen
      attention.postMessage(JSON.stringify(pingMessage), '*');
      // Enable polling
      setTimeout(function() {
        _fakeLoaded();
      }, 20);
    }
    // Boot the fake loader
    _fakeLoaded();
  }

  function cleanCallParams() {
    _callType = null;
    _params = null;
  }

  function getShareUI() {
    return new Promise((resolve, reject) => {
      LazyLoader.load(['style/share.css',
                       'js/screens/share.js'], () => {
        resolve(Share);
      });
    });
  }

  function onHandShakingEvent(event) {
    try {
      var messageFromCallScreen = JSON.parse(event.data);
      if (messageFromCallScreen.id != 'call_screen') {
        return;
      }
      switch(messageFromCallScreen.message) {
        case 'close':
          // Close the attention screen
          _closeAttentionScreen();
          break;
        case 'feedback':
          // Close the attention screen
          _closeAttentionScreen();

          // Send feedback to server
          var feedbackParams = messageFromCallScreen.params;
          if (feedbackParams.feedback) {
            LazyLoader.load([
              '../js/helpers/metrics.js',
              '../js/helpers/feedback.js'
            ], function() {
              var url = feedbackParams.call.callUrl;
              if (url) {
                // We include the URL that the user clicked on to
                // initiate the call (without the call token) in the
                // "url" field. The key reason for doing so is that
                // it allows us to distinguish standalone feedback
                // from build-in client feedback.
                feedbackParams.feedback.url =
                  url.substring(0, url.lastIndexOf('/'));
              }
              Feedback.send(feedbackParams.feedback);
            });
          }

          break;
        case 'hangout':
          // Create CALL object
          var callscreenParams = messageFromCallScreen.params;
          if (callscreenParams.error &&
              callscreenParams.error.reason) {
            switch (callscreenParams.error.reason) {
              case 'gum':
              case 'networkDisconnected':
              case 'offline':
              case 'genericServerError':
                _closeAttentionScreen();
                // If there is any error, as gUM permission, let's
                // show to the user asap.
                Controller.showError(callscreenParams.error.reason);
                break;
              case 'unavailable':
                // Get URL to share and show prompt
                CallHelper.generateCallUrl(_params.identities[0],
                  function onCallUrlSuccess(result) {
                    getShareUI().then((ui) => {
                      ui.show(result,
                              _params.identities,
                              'unavailable',
                              _closeAttentionScreen);
                    });
                  },
                  function(e) {
                    console.error(
                      'Unable to retrieve link to share ' + e
                    );
                    _closeAttentionScreen();
                  }
                );
                // We don't need to record this as a call cause we
                // already recording it as a shared URL, so we bail
                // out here.
                return;
              default:
                _closeAttentionScreen();
                break;
            }
          } else {
            if (!callscreenParams.connected) {
              _closeAttentionScreen();
            } else {
              _isWaitingFeedback = true;
            }
          }

          // Create object to store
          var callObject = {
            date: new Date(),
            identities: _params.identities || [],
            video: _params.video || callscreenParams.video || false,
            type: _callType,
            connected: callscreenParams.connected,
            duration: callscreenParams.duration,
            url: callscreenParams.call.callUrl || null,
            urlToken: callscreenParams.call.callToken || null,
            revoked: false,
            contactId: null,
            contactPrimaryInfo: null,
            contactPhoto: null
          };

          // Add object & update the UI
          ContactsHelper.find({
            identities: _params.identities
          }, function(result) {
            CallLog.addCall(callObject, result);
            cleanCallParams();
          }, function() {
            CallLog.addCall(callObject);
            cleanCallParams();
          });
          Telemetry.recordAudioCodec(callscreenParams.audioCodecName);
          Telemetry.recordVideoCodec(callscreenParams.videoCodecName);
          Telemetry.recordCallDuration(callObject.duration);
          break;
      }
    } catch(e) {}
  }

  var attention;
  function _closeAttentionScreen() {
    if (!attention) {
      return;
    }
    attention.close();
    attention = null;
    _inCall = false;
    _isWaitingFeedback = false;
    // Stop listener
    window.removeEventListener('message', onHandShakingEvent);
  }

  function _generateAttentionParams(type, params, callback) {

    var attentionParams = 'layout=' + type;

    if (!params) {
      callback(attentionParams);
      return;
    }

    var values = [];
    var keys = [];
    keys = Object.keys(params);
    for(var i = 0, lKeys = keys.length; i < lKeys; i++) {
      values[i] = params[keys[i]];
    }

    Promise.all(values).then( (resolvedValues) => {
      // Retrieve the params and pass them as part of the URL
      for (i = 0, lKeys = keys.length; i < lKeys; i++) {
        attentionParams +=
              '&' + keys[i] + '=' + encodeURIComponent(resolvedValues[i]);
      }
      callback(attentionParams);
    });
  };

  function _launchAttention(type, params, incomingCall, contact) {
    _generateAttentionParams(type, params, function(attentionParams) {
      AudioCompetingHelper.leaveCompetition();
      AudioCompetingHelper.destroy();

      // Cache params needed from the call
      _callType = type;
      _params = params;

      // Launch the Attention
      var host = document.location.host;
      var protocol = document.location.protocol;
      var urlBase = protocol + '//' + host +
            '/call_screen/call.html?' + attentionParams;
      attention = window.open(urlBase, 'call_screen', 'attention');

      // Enable handshaking with the Call Screen
      _onAttentionLoaded(
        attention,
        function onLoaded() {

          function _listenToCallScreenMessages() {
            window.addEventListener(
              'message',
              onHandShakingEvent
            );
          }

          // Function to post data from the server
          function _postCall(type, call, identities, frontCamera, video) {
            if (!attention) {
              return;
            }
            _listenToCallScreenMessages();
            attention.postMessage(JSON.stringify({
              id: 'controller',
              message: 'call',
              params: {
                type: type,
                call: call,
                identities: identities,
                video: video,
                frontCamera: frontCamera || false
              }
            }), '*');
          }

          function _abortCall(error) {
            if (!attention) {
              return;
            }
            attention.postMessage(JSON.stringify({
              id: 'controller',
              message: 'abort',
              error: error
            }), '*');
          }

          // Now it's time to send to the attention the info regarding the
          // call object
          switch(type) {
          case 'incoming':
            // Call was retrieved previously in order to accelerate the UI
            _postCall(type, incomingCall, params.identities, params.frontCamera);
            break;
          case 'outgoing':
            _ensureGum(params.frontCamera).then(function() {
              if (!params.token) {
                CallHelper.callUser(
                  params.identities,
                  params.video,
                  function onLoopIdentity(call) {
                    _postCall(type,
                              call,
                              params.identities,
                              params.frontCamera,
                              params.video);
                  },
                  function onFallback() {
                    if (!navigator.onLine) {
                      _listenToCallScreenMessages();
                      _abortCall({reason: 'offline'});
                      return;
                    }
                    _abortCall(null);
                    // Get URL to share and show prompt
                    CallHelper.generateCallUrl(params.identities[0],
                      function onCallUrlSuccess(result) {
                        var speaker = params.video && params.video === true;
                        getShareUI().then((ui) => {
                          ui.show(
                            result,
                            params.identities,
                            'notAUser',
                            function onShareScreen() {
                              _closeAttentionScreen();
                              LazyLoader.load('js/helpers/tone_player_helper.js',
                                function onTonePlayerLoaded() {
                                  TonePlayerHelper.init('telephony');
                                  TonePlayerHelper.playFailed(speaker).then(
                                    function onplaybackcompleted() {
                                      TonePlayerHelper.stop();
                                      TonePlayerHelper.releaseResources();
                                  });
                                }
                              );
                          });
                        });
                      },
                      function(e) {
                        console.error('Unable to retrieve link to share ' + e);
                        _listenToCallScreenMessages();
                        _abortCall({reason: 'genericServerError'});
                        return;
                      }
                    );
                });
              } else {
		if (!navigator.onLine) {
		  _listenToCallScreenMessages();
		  _abortCall({reason: 'offline'});
		  return;
		}
                CallHelper.callUrl(
                  params.token,
                  params.video,
                  function(call, calleeFriendlyName) {
                    params.identities = [calleeFriendlyName];
                    _postCall(type, call, params.identities, params.frontCamera,
                              params.video);
                  },
                  function() {
                    console.error('Unable to connect');
		    _listenToCallScreenMessages();
		    _abortCall({reason: 'genericServerError'});
		    return;
                  }
                );
              }
            },
            _listenToCallScreenMessages);
            break;
          }
        }
      );
    });
  }

  function _rejectCall(call) {
    LazyLoader.load([
      '../js/config.js',
      '../js/utils.js',
      '../js/helpers/call_progress_helper.js'
    ], function() {
      var callProgressHelper = new CallProgressHelper(call.callId,
                                                      call.progressURL,
                                                      call.websocketToken);
      callProgressHelper.terminate('busy');
    });
  }

  var CallScreenManager = {
    launch: function(type, params) {
      AudioCompetingHelper.init();
      AudioCompetingHelper.compete();

      // TODO Modify this in multiconference when adding a new peer
      // to the conversation
      if (_isWaitingFeedback) {
        // Close the current call and launch the new one
        _closeAttentionScreen();
      }

      if (type !== 'incoming') {
        // If we are already on a call, we shouldn't allow calling another user
        // until we have a proper multi-party feature in place.
        // Bug 1058628 - Do not allow make a call while there is another one in
        // place
        if (_inCall) {
          AudioCompetingHelper.leaveCompetition();
          AudioCompetingHelper.destroy();
          return;
        }
        _launchAttention(type, params);
        return;
      }

      // In the case of an incoming call, we need to retrieve call params
      // for doing some checks before launching the attention.
      ClientRequestHelper.getCalls(
        params.version,
        function onsuccess(callsInfo) {
          debug && console.log('Version ' + params.version);
          debug && console.log('Calls from server ' + JSON.stringify(callsInfo));

          var callsToReject = [];
          var call;

          // In the case of an incoming call we will double check if the state
          // is not set, what it means that the call was never answered
          // and it's within the first 10 seconds. After the first 10 seconds,
          // this call object will not be available.
          for (var i = 0; i < callsInfo.calls.length; i++) {
            // If it's a new incoming call, there is no state. In the case
            // of having one call working at the moment, we need to reject
            // the new ones
            if (!callsInfo.calls[i].state) {
              if (_inCall || !!call) {
                callsToReject.push(callsInfo.calls[i]);
                continue;
              }
              call = callsInfo.calls[i];
            }
          }

          // If we are already in a call (outgoing or incoming) we can't
          // automatically attend the new incoming call without hanging up the
          // on in progress. In the future we might want to allow the user to
          // accept or reject it manually, but for now we simply reject it
          // with the busy state without launching the attention screen.
          // Reject the incoming extra calls, if any.
          for (var i = 0, l = callsToReject.length; i < l; i++) {
            _rejectCall(callsToReject[i]);
          }

          // If we have a valid incoming call, let's launch the attention screen.
          if (!call || _inCall) {
            return;
          }

          params.identities = [call.callerId];
          _launchAttention(type, params, call);
        },
        function onerror(e) {
          debug && console.error('Error: ClientRequestHelper.getCalls ' + e);
          AudioCompetingHelper.leaveCompetition();
          AudioCompetingHelper.destroy();
        }
      );
    },
    close: function() {
      _closeAttentionScreen();
    }
  };

  exports.CallScreenManager = CallScreenManager;
}(this));
