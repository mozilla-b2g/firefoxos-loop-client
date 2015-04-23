'use strict';

var SplashScreen = {
  hide: function s_hide() {
    var splashPanel = document.getElementById('splash-screen');

    splashPanel.addEventListener('transitionend', function onTransitionEnd() {
      splashPanel.removeEventListener('transitionend', onTransitionEnd);
      splashPanel.parentNode.removeChild(splashPanel);
      var splashScreenSheet = document.getElementById('splash-screen-stylesheet');
      splashScreenSheet.parentNode.removeChild(splashScreenSheet);
      SplashScreen = null;
    });

    splashPanel.classList.add('invisible');
  }
};
