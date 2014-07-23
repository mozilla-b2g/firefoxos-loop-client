/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported AccountHelper */

/* globals AccountStorage, Account, SimplePush, ClientRequestHelper */

(function(exports) {
  'use strict';

  const LOOP_CHANNEL_NAME = 'loop';

  var _cachedAccount;
  var _isLogged = false;
  var _isIdFlowRunning = false;
  var _isIdCheckNeeded = false;

  var _onnotification = null;

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  /**
    * Helper function. Return the identifier in the assertion.
    *
    * @param {Object} assertion Assertion object.
    *
    * @return {String} The identifier in the assertion.
    */
  function _getIdentifier(credentials) {
    if (!credentials || (credentials.type !== 'BrowserID')) {
      return null;
    }

    var claim = Utils.parseClaimAssertion(credentials.value);

    if (!claim) {
      return null;
    }

    return claim['verifiedMSISDN'] || claim['fxa-verifiedEmail'];
  }

  function _registerPush(onnotification) {
    return new Promise(function(resolve, reject) {
      SimplePush.createChannel(
        LOOP_CHANNEL_NAME,
        onnotification,
        function onRegistered(error, endpoint) {
          Log.log('SimplePush.createChannel: onregistered ' +
                  endpoint);
          if (error) {
             reject(error);
             return;
          }

          if (!endpoint) {
             reject(new Error('Invalid endpoint'));
             return;
          }

          resolve(endpoint);

        }
      );
    });
  }

  function _dispatchEvent(eventName, detail) {
    var event = new CustomEvent(eventName, {
      detail: detail
    });
    window.dispatchEvent(event);
  }

  function _onlogin(assertion) {
    Log.log('onlogin ' + _isIdFlowRunning + ' ' + assertion);

    var assertionParsed = Utils.parseClaimAssertion(assertion);

    // If we received the onlogin event as a consecuence of the completion
    // of the ID flow, we just sign the user in and progress the onlogin
    // event.
    if (_isIdFlowRunning) {
      // Store new account
      AccountHelper.signUp({
        type: 'BrowserID',
        value: assertion
      }, function onSignedUp() {
        _isLogged = true;
        _isIdFlowRunning = false;
        _isIdCheckNeeded = false;
        _dispatchEvent('onlogin', {
          identity: assertionParsed['fxa-verifiedEmail'] ||
                    assertionParsed['verifiedMSISDN']
        });
      }, _onloginerror);
      return;
    }

    // If the onlogin is not coming from the ID flow launched by the app
    // we might need to check the new obtained identity for the case
    // where a new FxA email different than the one that we are already
    // using has been used to log into the device.
    // For now, the mobile ID flow can't get this far as there is no way to
    // change a mobile identity from settings. In the future, we might want
    // to do the same verification.
    if (!_isIdCheckNeeded) {
      return;
    }

    // If it was a FxA account let's check
    AccountHelper.getAccount(function(account) {
      if (account && account.id && account.id.type === 'fxa') {
        Log.log('New FxA email ' + assertionParsed['fxa-verifiedEmail']);
        Log.log('Previous FxA email ' + account.id.value);
        // If the value is the same, there is no change in FxA so we are
        // ready to show the CallLog!
        if (account.id.value === assertionParsed['fxa-verifiedEmail']) {
          AccountHelper.signIn(
            function onSuccess() {
              _isLogged = true;
              _isIdFlowRunning = false;
              _isIdCheckNeeded = false;
              _dispatchEvent('onlogin', {
                identity: assertionParsed['fxa-verifiedEmail'] ||
                          assertionParsed['verifiedMSISDN']
              });
            }, _onloginerror, Controller.onnotification);
        } else {
          _onlogout();
        }
      }
    });

    _isIdCheckNeeded = false;
  }

  function _onlogout() {
    Log.log('onlogout');

    AccountHelper.logout();
  }

  function _onloginerror(error) {
    Log.log('onloginerror ' + error);

    _isIdFlowRunning = false;
    _isLogged = false;
    _isIdCheckNeeded = false;

    _dispatchEvent('onloginerror', { error: error });
  }

  function _watchFxA(checkIdChange) {
    _isIdCheckNeeded = !!checkIdChange;

    var callbacks = {
      wantIssuer: 'firefox-accounts',
      onready: function() {},
      onlogin: _onlogin,
      onlogout: _onlogout,
      onerror: _onloginerror
    };

    try {
      navigator.mozId && navigator.mozId.watch(callbacks);
    } catch(e) {
      Log.warn(e);
    }
  }

  var AccountHelper = {

    get logged() {
      return _isLogged;
    },

    /**
     * Get the app account.
     *
     * @param {Function} onsuccess Function to be called once it gets the
     *                             account. The account object is passed as
     *                             parameter.
     */
    getAccount: function getAccount(onsuccess) {
      AccountStorage.load(onsuccess);
    },

    init: function init(onnotification) {
      this.getAccount((function(account) {
        Log.log('Account ', account);

        _onnotification = onnotification;

        // If there is no account, this is the first run of the App.
        if (!account) {
          Log.log('First run');
          _dispatchEvent('onauthentication', {
            firstRun: true
          });
          return;
        }

        if (!account.id || !account.id.type) {
          _dispatchEvent('onauthentication', {
            firstRun: false
          });
          return;
        }

        // If the account exists, we need to check its type and validity.
        // (i.e. The user was not logged out from FxA).

        switch (account.id.type) {
          case 'msisdn':
            _isLogged = true;
            this.signIn(function() {
              _dispatchEvent('onlogin', { identity: account.id.value });
            }, _onloginerror);
            break;
          case 'fxa':
            // In this case we need to launch the listener of FxA taking into
            // account that a Double Check is needed. Why? 2 scenarios:
            // [A] If I've registered my FxA with Loop and now it's logged out
            // I'll receive 'onlogout' event. In that case I need to reset the
            // Account and show again the 'Wizard' just with the 'Authenticate'
            // panel
            // [B] If FxA has changed (I was logged with 'USER A' and now
            // it's 'USER B')

            // Start listeners for FxA setting the flag that indicates that we
            // need to check for new identities different than the one that we
            // are already using.
            _watchFxA(true /* checkIdChange*/);
            break;
          default:
            _dispatchEvent('onfirstrun');
            break;
        }
      }).bind(this));
    },

    authenticate: function authenticate(id) {
      _isIdFlowRunning = true;
      switch (id) {
        case 'fxa':
          _watchFxA();
          navigator.mozId && navigator.mozId.request();
          break;
        case 'msisdn':
          navigator.getMobileIdAssertion({
            forceSelection: true
          }).then(_onlogin, _onloginerror);
          break;
        default:
          Log.error('Should never get here. Wrong authentication id');
          _isIdFlowRunning = false;
          break;
      }
    },

    /**
     * Sign up the user.
     *
     * @param {Object} credentials Assertion to sign up the user with. It could
     *                             be either a MSISDN or a Fx Account assertion.
     * @param {Function} onsuccess Function to be called once the user gets
     *                             signed up.
     * @param {Function} onerror Function to be called in case of any error. An
     *                           error object is passed as parameter.
     */
    signUp: function signUp(credentials, onsuccess, onerror) {
      if (!_onnotification) {
        _callback(onerror);
        return;
      }

      _registerPush(_onnotification).then(function onRegistered(endpoint) {
          // Register the peer.
          ClientRequestHelper.signUp(
            // TODO: We need to pass in the credentials once the prod server
            // runs (at least) "version":"0.6.0" (currently v.0.5.0).
            credentials,
            endpoint,
            function onRegisterSuccess(result, hawkCredentials) {
              // Create an account locally.
              try {
                var id = _getIdentifier(credentials);
                // Keep a cached version of the account
                _cachedAccount = new Account(id, hawkCredentials, endpoint);
                // Store it
                AccountStorage.store(_cachedAccount);
                // Start the Push notifications
                SimplePush.start();
                _callback(onsuccess);
              } catch (e) {
                _callback(onerror, [e]);
              }
            },
            onerror
          );
      }).catch(function onError(e) {
        _callback(onerror, [e]);
      });
    },

    /**
     * Sign in the user.
     *
     * @param {Function} onsuccess Function to be called once the user gets
     *                             signed in.
     * @param {Function} onerror Function to be called in case of any error. An
     *                           error object is passed as parameter.
     * @param {Function} onnotification Function to be called once the device
     *                                  receives a simple push notification.
     */
    signIn: function signIn(onsuccess, onerror) {
      if (!_onnotification) {
        _callback(onerror);
        return;
      }

      AccountStorage.load(
        function(account) {
          if (!account || !account.id) {
            _callback(onerror, [new Error('Unable to sign in. Sing up first')]);
            return;
          }
          // If we have a valid account, let's register it
          _registerPush(_onnotification).then(function onRegistered(endpoint) {
            ClientRequestHelper.signIn(
              account.credentials,
              endpoint,
              function onRegisterSuccess() {
                // Keep a cached version of the account
                _cachedAccount = account;
                // Start the Push notifications
                SimplePush.start();
                _callback(onsuccess, [account.id.value]);
              },
              onerror
            );
          }).catch(function onError(error) {
            _callback(onerror, [error]);
          });
        },
        onerror
      );
    },

    /**
     * Log the user out. It clears the app account.
     */
    logout: function logout() {
      // Dispatch onlogout
      _dispatchEvent('onlogout');
      // Clean the account
      AccountStorage.clear();
      // Reset the push channel
      SimplePush.reset();
      // Clean up flags.
      _isIdCheckNeeded = false;
      _isLogged = false;
      _isIdFlowRunning = false;
      
      if (!_cachedAccount) {
        return;
      }

      function cleanCache() {
        // Clean cached Account
        _cachedAccount = null;
      }

      ClientRequestHelper.unregister(
        _cachedAccount.credentials,
        _cachedAccount.simplePushUrl,
        cleanCache,
        cleanCache
      );
    }
  };

  exports.AccountHelper = AccountHelper;
})(this);
