/** exported SpeakerManagerHelper */

'use strict';

(function(exports) {
  var debug = Config.debug;

  var speakerManager = null;

  function init() {
    if (speakerManager) {
      return;
    }
    speakerManager = new window.MozSpeakerManager();
    debug && (speakerManager.onspeakerforcedchange = function() {
      console.log('speakerManager.forcespeaker is',
                  speakerManager.forcespeaker);
    });
  }

  var SpeakerManagerHelper = {
    set forcespeaker(value) {
      init();
      debug && console.log('speakerManager.forcespeaker toggles from',
			   speakerManager.forcespeaker, 'to', value);
      speakerManager.forcespeaker = value;
    },
    get forcespeaker() {
      init();
      return speakerManager.forcespeaker;
    }
  };

  exports.SpeakerManagerHelper = SpeakerManagerHelper;
}(this));
