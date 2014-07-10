

(function (exports) {

  'use strict';

  var domOverlay, overlayMessage;

  var LoadingOverlay = {
    show: function (text) {
      if (!domOverlay) {
        domOverlay = document.getElementById('loading-overlay');
        overlayMessage = document.getElementById('loading-overlay-message');
      }
      domOverlay.classList.add('show');
      overlayMessage.textContent = text;
    },
    hide: function () {
      if (domOverlay) {
        domOverlay.classList.remove('show');
      }
    }
  };

  exports.LoadingOverlay = LoadingOverlay;

}(this));
