

(function (exports) {

  'use strict';

  var domOverlay, closeOverlayButton, titleEl, iframe;

  function createWebviewIframe() {
    var newIframe = document.createElement('iframe');
    newIframe.id = 'webview-iframe';

    return newIframe;
  }

  var WebviewOverlay = {
    show: function (title, src) {
      if (!domOverlay) {
        domOverlay = document.getElementById('webview-overlay');
        closeOverlayButton = document.getElementById('webview-close');
        titleEl = document.getElementById('webview-overlay-title');
        iframe = document.getElementById('webview-iframe');
        // Add listeners
        closeOverlayButton.addEventListener('click', this.hide.bind(this));
      }
      domOverlay.classList.add('show');
      iframe.src = src || '';
      titleEl.textContent = title || '';
    },
    hide: function () {
      if (domOverlay) {
        domOverlay.classList.remove('show');
        domOverlay.removeChild(iframe);
        iframe = createWebviewIframe();
        domOverlay.appendChild(iframe);
      }
    }
  };

  exports.WebviewOverlay = WebviewOverlay;

}(this));
