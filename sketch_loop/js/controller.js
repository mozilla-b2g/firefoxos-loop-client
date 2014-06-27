(function(exports) {
  'use strict';

  var debug = true;

  // Flags in order to control the flow
  var _isFxaLogged = false;
  var _isFxaFlowRunning = false;
  var _fxaCheckNeeded = false;


  /**
   * Handle the simple push notifications the device receives as an incoming
   * call.
   *
   * @param {Numeric} notificationId Simple push notification id (version).
   */
  function _onNotification(version) {
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

  function _launchFxaWatch() {
    navigator.mozId && navigator.mozId.watch({
      wantIssuer: 'firefox-accounts',
      onready: function() {
        debug && console.log('FxA: onready event at ' + new Date().getTime());
      },
      onlogin: function(assertion) {
        debug && console.log('FxA: onlogin event at ' + new Date().getTime());
        var assertionParsed = Utils.parseClaimAssertion(assertion);
        
        // If the onlogin is due to the flow was launched by Loop
        if (_isFxaFlowRunning) {
          // Store new account
          AccountHelper.signUp(
            {
              type: 'BrowserID',
              value: assertion
            },
            function onSignedUp() {
              // Launch the Call Log
              CallLog.init(assertionParsed['fxa-verifiedEmail']);
              // TODO Add LoadingOverlay.hide() when implemented
            },
            function onError(e) {
              // TODO Add error message
              // TODO Add LoadingOverlay.hide() when implemented
            },
            _onNotification
          );
          
          // Update the flats accordingly
          _isFxaLogged = true;
          _isFxaFlowRunning = false;
          _fxaCheckNeeded = false; 
          return;
        }
        
        // If the onlogin is not coming from the FxA flow launched by the APP,
        //this is not a new login. So we need to check (if the flag is TRUE)
        if (_fxaCheckNeeded) {

          // Retrieve the account previously stored
          AccountStorage.load(function(account) {
            // If it was a FxA account let's check
            if (account && account.id && account.id.type === 'fxac') {
              debug && console.log('New FxA email ' + assertionParsed['fxa-verifiedEmail']);
              debug && console.log('Previously FxA email ' + account.id.value);
              // If the value is the same, there is no change in FxA so we are
              // ready to show the CallLog!
              if (account.id.value === assertionParsed['fxa-verifiedEmail']) {
                AccountHelper.signIn(
                  function onSuccess() {
                    // Reset the flag & launch the CallLog
                    _isFxaLogged = true;
                    CallLog.init(assertionParsed['fxa-verifiedEmail']);
                    // Hide the splash screen if needed
                    SplashScreen.hide();
                  },
                  function onError() {
                    debug && console.log('Error executing AccountHelper.signIn');
                    // Hide the splash screen if needed
                    SplashScreen.hide();
                  },
                  _onNotification
                );
                
              } else {
                // Reset the account and show the right panel
                Controller.logout();
                // Hide the splash screen if needed
                SplashScreen.hide();
              }
            }
            // Clearing the flag
            _fxaCheckNeeded = false; 
          });
          return;
        }
      },
      onlogout: function() {
        debug && console.log('FxA: onlogout event at ' + new Date().getTime());
        // If we are logged right now (_isFxaLogged) or we were (_fxaCheckNeeded)
        if (_fxaCheckNeeded || _isFxaLogged) {
          // Delegate in Controller
          Controller.logout();
          // Hide splash screen if needed
          SplashScreen.hide();
        } else {
          // Launch just the authentication part of the Wizard
          Wizard.init(false);
          // Hide splash screen if needed
          SplashScreen.hide();
        }
      },
      onerror: function() {
        debug && console.log('FxA: onerror event at ' + new Date().getTime());
        // If the flow is interrupted we go through 'onerror'.
        // We need to clean the flag
        _isFxaFlowRunning = false;
        // Launch just the authentication part of the Wizard
        Wizard.init(false);
        // Hide splash screen if needed
        SplashScreen.hide();
      }
    });
  }

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

    // Workaround why the bug is fixed
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
                  debug && console.log('Call duration ' + messageFromCallScreen.params.duration);
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

  var Controller = {
    set isFxaRunning(value) {
      _isFxaFlowRunning = value;
    },
    get isFxaRunning() {
      return _isFxaFlowRunning;
    },
    init: function () {
      // Check when booting if there was an Account or not
      AccountStorage.load(function onAccount(account) {
        debug && console.log('Controller.init: Account is ' + JSON.stringify(account));
        
        // If there is no account is the first run of the App
        if (!account) {
          // Start listeners for FxA
          _launchFxaWatch();
          // Launch the whole wizard
          Wizard.init(true);
          // Hide Splash Screen
          SplashScreen.hide();
          return;
        }
        // If the account was created previously but was cleared
        // (due to a Logout), it's an empty object
        if (!account.id) {
          // Start listeners for FxA
          _launchFxaWatch();
          // Launch just the authentication part of the Wizard
          Wizard.init(false);
          // Hide Splash Screen
          SplashScreen.hide();
          return;
        }
        
        // If the account exist, we need to check the type and if it
        // is still a valid Account (i.e. The user was not logged out
        // from FxA). Let's check 2 possibilities of Login:
        
        // [1] MSISDN Login
        if (account.id.type === 'msisdn' && account.id.value.length > 0) {
          AccountHelper.signIn(
            function onSuccess() {
              // If it's a number and was previously validated we show the CallLog
              CallLog.init(account.id.value);
              // Hide Splash Screen
              SplashScreen.hide();
            },
            function onError() {
              debug && console.log('Error executing AccountHelper.signIn with msisdn');
            },
            _onNotification
          );
        }
        // [2] FXA Login
        else if (account.id.type === 'fxac') {
          // In this case we need to launch the listener of FxA taking into
          // account that a Double Check is needed. Why? 2 scenarios:
          // [A] If I've registered my FxA with Loop and now it's logged out
          // I'll receive 'onlogout' event. In that case I need to reset the Account
          // and show again the 'Wizard' just with the 'Authenticate' panel
          // [2] If FxA has changed (I was logged with 'USER A' and now it's 'USER B')
          
          // Update the flag indicating we need to double check
          _fxaCheckNeeded = true;
          // Start listeners for FxA
          _launchFxaWatch();
        } else {
          // If there is any other scenario, we launch again the flow
          // from the beginning
          _launchFxaWatch();
          Wizard.init(true);
          SplashScreen.hide();
        }
      });
    },
    call: function() {
      var activity = new MozActivity({
            name: 'pick',
            data: {
              type: 'webcontacts/tel'
            }
          });
      // TODO Add email handling
      activity.onsuccess = function() {
        if (!activity.result ||
            !activity.result.tel ||
            !activity.result.tel.length ||
            !activity.result.tel[0].value) {
          console.error('The pick activity result is invalid.');
          return;
        }

        CallHelper.generateCallUrl(activity.result.tel[0].value,
          function onCallUrlSuccess(result) {
            Share.show(activity.result, result.call_url);
          },
          function() {
            alert('Unable to retrieve link to share');
          }
        );
      }.bind(this);

      activity.onerror = function() {
        // TODO Check if needed to show any prompt to the user
      };
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
      AccountHelper.logOut(
        function() {
          // Start listeners for FxA. If it was previosly opened
          // we neet to catch that error
          try {
            _launchFxaWatch();
          } catch(e) {
            debug && console.log('mozId.watch: ERROR. Called more than once');
          }
          // Launch just the authentication part of the Wizard
          Wizard.init(false);
          // Clean the flags
          _fxaCheckNeeded = false;
          _isFxaLogged = false;
          _isFxaFlowRunning = false;
        },
        function(){
          debug && console.log('Controller.logout error');
        }
      );
    }
  };

  exports.Controller = Controller;
}(this));