/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global UI, CallHelper, AccountHelper, FxacHelper */

/* exported Controller */

'use strict';

/*
 * This code is in charge of 'Controlling' all actions from the Loop
 * Library and link with UI operations. Controller is, as it name
 * indicates, the Controller part of MVC
 */

(function (exports) {
  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  /**
   * Handle the simple push notifications the device receives as an incoming
   * call.
   *
   * @param {Numeric} notificationId Simple push notification id (version).
   */
  function _onNotification(notificationId) {
    navigator.mozApps.getSelf().onsuccess = function (evt) {
      var app = evt.target.result;
      app.launch();
      UI.incomingCall(
        function onAnswer() {
          UI.callScreen(
            function onSwitchSpeaker() {
              CallHelper.switchSpeaker();
            },
            function onHangup() {
              CallHelper.hangUp();
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
        }
      );
    };
  }

  var Controller = {
    /**
     * Init function.
     */
    init: function c_init() {
      var onAccount = function(account) {
        // If account is null it means there wasn't a account before.
        // This will let us know if there was an account before, and we need
        // this to check if we need to show the full Tutorial or just the
        // authentication flow.
        if(!account || !account.id) {
          UI.signUp(this.signUp);
          return;
        }
        UI.signIn(this.signIn);
      };

      UI.init();

      AccountHelper.getAccount(onAccount.bind(Controller));
    },

    /**
     * Sign up the user.
     *
     * @param {Bool} msisdnSignUp Flag to determine whether the user performs
     *                            the sign up process with a MSISDN assertion.
     *                            If false, the user performs the sign up
     *                            process with a Fx Account assertion.
     * @param {Function} onsuccess Function to be called once the user gets
     *                             signed up.
     * @param {Function} onerror Function to be called in case of any error. An
     *                           error object is passed as parameter.
     */
    signUp: function signUp(msisdnSignUp, onsuccess, onerror) {
      var onSuccess = function() {
        UI.shareUrl(this.shareUrl);
        UI.logOut(this.logOut);
        _callback(onsuccess);
      };

      var onLogin = function(assertion) {
        if (msisdnSignUp) {
        } else {
          FxacHelper.logout();
        }

        var credentials = {};
        if (msisdnSignUp) {
          credentials.type = '';
        } else {
          credentials.type = 'BrowserID';
        }
        credentials.value = assertion;

        AccountHelper.signUp(
          credentials, onSuccess.bind(Controller), onerror, _onNotification
        );
      };

      if (msisdnSignUp) {
        // TODO: Request the MSISD assertion and start the registation dance.
        _callback(
          onerror, [new Error('Cannot register user through MSISDN yet.')]
        );
      } else {
        // TODO: Uncomment this once the prod server supports FxA-based sign up.
        // FxacHelper.init(onLogin);
        // FxacHelper.register();
        AccountHelper.signUp(
          null, onSuccess.bind(Controller), onerror, _onNotification
        );
      }
    },

    /**
     * Sign in the user.
     *
     * @param {Function} onsuccess Function to be called once the user gets
     *                             signed in.
     * @param {Function} onerror Function to be called in case of any error. An
     *                           error object is passed as parameter.
     */
    signIn: function signIn(onsuccess, onerror) {
      var onSuccess = function() {
        UI.shareUrl(this.shareUrl);
        UI.logOut(this.logOut);
        _callback(onsuccess);
      };
      AccountHelper.signIn(
        onSuccess.bind(Controller), onerror, _onNotification
      );
    },

    /**
     * Share the call url with called party.
     *
     * @param {String} id Peer's id.
     * @param {Function} onsuccess Function to be called once the call URL is
     *                             shared correctly.
     * @param {Function} onerror Function to be called when an error occurs. An
     *                           error object is passed as parameter.
     */
    shareUrl: function c_shareUrl(id, onsuccess, onerror) {
      CallHelper.generateCallUrl(id,
        function onCallUrlSuccess(result) {
          Utils.log('Loop web URL ' + result.call_url);
          var activity = new MozActivity({
            name: 'share',
            data: {
              type: 'url',
              url: result.call_url
            }
          });
          activity.onsuccess = onsuccess;
          activity.onerror =
           _callback.bind(null, onerror, [new Error('Activity error')]);
        },
        onerror
      );
    },

    /**
     * Log the user out. It clears the app account.
     *
     * @param {Function} onlogout Function to be called once the logout call
     *                            gets completed.
     */
    logOut: function logOut(onlogout) {
      AccountHelper.logOut(onlogout);
    }
  };

  exports.Controller = Controller;
}(this));
