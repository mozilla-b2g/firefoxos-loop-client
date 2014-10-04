(function(exports) {
  'use strict';

  var _perfDebug = Config.performanceLog.enabled;
  var _perfBranch = 'CallScreen';

  var _isVideoEnabled = false;
  var _isSpeakerEnabled = true;
  var _isMicEnabled = true;

  var _gUMFailed = false;

  var _feedbackClose;

  var _; // l10n

  var _hangupButton, _answerAudioButton, _answerVideoButton,
      _settingsButtonVideo, _settingsButtonMute,
      _settingsButtonSpeaker, _resumeButton, _callStatusInfo,
      _fakeLocalVideo, _localVideo, _feedback;

  var _initialized = false;

  function _hangUp(error) {
    Ringer.stop();
    Countdown.stop();
    CallScreenUI.notifyCallEnded(error);
  }

  function Feedback(happy, description) {
    this.happy = happy;
    this.description = description;
  }

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

  var CallScreenUI = {
    init: function(isIncoming, isVideoCall, frontCamera) {
      if (_initialized) {
        return;
      }
      _initialized = true;

      _perfDebug && PerfLog.log(_perfBranch, 'CallScreenUI.init');

      // Start rest of helpers
      TonePlayerHelper.init('telephony');
      Countdown.init();
      _ = navigator.mozL10n.get;

      // Update global params of the call
      var mode = frontCamera ? 'user' : 'environment';
      var cameraConstraint = {facingMode: mode, require: ['facingMode']};
      _isVideoEnabled = _isSpeakerEnabled = isVideoCall && isVideoCall != 'false';
      
      // Cache the rest of elements
      _localVideo = document.getElementById('local-video');

      // Ask for the Stream in order to ensure the fake video while opentok
      // is booting
      _perfDebug && PerfLog.log(_perfBranch, 'Requesting fake video via gUM');
      navigator.mozGetUserMedia(
        {
          video: cameraConstraint,
          audio: true
        },
        function onStreamReady(stream) {
          _perfDebug && PerfLog.log(_perfBranch,
                        'Showing fake video');
          var progress = _localVideo.querySelector('progress');
          progress && _localVideo.removeChild(progress);
          // Show your own stream as part of the GUM wizard
          _fakeLocalVideo = document.createElement('video');
          _fakeLocalVideo.className = 'fake-local-video';
          if (frontCamera) {
            _fakeLocalVideo.style.transform = 'rotateY(180deg)';
          }
          _fakeLocalVideo.muted = true;
          _fakeLocalVideo.mozSrcObject = stream;
          _localVideo.appendChild(_fakeLocalVideo);
          _fakeLocalVideo.play();
          if (_perfDebug) {
            var onfakevideoplaying = function onfakevideoplaying() {
              _fakeLocalVideo.removeEventListener('playing', onfakevideoplaying);
              PerfLog.log(_perfBranch, 'Fake video playing');
            };
            _fakeLocalVideo.addEventListener('playing', onfakevideoplaying);
          }
        },
        function(err) {
          console.log("An error occured! " + err);
          if (isIncoming) {
            _gUMFailed = true;
            return;
          }
          _hangUp({
            reason: 'gum'
          });
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
        if (_gUMFailed) {
          _hangUp({
            reason: 'gum'
          });
          return;
        }
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

      

      _resumeButton = document.getElementById('resume-button');
      // Resume button. On click resume the call.
      _resumeButton.addEventListener(
        'click',
        function onResume() {
          CallManager.resume();
          CallScreenUI.setCallStatus('connected');
        }
      );

      // Update the status of the UI & Tones properly
      if (document.body.dataset.callStatus === 'outgoing') {
        CallScreenUI.setCallStatus('dialing');
      } else {
        _enableSpeakerButton();
      }
      
      // Load rest of the resources needed
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

      // Set the callback function to be called on peer unavailable.
      CallManager.onpeerunavailable = this.notifyPeerUnavailable;

      // Set the callback function to be called on peer ending the call.
      CallManager.onpeerended = this.notifyCallEnded;

      // Set the callback function to be called when going offline during the
      // call.
      CallManager.oncallfailed = this.notifyCallFailed;

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

      _perfDebug && PerfLog.log(_perfBranch, 'CallScreenUI.setCallStatus ' + state);

      switch(state) {
        case 'dialing':
          // Fist step of the call. During this period we can not
          // ensure that the protocol is working (websocket), so we disable the
          // hangout button
          _hangupButton.disabled = true;
          // Play 'dialing' tone and update the UI taking into account
          // the preferences of the call.
          TonePlayerHelper.playDialing(_isSpeakerEnabled, _enableSpeakerButton);
          CallScreenUI.updateLocalVideo(_isVideoEnabled);
          if (_isVideoEnabled) {
            _settingsButtonSpeaker.classList.add('setting-enabled');
            _settingsButtonVideo.classList.remove('setting-disabled');
          } else {
            _settingsButtonSpeaker.classList.remove('setting-enabled');
            _settingsButtonVideo.classList.add('setting-disabled');
          }
          _callStatusInfo.textContent = _('calling');
          document.body.dataset.callStatus = 'outgoing';
          break;
        case 'calling':
          // Once we are in this step, the status of the protocol is 'alerting',
          // so we need to play a ringback tone (same as GSM).

          // Enable the button. Now when tapping 'hangup' we can terminate the
          // call accordingly through the protocol.
          _hangupButton.disabled = false;
          // Play ringback tone
          TonePlayerHelper.stop();
          TonePlayerHelper.playRingback(_isSpeakerEnabled);
          break;
        case 'connecting':
          // The other side has answered the call, so we need just to wait until
          // both streams will be published
          TonePlayerHelper.stop();
          _callStatusInfo.textContent = _('connecting');
          document.body.dataset.callStatus = 'connecting';
          break;
        case 'connected':
          // Both sides are publishing. This event is controlled by OpenTok and
          // has no relation with the 'connected' event of the Loop Protocol
          TonePlayerHelper.stop();
          TonePlayerHelper.playConnected();
          _perfDebug && PerfLog.log(_perfBranch, 'Countdown start counting');
          _perfDebug && PerfLog.milestone(_perfBranch, 'Countdown');
          Countdown.start();
          document.body.dataset.callStatus = 'connected';
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
          _hangupButton.removeEventListener('mousedown', _hangUp);
          _callStatusInfo.textContent = _('busy');
          break;
        case 'reject':
          _hangupButton.removeEventListener('mousedown', _hangUp);
          _callStatusInfo.textContent = _('declined');
          break;
        case 'unavailable':
          _hangupButton.removeEventListener('mousedown', _hangUp);
          _callStatusInfo.textContent = _('unavailable');
          break;
        case 'ended':
          _callStatusInfo.textContent = _('ended');
          document.body.dataset.callStatus = 'ended';
          break;
        case 'failed':
          _callStatusInfo.textContent = _('failed');
          document.body.dataset.callStatus = 'ended';
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
      if (!_feedback) {
        _feedback = document.getElementById('feedback');
      }
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
        function onRate() {
          if (typeof callback === 'function') {
            var description = [];
            var checked = _feedback.querySelectorAll(':checked');
            if (checked) {
              for (var i = 0, l = checked.length; i < l; i++) {
                description.push(checked[i].value);
              }
            }

            callback(new Feedback(false /* happy */, description));
          }
        }
      );

      document.getElementById('answer-happy').addEventListener(
        'click',
        function onAnswerHappy() {
          if (typeof callback === 'function') {
            callback(new Feedback(true /* happy */));
          }
        }
      );

      document.getElementById('answer-sad').addEventListener(
        'click',
        function onAnswerSad() {
          _feedback.classList.add('two-options');
          document.querySelector('[data-question]').dataset.question = 2;
        }
      );

      document.body.dataset.feedback = true;
    },
    toggleHold: function() {
      CallScreenUI.setCallStatus('hold');
    },
    removeFakeVideo: function() {
      _perfDebug && PerfLog.log(_perfBranch, 'removeFakeVideo');
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
      TonePlayerHelper.stop();
      CallScreenUI.setCallStatus('busy');
      CallManager.terminate();
      TonePlayerHelper.playBusy(_isSpeakerEnabled).then(
        function onplaybackcompleted() {
          TonePlayerHelper.stop();
          TonePlayerHelper.releaseResources();
          CallManager.leaveCall();
      });
    },
    notifyPeerReject: function() {
      TonePlayerHelper.stop();
      CallScreenUI.setCallStatus('reject');
      CallManager.terminate();
      TonePlayerHelper.playBusy(_isSpeakerEnabled).then(
        function onplaybackcompleted() {
          TonePlayerHelper.stop();
          TonePlayerHelper.releaseResources();
          CallManager.leaveCall();
      });
    },
    notifyPeerCancel: function() {
      Ringer.stop();
      TonePlayerHelper.stop();
      TonePlayerHelper.releaseResources();
      CallManager.terminate();
      CallManager.leaveCall();
    },
    notifyPeerUnavailable: function() {
      TonePlayerHelper.stop();
      CallScreenUI.setCallStatus('unavailable');
      CallManager.terminate();
      TonePlayerHelper.playFailed(_isSpeakerEnabled).then(
        function onplaybackcompleted() {
          TonePlayerHelper.stop();
          TonePlayerHelper.releaseResources();
          CallManager.leaveCall({
            reason: 'unavailable'
          });
      });
    },
    notifyCallEnded: function(error) {
      TonePlayerHelper.stop();
      CallScreenUI.setCallStatus('ended');
      CallManager.terminate(error);
      TonePlayerHelper.playEnded(_isSpeakerEnabled).then(
        function onplaybackcompleted() {
          TonePlayerHelper.stop();
          TonePlayerHelper.releaseResources();
          CallManager.leaveCall(error);
      });
    },
    notifyCallFailed: function() {
      TonePlayerHelper.stop();
      CallScreenUI.setCallStatus('failed');
      CallManager.terminate();
      TonePlayerHelper.playEnded(_isSpeakerEnabled).then(
        function onplaybackcompleted() {
          TonePlayerHelper.stop();
          TonePlayerHelper.releaseResources();
          CallManager.leaveCall({
            reason: 'failed'
          });
      });
    },
    abortCall: function() {
      TonePlayerHelper.stop();
      TonePlayerHelper.releaseResources();
    }
  };

  exports.CallScreenUI = CallScreenUI;

}(this));
