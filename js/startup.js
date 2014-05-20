/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

/*
 * The structure should be the following:
 * - User actions must be *only* managed in 'ui.js'.
 * - Startup is the first code executed, so optimization as
 * lazy loading could be there.
 * - Controller is, as it name indicates, the Controller part of MVC
 * - We will include handlers/helpers to manage the calls and talk with
 * Loop & Opentok
 */

/*
 * This is the first code executed when loading the 'locales' file.
 * We could add Lazy loading and the initialization of the rest of
 * the modules needed
 */

window.addEventListener('localized', function onLocalized() {
  window.removeEventListener('localized', onLocalized);

  // TODO: This piece of code will be removed eventually. Temporary start up.
  SimplePush.createChannel(
   'loop',
   function onNotification(version) {
     // TODO
   },
   function onRegistered(error, endpoint) {
     if (error || !endpoint) {
       alert('Could not get simple push url.');
       return;
     }
     SimplePush.start();
     ClientRequestHelper.register(endpoint,
       function onRegisterSuccess() {
         UI.init();
       },
       function onRegisterError() {
         alert('Could not register the peer.');
         return;
       });
   });
});
