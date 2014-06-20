(function(exports) {
  'use strict';

  var sharePanel, shareButton;

  var Share = {
    init: function w_init() {
      if (sharePanel) {
        return;
      }
      sharePanel = document.getElementById('share-panel');
      shareButton = document.getElementById('share-done-mock');
      shareButton.addEventListener(
        'click',
        function() {
          this.hide();
        }.bind(this)
      )
    },
    show: function s_show() {
      sharePanel.classList.add('show');
    },
    hide: function s_hide() {
      sharePanel.classList.remove('show');
    }
  };

  exports.Share = Share;
}(this));