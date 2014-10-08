(function(exports) {
  'use strict';

  var TONE = '../resources/media/ringtones/ringtone.mp3';

  var _ringtone;
  var _speakerManager;

  function _init() {
    if (!_speakerManager) {
      _speakerManager = new window.MozSpeakerManager();
    }
    _speakerManager.forcespeaker = true;
    _ringtone = new Audio();
    _ringtone.src = TONE;
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
