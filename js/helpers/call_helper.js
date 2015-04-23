/* global ClientRequestHelper, Utils */

/* exported CallHelper */

'use strict';

(function(exports) {
  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  var CallHelper = {
    /**
     * Generate a call URL to be shared with the called party.
     *
     * @param {String} params Object with the needed params.
                              Shall include the id Peer's id.
     * @param {Function} onsuccess Function to be called once the call URL is
     *                             generated correctly.
     * @param {Function} onerror Function to be called when an error occurs.
     */
    generateCallUrl: function ch_generateCallUrl(params, onsuccess, onerror) {
      params = params || {};
      if (!params.callerId) {
        _callback(onerror, [new Error('Invalid peer id')]);
        return;
      }

      ClientRequestHelper.generateCallUrl(params, function onCallUrl(result) {
        _callback(onsuccess, [result]);
      }, onerror);
    },

    /**
     * Call a user given a known identity.
     *
     * @param {Array} calleeId Array of strings that can contain the phone
     *                         number or email associated with a Loop user
     *                         account.
     * @param {Boolean} isVideoCall
     */
    callUser: function ch_callUser(params, onsuccess, onerror) {
      params = params || {};
      if (!params.calleeId) {
        _callback(onerror, [new Error('Invalid callee id')]);
        return;
      }

      ClientRequestHelper.callUser(params, function(result) {
        _callback(onsuccess, [result]);
      }, onerror);
    },

    /**
     * Call a user given a call token.
     *
     * @param {String} params Object with the callUrl params.
     *                  shall include The call token comes from a
                        previously generated
     *                 Loop URL
     * @param {Boolean} isVideoCall
     */

    callUrl: function ch_callUrl(params, onsuccess, onerror) {
      params = params || {};
      if (!params.token) {
        _callback(onerror, [new Error('Invalid call token')]);
        return;
      }

      ClientRequestHelper.getCallUrl(params, function(call) {
        ClientRequestHelper.callUrl(params, function(result) {
          _callback(onsuccess, [result, call.calleeFriendlyName]);
        }, onerror);
      }, onerror);
    }
  };

  exports.CallHelper = CallHelper;
}(this));
