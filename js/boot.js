'use strict';

window.addEventListener('DOMContentLoaded', function load() {
  window.removeEventListener('DOMContentLoaded', load);
  Telemetry.updateObjectFields = RoomsDB.updateFrequencyValues;
  CompatibilityChecker.check().then(() => {
    LazyLoader.load('js/update_checker.js', () => {
      UpdateChecker.check();
    });
  });
  // TODO Add LazyLoading
  // TODO If it's an incoming call, I launch it before rendering the app
  Controller.init();
  Branding.naming();
  window.addEventListener('localized', () => {
    Branding.naming();
  });

  // Headers have to be properly resized and centered, we emmit a lazyload event
  LazyLoader.load('libs/font_size_utils.js', () => {
    window.dispatchEvent(new CustomEvent('lazyload', {
      detail: document.body
    }));
  });
});