(function(exports) {
  'use strict';

  var debug = true;

  function _onAttentionLoaded(attention, callback) {
    if (typeof callback !== 'function') {
      console.log('Error when waiting for attention onload');
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

    attention.onload = _onloaded;

    // Workaround while the bug is being fixed
    window.addEventListener(
      'message',
      function onPingMessageListener(event) {
        try {
          var pongObjectCandidate = JSON.parse(event.data);
          if (pongObjectCandidate.message === 'pong') {
            window.removeEventListener('message', onPingMessageListener);
            _onloaded();
          }
        } catch(e) {
          console.log('Message from iFrame not related with Loop');
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

  function _launchAttention(call) {
    // Retrieve the params and pass them as part of the URL
    var attentionParams = '';
    if (call) {
      Object.keys(call).forEach(function(param) {
        if (attentionParams.length > 0) {
          attentionParams += '&'
        }
        attentionParams += param + '=' + encodeURIComponent(call[param])
      });
    }
    // Launch the Attention
    var host = document.location.host;
    var protocol = document.location.protocol;
    var urlBase = protocol + '//' + host +
      '/call_screen/call.html?' + attentionParams;
    var attention = window.open(urlBase, 'call_screen', 'attention');
    // Enable handshaking with the Call Screen
    _onAttentionLoaded(
      attention,
      function onLoaded() {
        debug && console.log('handshaking ready!');
        window.addEventListener(
          'message',
          function onHandShakingEvent(event) {
            try {
              var messageFromCallScreen = JSON.parse(event.data);
              if (messageFromCallScreen.id != 'call_screen') {
                debug && console.log('CallScreen: PostMessage not from CallScreen')
                return;
              }
              switch(messageFromCallScreen.message) {
                case 'hangout':
                  // TODO Add Call log info & Feedback
                  debug && console.log('Call duration ' +
                                       messageFromCallScreen.params.duration);
                  attention.close();
                  break;
              }

            } catch(e) {
              console.log('ERROR: Message received from CallScreen not valid');
            }
          }
        )
      }
    );
  }

  function _onauthentication(event) {
    Wizard.init(event.detail.firstRun);
    SplashScreen.hide();
    window.removeEventListener('onauthentication', _onauthentication);
  }

  function _onlogin(event) {
    if (!event.detail || !event.detail.identity) {
      log.error('Unexpected malformed onlogin event');
      return;
    }
    CallLog.init(event.detail.identity);
    SplashScreen.hide();
    // TODO Add LoadingOverlay.hide() when implemented
  }

  function _onlogout() {
    Wizard.init(false);
    SplashScreen.hide();
  }

  function _onloginerror(event) {
    Wizard.init(false /* isFirstUse */);
    SplashScreen.hide();
    // TODO Add error message
    // TODO Add LoadingOverlay.hide() when implemented
  }

  /**
   * Handle the simple push notifications the device receives as an incoming
   * call.
   *
   * @param {Numeric} notificationId Simple push notification id (version).
   */
  function _onnotification(version) {
    navigator.mozApps.getSelf().onsuccess = function (event) {
      var app = event.target.result;
      app.launch();
      ClientRequestHelper.getCalls(
        version,
        function onsuccess(callsArray) {
          var call = callsArray.calls[0];
          _launchAttention(call);
        },
        function onerror(e) {
          debug && console.log('Error: ClientRequestHelper.getCalls ' + e);
        }
      )
    }
  }


  var Controller = {
    init: function () {
      window.addEventListener('onauthentication', _onauthentication);
      window.addEventListener('onlogin', _onlogin);
      window.addEventListener('onlogout', _onlogout);
      window.addEventListener('onloginerror', _onloginerror);

      // Start listening activities
      Activities.init();

      AccountHelper.init(_onnotification);
    },

    authenticate: function(id) {
      AccountHelper.authenticate(id);
    },

    pickAndCall: function() {
      var activity = new MozActivity({
            name: 'pick',
            data: {
              type: 'webcontacts/tel'
            }
          });
      // TODO Add email handling
      activity.onsuccess = function() {
        this.call(activity.result);
      }.bind(this);

      activity.onerror = function() {
        // TODO Check if needed to show any prompt to the user
      };
    },

    call: function(contact, isVideoOn) {
      if (!AccountHelper.logged) {
        alert('You need to be logged in before making a call with Loop');
        return;
      }

      if (!contact ||
          !contact.tel ||
          !contact.tel.length ||
          !contact.tel[0].value) {
        console.error('The pick activity result is invalid.');
        return;
      }

      // TODO When doing the direct call, use 'isVideoOn' or
      // the param retrieved from Loop Settings. By default
      // this param will be true.

      CallHelper.generateCallUrl(contact.tel[0].value,
        function onCallUrlSuccess(result) {
          Share.show(contact, result.call_url);
        },
        function() {
          alert('Unable to retrieve link to share');
        }
      );
    },

    shareUrl: function (id, onsuccess, onerror) {
      CallHelper.generateCallUrl(id,
        function onCallUrlSuccess(result) {
          debug && console.log('Loop web URL ' + result.call_url);
          var activity = new MozActivity({
            name: 'share',
            data: {
              type: 'url',
              url: result.call_url
            }
          });
          activity.onsuccess = onsuccess;
          activity.onerror = onerror;
        },
        onerror
      );
    },

    sendUrlBySMS: function (id, onsuccess, onerror) {
      CallHelper.generateCallUrl(id,
        function onCallUrlSuccess(result) {
          debug && console.log('Loop web URL for SMS ' + result.call_url);
          var activity = new MozActivity({
            name: 'new',
            data: {
              type: 'websms/sms',
              number: id,
              body: 'Lets join the call with Loop! ' + result.call_url
            }
          });
          activity.onsuccess = onsuccess;
          activity.onerror = onerror;
        },
        onerror
      );
    },

    logout: function() {
      AccountHelper.logout();
    },

  };

  exports.Controller = Controller;
}(this));
