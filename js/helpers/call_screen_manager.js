/* exported CallScreenManager */

'use strict';

(function(exports) {
  var debug = true;
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

  var attention;
  function _launchAttention(type, call, identities, isVideoCall) {
    // Retrieve the params and pass them as part of the URL
    var attentionParams = 'layout=' + type;
    attentionParams += '&identities=' +  encodeURIComponent(identities.toString());
    attentionParams += '&isVideoCall=' +  encodeURIComponent(isVideoCall);
    if (call) {
      Object.keys(call).forEach(function(param) {
        attentionParams += '&' + param + '=' + encodeURIComponent(call[param])
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
        debug && console.log('handshaking ready!');
        LoadingOverlay.hide();
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
                  var params = messageFromCallScreen.params;
                  // Create object to store
                  var callObject = {
                    date: attentionLoadedDate,
                    identities: identities || [],
                    video: isVideoCall,
                    type: type,
                    connected: params.connected,
                    duration: params.duration,
                    url: call.callUrl || null,
                    urlToken: call.callToken || null,
                    contactId: null,
                    contactPrimaryInfo: null,
                    contactPhoto: null
                  };

                  ContactsHelper.find({
                    identities: identities
                  }, function(result) {
                    CallLog.addCall(
                      result.contactIds ?
                      CallLog.addContactInfoToRecord(callObject, result) :
                      callObject
                    );
                  }, function() {
                    CallLog.addCall(callObject);
                  });
                  break;
              }
            } catch(e) {
              console.error('ERROR: Message received from CallScreen not valid '
                            + e.message || e);
            }
          }
        )
      }
    );
  }

  var CallScreenManager = {
    launch: function(type, call, identities, isVideoCall) {
      // TODO Depending on the type show one or another
      _launchAttention(type, call, identities, isVideoCall);
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
