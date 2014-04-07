/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {
  var DEBUG = true;

  var Utils = {
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
