/* exported CallScreenManager */

'use strict';

(function(exports) {
  var debug = true;

  // Global flag to indicate that we are in a call and so we will be rejecting
  // any incoming call with the 'busy' state and forbiding any outgoing call
  // until we support multi-party calls.
  var _inCall = false;

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
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

    attention.onunload = function() {
      _inCall = false;
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

  var attention;
  function _launchAttention(type, params, incomingCall, contact) {
    // Retrieve the params and pass them as part of the URL
    var attentionParams = 'layout=' + type;
    if (params) {
      Object.keys(params).forEach(function(key) {
        attentionParams += '&' + key + '=' + encodeURIComponent(params[key]);
      });
    }

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
        // Function to post data from the server
        function _postCall(type, call, identities, video) {
          attention.postMessage(JSON.stringify({
            id: 'controller',
            message: 'call',
            params: {
              type: type,
              call: call,
              identities: identities,
              video: video || null
            }
          }), '*');
        }

        // Now it's time to send to the attention the info regarding the
        // call object
        switch(type) {
          case 'incoming':
            // Call was retrieved previously in order to accelerate the UI
            _postCall(type, incomingCall, params.identities);
            break;
          case 'outgoing':
            if (!params.token) {
              CallHelper.callUser(
                params.identities,
                params.video,
                function onLoopIdentity(call) {
                  _postCall(type, call, params.identities, params.video);
                },
                function onFallback() {
                  // Get URL to share and show prompt
                  CallHelper.generateCallUrl(params.identities[0],
                    function onCallUrlSuccess(result) {
                      Share.show(result, params.identities, function onShareShown() {
                        attention.close();
                      });
                    },
                    function(e) {
                      console.error('Unable to retrieve link to share ' + e);
                      attention.close();
                    }
                  );
                }
              );
            } else {
              CallHelper.callUrl(
                params.token,
                params.video,
                function(call, calleeFriendlyName) {
                  params.identities = [calleeFriendlyName];
                  _postCall(type, call, params.identities, params.video);
                },
                function() {
                  console.error('Unable to connect');
                  // Close attention
                  attention.close();
                }
              );
            }
            break;
        }

        var attentionLoadedDate = new Date();
        window.addEventListener(
          'message',
          function onHandShakingEvent(event) {
            try {
              var messageFromCallScreen = JSON.parse(event.data);
              if (messageFromCallScreen.id != 'call_screen') {
                debug && console.log('CallScreen: PostMessage not from CallScreen');
                return;
              }
              switch(messageFromCallScreen.message) {
                case 'hangout':
                  // Stop listener
                  window.removeEventListener('message', onHandShakingEvent);
                  // Clean attention params
                  attention.close();
                  attention = null;

                  // Create CALL object
                  var callscreenParams = messageFromCallScreen.params;

                  // Create object to store
                  var callObject = {
                    date: attentionLoadedDate,
                    identities: params.identities || [],
                    video: params.video || null,
                    type: type,
                    connected: callscreenParams.connected,
                    duration: callscreenParams.duration,
                    url: callscreenParams.call.callUrl || null,
                    urlToken: callscreenParams.call.callToken || null,
                    contactId: null,
                    contactPrimaryInfo: null,
                    contactPhoto: null
                  };

                  ContactsHelper.find({
                    identities: params.identities
                  }, function(result) {
                    CallLog.addCall(callObject, result);
                  }, function() {
                    CallLog.addCall(callObject);
                  });
                  break;
              }
            } catch(e) {}
          }
        );
      }
    );
  }

  function _rejectCall(call) {
    LazyLoader.load([
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
      if (type !== 'incoming') {
        // If we are already on a call, we shouldn't allow calling another user
        // until we have a proper multi-party feature in place.
        // Bug 1058628 - Do not allow make a call while there is another one in
        // place
        if (_inCall) {
          return;
        }
        _launchAttention(type, params);
        return;
      }

      ClientRequestHelper.getCalls(
        params.version,
        function onsuccess(callsArray) {
          var call = callsArray.calls[0];

          // If we are already in a call (outgoing or incoming) we can't
          // automatically attend the new incoming call without hanging up the
          // on in progress. In the future we might want to allow the user to
          // accept or reject it manually, but for now we simply reject it
          // with the busy state without launching the attention screen.
          if (_inCall) {
            _rejectCall(call);
            return;
          }

          params.identities = [call.callerId];
          _launchAttention(type, params, call);
        },
        function onerror(e) {
          debug && console.error('Error: ClientRequestHelper.getCalls ' + e);
        }
      );
    },
    close: function() {
      if (attention) {
        attention.close();
        attention = null;
      }
    }
  };

  exports.CallScreenManager = CallScreenManager;
}(this));
