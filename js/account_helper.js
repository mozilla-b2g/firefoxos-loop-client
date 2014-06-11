/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported AccountHelper */

/* globals Account, SimplePush, ClientRequestHelper */

(function(exports) {
  'use strict';

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  var ID_KEY = 'loop';

  var AccountStorage = {
    /**
     * Load the account object.
     *
     * @param {Function} success A callback invoked when the transaction
     *                           completes successfully.
     * @param {Function} error A callback invoked if an operation fails.
     */
    load: function a_load(onsuccess, onerror) {
      asyncStorage.getItem(
        ID_KEY,
        function onId(id) {
          if (!id) {
            _callback(onsuccess, [null]);
            return;
          }
          _callback(onsuccess, [new Account(id.value)]);
      });
    },

    /**
     * Store the account id object.
     *
     * @param {Account} account Account object to store.
     */
    store: function a_store(account) {
      asyncStorage.setItem(ID_KEY, account.id);
    },

    /**
     * Clear the account storage.
     *
     */
    clear: function a_clear(identifier) {
      asyncStorage.setItem(ID_KEY, null);
    }
  };

  var AccountHelper = {
    /**
     * Get the app account.
     *
     * @param {Function} onsuccess Function to be called once it gets the
     *                             account. The account object is passed as
     *                             parameter.
     * @param {Function} onerror Function to be called in case of any error. An
     *                           error object is passed as parameter.
     */
    getAccount: function getAccount(onsuccess, onerror) {
      AccountStorage.load(onsuccess, onerror);
    },

    /**
     * Sign up the user.
     *
     * @param {Function} onsuccess Function to be called once the user gets
     *                             signed up.
     * @param {Function} onerror Function to be called in case of any error. An
     *                           error object is passed as parameter.
     * @param {Function} onnotification Function to be called once the device
     *                                  receives a simple push notification.
     */
    signUp: function signUp(id, onsuccess, onerror, onnotification) {
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
         ClientRequestHelper.register(endpoint,
           function onRegisterSuccess() {
             // Create an account locally.
             try {
               AccountStorage.store(new Account(id));
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
        if (!account) {
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
           ClientRequestHelper.register(endpoint,
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
        if (!account) {
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
