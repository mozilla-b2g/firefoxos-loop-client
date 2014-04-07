/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global CallHelper */

/* exported Controller */

'use strict';

/*
 * This code is in charge of 'Controlling' all actions from the Loop
 * Library and link with UI operations. Controller is, as it name
 * indicates, the Controller part of MVC
 */

(function (exports) {
  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  var Controller = {
    /**
     * Share the call url with called party.
     *
     * @param {String} id Peer's id.
     * @param {Function} onsuccess Function to be called once the call URL is
     *                             shared correctly.
     * @param {Function} onerror Function to be called when an error occurs.
     */
    shareUrl: function c_shareUrl(id, onsuccess, onerror) {
      CallHelper.generateCallUrl(id,
        function onCallUrlSuccess(result) {
          Utils.log('Loop web URL ' + result.call_url);
          var activity = new MozActivity({
            name: 'share',
            data: {
              type: 'url',
              url: result.call_url
            }
          });
          activity.onsuccess = onsuccess;
          activity.onerror = _callback.bind(null, onerror, [new Error('Activity error')]);
        },
        onerror
      );
    }
  };

  exports.Controller = Controller;
}(this));
