/** exported TonePlayerHelper */

/** globals Audio */

'use strict';

(function(exports) {
  var debug = true;
  var _audioElement = null;
  var _channel = null;
  var _speakerManager = null;

  var BUSY_TONE_TIMEOUT = 5000;

  var DIAL_TONE = '../../resources/media/tones/dial.mp3';
  var RINGBACK_TONE = '../../resources/media/tones/ringback.mp3';
  var BUSY_TONE = '../../resources/media/tones/busy.mp3';
  var HOLD_TONE = '../../resources/media/tones/hold.mp3';

  function _playTone(src, isSpeaker, cb) {
    debug && console.log('Playing tone with channel ' + _audioElement.mozAudioChannelType);
    _audioElement.src = src;
    _audioElement.loop = true;
    _audioElement.addEventListener(
      'playing',
      function tonePlaying() {
        _audioElement.removeEventListener('playing', tonePlaying);
        debug && console.log('Speaker will change from  ' + _speakerManager.forcespeaker +
          ' to ' + isSpeaker);
        _speakerManager.forcespeaker = isSpeaker;
        if (typeof cb === 'function') {
          cb();
        }
      }
    );
    _audioElement.play();
  };

  var TonePlayerHelper = {
    init: function tph_init(channel) {
      if (!_speakerManager) {
        _speakerManager = new window.MozSpeakerManager();
      }
      this.setChannel(channel);
    },

    setChannel: function tph_setChannel(channel) {
      var ctx = _audioElement;
      if (!channel || (ctx && (ctx.mozAudioChannelType === channel))) {
        return;
      }

      // If the channel needs to change we need to release resources and to
      // create a new audio context object.
      this.releaseResources();
      _channel = channel;
      this.ensureAudio();
    },

    ensureAudio: function tph_ensureAudio() {
      if (_audioElement || !_channel) {
        return;
      }
      _audioElement = new Audio();
      _audioElement.mozAudioChannelType = _channel;
    },

    playDialing: function tph_playDialing(isSpeaker, cb) {
      _playTone(DIAL_TONE, isSpeaker, cb);
    },

    playRingback: function tph_playRingback(isSpeaker, cb) {
      console.log('playRingback: function tph_playRingback(isSpeaker, cb)');
      _playTone(RINGBACK_TONE, isSpeaker, cb);
    },

    playBusy: function tph_playBusy() {
      return new Promise(function(resolve, reject) {
        var timeout = window.setTimeout(resolve, BUSY_TONE_TIMEOUT);
        _audioElement.addEventListener('ended', function onplaybackcompleted() {
          _audioElement.removeEventListener(onplaybackcompleted);
          window.clearTimeout(timeout);
          resolve();
        });
        _playTone(BUSY_TONE);
      });
    },

    playHold: function tph_playHold() {
      _playTone(HOLD_TONE);
    },

    stop: function tph_stop() {
      if (!_audioElement) {
        return;
      }
      _audioElement.pause();
      _audioElement.src = '';
    },

    releaseResources: function tph_releaseResources() {
      if ((_channel === 'telephony') && _audioElement) {
        _audioElement.mozAudioChannelType = 'normal';
      }
      _audioElement = null;
    }
  };

  exports.TonePlayerHelper = TonePlayerHelper;
}(this));
