/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported AccountStorage */

/* globals asyncStorage, Account */

(function(exports) {
  'use strict';

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  var ACCOUNT_KEY = 'loop';
  var _cachedAccount;

  var AccountStorage = {
    /**
     * Load the account object.
     *
     * @param {Function} success A callback invoked when the transaction
     *                           completes successfully.
     */
    load: function a_load(onsuccess) {
      if (_cachedAccount !== undefined) {
        _callback(onsuccess, [_cachedAccount]);
        return;
      }
      // TODO Cache and restore the cached version
      asyncStorage.getItem(
        ACCOUNT_KEY,
        function onAccount(account) {
          if (!account) {
            _cachedAccount = null;
          } else if ((Object.keys(account)).length === 0) {
            _cachedAccount = {};
          } else {
            _cachedAccount = new Account(account.id.value,
                                         account.credentials,
                                         account.simplePushUrl);
          }
          _callback(onsuccess, [_cachedAccount]);
      });
    },

    /**
     * Store the account object. It gather together the id object and the
     * credential object. Both objects have the same structure which is a couple
     * of properties such as type and value. For the id object type could be
     * 'msisdn' or 'fxac' (phone number or email address respectively). For the
     * credentials object type could be 'BrowserID', 'MSISDN', or 'Hwak'.
     * Moreover the simple Push URL is saved along with the properties above.
     *
     * @param {Account} account Account object to store.
     */
    store: function a_store(account) {
      // Update cache
      _cachedAccount = {
        id: account.id,
        credentials: account.credentials,
        simplePushUrl: account.simplePushUrl
      };
      // Store
      asyncStorage.setItem(
        ACCOUNT_KEY, _cachedAccount
      );
    },

    /**
     * Clear the account storage.
     *
     */
    clear: function a_clear() {
      _cachedAccount = {};
      asyncStorage.setItem(ACCOUNT_KEY, {});
    }
  };

  exports.AccountStorage = AccountStorage;
})(this);
