/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global UI, CallHelper, PushNotification, AudioCompetingHelper */

/* exported Callscreen */

'use strict';

(function (exports) {

  var Callscreen = {
    init: function c_init() {
      var notificationId = null;
      var rawParams = window.location.search.slice(1);
      var params = rawParams.split('&');
      for (var i = 0; i < params.length; i++) {
        if (params[i].indexOf('notificationid=') !== -1) {
          notificationId = params[i].replace('notificationid=', '');
        }
      }

      if (!notificationId) {
        window.close();
      }

      var _onSuccess = function() {
        UI.init();

        AudioCompetingHelper.init('loop');

        UI.incomingCall(
          function onAnswer() {
            UI.callScreen(
              function onSwitchSpeaker() {
                CallHelper.switchSpeaker();
              },
              function onHangup() {
                CallHelper.hangUp();
                window.close();
              }
            );
            // TODO: the constraints object should be definded based on user's
            // preferences such as the ones exposed in the UI or the ones selected
            // in the hipothetical settings panel we should have.
            var constraints = {audio: true, video: true};
            CallHelper.handleIncomingCall(notificationId,
                                          'audio-video-container',
                                          constraints);
          },
          function onReject() {
            window.close();
          }
        );
      };

      var _onError = function () {
        alert('Oh no!, something bad happened!');
        window.close();
      };

      AccountHelper.signIn(
        _onSuccess.bind(Callscreen),
        _onError.bind(Callscreen),
        PushNotification.onNotification
      );
    }
  };

  exports.Callscreen = Callscreen;
}(this));
