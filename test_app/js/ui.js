/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

/* exported UI */

/*
 * This code is in charge of the UI & User actions in our app.
 * This is the 'View' part of our MVC.
 */

(function (exports) {
  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  var UI = {
    audioElement: null,
    signUpButton: null,
    logoutButton: null,
    shareUrlButton: null,
    answerButton: null,
    rejectButton: null,
    switchSpeakerButton: null,
    hangupButton: null,

    /**
     * Init function.
     */
    init: function ui_init(oninit) {
      // Retrieve the various page elements
      this.signUpButton = document.getElementById('signup');
      this.logoutButton = document.getElementById('logout');
      this.shareUrlButton = document.getElementById('share');
      this.answerButton = document.getElementById('answer');
      this.rejectButton = document.getElementById('reject');
      this.switchSpeakerButton = document.getElementById('switchSpeaker');
      this.hangupButton = document.getElementById('hangup');
    },

    /**
     * Set sign up UI. Function to be called once the sign up elements need to
     * be shown.
     *
     * @param {Function} onsignup Function to be called once the user wants to
     *                            sign up. This callback funcion has the
     *                            following parameters:
     *                            - {String} id Peer's id.
     *                            - {Function} onsuccess Callback function to be
     *                                                   called once the sign up
     *                                                   process gets completed.
     *                            - {Function} onerror Callback function to be
     *                                                 called in case of errros.
     *                                                 This function will have
     *                                                 an error object as
     *                                                 paramenter.
     */
    signUp: function ui_signUp(onsignup) {
      var onSignUpSuccess = function() {
        this.signUpButton.hidden = true;
      };

      var onSignUpError = function(e) {
        alert(e);
      };

      this.signUpButton.hidden = false;
      this.signUpButton.onclick = function onClickSignUpButton() {
        _callback(
          onsignup, [false, onSignUpSuccess.bind(UI), onSignUpError]
        );
      };
    },

    /**
     * Set sign in UI. Function to be called once the sign in elements need to
     * be shown.
     *
     * @param {Function} onsignin Function to be called once the user wants to
     *                            sign in. This callback funcion has the
     *                            following parameters:
     *                            - {Function} onsuccess Callback function to be
     *                                                   called once the sign in
     *                                                   process gets completed.
     *                            - {Function} onerror Callback function to be
     *                                                 called in case of errros.
     *                                                 This function will have
     *                                                 an error object as
     *                                                 paramenter.
     */
    signIn: function ui_signIn(onsignin) {
      var onSignInSuccess = function() {
      };

      var onSignInError = function(e) {
        alert(e);
      };

      _callback(onsignin, [onSignInSuccess.bind(UI), onSignInError]);
    },

    /**
     * Set share url UI. Function to be called once the share url elements need
     * to be shown.
     *
     * @param {Function} onshareurl Function to be called once the user wants to
     *                              share a call url. This callback funcion has
     *                              the following parameters:
     *                              - {Function} onsuccess Callback function to
     *                                                     be called once the
     *                                                     share url process
     *                                                     gets completed.
     *                              - {Function} onerror Callback function to be
     *                                                   called in case of
     *                                                   errros. This function
     *                                                   will have an error
     *                                                   object as paramenter.
     */
    shareUrl: function ui_shareUrl(onshareurl) {
      var onShareUrlSuccess = function() {
      };

      var onShareUrlError = function(e) {
        alert(e.message);
      };

      this.shareUrlButton.hidden = false;
      this.shareUrlButton.onclick = function onClickShareUrlButton() {
        _callback(onshareurl, ['dummyId', onShareUrlSuccess, onShareUrlError]);
      };
    },

    /**
     * Set the incoming call UI.
     *
     * @param {Function} onanswer Function to be called when answering.
     * @param {Function} onreject Function to be called when rejecting the call.
     */
    incomingCall: function ui_incomingCall(onanswer, onreject) {
      var onClickAnswerButton = function() {
        this.audioElement.pause();
        this.answerButton.hidden = true;
        this.rejectButton.hidden = true;
        _callback(onanswer);
      };

      var onClickRejectButton = function() {
        this.audioElement.pause();
        this.shareUrlButton.hidden = false;
        this.answerButton.hidden = true;
        this.rejectButton.hidden = true;
        _callback(onreject);
      };

      this.audioElement = new Audio();
      this.audioElement.mozAudioChannelType = 'ringer';
      this.audioElement.src =
        '/resources/media/ringtones/ringer_classic_wallphone.ogg';
      this.audioElement.play();

      this.shareUrlButton.hidden = true;
      this.answerButton.hidden = false;
      this.rejectButton.hidden = false;

      this.answerButton.onclick = onClickAnswerButton.bind(this);
      this.rejectButton.onclick = onClickRejectButton.bind(this);
    },

    /**
     * Set the call screen UI.
     *
     * @param {Function} onswitchspeaker Function to be called when switching
     *                                   audio.
     * @param {Function} onhanup Function to be called when hanging up.
     */
    callScreen: function ui_callScreen(onswitchspeaker, onhangup) {
      var onClickHangupButton = function() {
        this.shareUrlButton.hidden = false;
        this.switchSpeakerButton.hidden = true;
        this.hangupButton.hidden = true;
        _callback(onhangup);
      };

      var onClickSwitchSpeaker = function() {
        _callback(onswitchspeaker);
      }

      this.switchSpeakerButton.hidden = false;
      this.hangupButton.hidden = false;

      this.hangupButton.onclick = onClickHangupButton.bind(this);
      this.switchSpeakerButton.onclick = onClickSwitchSpeaker.bind(this);
    },

    /**
     * Set logout UI. Function to be called once the logout elements need to be
     * shown.
     *
     * @param {Function} onlogout Function to be called once the user wants to
     *                            share a call url. This callback funcion has
     *                            the following parameters:
     *                            - {Function} onlogout Callback function to be
     *                                                  called once the logout
     *                                                  process gets completed.
     */
    logOut: function ui_logOut(onlogout) {
      var close = function() {
        window.close();
      };

      this.logoutButton.hidden = false;
      this.logoutButton.onclick = function onClickLogoutButton() {
        _callback(onlogout, [close]);
      };
    },

    /**
     * Generic error function.
     *
     * @param {Error} e Error object informing about the error.
     */
    showError: function ui_showError(e) {
      alert(e.message);
    }
  };

  exports.UI = UI;
}(this));
