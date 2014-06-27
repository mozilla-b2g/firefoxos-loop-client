/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported AccountHelper */

/* globals AccountStorage, Account, SimplePush, ClientRequestHelper */

(function(exports) {
  'use strict';

  const LOOP_CHANNEL_NAME = 'loop'; 
  var debug = true;
  var _cachedAccount;

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
    * @return {String} The indetifier in the assertion.
    */
  function _getIdentifier(credentials) {
    // TODO: Get MSISDN in case of MSISDN assertion.
    if (!credentials || (credentials.type !== 'BrowserID')) {
      return null;
    }

    var claim = Utils.parseClaimAssertion(credentials.value);
    return claim ? claim['fxa-verifiedEmail'] : null;
  }


  function _registerPush(onnotification) {
    return new Promise(function(resolve, reject) {
      SimplePush.createChannel(
        LOOP_CHANNEL_NAME,
        onnotification,
        function onRegistered(error, endpoint) {
          debug && console.log('SimplePush.createChannel: onregistered ' + endpoint);
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

  var AccountHelper = {
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

    /**
     * Sign up the user.
     *
     * @param {Object} credentials Assertion to sign up the user with. It could
     *                             be either a MSISDN or a Fx Account assertion.
     * @param {Function} onsuccess Function to be called once the user gets
     *                             signed up.
     * @param {Function} onerror Function to be called in case of any error. An
     *                           error object is passed as parameter.
     * @param {Function} onnotification Function to be called once the device
     *                                  receives a simple push notification.
     */
    signUp: function signUp(credentials, onsuccess, onerror, onnotification) {
      _registerPush(onnotification).then(function onRegistered(endpoint) {
          // Register the peer.
          ClientRequestHelper.signUp(
            // We need to pass in the credentials once the prod server runs (at least)
            // "version":"0.6.0" (currently v.0.5.0).
            null,
            endpoint,
            function onRegisterSuccess(result, hawkCredentials) {
              // Create an account locally.
              try {
                var email = _getIdentifier(credentials);
                // Keep a cached version of the account
                _cachedAccount =
                  new Account(email, hawkCredentials);
                // Store it
                AccountStorage.store(
                  _cachedAccount
                );
                // Start the Push notifications
                SimplePush.start();
                // Execute the callback
                _callback(onsuccess);
              } catch(e) {
                _callback(onerror, [e]);
                return;
              }
            },
            onerror
          );
      }).catch(function onError(error) {
        _callback(onerror, [error]);
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
    signIn: function signIn(onsuccess, onerror, onnotification) {
      AccountStorage.load(
        function(account) {
          if (!account || !account.id) {
            _callback(onerror, [new Error('Unable to sign in. Sing up first')])
            return;
          }
          // If we have a valid account, let's register it
          _registerPush(onnotification).then(function onRegistered(endpoint) {
            ClientRequestHelper.signIn(
              account.credentials,
              endpoint,
              function onRegisterSuccess() {
                // Keep a cached version of the account
                _cachedAccount = account;
                // Start the Push notifications
                SimplePush.start();
                // Execute the callback
                _callback(onsuccess);
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
    logOut: function logOut(onlogout, onerror) {

      if (!_cachedAccount) {
        return;
      }
      
      ClientRequestHelper.unregister(
        _cachedAccount.credentials,
        _cachedAccount.simplePushUrl,
        function onLogout() {
          // Clean the account
          AccountStorage.clear();
          // Reset the push channel
          SimplePush.reset();
          // Clean the cached account
          _cachedAccount = null;
          _callback(onlogout);
        },
        function onError() {
          // TODO: We could fail silently and we do not want that.
          _callback(onerror, [new Error('Unable to unregister correctly')]);
        }
      );
      
    }
  };

  exports.AccountHelper = AccountHelper;
})(this);
