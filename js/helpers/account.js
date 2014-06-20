/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported Account */

(function(exports) {
  'use strict';

  /**
   * Parse the given id and return peer's id object (value and type).
   *
   * @param {String} id Peer's id.
   *
   * @return {Object} Peer's id object.
   */
  function _parse(id) {
    var parsedId = {value: null, type: 'unknown'};

    if (Utils.isPhoneNumberValid(id)) {
      parsedId.type = 'msisdn';
    } else if (Utils.isEmailValid(id)) {
      parsedId.type = 'fxac';
    } else {
      throw new Error('Invalid id');
    }

    parsedId.value = id;
    return parsedId;
  }

  /** Peer's id object (value and type) for the current account. */
  var _id = null;

  /** Peer's credentials. */
  var _credentials = null;

  /**
   * Represents a parsed Account object.
   */
  function Account(identifier, credentials) {
    _id = _parse(identifier);
    _credentials = credentials;
  }

  Account.prototype = {
    /**
     * Constructor
     */
    constructor: Account,

    /**
     * Return peer's id object (value and type) for the current account.
     *
     * @return {String} Peer's id object.
     */
    get id() {
      return _id;
    },

    /**
     * Return peer's credentials object for the current account.
     *
     * @return {Object} Peer's credentials object.
     */
    get credentials() {
      return _credentials;
    }
  };

  exports.Account = Account;
})(window);
