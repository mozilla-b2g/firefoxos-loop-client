/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported FxacHelper */

'use strict';

(function(exports) {
  var FxacHelper = {
    /**
     * Init function.
     *
     * @param {Function} onLogin Callback function to be called once the onlogin
     *                           function gets called. The FxA assertion will be
     *                           passed in as its parameter.
     */
    init: function fxach_init(onLogin) {
      var that = this;
      navigator.mozId.watch({
        wantIssuer: 'firefox-accounts',
        onready: function onReady() {},
        onlogin: onLogin,
        onlogout: function onLogout() {}
      });
    },

    /**
     * Request the register process.
     */
    register: function fxach_register() {
      navigator.mozId.request();
    },

    /**
     * Log out.
     */
    logout: function fxach_logout() {
      navigator.mozId.logout();
    }
  };

  exports.FxacHelper = FxacHelper;
})(this);
