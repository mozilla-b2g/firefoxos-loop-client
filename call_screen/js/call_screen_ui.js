(function(exports) {
  'use strict';

  var _isVideoEnabled = false;
  var _isSpeakerEnabled = true;
  var _isMicEnabled = true;

  var _feedbackClose;

  var _hangoutButton, _answerAudioButton, _answerVideoButton,
      _settingsButton, _settingsButtonVideo, _settingsButtonMute,
      _settingsButtonSpeaker, _resumeButton, _title, _callStatusInfo,
      _remoteVideo, _remoteImage;

  function _updateUI(params) {
    var identities = params.identities.split(',');

    function _noContact() {
      _title.textContent = identities[0];
    }

    ContactsHelper.find({
      identities: identities
    }, function(result) {
      if (!result) {
        _noContact();
        return;
      }
      // We don't want to show the whole list of contacts in the call screen
      // so we just take the first one.
      _title.textContent = result.contacts[0].name[0];
      if (result.contacts[0] && result.contacts[0].photo && result.contacts[0].photo[0]) {
        var url = URL.createObjectURL(result.contacts[0].photo[0]);
        var urlString = 'url(' + url + ')';
        _remoteVideo.innerHTML = '';
        _remoteVideo.style.backgroundImage = urlString;
        _remoteImage.style.backgroundImage = urlString;
      }
    }, _noContact);
  }

  function _toggleSettings(callback) {
    document.body.classList.remove('no-transition');
    setTimeout(function() {
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
    }, 100);
  }

  var _hitButton = document.getElementById('action-button-hit');

  function _showHitEffect(buttonId, callback) {
    _hitButton.addEventListener(
      'transitionend',
      function effectShown() {
        _hitButton.removeEventListener(
          'transitionend',
          effectShown
        );
        _hitButton.className = 'action-button-hit';
        if (typeof callback === 'function') {
          callback();
        }
      }
    );
    _hitButton.classList.add(buttonId);
    setTimeout(function() {
      _hitButton.classList.add('enabled');
    }, 100);
  }

  var CallScreenUI = {
    init: function(params) {
      if (_hangoutButton) {
        return;
      }

      OrientationHandler.on('orientation', function(event) {
        document.body.dataset.rotation = event;
      });

      OrientationHandler.start();

      _hangoutButton = document.getElementById('hang-out');
      _answerAudioButton = document.getElementById('answer');
      _answerVideoButton = document.getElementById('answer-video');
      _settingsButton = document.getElementById('call-settings');
      _settingsButtonVideo = document.getElementById('call-settings-video');
      _settingsButtonMute = document.getElementById('call-settings-mute');
      _settingsButtonSpeaker = document.getElementById('call-settings-speaker');
      _resumeButton = document.getElementById('resume-button');

      _title = document.getElementById('contact-name-details');
      _callStatusInfo = document.getElementById('call-status-info');
      _remoteVideo = document.getElementById('remote-video');
      _remoteImage = document.getElementById('fullscreen-image');
      
      if (params && params.video === 'true') {
        _isVideoEnabled = true;
        _isSpeakerEnabled = true;
        _settingsButtonSpeaker.classList.add('enabled');
      }

      _settingsButton.addEventListener(
        'mousedown',
        function onSettingsClick(e) {
          _showHitEffect(e.target.id, function() {
            _toggleSettings();
          });
        }
      );

      _settingsButtonVideo.addEventListener(
        'mousedown',
        function onSettingsClick(e) {
          _showHitEffect(e.target.id, function() {
            _isVideoEnabled = !_isVideoEnabled;
            _settingsButtonVideo.classList.toggle('disabled');
            CallScreenUI.updateLocalVideo(
              _isVideoEnabled,
              function onUIUpdated() {
                CallManager.toggleVideo(_isVideoEnabled);
              }
            );
          });
        }
      );

      _settingsButtonMute.addEventListener(
        'mousedown',
        function onSettingsClick(e) {
          _showHitEffect(e.target.id, function() {
            _settingsButtonMute.classList.toggle('disabled');
            _isMicEnabled = !_isMicEnabled;
            CallManager.toggleMic(_isMicEnabled);
          });
        }
      );

      _settingsButtonSpeaker.addEventListener(
        'mousedown',
        function onSettingsClick(e) {
          _showHitEffect(e.target.id, function() {
            _settingsButtonSpeaker.classList.toggle('enabled');
            _isSpeakerEnabled = !_isSpeakerEnabled;
            CallManager.toggleSpeaker(_isSpeakerEnabled);
          });
        }
      );

      // Set the callback function to be called once the call is held in the
      // call manager helper.
      CallManager.onhold = this.toggleHold;

      // Resume button. On click resume the call.
      _resumeButton.addEventListener(
        'click',
        function() {
          CallManager.resume();
          CallScreenUI.update('connected', params);
        }
      );

      // Hangout button. We need to stop the ringer
      // and the countdown. Session should be disconnected
      // as well.
      _hangoutButton.addEventListener(
        'mousedown',
        function hangOutClick(e) {
          _showHitEffect(e.target.id, function() {
            Ringer.stop();
            Countdown.stop();
            CallManager.stop();
          });
        }
      );

      // We have 2 buttons for answering a call, depending on if we are
      // publishing video or not
      function _answer(isVideo) {
        _isVideoEnabled = isVideo;
        Ringer.stop();
        CallScreenUI.update('connected', params);
        CallManager.join(isVideo);
        CallScreenUI.updateLocalVideo(isVideo);
      }

      _answerAudioButton.addEventListener(
        'click',
        function answerClick(e) {
          _showHitEffect(e.target.id, function() {
            _answer(false);
          });
        }.bind(this)
      );

      _answerVideoButton.addEventListener(
        'click',
        function answerVideo(e) {
          _showHitEffect(e.target.id, function() {
            _answer(true);
          });
        }.bind(this)
      );

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

      this.update(params.layout, params);
    },
    update: function(state, params) {
      _settingsButtonMute.classList.remove('disabled');
      _settingsButtonSpeaker.classList.remove('disabled');
      _isVideoEnabled ?
        _settingsButtonVideo.classList.remove('disabled'):
        _settingsButtonVideo.classList.add('disabled');

      switch(state) {
        case 'incoming':
          Ringer.play();
          document.body.dataset.callStatus = 'incoming';
          _updateUI(params);
          break;
        case 'outgoing':
          document.body.dataset.callStatus = 'outgoing';
          _updateUI(params);
          CallManager.join(_isVideoEnabled);
          _callStatusInfo.textContent = 'Calling...';
          CallScreenUI.updateLocalVideo(_isVideoEnabled);
          break;
        case 'connecting':
          _callStatusInfo.textContent = 'Connecting...';
          break;
        case 'connected':
          document.body.dataset.callStatus = 'connected';
          break;
        case 'disconnected':
          // TODO Styles not defined yet.
          break;
        case 'hold':
          document.body.dataset.callStatus = 'hold';
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
      CallScreenUI.update('hold');
    }
  };

  exports.CallScreenUI = CallScreenUI;

}(this));
