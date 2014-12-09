(function(exports) {
  'use strict';

  var debug = Config.debug;

  var refreshTimeOut;
  var isConnected = false, currentToken;

  //miliseg timestamp start Communication
  var _startCommunicationTime = 0;
  var _participants = [];
  var _communicationEnd = true;
  var _communicationToken = null;

  const ROOM_ACTION_JOIN = 'join';
  const ROOM_CLIENT_MAX_SIZE = 2;
  const ROOM_FEEDBACK_TYPE = 'room';

  const DEFAULT_JOIN_PARAMS = {
    displaName: '',
    video: true,
    frontCamera: false
  };

  function rate(callback) {
    if (typeof callback !== 'function') {
      callback = function() {};
    }
    Loader.getFeedback(false /*isAttention = false*/).then(
      function(FeedbackScreen){
        FeedbackScreen.show(function(feedback) {
          if (!feedback) {
            callback();
            return;
          }
          LazyLoader.load([
            'js/helpers/metrics.js',
            'js/helpers/feedback.js'
          ], function() {
            // We distinguish between calls and room chats with the type prop.
            feedback.type = ROOM_FEEDBACK_TYPE;
            Feedback.send(feedback);
            callback();
          });
        });
    });
  }

  function _initCommunicationEvent() {
    _startCommunicationTime = new Date().getTime();
    _communicationEnd = false;
    _communicationToken = currentToken;
  }

  function _logEventCommunication(aCurrentTime) {
    if (_communicationEnd || !_communicationToken) {
      return;
    }
    _communicationEnd = true;

    // We need the lenght in seconds
    var duration = Math.floor((aCurrentTime - _startCommunicationTime) / 1000);
    Loader.getRoomEvent().then(RoomEvent => {
      var other = RoomEvent.identityUnknown;
      // For now we assume that only other User and I will make a communication
      for (var i = 0, l = _participants.length;
           i < l && other === RoomEvent.identityUnknown;
           i++) {
        // If participants[i] is not logged he hasn't account and we want
        // to keep RoomEvent identifier
        if (_participants[i].account &&
            _participants[i].account !== Controller.identity) {
          other = _participants[i].account;
        }
      }
      RoomEvent.save({type: RoomEvent.type.communication,
                      token: _communicationToken,
                      otherIdentity: other,
                      length: duration });
    });
  }

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
        RoomUI.show(params).then(() => {

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

            var shouldRate = false;
            isConnected = true;
            currentToken = params.token;

            Loader.getRoomEvent().then(RoomEvent => {
              RoomEvent.save({type: RoomEvent.type.iJoin,
                              token: currentToken });
            });

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
                  // We take time here because we trying to set the count
                  // as exact than we can
                  var current = new Date().getTime();
                  debug && console.log('Room left');
                  window.clearTimeout(refreshTimeOut);
                  _logEventCommunication (current);
                },
                participantJoining: function(event) {
                  debug && console.log('Room participant joining');
                },
                participantJoined: function(event) {
                  // The communication has started exactly in this moment
                  _initCommunicationEvent();
                  debug && console.log('Room participant joined');
                  RoomUI.setConnected();
                  shouldRate = true;
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
                  // We take time here because we trying to set the count
                  // as exact than we can
                  var current = new Date().getTime();
                  debug && console.log('Room participant left');
                  RoomUI.setWaiting();
                  _logEventCommunication (current);
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

                shouldRate ? rate(RoomUI.hide) : RoomUI.hide();
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
        }, () => {
          // The user cancels
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
