(function(exports) {
  'use strict';

  var debug = Config.debug;
  var session = null, publisher = null, subscribers = [], speakerManager = null;

  var TARGET_ELEMENT_PROPERTIES = {
    audioVolume: 100,
    width: "100%",
    height: "100%",
    style:{
      nameDisplayMode: 'off',
      buttonDisplayMode: 'off',
      showMicButton: false,
      showSettingsButton: false,
      audioLevelDisplayMode: 'off'
    }
  };

  const DEFAULT_JOIN_PARAMS = {
    video: true,
    frontCamera: false
  };

  function disconnectSession() {
    if (session) {
      session.off();
      session.disconnect();
      session = null;
    }
  }

  // Note: we reuse the OT eventing module. This will allow to dispatch any
  // event on the RoomManager Object. The object inherits all the eventing suff
  // like on, once, off, dispatch methods.
  OT.RoomManager = function() {
    OT.$.eventing(this);
  };

  OT.RoomManager.prototype = {
    join: function(params) {
      debug && console.log('Join room with params: ' + JSON.stringify(params));

      params = params || {};
      if (!params.apiKey || !params.sessionId || !params.sessionToken ||
          !params.localTargetElement || !params.remoteTargetElement) {
        // https://tokbox.com/opentok/libraries/client/js/reference/Error.html
        // Fire an OT.RoomManager.EventNames.ERROR event.
        this.dispatchEvent(new OT.ErrorEvent(OT.RoomManager.EventNames.ERROR,
                                             1011,
                                             'Invalid Parameter'));
        return;
      }
      for (var param in params) {
        params.param = params.param || DEFAULT_JOIN_PARAMS.param;
      }

      var video = params.video;
      var frontCamera = params.frontCamera;
      var mode = !!frontCamera ? 'user': 'environment';
      var cameraConstraints = {facingMode: mode, require: ['facingMode']};
      var sessionConstraints = {video: cameraConstraints, audio: true};

      var self = this;
      Opentok.setConstraints(sessionConstraints);
      session = OT.initSession(params.apiKey, params.sessionId);
      session.on(
        {
          streamPropertyChanged: function(event) {
            if (publisher && event.stream && publisher.stream &&
                event.stream.streamId === publisher.stream.streamId) {
              return;
            }
            if (event.changedProperty === 'hasVideo') {
              if (event.newValue) {
                this.dispatchEvent(
                  new OT.Event(OT.RoomManager.EventNames.PARTICIPANT_VIDEO_ADDED)
                );
              } else {
                this.dispatchEvent(
                  new OT.Event(OT.RoomManager.EventNames.PARTICIPANT_VIDEO_DELETED)
                );
              }
            }
          },
          sessionConnected: function(event) {
            // Fire an OT.RoomManager.EventNames.JOINING event.
            this.dispatchEvent(new OT.Event(OT.RoomManager.EventNames.JOINING));

            TARGET_ELEMENT_PROPERTIES.mirror = frontCamera;
            publisher = session.publish(
              params.localTargetElement,
              TARGET_ELEMENT_PROPERTIES,
              function(error) {
                if (error) {
                  disconnectSession();
                  // Fire an OT.RoomManager.EventNames.ERROR event.
                  self.dispatchEvent(
                    new OT.ErrorEvent(OT.RoomManager.EventNames.ERROR,
                                      error.code,
                                      error.message));
                } else {
                  self.publishVideo(video);
                  self.forceSpeaker(video);
                  // Fire an OT.RoomManager.EventNames.JOINED event.
                  self.dispatchEvent(
                      new OT.Event(OT.RoomManager.EventNames.JOINED)
                  );
                }
            });
          },

          connectionCreated: function(event) {
            // The Session object dispatches a connectionCreated event when a
            // client (including your own) connects to a Session so we should
            // not dispatch an OT.RoomManager.EventNames.PARTICIPANT_JOINING
            // event in case this event is because of our own connection. Let's
            // check whether this event is because of our own connection by
            // comparing the connection objects.
            if (session.connection &&
                (session.connection.connectionId ===
                event.connection.connectionId)) {
              return;
            }

            // Fire an OT.RoomManager.EventNames.PARTICIPANT_JOINING event.
            this.dispatchEvent(
              new OT.Event(OT.RoomManager.EventNames.PARTICIPANT_JOINING)
            );
          },

          connectionDestroyed: function(event) {
            // Fire an OT.RoomManager.EventNames.PARTICIPANT_LEFT event.
            this.dispatchEvent(
              new OT.Event(OT.RoomManager.EventNames.PARTICIPANT_LEFT)
            );
          },

          streamCreated: function(event) {
            TARGET_ELEMENT_PROPERTIES.mirror = false;
            var subscriber = session.subscribe(
              event.stream,
              params.remoteTargetElement,
              TARGET_ELEMENT_PROPERTIES
            );
            subscriber.on({
              loaded: function() {
                // Fire an OT.RoomManager.EventNames.PARTICIPANT_JOINED event.
                self.dispatchEvent(
                  new OT.Event(OT.RoomManager.EventNames.PARTICIPANT_JOINED)
                );
              }
            });
          },

          streamDestroyed: function(event) {
            // Fire an OT.RoomManager.EventNames.PARTICIPANT_LEAVING event.
            this.dispatchEvent(
              new OT.Event(OT.RoomManager.EventNames.PARTICIPANT_LEAVING)
            );
          }
        },
        this
      );
      session.connect(params.sessionToken, function(error) {
        if (error) {
          session.off();
          session = null;
          // Fire an OT.RoomManager.EventNames.ERROR event.
          self.dispatchEvent(new OT.ErrorEvent(OT.RoomManager.EventNames.ERROR,
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
      // Fire an OT.RoomManager.EventNames.LEFT event.
      this.dispatchEvent(new OT.Event(OT.RoomManager.EventNames.LEFT));
    },

    publishAudio: function(value) {
      publisher && publisher.publishAudio(value);
    },

    get isPublishingAudio() {
      return publisher && publisher.stream && publisher.stream.hasAudio;
    },

    publishVideo: function(value) {
      publisher && publisher.publishVideo(value);
    },

    get isPublishingVideo() {
      return publisher && publisher.stream && publisher.stream.hasVideo;
    },

    get isRemotePublishingVideo() {
      return subscriber && subscriber.stream && subscriber.stream.hasVideo;
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
    },

    get isSpeakerEnabled() {
      if (!speakerManager) {
        speakerManager = new window.MozSpeakerManager();
      }
      return speakerManager.forcespeaker;
    }
  };

  OT.RoomManager.EventNames = {
    JOINING: 'joining',
    JOINED: 'joined',
    PARTICIPANT_JOINING: 'participantJoining',
    PARTICIPANT_JOINED: 'participantJoined',
    PARTICIPANT_LEAVING: 'participantLeaving',
    PARTICIPANT_LEFT: 'participantLeft',
    PARTICIPANT_VIDEO_DELETED: 'participantVideoDeleted',
    PARTICIPANT_VIDEO_ADDED: 'participantVideoAdded',
    LEFT: 'left',
    ERROR: 'error'
  };

  OT.ErrorEvent = function(type, code, message) {
    OT.Event.call(this, type, false);

    this.error = new OT.Error(code, message);
  };

  exports.RoomManager = OT.RoomManager;
}(this));
