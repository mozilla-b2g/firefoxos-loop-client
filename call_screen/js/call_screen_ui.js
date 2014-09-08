(function(exports) {
  'use strict';

  var _isVideoEnabled = false;
  var _isSpeakerEnabled = true;
  var _isMicEnabled = true;

  var _feedbackClose;

  var _; // l10n

  var _hangupButton, _answerAudioButton, _answerVideoButton,
      _settingsButtonVideo, _settingsButtonMute,
      _settingsButtonSpeaker, _resumeButton, _callStatusInfo,
      _fakeLocalVideo, _localVideo;

  var _initialized = false;


  function _hangUp(error) {
    TonePlayerHelper.stop();
    TonePlayerHelper.releaseResources();
    Ringer.stop();
    Countdown.stop();
    CallManager.stop(error);
  }

  var CallScreenUI = {
    init: function(isVideoCall, frontCamera) {
      if (_initialized) {
        return;
      }

      _ = navigator.mozL10n.get;

      _initialized = true;

      TonePlayerHelper.init('telephony');

      var mode = frontCamera ? 'user':'environment';
      var cameraConstraint = {facingMode: mode, require: ['facingMode']};

      // Cache the rest of elements
      _localVideo = document.getElementById('local-video');

      // Ask for the Stream
      navigator.mozGetUserMedia(
        {
          video: cameraConstraint,
          audio: true
        },
        function onStreamReady(stream) {
          var progress = _localVideo.querySelector('progress');
          progress && _localVideo.removeChild(progress);
          // Show your own stream as part of the GUM wizard
          _fakeLocalVideo = document.createElement('video');
          _fakeLocalVideo.className = 'fake-local-video';
          _fakeLocalVideo.muted = true;
          _fakeLocalVideo.mozSrcObject = stream;
          _localVideo.appendChild(_fakeLocalVideo);
          _fakeLocalVideo.play();
        },
        function(err) {
          _hangUp({
            reason: 'gum'
          });
          console.log("An error occured! " + err);
        }
      );

      // Hangout button. We need to stop the ringer
      // and the countdown. Session should be disconnected
      // as well.
      _hangupButton = document.getElementById('hang-up');
      _hangupButton.addEventListener(
        'mousedown',
        _hangUp
      );

      _answerAudioButton = document.getElementById('answer');
      _answerVideoButton = document.getElementById('answer-video');

      // We have 2 buttons for answering a call, depending on if we are
      // publishing video or not
      function _answer(isVideo) {
        _isVideoEnabled = isVideo;
        Ringer.stop();
        CallScreenUI.setCallStatus('connecting');
        CallManager.join(isVideo, frontCamera);
        CallScreenUI.updateLocalVideo(isVideo);
        if (isVideo) {
          _settingsButtonSpeaker.classList.add('setting-enabled');
          _settingsButtonVideo.classList.remove('setting-disabled');
        } else {
          _settingsButtonSpeaker.classList.remove('setting-enabled');
          _settingsButtonVideo.classList.add('setting-disabled');
        }
      }

      _answerAudioButton.addEventListener(
        'click',
        function answerClick(e) {
          _answer(false);
        }
      );

      _answerVideoButton.addEventListener(
        'click',
        function answerVideo(e) {
          _answer(true);
        }
      );

      // Settings UI
      _settingsButtonSpeaker = document.getElementById('call-settings-speaker');
      _settingsButtonVideo = document.getElementById('call-settings-video');
      _settingsButtonMute = document.getElementById('call-settings-mute');

      _settingsButtonVideo.addEventListener(
        'mousedown',
        function onSettingsClick(e) {
          _isVideoEnabled = !_isVideoEnabled;
          // Change the status of the video
          _settingsButtonVideo.classList.toggle('setting-disabled');
          CallScreenUI.updateLocalVideo(
            _isVideoEnabled,
            function onUIUpdated() {
              CallManager.toggleVideo(_isVideoEnabled);
            }
          );
          CallManager.toggleVideo(_isVideoEnabled);
        }
      );

      _settingsButtonMute.addEventListener(
        'mousedown',
        function onSettingsClick(e) {
          _settingsButtonMute.classList.toggle('setting-disabled');
          _isMicEnabled = !_isMicEnabled;
          CallManager.toggleMic(_isMicEnabled);
        }
      );

      function _enableSpeakerButton() {
        _settingsButtonSpeaker.addEventListener(
          'mousedown',
          function onSettingsClick(e) {
            _settingsButtonSpeaker.classList.toggle('setting-enabled');
            _isSpeakerEnabled = !_isSpeakerEnabled;
            CallManager.toggleSpeaker(_isSpeakerEnabled);
          }
        );
      }
      
      _resumeButton = document.getElementById('resume-button');
      // Resume button. On click resume the call.
      _resumeButton.addEventListener(
        'click',
        function onResume() {
          CallManager.resume();
          CallScreenUI.setCallStatus('connected');
        }
      );

      // Update UI taking into account if the call is a video call or not
      _isVideoEnabled = _isSpeakerEnabled = isVideoCall && isVideoCall != 'false';
      if (document.body.dataset.callStatus === 'outgoing') {
        TonePlayerHelper.playDialing(_isSpeakerEnabled, _enableSpeakerButton);
        CallScreenUI.updateLocalVideo(_isVideoEnabled);
        if (_isVideoEnabled) {
          _settingsButtonSpeaker.classList.add('setting-enabled');
          _settingsButtonVideo.classList.remove('setting-disabled');
        } else {
          _settingsButtonSpeaker.classList.remove('setting-enabled');
          _settingsButtonVideo.classList.add('setting-disabled');
        }
      } else {
        _enableSpeakerButton();
      }

      Countdown.init();

      LazyLoader.load(
        [
          '../style/bb/progress_activity.css',
          '../style/bb/switches.css',
          '../style/bb/edit_mode.css',
          '../style/bb/lists.css',
          '../style/bb/buttons.css',
          '../libs/components/gaia-layout/style.css'
        ]
      );


      // Set the callback function to be called once the call is held in the
      // call manager helper.
      CallManager.onhold = this.toggleHold;

      // Set the callback function to be called once the peer has set its call
      // on hold.
      CallManager.onpeeronhold = this.notifyCallHeld;

      // Set the callback function to be called once the peer has resumed the
      // held call.
      CallManager.onpeerresume = this.notifyCallResume;

      // Set the callback function to be called on peer busy.
      CallManager.onpeerbusy = this.notifyPeerBusy;

      // Set the callback function to be called on peer rejecting the call.
      CallManager.onpeerreject = this.notifyPeerReject;

      // Set the callback function to be called either on peer cancelling
      // or terminating (timeout) the call.
      CallManager.onpeercancel = this.notifyPeerCancel;

      // Use status bar in the call screen
      window.onresize = function() {
        if (_feedbackClose && typeof _feedbackClose === 'function') {
          _feedbackClose();
          return;
        }
        if (document.body.classList.contains('status-bar')) {
          document.body.classList.remove('status-bar');
        } else {
          document.body.classList.add('status-bar');
        }
      };


      // // Canceling orientation by now. This will be part of the
      // // nice to have features.
      // LazyLoader.load(
      //   [
      //     '../libs/orientation_vendor.js'
      //   ],
      //   function() {
      //     OrientationHandler.on('orientation', function(event) {
      //       document.body.dataset.rotation = event;
      //     });
      //     OrientationHandler.start();
      //   }
      // );

    },
    isStatusBarShown: function() {
      return document.body.classList.contains('status-bar');
    },
    setCallStatus: function(state) {
      if (!_callStatusInfo) {
        _callStatusInfo = document.getElementById('call-status-info');
      }
      switch(state) {
        case 'calling':
          TonePlayerHelper.stop();
          TonePlayerHelper.playRingback(_isSpeakerEnabled);
          _callStatusInfo.textContent = _('calling');
          document.body.dataset.callStatus = 'outgoing';
          break;
        case 'connecting':
          TonePlayerHelper.stop();
          _callStatusInfo.textContent = _('connecting');
          document.body.dataset.callStatus = 'connected';
          break;
        case 'connected':
          Countdown.start();
          document.body.dataset.callStatus = 'connected';
          break;
        case 'disconnected':
          // TODO Styles not defined yet.
          break;
        case 'hold':
          document.body.dataset.callStatus = 'hold';
          _callStatusInfo.textContent = _('onHold');
          break;
        case 'remotehold':
          document.body.dataset.callStatus = 'remotehold';
          _callStatusInfo.textContent = _('onHold');
          break;
        case 'busy':
          // Show the state for the time being.
          // Bug 1054417 - [Loop] Implement 'busy' call screen
          _callStatusInfo.textContent = _('busy');
          break;
        case 'reject':
          _callStatusInfo.textContent = _('declined');
          break;
      }
    },

    updateRemoteVideo: function(videoStatus) {
      if (videoStatus == true) {
        document.body.dataset.remoteVideo = 'on';
        return;
      }
      document.body.dataset.remoteVideo = 'off';
    },
    updateLocalVideo: function(videoStatus, callback) {
      if (videoStatus == true) {
        document.body.dataset.localVideo = 'on';
        return;
      }
      document.body.dataset.localVideo = 'off';
    },
    showFeedback: function(callback) {
      _feedbackClose = callback;
      document.getElementById('skip-feedback-button').addEventListener(
        'click',
        function onSkip() {
          if (typeof callback === 'function') {
            callback();
          }
        }
      );

      document.getElementById('rate-feedback-button').addEventListener(
        'click',
        function onSkip() {
          if (typeof callback === 'function') {
            // TODO Collect info and send to Controller
            callback();
          }
        }
      );

      document.getElementById('answer-happy').addEventListener(
        'click',
        function onSkip() {
          if (typeof callback === 'function') {
            callback();
          }
        }
      );

      document.getElementById('answer-sad').addEventListener(
        'click',
        function onSkip() {
          document.getElementById('feedback').classList.add('two-options');
          document.querySelector('[data-question]').dataset.question = 2;
        }
      );

      document.body.dataset.feedback = true;
    },
    toggleHold: function() {
      CallScreenUI.setCallStatus('hold');
    },
    removeFakeVideo: function() {
      try {
        _localVideo && _fakeLocalVideo && _localVideo.removeChild(_fakeLocalVideo);
      } catch(e) {
        console.log('Fake video was removed before');
      }
      _fakeLocalVideo = null;
    },
    notifyCallHeld: function() {
      TonePlayerHelper.playHold();
      CallScreenUI.setCallStatus('remotehold');
    },
    notifyCallResume: function() {
      TonePlayerHelper.stop();
      CallScreenUI.setCallStatus('connected');
    },
    notifyPeerBusy: function() {
      CallScreenUI.setCallStatus('busy');
      TonePlayerHelper.playBusy().then(function onplaybackcompleted() {
        TonePlayerhelper.stop();
        TonePlayerHelper.releaseResources();
        CallManager.stop();
      });
    },
    notifyPeerReject: function() {
      CallScreenUI.setCallStatus('reject');
      TonePlayerHelper.playBusy().then(function onplaybackcompleted() {
        TonePlayerHelper.stop();
        TonePlayerHelper.releaseResources();
        CallManager.stop();
      });
    },
    notifyPeerCancel: function() {
      Ringer.stop();
      TonePlayerHelper.stop();
      TonePlayerHelper.releaseResources();
      CallManager.stop();
    }
  };

  exports.CallScreenUI = CallScreenUI;

}(this));
