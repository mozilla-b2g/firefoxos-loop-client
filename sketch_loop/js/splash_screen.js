(function(exports) {
  'use strict';

  var splashPanel;

  var SplashScreen = {
    init: function w_init() {
      if (splashPanel) {
        return;
      }
      splashPanel = document.getElementById('splash-screen');
    },
    show: function s_show() {
      splashPanel.classList.add('show');
    },
    hide: function s_hide() {
      splashPanel.addEventListener('transitionend', function onTransitionEd() {
        splashPanel.removeEventListener('transitionend', onTransitionEd);
        splashPanel.classList.remove('show');
      });
      splashPanel.classList.add('invisible');
    }
  };

  exports.SplashScreen = SplashScreen;
}(this));

SplashScreen.init();