(function(exports) {
  'use strict';

  var _isVideoEnabled = false;
  var _isSpeakerEnabled = true;
  var _isMicEnabled = true;

  var _feedbackClose;

  var _hangoutButton, _answerAudioButton, _answerVideoButton,
      _settingsButton, _settingsButtonVideo, _settingsButtonMute,
      _settingsButtonSpeaker, _resumeButton, _title , _subtitle;

  function _callTypeString(type) {
    // This will probably disappear once we have l10n strings.
    return type == 'outgoing' ? 'Outgoing call' : 'Incoming call';
  }

  function _updateUI(params) {
    var identities = params.identities.split(',');

    function _noContact() {
      _title.textContent = identities ? identities[0] :
                           params.layout ? _callTypeString(params.layout) :
                           'Unknown ID';
      _subtitle.textContent = '';
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
      _subtitle.textContent = identities[0];
    }, _noContact);
  }

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

  var CallScreenUI = {
    init: function(params) {
      if (_hangoutButton) {
        return;
      }

      _hangoutButton = document.getElementById('hang-out');
      _answerAudioButton = document.getElementById('answer');
      _answerVideoButton = document.getElementById('answer-video');
      _settingsButton = document.getElementById('call-settings');
      _settingsButtonVideo = document.getElementById('call-settings-video');
      _settingsButtonMute = document.getElementById('call-settings-mute');
      _settingsButtonSpeaker = document.getElementById('call-settings-speaker');
      _resumeButton = document.getElementById('resume-button');

      _title = document.getElementById('contact-name-details');
      _subtitle = document.getElementById('contact-phone-details');

      if (params && params.video === 'true') {
        _isVideoEnabled = true;
        _isSpeakerEnabled = true;
      }

      _settingsButton.addEventListener(
        'click',
        function onSettingsClick() {
          _toggleSettings();
        }
      );

      _settingsButtonVideo.addEventListener(
        'click',
        function onSettingsClick() {
          _settingsButtonVideo.classList.toggle('disabled');
          _isVideoEnabled = !_isVideoEnabled;
          CallManager.toggleVideo(_isVideoEnabled);

          _toggleSettings(function() {
            document.body.classList.add('settings-hidden');
            _settingsButton.addEventListener(
              'transitionend',
              function onTransitionEnd() {
                _settingsButton.removeEventListener('transitionend', onTransitionEnd);
                document.body.classList.remove('settings-hidden');
              }
            );
            CallScreenUI.toggleVideoButton(_isVideoEnabled);
          });
        }
      );

      _settingsButtonMute.addEventListener(
        'click',
        function onSettingsClick() {
          _settingsButtonMute.classList.toggle('disabled');
          _isMicEnabled = !_isMicEnabled;
          CallManager.toggleMic(_isMicEnabled);
          _toggleSettings();
        }
      );

      _settingsButtonSpeaker.addEventListener(
        'click',
        function onSettingsClick() {
          _settingsButtonSpeaker.classList.toggle('disabled');
          _isSpeakerEnabled = !_isSpeakerEnabled;
          CallManager.toggleSpeaker(_isSpeakerEnabled);
          _toggleSettings();
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
        'click',
        function hangOutClick() {
          Ringer.stop();
          Countdown.stop();
          CallManager.stop();
        }
      );

      // We have 2 buttons for answering a call, depending on if we are
      // publishing video or not
      function _answer(isVideo) {
        Ringer.stop();
        CallScreenUI.update('connected', params);
        CallManager.join(isVideo);
        CallScreenUI.toggleVideoButton(isVideo);
      }

      _answerAudioButton.addEventListener(
        'click',
        function answerClick() {
          _answer(false);
        }.bind(this)
      );

      _answerVideoButton.addEventListener(
        'click',
        function answerVideo() {
          _answer(true);
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
          _answerAudioButton.style.display = 'block';
          _answerVideoButton.style.display = 'block';
          _updateUI(params);
          break;
        case 'outgoing':
          _answerAudioButton.style.display = 'none';
          _answerVideoButton.style.display = 'none';
          _updateUI(params);
          CallManager.join(_isVideoEnabled);
          CallScreenUI.toggleVideoButton(_isVideoEnabled);
          break;
        case 'connected':
          _answerAudioButton.style.display = 'none';
          _answerVideoButton.style.display = 'none';
          _settingsButton.style.display = 'block';
          _resumeButton.style.display = 'none';
          break;
        case 'disconnected':
          // TODO Styles not defined yet.

          break;
        case 'hold':
          _settingsButton.style.display = 'none';
          _resumeButton.style.display = 'block';
          break;
      }
    },
    toggleVideoButton: function(status) {
      if (status) {
        document.body.dataset.callType = 'video';
        return;
      }
      document.body.dataset.callType = 'audio';
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
