(function(exports) {
  'use strict';

  var debug = true;

  // Flags in order to control the flow
  var _isFxaLogged = false;
  var _isFxaFlowRunning = false;
  var _fxaCheckNeeded = false;

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
          // Launch the Call Log
          CallLog.init(assertionParsed['fxa-verifiedEmail']);
          // Hide the Splash Screen if shown
          SplashScreen.hide();
          // Store the new account
          // TODO Call AccountHelper instead. This is just for the sketch.
          AccountStorage.store(
            new Account(assertionParsed['fxa-verifiedEmail'], {})
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
                // Reset the flag & launch the CallLog
                _isFxaLogged = true;
                CallLog.init(assertionParsed['fxa-verifiedEmail']);
              } else {
                // Reset the account and show the right panel
                Controller.logout();
              }
              // Hide the splash screen if needed
              SplashScreen.hide();
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
        }
      },
      onerror: function() {
        debug && console.log('FxA: onlogout event at ' + new Date().getTime());
        // If the flow is interrupted we go through 'onerror'.
        // We need to clean the flag
        _isFxaFlowRunning = false;
      }
    });
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
          // If it's a number and was previously validated we show the CallLog
          CallLog.init(account.id.value);
          // Hide Splash Screen
          SplashScreen.hide();
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
    logout: function() {
      // Clear the account from the storage
      AccountStorage.clear();
      // Start listeners for FxA. If it was previosly opened
      // we neet to catch that error
      try {
        _launchFxaWatch();
      } catch(e) {
        debug && console.log('mozId.watch: ERROR. Called more than once');
      }
      // Launch just the authentication part of the Wizard
      Wizard.init(false);
      // TODO Request to Server > logout();

      // Clean the flags
      _fxaCheckNeeded = false;
      _isFxaLogged = false;
      _isFxaFlowRunning = false;
    }
  };

  exports.Controller = Controller;
}(this));