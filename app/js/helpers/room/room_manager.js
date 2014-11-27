(function(exports) {
  'use strict';

  var debug = Config.debug;
  var session = null, publisher = null, subscribers = [], speakerManager = null;

  function disconnectSession() {
    if (session) {
      session.off();
      session.disconnect();
      session = null;
    }
  }

  var RoomManager = {
    join: function(params) {
      var video = params.video;
      var frontCamera = params.frontCamera;
      var mode = !!frontCamera ? 'user': 'environment';
      var cameraConstraints = {facingMode: mode, require: ['facingMode']};
      var sessionConstraints = {video: cameraConstraints, audio: true};

      Opentok.setConstraints(sessionConstraints);
      session = OT.initSession(params.apiKey, params.sessionId);
      session.on(
        {
          sessionConnected: function(event) {
            // TODO: https://bugzilla.mozilla.org/show_bug.cgi?id=1104003
            // Pass in a targetElement (the ID of the DOM element that the
            // Publisher will replace) and a properties object that defines
            // options for the Publisher.
            publisher = session.publish(function(error) {
              if (error) {
                disconnectSession();
                // Fire a RoomManager.EventNames.ERROR event.
                this.dispatch(new OT.ErrorEvent(RoomManager.EventNames.ERROR,
                                                error.code,
                                                error.message));
              } else {
                this.publishVideo(video);
                // Fire a RoomManager.EventNames.JOINED event.
                this.dispatch(new OT.Event(RoomManager.EventNames.JOINED));
              }
            });
          },

          streamCreated: function(event) {
            // TODO: https://bugzilla.mozilla.org/show_bug.cgi?id=1104003
            // A new stream, published by another client, has been created on
            // this session. Subscribes to a stream that is available to the
            // session via Session.subscribe() function.
            // Pass in a targetElement (the ID of the DOM element that the
            // Subscriber will replace) and a properties object that defines
            // options for the Subscriber.
            // Fire a RoomManager.EventNames.PARTICIPANT_JOINED event.
            this.dispatch(
              new OT.Event(RoomManager.EventNames.PARTICIPANT_JOINED)
            );
          },

          streamDestroyed: function(event) {
            // Fire a RoomManager.EventNames.PARTICIPANT_LEFT event.
            this.dispatch(
              new OT.Event(RoomManager.EventNames.PARTICIPANT_LEFT)
            );
          }
        },
        RoomManager
      );
      session.connect(params.sessionToken, function(error) {
        if (error) {
          session.off();
          session = null;
          // Fire a RoomManager.EventNames.ERROR event.
          this.dispatch(new OT.ErrorEvent(RoomManager.EventNames.ERROR,
                                          error.code,
                                          error.message));
        }
      });
    },

    leave: function() {
      disconnectSession();
      publisher = null;
      subscribers = null;
      speakerManager = null;
      // Fire a RoomManager.EventNames.LEFT event.
      this.dispatch(new OT.Event(RoomManager.EventNames.LEFT));
    },

    publishAudio: function(value) {
      publisher && publisher.publishAudio(value);
    },

    publishVideo: function(value) {
      publisher && publisher.publishVideo(value);
    },

    subscribeToAudio: function(value) {
      // Note: the first verison of the room implementatio define a room with
      // only two participants. Let's consider for the future that more
      // participants might take part.
      subscribers && subscribers.forEach(function(subscriber) {
        subscriber.subscribeToAudio(value);
      });
    },

    subscribeToVideo: function(value) {
      // Note: the first verison of the room implementatio define a room with
      // only two participants. Let's consider for the future that more
      // participants might take part.
      subscribers && subscribers.forEach(function(subscriber) {
        subscriber.subscribeToVideo(value);
      });
    },

    forceSpeaker: function(value) {
      if (!speakerManager) {
        speakerManager = new window.MozSpeakerManager();
      }
      speakerManager.forcespeaker = value;
    }
  };

  RoomManager.EventNames = {
    JOINED: 'joined',
    PARTICIPANT_JOINED: 'participantJoined',
    PARTICIPANT_LEFT: 'participantLeft',
    LEFT: 'left',
    ERROR: 'error'
  };

  OT.ErrorEvent = function(type, code, message) {
    OT.Event.call(this, type, false);

    this.error = new OT.Error(code, message);
  };

  // Note: we reuse the OT eventing module. This will allow to dispatch any
  // event on the RoomManager Object. The object inherits all the eventing suff
  // like on, once, off, dispatch methods.
  OT.$.eventing(RoomManager);

  exports.RoomManager = RoomManager;
}(this));
