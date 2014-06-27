(function(exports) {
  'use strict';

  var _ringtone;

  function _init() {
    _ringtone = new Audio();
    _ringtone.src = '../resources/media/ringtones/ringer_classic_wallphone.ogg';
    _ringtone.mozAudioChannelType = 'ringer';
    _ringtone.loop = true;
  }

  var Ringer = {
    play: function() {
      _init();
      _ringtone.play();
    },
    stop: function() {
      if (!_ringtone) {
        return;
      }
      _ringtone.pause();
      _ringtone.src = '';
      _ringtone = null;
    }
  };

  exports.Ringer = Ringer;

}(this));
