/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported PushNotification */

'use strict';

(function (exports) {

  var PushNotification = {
    /**
     * Handle the simple push notifications the device receives as an incoming
     * call.
     *
     * @param {Numeric} notificationId Simple push notification id (version).
     */
    onNotification: function pn_onNotification(notificationId) {
      var host = document.location.host;
      var protocol = document.location.protocol;
      var urlBase = protocol + '//' + host +
                    '/test_app/callscreen.html?notificationid=' + notificationId;
      window.open(urlBase, 'call_screen', 'attention');
    }
  };

  exports.PushNotification = PushNotification;
}(this));
