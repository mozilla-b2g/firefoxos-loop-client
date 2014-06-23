/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported AudioCompetingHelper */

/* globals AudioContext */

(function(exports) {
  'use strict';

  /** App name competing for the telephony audio channel. */
  var _appName = null;

  /** Buffer source we use for competing for the telephony audio channel. */
  var _silenceBufferSource = null;

  /** Array of listener function to be called once the app is muted/unmute. */
  var _listeners = {
    mozinterruptbegin: [],
    mozinterruptend: []
  };

  /**
   * Fire the given event on the audio competing helper.
   * 
   * @param {String} type A string representing the event type being fired.
   */
  function _fireEvent(type) {
    console.log('AudioCompetingHelper(' + _appName+ ')._fireEvent(' + type + ')');
    if (!_listeners[type]) {
      return;
    }

    for (var i = 0; i <_listeners[type].length; i++) {
      if(_listeners[type][i] && (typeof _listeners[type][i] === 'function')) {
        _listeners[type][i].call(null);
      }
    }
  }

  /**
   * The AudioCompetingHelper singleton object helps the callscreen to compete
   * for the telephony audio channel. After bug 1016277 apps use the telephony
   * audio channel on a LIFO basis which means apps might be muted by other
   * apps trying to use the telephony audio channel.
   */
  var AudioCompetingHelper = {
    /**
     * Init function.
     */
    init: function ach_init(appName) {
      _appName = appName;

      var ac = new AudioContext();
      ac.mozAudioChannelType = "telephony";

      var onmozinterruptbegin = _fireEvent.bind(null, 'mozinterruptbegin');
      ac.addEventListener('mozinterruptbegin', onmozinterruptbegin);

      var onmozinterruptend = _fireEvent.bind(null, 'mozinterruptend');
      ac.addEventListener('mozinterruptend', onmozinterruptend);

      _silenceBufferSource = ac.createBufferSource();
      _silenceBufferSource.buffer = ac.createBuffer(1, 2048, ac.sampleRate);
      _silenceBufferSource.connect(ac.destination);
      _silenceBufferSource.loop = true;
    },

    /**
     * Request the helper to start competing for the use of the telephony audio
     * channel.
     */
    compete: function ach_compete() {
      console.log('AudioCompetingHelper(' + _appName+ ').compete()');
      if (!_silenceBufferSource) {
        return;
      }
      _silenceBufferSource.start(0);
      // window.setTimeout(function () {
      // }, 3000);
    },

    /**
     * Request the helper to leave the competition for the use of the telephony
     * audio channel.
     */
    leaveCompetition: function ach_leaveCompetition() {
      console.log('AudioCompetingHelper(' + _appName+ ').leaveCompetition()');
      if (!_silenceBufferSource) {
        return;
      }
      _silenceBufferSource.stop(0);
    },

    /**
     * Register the specified listener on the audio competing helper.
     * 
     * @param {String} type A string representing the event type to listen for.
     * @param {Function} listener The function that receives a notification when
     *                            an event of the specified type occurs.
     */
    addEventListener: function ach_addEventListener(type, listener) {
      if ((type !== 'mozinterruptbegin') && (type !== 'mozinterruptend') ) {
        // TODO: Should we throw an exception?
        return;
      }
      if (listener && (typeof listener !== 'function')) { 
        // TODO: Should we throw an exception?
       return;
      }
      _listeners[type].push(listener);
    },

    /**
     * Remove the event listener previously registered with
     * AudioCompetingHelper.addEventListener.
     * 
     * @param {String} type A string representing the event type being removed.
     * @param {Function} listene The listener parameter indicates the event 
     *                           listener function to be removed.
     */
    removeEventListener: function ach_removeEventListener(type, listener) {
      // TODO
    }
  };

  exports.AudioCompetingHelper = AudioCompetingHelper;
})(this);
