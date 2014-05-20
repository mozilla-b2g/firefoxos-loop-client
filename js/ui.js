/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

/* global Controller */

/* exported UI */

/*
 * This code is in charge of the UI & User actions in our app.
 * This is the 'View' part of our MVC.
 */

(function (exports) {
  var UI = {
    init: function ui_init() {
      // Retrieve the various page elements
      var shareUrlButton = document.getElementById('share');

      shareUrlButton.addEventListener('click', this.onShareUrl);
    },

    onShareUrl: function ui_onShareUrl() {
      Controller.shareUrl('DummyId',
        function onSuccess() {
        },
        function onError(e) {
          alert(e.message)
        }
      );
    }
  };

  exports.UI = UI;
}(this));
