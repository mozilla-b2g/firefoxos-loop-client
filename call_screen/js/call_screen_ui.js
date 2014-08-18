(function(exports) {
  'use strict';

  var _isVideoEnabled = false;
  var _isSpeakerEnabled = true;
  var _isMicEnabled = true;

  var _feedbackClose;

  var _; // l10n
  
  var _hangoutButton, _answerAudioButton, _answerVideoButton,
      _settingsButton, _settingsButtonVideo, _settingsButtonMute,
      _settingsButtonSpeaker, _resumeButton, _callStatusInfo,
      _fakeLocalVideo, _localVideo;

  function _toggleSettings(callback) {
    document.body.classList.remove('no-transition');
    _settingsButtonSpeaker.addEventListener(
      'transitionend',
      function onTransitionEnd() {
        _settingsButtonSpeaker.removeEventListener('transitionend', onTransitionEnd);

        if (document.body.dataset.settings !== 'true') {
          document.body.classList.add('no-transition');
        }

        if (typeof callback === 'function') {
          callback();
        }
      }
    );

    if (document.body.dataset.settings !== 'true') {
      document.body.dataset.settings = true;
    } else {
      document.body.dataset.settings = false;
    }
  }

  var _initialized = false;

  var CallScreenUI = {
    init: function(isVideoCall) {
      if (_initialized) {
        return;
      }
      
      _ = navigator.mozL10n.get;

      _initialized = true;

      // Choose default camera
      var cameraConstraint = navigator.mozCameras.getListOfCameras().length > 1 ?
        {facingMode: 'user', require:['facingMode']} : true;

      // Cache the rest of elements
      _callStatusInfo = document.getElementById('call-status-info');
      _localVideo = document.getElementById('local-video');

      // Ask for the Stream
      navigator.mozGetUserMedia(
        {
          video: cameraConstraint,
          audio: false
        },
        function onStreamReady(stream) {
          var progress = _localVideo.querySelector('progress');
          progress && _localVideo.removeChild(progress);
          // Show your own stream as part of the GUM wizard
          _fakeLocalVideo = document.createElement('video');
          _fakeLocalVideo.className = 'fake-local-video';
          _fakeLocalVideo.mozSrcObject = stream;
          _localVideo.appendChild(_fakeLocalVideo);
          _fakeLocalVideo.play();
        },
        function(err) {
          console.log("An error occured! " + err);
        }
      );

      // Hangout button. We need to stop the ringer
      // and the countdown. Session should be disconnected
      // as well.
      _hangoutButton = document.getElementById('hang-out');
      _hangoutButton.addEventListener(
        'mousedown',
        function hangOutClick(e) {
          Ringer.stop();
          Countdown.stop();
          CallManager.stop();
        }
      );

      _answerAudioButton = document.getElementById('answer');
      _answerVideoButton = document.getElementById('answer-video');

      // We have 2 buttons for answering a call, depending on if we are
      // publishing video or not
      function _answer(isVideo) {
        _isVideoEnabled = isVideo;
        Ringer.stop();
        CallScreenUI.setCallStatus('connecting');
        CallManager.join(isVideo);
        CallScreenUI.updateLocalVideo(isVideo);
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
      _settingsButton = document.getElementById('call-settings');
      
      _settingsButton.addEventListener(
        'mousedown',
        function onSettingsClick(e) {
           _toggleSettings();
        }
      );

      _settingsButtonVideo.addEventListener(
        'mousedown',
        function onSettingsClick(e) {
          _isVideoEnabled = !_isVideoEnabled;
          _settingsButtonVideo.classList.toggle('disabled');
          CallScreenUI.updateLocalVideo(
            _isVideoEnabled,
            function onUIUpdated() {
              CallManager.toggleVideo(_isVideoEnabled);
            }
          );
        }
      );

      _settingsButtonMute.addEventListener(
        'mousedown',
        function onSettingsClick(e) {
          _settingsButtonMute.classList.toggle('disabled');
          _isMicEnabled = !_isMicEnabled;
          CallManager.toggleMic(_isMicEnabled);
        }
      );

      _settingsButtonSpeaker.addEventListener(
        'mousedown',
        function onSettingsClick(e) {
          _settingsButtonSpeaker.classList.toggle('enabled');
          _isSpeakerEnabled = !_isSpeakerEnabled;
          CallManager.toggleSpeaker(_isSpeakerEnabled);
        }
      );
      

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
      if (isVideoCall || isVideoCall === 'true') {
        _isVideoEnabled = true;
        _isSpeakerEnabled = true;
        _settingsButtonSpeaker.classList.add('enabled');
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

      /*
      // Canceling orientation handling by now until fixing
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1053699
      OrientationHandler.on('orientation', function(event) {
        document.body.dataset.rotation = event;
      });
      OrientationHandler.start();
      */
    },
    setCallStatus: function(state) {
      switch(state) {
        case 'calling':
          _callStatusInfo.textContent = _('connecting');
          break;
        case 'connecting':
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
      // As there is a translation of the buttons when video is off/on
      // we need to track when the animation is over.
      _hangoutButton.addEventListener(
        'transitionend',
        function onHangoutTranslated() {
          _hangoutButton.removeEventListener('transitionend', onHangoutTranslated);
          if (typeof callback === 'function') {
            callback();
          }
        }
      );

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
      _localVideo.removeChild(_fakeLocalVideo);
      _fakeLocalVideo = null;
    }
  };

  exports.CallScreenUI = CallScreenUI;

}(this));
