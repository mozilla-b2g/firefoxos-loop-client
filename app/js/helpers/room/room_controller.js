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

  function showError(errorMessage) {
    errorMessage = errorMessage || 'genericServerError';
    Loader.getErrorScreen().then(ErrorScreen => {
      var _ = navigator.mozL10n.get;
      ErrorScreen.show(_(errorMessage));
    });
  }

  function removeMyselfFromRoom(params) {
    Rooms.get(params.token).then(
      function(room) {
        if (room && room.participants && room.participants.length > 1) {
          var amIin = false;
          room.participants.forEach(function(participant) {
            if (participant.account === params.displayName) {
              Rooms.leave(params.token).then(function() {
                RoomController.join(params);
              });
              amIin = true;
            }
          });
          !amIin && showError('roomFull');
        } else {
          showError();
        }
      },
      function() {
        showError();
      }
    );
  }

  function onInvalidToken(params) {
    var token = params.token;
    var options = new OptionMenu({
      section: navigator.mozL10n.get('invalidRoomToken'),
      type: 'confirm',
      items: [
        {
          name: 'Cancel',
          l10nId: 'cancel',
          method: (token) => {
            RoomsDB.get(token).then(room => {
              room.noLongerAvailable = true;
              Controller.onRoomUpdated(room);
            });
          },
          params: [token]
        },
        {
          name: 'Delete',
          class: 'danger',
          l10nId: 'delete',
          method: (token) => {
            // Step 1: Delete from loop server
            // Step 2: Delete from DB (if the first step fails, this means
            //         the user is not the owner)
            var deleteFromDB = Controller.onRoomDeleted.bind(null, token);
            Rooms.delete(token).then(deleteFromDB, deleteFromDB);
          },
          params: [token]
        }
      ]
    });
  }

  function handleBackgroundMode(params) {
    document.hidden && Loader.getNotificationHelper().then(
    function(NotificationHelper) {
      Utils.getAppInfo().then(appInfo => {
        var _ = navigator.mozL10n.get;
        NotificationHelper.send({
          raw: params.roomName
        }, {
          body: _('tapToReturn'),
          icon: appInfo.icon,
          tag: params.roomUrl
        }).then((notification) => {
          var onVisibilityChange = function() {
            if (!document.hidden) {
              notification.close();
            }
          };
          document.addEventListener('visibilitychange',
                                    onVisibilityChange);
          notification.onclose = function() {
            document.removeEventListener('visibilitychange',
                                         onVisibilityChange);
            notification.onclose = notification.onclick = null;
          };
          notification.onclick = function() {
            debug && console.log(
              'Notification clicked for room: ' + params.roomUrl
            );
            appInfo.app.launch();
            notification.close();
          };
        });
      });
    });
  }

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

      if (!navigator.onLine) {
        Loader.getOfflineScreen().then(OfflineScreen => {
          var _ = navigator.mozL10n.get;
          OfflineScreen.show(_('noConnection'));
        });
        return;
      }

      params = params || {};
      if (!params.token) {
        debug && console.log('Error while joining room');

        showError();
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
              displayName: params.displayName,
              clientMaxSize: ROOM_CLIENT_MAX_SIZE
            }
          ).then(function(result) {
            if (!result.apiKey || !result.sessionId || !result.sessionToken ||
                !result.expires) {
              debug &&
                console.log('Error while joining room. Some params missing');

              RoomUI.hide();
              Rooms.leave(params.token);
              showError();
              return;
            }

            var shouldRate = false;
            var currentRoom = null;
            isConnected = true;
            currentToken = params.token;
            var backgroundModeHandler = null;

            Rooms.get(params.token).then(function(room) {
              currentRoom = room;
              params.roomName = room.roomName;
              params.roomUrl = room.roomUrl;
              backgroundModeHandler = handleBackgroundMode.bind(null, params);
              document.addEventListener('visibilitychange',
                                        backgroundModeHandler);
              RoomUI.updateName(room.roomName);
              if (Controller.identity !== room.roomOwner) {
                room.roomToken = params.token;
                CallLog.addRoom(room).then(() => {
                  Loader.getRoomEvent().then(RoomEvent => {
                    RoomEvent.save({type: RoomEvent.type.iJoin,
                                    token: currentToken });
                  });
                });
              } else {
                Loader.getRoomEvent().then(RoomEvent => {
                  RoomEvent.save({type: RoomEvent.type.iJoin,
                                  token: currentToken });
                });
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

                  if (currentRoom &&
                      (currentRoom.roomOwner === params.displayName)) {
                    TonePlayerHelper.init('telephony');
                    TonePlayerHelper.playConnected(RoomUI.isSpeakerEnabled);
                  }
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
                  TonePlayerHelper.init('telephony');
                  TonePlayerHelper.playConnected(RoomUI.isSpeakerEnabled);
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
                  if (currentRoom &&
                      (currentRoom.roomOwner === params.displayName)) {
                    TonePlayerHelper.init('telephony');
                    TonePlayerHelper.playEnded(RoomUI.isSpeakerEnabled);
                  }
                  RoomUI.setWaiting();
                  _logEventCommunication (current);
                },
                error: function(event) {
                  debug && console.log('Error while joining room');
                  isConnected = false;
                  currentToken = null;
                  document.removeEventListener('visibilitychange',
                                               backgroundModeHandler);
                  RoomUI.hide();
                  window.clearTimeout(refreshTimeOut);
                  Rooms.leave(params.token);
                  showError();
                }
              });

              RoomUI.onLeave = function() {
                Rooms.leave(params.token);
                roomManager.leave();
                isConnected = false;
                currentToken = null;
                document.removeEventListener('visibilitychange',
                                             backgroundModeHandler);

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
            debug && console.log('Error while joining room');
            currentToken = null;
            isConnected = false;
            RoomUI.hide();
            // See https://docs.services.mozilla.com/loop/apis.html
            if (error) {
              if (error.code === 400 && error.errno === 202) {
                // Room full
                return removeMyselfFromRoom(params);
              } else if (error.code === 404) {
                return onInvalidToken(params);
              }
            }

            showError();
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
