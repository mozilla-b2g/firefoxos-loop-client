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

  var AccountStorage = {
    /**
     * Load the account object.
     *
     * @param {Function} success A callback invoked when the transaction
     *                           completes successfully.
     */
    load: function a_load(onsuccess) {
      asyncStorage.getItem(
        ACCOUNT_KEY,
        function onAccount(account) {
          if (!account) {
            _callback(onsuccess, [null]);
            return;
          }
          if ((Object.keys(account)).length === 0) {
            _callback(onsuccess, {});
            return;
          }
          _callback(onsuccess,
                    [new Account(account.id.value, account.credentials)]);
      });
    },

    /**
     * Store the account object. It gather together the id object and the
     * credential object. Both objects have the same structure which is a couple
     * of properties such as type and value. For the id object type could be
     * 'msisdn' or 'fxac' (phone number or email address respectively). For the
     * credentials object type could be 'BrowserID', 'MSISDN', or 'Hwak'.
     *
     * @param {Account} account Account object to store.
     */
    store: function a_store(account) {
      asyncStorage.setItem(
        ACCOUNT_KEY, {id: account.id, credentials: account.credentials}
      );
    },

    /**
     * Clear the account storage.
     *
     */
    clear: function a_clear() {
      asyncStorage.setItem(ACCOUNT_KEY, {});
    }
  };

  exports.AccountStorage = AccountStorage;
})(this);
