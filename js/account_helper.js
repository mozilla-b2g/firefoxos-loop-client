/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported AccountHelper */

/* globals AccountStorage, Account, SimplePush, ClientRequestHelper */

(function(exports) {
  'use strict';

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
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
      /**
       * Helper function. Return the identifier in the assertion.
       *
       * @param {Object} assertion Assertion object.
       *
       * @return {String} The indetifier in the assertion.
       */
      function _getIdentifier(assertion) {
        // TODO: Get MSISDN in case of MSISDN assertion.
        if (!assertion || (assertion.type !== 'BrowserID')) {
          return null;
        }

        var unpacked = Utils.unpackAssertion(assertion.value);
        return unpacked.claim ?
          JSON.parse(unpacked.claim)['fxa-verifiedEmail'] : null;
      }

      SimplePush.createChannel(
       'loop',
       onnotification,
       function onRegistered(error, endpoint) {
         if (error) {
           _callback(onerror, [error]);
         }
         if (!endpoint) {
           _callback(onerror, [new Error('Invalid endpoint')]);
         }
         // Register the peer.
         ClientRequestHelper.signUp(
           credentials,
           endpoint,
           function onRegisterSuccess(result, hawkCredentials) {
             // Create an account locally.
             try {
               AccountStorage.store(
                 new Account(_getIdentifier(credentials), hawkCredentials)
               );
               SimplePush.start();
               _callback(onsuccess);
             } catch(e) {
               _callback(onerror, [e]);
               return;
             }
           },
           onerror
         );
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
      AccountStorage.load(function(account) {
        if (!account || !account.id) {
          _callback(onerror, [new Error('Unable to sign in. Sing up first')])
        }
        SimplePush.createChannel(
         'loop',
         onnotification,
         function onRegistered(error, endpoint) {
           if (error) {
             _callback(onerror, [error]);
           }
           if (!endpoint) {
             _callback(onerror, [new Error('Invalid endpoint')]);
           }
           ClientRequestHelper.signIn(
             account.credentials,
             endpoint,
             function onRegisterSuccess() {
               SimplePush.start();
               _callback(onsuccess);
             },
             onerror
           );
         });
      }, onerror);
    },

    /**
     * Log the user out. It clears the app account.
     */
    logOut: function logOut(onlogout) {
      AccountStorage.load(function(account) {
        if (!account || !account.id) {
          return;
        }
        AccountStorage.clear();
        // TODO We should remove the endpoint from the server as well.
        _callback(onlogout);
      });
    }
  };

  exports.AccountHelper = AccountHelper;
})(this);
