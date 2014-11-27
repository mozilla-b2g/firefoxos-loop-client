(function(exports) {
  'use strict';

  var _perfDebug = Config.performanceLog.enabled;
  var _perfBranch = 'CallScreen';

  var _isVideoEnabled = false;
  var _isSpeakerEnabled = true;
  var _isMicEnabled = true;

  var _gUMFailed = false;
  var _stream = null;

  var _orientationHandler;

  var _; // l10n

  var _hangupButton, _answerAudioButton, _answerVideoButton,
      _settingsButtonVideo, _settingsButtonMute, _callBarMicro, _callBarVideo,
      _settingsButtonSpeaker, _resumeButton, _callStatusInfoElements,
      _fakeLocalVideo, _localVideo;

  var _initialized = false;
  var _feedbackClose = null;

  function _hangUp(error) {
    Ringer.stop();
    Countdown.stop();
    CallScreenUI.notifyCallEnded(error);
  }

  function _toggleSpeakerButton() {
    _settingsButtonSpeaker.classList.toggle('setting-enabled');
    _isSpeakerEnabled = !_isSpeakerEnabled;
  }

  function _enableSpeakerButton() {
    _settingsButtonSpeaker.addEventListener('mousedown', function onClick() {
      _toggleSpeakerButton();
      CallManager.toggleSpeaker(_isSpeakerEnabled);
    });
  }

  function _setHeadphonesPresent(status) {
    var _headphonesPresent = !!status;
    // What we should do on a headphone change is:
    // Removal (!_headphonesPresent)
    //  - If the call is audio, removing the headphones should leave the
    //    speaker on the same status it was.
    //  - If the call is video, removing the headphones should turn ON the
    //    speaker
    // Insertion (_headphonesPresent)
    //  - If the call is audio, then inserting the headphones should
    //    disable the speaker if it was enabled.
    //  - If the call is video, then inserting the headphones should
    //    disable the speaker if it was enabled.
    if ((!_headphonesPresent && _isVideoEnabled && !_isSpeakerEnabled) ||
        (_headphonesPresent && _isSpeakerEnabled)) {
      // According to the previous description, in those two cases we have
      // to change the speaker status
      _toggleSpeakerButton();
      CallManager.toggleSpeaker(_isSpeakerEnabled);
    }
  }

  function updateStatusInfo(status) {
    var str = _(status);
    var len = _callStatusInfoElements.length;
    for (var i = 0; i < len; i++) {
      _callStatusInfoElements[i].textContent = str;
    }
  }

  var CallScreenUI = {
    init: function(isIncoming, isVideoCall, frontCamera) {
      if (_initialized) {
        return;
      }

      _perfDebug && PerfLog.log(_perfBranch, 'CallScreenUI.init');

      Branding.naming();

      _ = navigator.mozL10n.get;

      _initialized = true;

      TonePlayerHelper.init('telephony');

      var mode = frontCamera ? 'user' : 'environment';
      var cameraConstraint = {facingMode: mode, require: ['facingMode']};

      // Cache the rest of elements
      _localVideo = document.getElementById('local-video');

      // Ask for the Stream
      _perfDebug && PerfLog.log(_perfBranch, 'Requesting fake video via gUM');
      navigator.mozGetUserMedia(
        {
          video: cameraConstraint,
          audio: true
        },
        function onStreamReady(stream) {
          _stream = stream;
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
        _isVideoEnabled = _isSpeakerEnabled = isVideo;
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
          _callBarVideo.classList.remove('disabled');
        } else {
          _settingsButtonSpeaker.classList.remove('setting-enabled');
          _settingsButtonVideo.classList.add('setting-disabled');
          _callBarVideo.classList.add('disabled');
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
      _callBarMicro = document.querySelector('#call-bar .micro-info');
      _callBarVideo = document.querySelector('#call-bar .video-info');

      _settingsButtonVideo.addEventListener(
        'mousedown',
        function onSettingsClick(e) {
          _isVideoEnabled = !_isVideoEnabled;
          // Change the status of the video
          _settingsButtonVideo.classList.toggle('setting-disabled');
          _callBarVideo.classList.toggle('disabled');
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
          _callBarMicro.classList.toggle('disabled');
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

      // Update UI taking into account if the call is a video call or not
      if (!isIncoming) {
        _isVideoEnabled = _isSpeakerEnabled =
          isVideoCall && isVideoCall != 'false';
      }

      // Set the initial headphone state (and modify the speaker state
      // accordingly)
      _setHeadphonesPresent(CallManager.headphonesPresent);

      if (document.body.dataset.callStatus === 'dialing') {
        // Update the status of the UI & Tones properly
        CallScreenUI.setCallStatus('dialing');
      } else {
        _enableSpeakerButton();
      }

      Countdown.init();


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

      var statusBarHeight = document.getElementById('call-bar').offsetHeight;

      // Use status bar in the call screen
      window.onresize = function() {

        if (_feedbackClose && typeof _feedbackClose === 'function') {
          _feedbackClose();
          Loader.getFeedback(true /*isAttention = true*/).then(function(FeedbackScreen){
            FeedbackScreen.hide();
            _feedbackClose = null;
          });
          return;
        }
        if (window.innerHeight > statusBarHeight) {
          document.body.classList.remove('status-bar');
        } else {
          document.body.classList.add('status-bar');
        }
      };
    },

    set headphonesPresent(status) {
      _setHeadphonesPresent(status);
    },

    isStatusBarShown: function() {
      return document.body.classList.contains('status-bar');
    },
    setCallStatus: function(state) {
      if (!_callStatusInfoElements) {
        _callStatusInfoElements = document.querySelectorAll('.call-status-info');
      }

      _perfDebug && PerfLog.log(_perfBranch, 'CallScreenUI.setCallStatus ' + state);

      switch(state) {
        case 'dialing':
          // Play 'dialing' tone and update the UI taking into account
          // the preferences of the call.
          TonePlayerHelper.playDialing(_isSpeakerEnabled, _enableSpeakerButton);
          CallScreenUI.updateLocalVideo(_isVideoEnabled);
          if (_isSpeakerEnabled) {
            _settingsButtonSpeaker.classList.add('setting-enabled');
            _settingsButtonVideo.classList.remove('setting-disabled');
            _callBarVideo.classList.remove('disabled');
          } else {
            _settingsButtonSpeaker.classList.remove('setting-enabled');
            _settingsButtonVideo.classList.add('setting-disabled');
            _callBarVideo.classList.add('disabled');
          }
          updateStatusInfo('dialing');
          document.body.dataset.callStatus = 'dialing';
          break;
        case 'calling':
          // Once we are in this step, the status of the protocol is 'alerting',
          // so we need to play a ringback tone (same as GSM).
          // Play ringback tone
          TonePlayerHelper.stop();
          TonePlayerHelper.playRingback(_isSpeakerEnabled);
          updateStatusInfo('calling');
          document.body.dataset.callStatus = 'outgoing';
          break;
        case 'connecting':
          // If we are the caller party and the call status changes to
          // connecting is because the call set up protocol has finished (it has
          // already reached the connected state). There might be a race
          // condition here and we could change to the connecting status even
          // being already in the connected status. If that happens we must keep
          // the connected status.
          if (document.body.dataset.callStatus === 'connected') {
            return;
          }
          // If we are the calle party and the call status changes to connecting
          // is because the user has answered the call.
          TonePlayerHelper.stop();
          updateStatusInfo('connecting');
          document.body.dataset.callStatus = 'connecting';
          break;
        case 'connected':
          // Both sides are publishing. This event is controlled by OpenTok and
          // has no relation with the 'connected' event of the Loop Protocol
          TonePlayerHelper.stop();
          TonePlayerHelper.playConnected(_isSpeakerEnabled);
          _perfDebug && PerfLog.log(_perfBranch, 'Countdown start counting');
          _perfDebug && PerfLog.milestone(_perfBranch, 'Countdown');
          Countdown.start();
          document.body.dataset.callStatus = 'connected';
          CallScreenUI.startRotationHandler();
          break;
        case 'hold':
          document.body.dataset.callStatus = 'hold';
          updateStatusInfo('onHold');
          break;
        case 'remotehold':
          document.body.dataset.callStatus = 'remotehold';
          updateStatusInfo('onHold');
          break;
        case 'busy':
          // Show the state for the time being.
          // Bug 1054417 - [Loop] Implement 'busy' call screen
          _hangupButton.removeEventListener('mousedown', _hangUp);
          updateStatusInfo('busy');
          break;
        case 'reject':
          _hangupButton.removeEventListener('mousedown', _hangUp);
          updateStatusInfo('declined');
          document.body.dataset.callStatus = 'ended';
          break;
        case 'unavailable':
          _hangupButton.removeEventListener('mousedown', _hangUp);
          updateStatusInfo('unavailable');
          document.body.dataset.callStatus = 'unavailable';
          break;
        case 'ended':
          updateStatusInfo('ended');
          document.body.dataset.callStatus = 'ended';
          CallScreenUI.stopRotationHandler();
          break;
        case 'ending':
          updateStatusInfo('ending');
          document.body.dataset.callStatus = 'ended';
          break;
        case 'networkDisconnected':
          updateStatusInfo('networkDisconnected');
          document.body.dataset.callStatus = 'ended';
          break;
        case 'offline':
          updateStatusInfo('offline');
          document.body.dataset.callStatus = 'ended';
          break;
        case 'genericServerError':
          updateStatusInfo('genericServerError');
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
      Loader.getFeedback(true /*isAttention = true*/).then(function(FeedbackScreen){
        FeedbackScreen.show(callback);
      });
    },
    toggleHold: function() {
      CallScreenUI.setCallStatus('hold');
    },
    removeFakeVideo: function() {
      _stream.stop();
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
        }
      );
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
        }
      );
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
      CallScreenUI.setCallStatus('ending');
      CallManager.terminate(error).then(
        function onTerminated() {
          CallScreenUI.setCallStatus('ended');
          TonePlayerHelper.playEnded(_isSpeakerEnabled).then(
            function onplaybackcompleted() {
              TonePlayerHelper.stop();
              TonePlayerHelper.releaseResources();
              CallManager.leaveCall(error);
          });
        }
      );
    },
    notifyCallFailed: function(error) {
      TonePlayerHelper.stop();
      CallScreenUI.setCallStatus(error.reason);
      CallManager.terminate(error);
      TonePlayerHelper.playEnded(_isSpeakerEnabled).then(
        function onplaybackcompleted() {
          TonePlayerHelper.stop();
          TonePlayerHelper.releaseResources();
          CallManager.leaveCall(error);
      });
    },
    abortCall: function(error) {
      TonePlayerHelper.init('telephony');
      if (error && error.reason) {
        this.notifyCallFailed(error);
        return;
      }
      TonePlayerHelper.stop();
      TonePlayerHelper.releaseResources();
    },

    startRotationHandler: function() {
      LazyLoader.load(
        [
        '../libs/orientation_vendor.js'
        ],
        function() {
          _orientationHandler = OrientationHandler;
          _orientationHandler.on('orientation', function(event) {
            document.body.dataset.rotation = event;
          });
          _orientationHandler.start();
        }
      );
    },
    stopRotationHandler: function() {
      _orientationHandler && _orientationHandler.stop();
      document.body.dataset.rotation = '0';
    }
  };

  exports.CallScreenUI = CallScreenUI;

}(this));
