/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {
  var DEBUG = true;

  var Utils = {
    /**
     * Helper function. Check whether the id parameter is a phone number.
     *
     * @param {String} id The id to check.
     *
     * @return {Boolean} Result.
     */
    isPhoneNumberValid: function u_isPhoneNumberValid(id) {
      if (id) {
        var re = /^([\+]*[0-9])+$/;
        if (re.test(id)) {
          return true;
        }
      }
      return false;
    },

    /**
     * Helper function. Check whether the id parameter is a email address.
     *
     * @param {String} id The id to check.
     *
     * @return {Boolean} Result.
     */
    isEmailValid: function u_isEmailValid(id) {
      // TODO.
      return true;
    },

    /**
     * Helper function. Unpack the given assertion.
     *
     * @param {String} assertion The assertion to unpack
     *
     * @return {Object} Unpacked assertion object.
     */
    unpackAssertion: function u_unpackAssertion(assertion) {
      var parts = assertion.split('.');
      return {
        header: atob(parts[0]),
        claim: atob(parts[1]),
        payload: atob(parts[3])
      };
    },
    /**
     * Helper function. Return the claim from the assertion.
     *
     * @param {String} assertion The assertion to unpack
     *
     * @return {Object} Claim object.
     */
    parseClaimAssertion: function u_parseClaimAssertion(assertion) {
      var unpacked = this.unpackAssertion(assertion);

      return unpacked.claim ?
        JSON.parse(unpacked.claim) : null;
    },

    /**
     * Simple dump function.
     *
     * @param {String} s Message.
     */
    log: function u_log(s) {
      DEBUG && console.log(s);
    }
  };

  exports.Utils = Utils;
}(this));
