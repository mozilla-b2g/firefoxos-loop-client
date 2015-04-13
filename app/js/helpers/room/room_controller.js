(function(exports) {
  'use strict';

  var debug = Config.debug;

  var refreshTimeOut;
  var isConnected = false, currentToken;

  //miliseg timestamp start Communication
  var _startCommunicationTime = 0;
  var _participants = [];
  var _numberParticipants = 0;
  var _communicationEnd = true;
  var _communicationToken = null;
  var _wentToBackground = false;

  const ROOM_ACTION_JOIN = 'join';
  const ROOM_CLIENT_MAX_SIZE = 2;
  const ROOM_FEEDBACK_TYPE = 'room';

  const DEFAULT_JOIN_PARAMS = {
    displayName: '',
    video: true,
    audio: true,
    frontCamera: false
  };

  var acm = navigator.mozAudioChannelManager;

  // Connected users connectionId per room
  var connectionIds = {};

  function _updateRoomAttribute(token, attribute) {
    RoomsDB.get(token).then(function(room) {
      room[attribute] = room[attribute] && room[attribute] + 1 || 1;
      RoomsDB.update(room).then(function() {
        debug && console.log(attribute + ' successfully set');
      }, function() {
        console.error('Error setting ' + attribute + ' field of the room');
      });
    }, function() {
      console.error('Error retrieving room from RoomsDB');
    });
  }

  function addConnectionId(roomToken, connectionId) {
    debug && console.log("RoomConnections: Adding " + connectionId +
                         " to room " + roomToken);
    if (!connectionIds[roomToken]) {
      connectionIds[roomToken] = [];
    }
    var room = connectionIds[roomToken];
    if (room.indexOf(connectionId) < 0) {
      room.push(connectionId);
    }
  }

  function updateConnectionIds(roomToken, connectionIds) {
    debug && console.log("RoomConnections: Updating " + roomToken +
                         " with connections: " + connectionIds);
    connectionIds[roomToken] = connectionIds;
  }

  function checkConnectionId(roomToken, connectionId) {
    debug && console.log("RoomConnections: Checking " + connectionId +
                         " in room " + roomToken);
    return connectionIds[roomToken] &&
           (connectionIds[roomToken].indexOf(connectionId) >= 0);
  }

  function playEndedTone() {
    TonePlayerHelper.init('telephony');
    TonePlayerHelper.playEnded(RoomUI.isSpeakerEnabled);
  }

  function onHeadPhonesChange() {
    RoomUI.headphonesPresent = RoomController.headphonesPresent;
  }

  function handleHeadPhonesChange() {
    acm && acm.addEventListener('headphoneschange', onHeadPhonesChange);
  }

  function removeHeadPhonesChangeHandler() {
    acm && acm.removeEventListener('headphoneschange', onHeadPhonesChange);
  }

  function showError(errorMessage) {
    errorMessage = errorMessage || 'genericServerError1';
    Loader.getErrorScreen().then(ErrorScreen => {
      var _ = navigator.mozL10n.get;
      ErrorScreen.show(_(errorMessage));
    });
  }

  function setNumberParticipants(num) {
    _numberParticipants = RoomUI.numberParticipants = num;
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
      function(error) {
        if (error) {
          // See https://docs.services.mozilla.com/loop/apis.html
          if (error.code === 403 && error.errno === 999) {
            // The room was full and we were trying to remove the user who is
            // neither a participant of the room nor the room owner. As the
            // remove process failed, let's show the full room error then.
            showError('roomFull');
            return;
          }
        }
        showError();
      }
    );
  }

  function onInvalidToken(params) {
    var token = params.token;

    RoomsDB.get(token).then(room => {
      var parameters = {
        type: 'confirm',
        items: [
          {
            name: 'Cancel',
            l10nId: 'cancel'
          }
        ]
      };

      var title;

      if (room) {
        title = 'invalidRoomTokenAndDelete';

        parameters.items[0].method = () => {
          room.noLongerAvailable = true;
          Controller.onRoomUpdated(room);
        };

        parameters.items.push({
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
        });
      } else {
        title = 'invalidRoomToken';

        var item = parameters.items[0];
        item.name = 'OK';
        item.l10nId = 'ok';
        item.class = 'full';
      }

      parameters.section = navigator.mozL10n.get(title);

      var options = new OptionMenu(parameters);
    });
  }

  function handleBackgroundMode(params) {
    document.hidden && Loader.getNotificationHelper().then(
    function(NotificationHelper) {
      _wentToBackground = true;
      Utils.getAppInfo().then(appInfo => {
        var _ = navigator.mozL10n.get;
        NotificationHelper.send({
          raw: params.roomName
        }, {
          body: _('tapToReturn'),
          icon: appInfo.icon,
          tag: params.roomUrl,
          // Definition of vibrationPattern to 1ms is a
          // workaround of this bug #1132245 that prevent
          // to use 0 or empty array to cancel a vibration
          mozbehavior: {
            vibrationPattern: [1]
          }
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
            if (_wentToBackground) {
              RoomsDB.get(currentToken).then(room => {
                room.backgroundMode = room.backgroundMode &&
                                      room.backgroundMode + 1 || 1;
                RoomsDB.update(room).then(function() {
                  debug &&
                  console.log('Field backgroundMode of the room successfully ' +
                              'updated');
                }, function() {
                  console.error('Field backgroundMode of the room ' +
                                'unsuccessfully updated');
                });
              });
            }
            _wentToBackground = false;
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
            return;
          }
          LazyLoader.load([
            'js/helpers/metrics.js',
            'js/helpers/feedback.js'
          ], function() {
            // We distinguish between calls and room chats with the type prop.
            feedback.type = ROOM_FEEDBACK_TYPE;
            Feedback.send(feedback);
          });
        }).then(callback);
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
        var account = _participants[i].account;
        if (account && (account !== Controller.identity)) {
          other = account;
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
    get roomActive() {
      return isConnected;
    },
    join: function(params) {
      debug && console.log('Join room with params: ' + JSON.stringify(params));

      window.dispatchEvent(new CustomEvent('joinstart'));

      var forceReject = (params.action === 'reject');
      if (forceReject) {
        showError();
        return;
      }

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
          handleHeadPhonesChange();

          params.audio = RoomUI.isMicEnabled;
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

              removeHeadPhonesChangeHandler();
              RoomUI.hide();
              Rooms.leave(params.token);
              showError();
              return;
            }

            var shouldRate = false, shouldPlayEnded = false;
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
              setNumberParticipants(room.participants.length);
              if (Controller.identity !== room.roomOwner) {
                room.roomToken = params.token;
                CallLog.addRoom(room).then(() => {
                  Loader.getRoomEvent().then(RoomEvent => {
                    RoomEvent.save({type: RoomEvent.type.iJoin,
                                    token: currentToken });
                  });
                });
              } else {
                CallLog.updateRoom(room).then(() => {
                  Loader.getRoomEvent().then(RoomEvent => {
                    RoomEvent.save({type: RoomEvent.type.iJoin,
                                    token: currentToken });
                  });
                });
              }
              _updateRoomAttribute(currentToken, 'numberTimesIJoined');
            });

            Loader.getRoomManager().then((RoomManager) => {
              var roomManager = new RoomManager();
              roomManager.on({
                joining: function(event) {
                  debug && console.log('Room joining');
                },
                joined: function(event) {
                  debug && console.log('Room joined');

                  roomManager.publishAudio(RoomUI.isMicEnabled);
                  if (currentRoom &&
                      (currentRoom.roomOwner === params.displayName)) {
                    TonePlayerHelper.init('telephony');
                    TonePlayerHelper.playConnected(RoomUI.isSpeakerEnabled);
                  }
                  refreshMembership(params.token, result.expires);
                },
                left: function(event) {
                  playEndedTone();
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
                  debug && console.log('Room participant joined');
                  Rooms.get(currentToken).then(room => {
                    _participants = room.participants;
                    setNumberParticipants(_participants.length);
                    // If we joined a room we don't own we are not receiving
                    // push notification for that room. That means we have to
                    // set the participant name in the UI from here once he
                    // joins the room. For the time being as there is only
                    // room for two participant the participant name to set is
                    // the one that doesn't correspond to ours.
                    for (var i = 0, l = _participants.length; i < l; i++) {
                      var participant = _participants[i];
                      if (participant.displayName !== params.displayName) {
                        RoomUI.updateParticipant(participant.displayName,
                                                 participant.account);
                        break;
                      }
                    }
                  });
                  // The communication has started exactly in this moment
                  _updateRoomAttribute(currentToken, 'numberEstablishedConnections');
                  _initCommunicationEvent();
                  TonePlayerHelper.init('telephony');
                  TonePlayerHelper.playConnected(RoomUI.isSpeakerEnabled);
                  RoomUI.setConnected(roomManager.isRemotePublishingVideo);
                  shouldRate = shouldPlayEnded = true;
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
                  // There might be chances the local party receives
                  // the 'participantLeft' event even when the remote
                  // party couldn't join the room successfully. That
                  // is the case when the remote party tries to join a
                  // room when a GSM/CDMA call is active in the remote
                  // device. It's kinda wierd to play the ended tone
                  // when the call didn't connected actually.
                  shouldPlayEnded && playEndedTone();
                  // We take time here because we trying to set the count
                  // as exact than we can
                  var current = new Date().getTime();
                  debug && console.log('Room participant left');
                  Rooms.get(currentToken).then(room => {
                    var participants = _participants = room.participants.length;
                    if (event && event.connectionEvent &&
                        (event.connectionEvent.reason === 'networkDisconnected')) {
                      participants-=1;
                    }
                    setNumberParticipants(participants);
                  });
                  RoomUI.setWaiting();
                  _logEventCommunication (current);
                },
                interrupt: function(event) {
                  debug && console.log('Room chat interrupted.');
                  window.clearTimeout(refreshTimeOut);
                  Rooms.leave(currentToken);
                  isConnected = false;
                  currentToken = null;
                  document.removeEventListener('visibilitychange',
                                               backgroundModeHandler);
                  removeHeadPhonesChangeHandler();

                  if (document.hidden) {
                    window.addEventListener('visibilitychange', function onVisibilityChange() {
                      window.removeEventListener('visibilitychange', onVisibilityChange);
                      RoomUI.hide();
                      showError();
                    });
                  } else {
                    RoomUI.hide();
                    showError();
                  }
                },
                error: function(event) {
                  debug && console.log('Error while joining room');
                  isConnected = false;
                  currentToken = null;
                  document.removeEventListener('visibilitychange',
                                               backgroundModeHandler);
                  removeHeadPhonesChangeHandler();
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
                removeHeadPhonesChangeHandler();
                shouldRate ? rate(RoomUI.hide) : RoomUI.hide();
              };

              RoomUI.onToggleMic = function() {
                roomManager.publishAudio(RoomUI.isMicEnabled);
              };

              RoomUI.onSwitchSpeaker = function() {
                roomManager.forceSpeaker(RoomUI.isSpeakerEnabled);
              };

              RoomUI.onToggleVideo = function() {
                roomManager.publishVideo(!roomManager.isPublishingVideo);
              };

              params.apiKey = result.apiKey;
              params.sessionId = result.sessionId;
              params.sessionToken = result.sessionToken;
              roomManager.join(params);
            });
            // We compare with false because we've assumed that by default
            // is a video call (when the parameter is not present)
            // and its behavior will be the same as RoomManager.join
            var isVideoCall = params.video !== 'false' &&
                              params.video !== false;
            Telemetry.updateReport('roomCamera',
              isVideoCall ?
                (params.frontCamera === true || params.frontCamera === 'true') ?
                  'front' :
                  'back' :
                'none'
              );
          },
          function(error) {
            debug && console.log('Error while joining room');
            currentToken = null;
            isConnected = false;
            removeHeadPhonesChangeHandler();
            RoomUI.hide(() => {
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
          });
        }, () => {
          // The user cancels
          RoomUI.hide();
        });
      });
    },
    addParticipant: function(token, name, account, connectionId) {
      if (isConnected && currentToken && (currentToken === token)) {
        RoomUI.updateParticipant(name, account);
      }
      addConnectionId(token, connectionId);
    },
    updateParticipants: function(token, connectionIds) {
      updateConnectionIds(token, connectionIds);
    },
    isParticipant: function(token, connectionId) {
      return checkConnectionId(token, connectionId);
    },
    get headphonesPresent() {
      return acm && acm.headphones;
    }
  };

  exports.RoomController = RoomController;
}(this));
