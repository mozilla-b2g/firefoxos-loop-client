'use strict';

window.addEventListener('load', function load() {
  window.removeEventListener('load', load);
  CompatibilityChecker.check();
  // TODO Add LazyLoading
  // TODO If it's an incoming call, I launch it before rendering the app
  Controller.init();
  Branding.naming();
  window.addEventListener('localized', Branding.naming);

  // Headers have to be properly resized and centered, we emmit a lazyload event
  LazyLoader.load('libs/font_size_utils.js', () => {
    window.dispatchEvent(new CustomEvent('lazyload', {
      detail: document.body
    }));
  });
});