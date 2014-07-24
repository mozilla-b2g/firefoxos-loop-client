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
     * @param {String} id Peer's id.
     * @param {Function} onsuccess Function to be called once the call URL is
     *                             generated correctly.
     * @param {Function} onerror Function to be called when an error occurs.
     */
    generateCallUrl: function ch_generateCallUrl(id, onsuccess, onerror) {
      if (!id) {
        _callback(onerror, [new Error('Invalid peer id')]);
        return;
      }

      ClientRequestHelper.generateCallUrl(id, function onCallUrl(result) {
        _callback(onsuccess, [result]);
      }, onerror);
    },

    /**
     * Call a user given a known identity.
     *
     * @param {Array} calleeId Array of strings that can contain the phone
     *                         number or email associated with a Loop user
     *                         account.
     */
    callUser: function ch_callUser(calleeId, isVideoCall, onsuccess, onerror) {
      if (!calleeId) {
        _callback(onerror, [new Error('Invalid callee id')]);
        return;
      }

      ClientRequestHelper.callUser(calleeId, isVideoCall, function(result) {
        _callback(onsuccess, [result]);
      }, onerror);
    },

    callUrl: function ch_callUrl(token, isVideoCall, onsuccess, onerror) {
      if (!token) {
        _callback(onerror, [new Error('Invalid call token')]);
        return;
      }

      ClientRequestHelper.getCallUrl(token, function(call) {
        ClientRequestHelper.callUrl(token, isVideoCall, function(credentials) {
          _callback(onsuccess, [credentials, call.calleeFriendlyName]);
        }, onerror);
      }, onerror);
    }
  };

  exports.CallHelper = CallHelper;
}(this));
