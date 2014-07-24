/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {

  /**
   * Helper singleton object for Opentok hacks.
   */
  var Opentok = {
    /**
     * Set the constaints to be use for Loop calls.
     *
     * @param {Object} loopConstraints gUM constraint object.
     */
    setConstraints: function ot_setConstraints(loopConstraints) {
      /**
       * Custom getUserMedia function for Loop Firefox OS client app.
       *
       */
      var customGetUserMedia = function(ignoredConstraints, onsuccess, onerror) {
        navigator.mozGetUserMedia(loopConstraints, onsuccess, onerror);
      };
      OT.$.customGetUserMedia = customGetUserMedia;
    }
  };

  OT.setLogLevel(Config.logLevel || 2); // Warn by default.

  exports.Opentok = Opentok;
})(this);
