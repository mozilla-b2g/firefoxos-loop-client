(function(exports) {
  'use strict';

  var TONE = '../resources/media/ringtones/ringtone.mp3';

  var _ringtone;
  var _vibrateInterval;

  const _VIBRATE_TIME = 200;
  const _VIBRATE_INTERVAL = 600;

  function _init() {
    _ringtone = new Audio(TONE);
    _ringtone.mozAudioChannelType = 'ringer';
    _ringtone.loop = true;
  }

  var Ringer = {
    play: function(shouldVibrate) {
      _init();

      if (shouldVibrate === 'true') {
        _vibrateInterval = window.setInterval(function vibrate() {
          navigator.vibrate([_VIBRATE_TIME]);
        }, _VIBRATE_INTERVAL);
        navigator.vibrate([_VIBRATE_TIME]);
      }

      _ringtone.play();
    },

    stop: function() {
      if (!_ringtone) {
        return;
      }
      _ringtone.pause();
      _ringtone.src = '';
      _ringtone = null;

      if (_vibrateInterval) {
        navigator.vibrate(0);
        window.clearInterval(_vibrateInterval);
        _vibrateInterval = null;
      }
    }
  };

  exports.Ringer = Ringer;

}(this));
