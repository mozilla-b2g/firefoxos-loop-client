/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global Callscreen */

'use strict';
window.addEventListener('localized', function onLocalized() {
  window.removeEventListener('localized', onLocalized);

  Callscreen.init();
});
