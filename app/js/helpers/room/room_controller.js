(function(exports) {
  'use strict';

  var debug = Config.debug;

  var refreshTimeOut;
  var isConnected = false, currentToken;

  const ROOM_ACTION_JOIN = 'join';
  const ROOM_CLIENT_MAX_SIZE = 2;

  const DEFAULT_JOIN_PARAMS = {
    displaName: '',
    video: true,
    frontCamera: false
  };

  function refreshMembership(token, before) {
    refreshTimeOut = window.setTimeout(function() {
      Rooms.refresh(token).then(
        function(result) {
          refreshMembership(token, result.expires);
        },
        function(error) {
          // TODO: should we show some kind of error in the UI?
          debug && console.log('Error while refreshing membership');
        }
      );
    }, before * 1000);
  }

  var RoomController = {
    join: function(params) {
      debug && console.log('Join room with params: ' + JSON.stringify(params));

      params = params || {};
      if (!params.token) {
        // TODO: we should show some kind of error in the UI.
        debug && console.log('Error while joining room');
        return;
      }
      for (var param in params) {
        params.param = params.param || DEFAULT_JOIN_PARAMS.param;
      }

      Loader.getRoomUI().then((RoomUI) => {
        RoomUI.show(params);

        params.localTargetElement = RoomUI.localTargetElement;
        params.remoteTargetElement = RoomUI.remoteTargetElement;

        Rooms.join(
          params.token,
          {
            action: ROOM_ACTION_JOIN,
            displayName: params.displaName,
            clientMaxSize: ROOM_CLIENT_MAX_SIZE
          }
        ).then(function(result) {
          if (!result.apiKey || !result.sessionId || !result.sessionToken ||
              !result.expires) {
            // TODO: we should show some kind of error in the UI.
            debug && console.log('Error while joining room. Some params missing');

            RoomUI.hide();
            Rooms.leave(params.token);
            return;
          }

          isConnected = true;
          currentToken = params.token;

          Rooms.get(params.token).then(function(room) {
            RoomUI.updateName(room.roomName);
            if (Controller.identity !== room.roomOwner) {
              room.roomToken = params.token;
              CallLog.addRoom(room);
            }
          });

          Loader.getRoomManager().then((RoomManager) => {
            var roomManager = new RoomManager();
            roomManager.on({
              joining: function(event) {
                debug && console.log('Room joining');

              },
              joined: function(event) {
                debug && console.log('Room joined');

                refreshMembership(params.token, result.expires);
              },
              left: function(event) {
                debug && console.log('Room left');
                window.clearTimeout(refreshTimeOut);
              },
              participantJoining: function(event) {
                debug && console.log('Room participant joining');
              },
              participantJoined: function(event) {
                debug && console.log('Room participant joined');
                RoomUI.setConnected();
              },
              participantVideoAdded: function(event) {
                RoomUI.showRemoteVideo(true);
              },
              participantVideoDeleted: function(event) {
                RoomUI.showRemoteVideo(false);
              },
              participantLeaving: function(event) {
                debug && console.log('Room participant leaving');
              },
              participantLeft: function(event) {
                debug && console.log('Room participant left');
                RoomUI.setWaiting();
              },
              error: function(event) {
                // TODO: we should show some kind of error in the UI.
                debug && console.log('Error while joining room');
                isConnected = false;
                currentToken = null;
                RoomUI.hide();
                window.clearTimeout(refreshTimeOut);
                Rooms.leave(params.token);
              }
            });

            RoomUI.onLeave = function() {
              Rooms.leave(params.token);
              roomManager.leave();
              isConnected = false;
              currentToken = null;
            };

            RoomUI.onToggleMic = function() {
              roomManager.publishAudio(!roomManager.isPublishingAudio);
            };

            RoomUI.onSwitchSpeaker = function() {
              roomManager.forceSpeaker(!roomManager.isSpeakerEnabled);
            };

            RoomUI.onToggleVideo = function() {
              roomManager.publishVideo(!roomManager.isPublishingVideo);
            };

            params.apiKey = result.apiKey;
            params.sessionId = result.sessionId;
            params.sessionToken = result.sessionToken;
            roomManager.join(params);
          });
        },
        function(error) {
          // TODO: we should show some kind of error in the UI.
          debug && console.log('Error while joining room');
          alert('Room is full of participants');
          currentToken = null;
          isConnected = false;
          RoomUI.hide();
        });
      });
    },
    addParticipant: function(token, name, account) {
      if (isConnected && currentToken && (currentToken === token)) {
        RoomUI.updateParticipant(name, account);
      }
    }
  };

  exports.RoomController = RoomController;
}(this));
