/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global ClientRequestHelper, Opentok, Utils */

/* exported CallHelper */

'use strict';

(function(exports) {
  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  var CallHelper = {
    /** Opentok session */
    session: null,

    /** Speaker manager */
    speakerManager: null,

    /**
     * Route the audio from the builtin earpiece to the speaker and viceversa.
     */
    switchSpeaker: function c_switchSpeaker() {
      if (!this.speakerManager) {
        this.speakerManager = new window.MozSpeakerManager();
      }
      this.speakerManager.forcespeaker = !this.speakerManager.forcespeaker;
    },

    /**
     * Generate a call URL to be shared with the called party.
     *
     * @param {String} id Peer's id.
     * @param {Function} onsuccess Function to be called once the call URL is
     *                             generated correctly.
     * @param {Function} onerror Function to be called when an error occurs.
     */
    generateCallUrl: function ch_generateCallUrl(id, onsuccess, onerror) {
      if (!id) {
        _callback(onerror, [new Error('Invalid peer id')]);
        return;
      }

      ClientRequestHelper.generateCallUrl(id,
        function onGenerateCallUrl(result) {
          _callback(onsuccess, [result]);
        },
        onerror
      );
    },

    /**
     * Answer/handle the incoming call.
     *
     * @param {Numeric} notificationId Simple push notification version.
     * @param {String} target Container element name for video/audio elements.
     * @param {Object} constraints Constraints object defining call details.
     * @param {Function} onconnected Function to be called once the peer
     *                               connects the session.
     * @param {Function} onstream Function to be called once the session object
     *                            receives 'streamCreated' events.
     * @param {Function} onerror Function to be called if any error happens.
     */
    handleIncomingCall: function ch_handleIncomingCall(
      notificationId, target, constraints, onconnected, onstream, onerror) {

      var onGetCallsSuccess = function(calls) {
        var call = calls.calls[0];
        if (!call) {
          _callback(onerror, [new Error('Unable to get call data')])
          return;
        }
        this.session = this.joinCall(
          call, target, constraints, onconnected, onstream, onerror
        );
      };

      ClientRequestHelper.getCalls(
        notificationId,
        onGetCallsSuccess.bind(this),
        onerror
      );
    },

    /**
     * Join the call party to the ongoing call.
     *
     * @param {Object} call Call data.
     * @param {String} target Container element name for video/audio elements.
     * @param {Object} constraints Constraints object defining some call details.
     * @param {Function} onconnected Function to be called once the peer
     *                               connects the session.
     * @param {Function} onstream Function to be called once the session object
     *                            receives 'streamCreated' events.
     * @param {Function} onerror Function to be called if any error happens.
     */
    joinCall: function ch_joinCall(
      call, target, constraints, onconnected, onstream, onerror) {

      Opentok.setConstraints(constraints);
      var session = TB.initSession(call.apiKey, call.sessionId);
      session.on({
        streamCreated: function(event) {
          session.subscribe(event.stream, target, null);
          Utils.log('Subcribed to remote peers stream, video should appear');
          _callback(onstream, [event]);
        }
      });
      session.connect(call.sessionToken, function(e) {
        if (e) {
          Utils.log('Session connect error ' + e.message);
          _callback(onerror, [e]);
          return;
        }
        _callback(onconnected);
        session.publish(target, null, function onPublish(ee) {
          if (ee) {
            Utils.log('Session publish error ' + ee.message);
            _callback(onerror, [ee]);
          }
        });
      });
      return session;
    },

    /**
     * Hangs up the call.
     */
    hangUp: function ch_hangUp() {
      if (this.session) {
        this.session.disconnect();
        this.session = null;
      }
    }
  };

  exports.CallHelper = CallHelper;
}(this));
