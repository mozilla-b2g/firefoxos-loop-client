(function(exports) {
  'use strict';

  var _isVideoEnabled = false;

  var _hangoutButton, _answerAudioButton, _answerVideoButton,
      _settingsButton, _title , _subtitle;
  
  var CallScreenUI = {
    init: function(params) {
      if (_hangoutButton) {
        return;
      }

      _hangoutButton = document.getElementById('hang-out');
      _answerAudioButton = document.getElementById('answer');
      _answerVideoButton = document.getElementById('answer-video');
      _settingsButton = document.getElementById('call-settings');

      _title = document.getElementById('contact-name-details');
      _subtitle = document.getElementById('contact-phone-details');


      // TODO Implement all options in Settings. Currently
      // we have just the video on/off
      _settingsButton.addEventListener(
        'click',
        function() {
          CallManager.toggleVideo(!_isVideoEnabled);
          this.toggleVideoButton(!_isVideoEnabled);
        }.bind(this)
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
        CallScreenUI.update('connected');
        CallManager.join(isVideo);
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

      
      this.toggleVideoButton(params.video);
      this.update(params.layout);
    },
    update: function(state) {
      switch(state) {
        case 'incoming':
          Ringer.play();
          _answerAudioButton.style.display = 'block';
          _answerVideoButton.style.display = 'block';
          _title.textContent = 'Incoming Call';
          _subtitle.textContent = 'Llamada entrante de...';
          // Show 'answer' with video/audio & 'hangout'
          break;
        case 'outgoing':
          _answerAudioButton.style.display = 'none';
          _answerVideoButton.style.display = 'none';
          _title.textContent = 'Outgoing Call';
          _subtitle.textContent = 'Llamada a...';
          CallManager.join(true);
          // _joinCall(true);
          // Show 'hangout' & 'settings'
          break;
        case 'connected':
          _answerAudioButton.style.display = 'none';
          _answerVideoButton.style.display = 'none';
          // Show 'hangout' & 'settings'
          break;
        case 'disconnected':
          // TODO Styles not defined yet.

          break;
        case 'feedback':
          // TODO Implement this when ready

          break;
        case 'hold':
          // TODO Implement this when ready

          break;
      }
    },
    toggleVideoButton: function(status) {
      _isVideoEnabled = status;
      if (status) {
        document.body.dataset.callType = 'video';
        return;
      }
      document.body.dataset.callType = 'audio';
    }
  };

  exports.CallScreenUI = CallScreenUI;

}(this));
