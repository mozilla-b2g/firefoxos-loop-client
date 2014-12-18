(function(exports) {
  'use strict';

  var debug = Config.debug;

  var _identity;

  const TELEMETRY_DICTIONARY = {
    'fxa': 'FxA',
    'msisdn': 'MobileId',
    'cellular': 'callsWithCellular',
    'wifi': 'callsWithWifi'
  };

  const CALLS_CHANNEL_NAME = 'calls';
  const ROOMS_CHANNEL_NAME = 'rooms';
  const MAX_PARTICIPANTS = 2;

  var _lastChangedRooms = [];

  var _ownAppInfo = {
    app: null,
    icon: null
  };

  function _getLastStateRoom(aRoom) {
    if (!aRoom) {
      return;
    }

    var lastState = _lastChangedRooms.find(function(room) {
      return room.roomToken === aRoom.roomToken;
    });

    return lastState || {};
  }

  function _registerOtherJoinEvt(token, aNewParticipant, aLastStateRoom) {
    if (!aNewParticipant) {
      console.error ('we have not received a user to compare');
      return;
    }

    var userPreviouslyPresent = [];
    if (aLastStateRoom && aLastStateRoom.participants) {
      var accountNewP = aNewParticipant.account;
      var nameNewP = aNewParticipant.displayName;
      var lastParticipants = aLastStateRoom.participants;
      userPreviouslyPresent = lastParticipants.find(function(participant) {
        if (participant.account) {
          return participant.account === accountNewP;
        } else if (!accountNewP) {
          return participant.displayName === nameNewP;
        }
      });
    }

    if (!userPreviouslyPresent) {
      Loader.getRoomEvent().then(RoomEvent => {
        RoomEvent.save({type: RoomEvent.type.otherJoin,
                        token: token,
                        identity: accountNewP  || RoomEvent.identityUnknown });
      });
    }
  }

  function _getApp() {
    if (_ownAppInfo.app && _ownAppInfo.icon) {
      return Promise.resolve(_ownAppInfo);
    }

    return new Promise(function(resolve, reject) {
      navigator.mozApps.getSelf().onsuccess = function(evt) {
        _ownAppInfo.app = evt.target.result;
        Loader.getNotificationHelper().then(function(NotificationHelper) {
          _ownAppInfo.icon = NotificationHelper.getIconURI(_ownAppInfo.app);
          resolve(_ownAppInfo);
        });
      };
    });
  }

  function _hideSplash() {
    setTimeout(function() {
      SplashScreen && SplashScreen.hide();
    }, 1000);
  }

  function _initWizard(isFirstUse) {
    return new Promise((resolve, reject) => {
      Loader.getWizard().then((Wizard) => {
        Navigation.to('wizard-panel', 'right');
        Wizard.init(isFirstUse, resolve, reject);
      });
    });
  }

  function _getCallScreenManager() {
    return new Promise((resolve, reject) => {
      LazyLoader.load(['js/helpers/call_screen_manager.js'], () => {
        resolve(CallScreenManager);
      });
    });
  }

  function _onauthentication(event) {
    _initWizard(event.detail.firstRun).then(() => {
      _hideSplash();
      window.removeEventListener('onauthentication', _onauthentication);
    });
  }

  function _onAccount(event) {
    if (!event.detail || !event.detail.identity) {
      log.error('Unexpected malformed onlogin event');
      return;
    }

    _identity = event.detail.identity;

    Settings.updateIdentity(_identity);

    CallLog.init(_identity);
    LoadingOverlay.hide();
    Navigation.to('calllog-panel', 'left').then(_hideSplash);
  }

  function _onlogin(event) {
    _synchronizeRooms();
  }

  /*
   * It synchronizes local and remote rooms. It adds new rooms or deletes rooms
   * created/deleted while phone was off or existing before installing Firefox
   * Hello.
   */
  function _synchronizeRooms() {
    Loader.getRoomsSynchronizer().then((RoomsSynchronizer) => {
      RoomsSynchronizer.synchronize().then((response) => {
        CallLog.removeRooms(response.roomsToDelete.map((currentValue) => {
          return currentValue.roomToken;
        }));
        CallLog.updateRooms(response.roomsToUpdate);
        response.roomsToAdd.forEach(CallLog.addRoom);
      }, (error) => {
        console.error('Could not synchronize the call log', error);
      });
    });
  }

  function _onlogout() {
    CallLog.clean();
    _initWizard(false).then(() => {
      _hideSplash();
      Settings.reset();
      LoadingOverlay.hide();
    });
  }

  function _onloginerror(event) {
    _initWizard(false /* isFirstUse */).then(() => {
      _hideSplash();
      LoadingOverlay.hide();
    });
  }

  function _onsharedurl() {
    Telemetry.updateReport('sharedUrls');
  }

  function _oncall(isIncoming) {
    AccountHelper.getAccount(function(account) {
      if (!account || !account.id || !account.id.type) {
        return;
      }

      var direction = isIncoming ? 'incoming' : 'outgoing';
      var type = TELEMETRY_DICTIONARY[account.id.type];
      type && Telemetry.updateReport(direction + 'CallsWith' + type);
    });

    if (navigator.connection) {
      var reportName = TELEMETRY_DICTIONARY[navigator.connection.type];
      reportName && Telemetry.updateReport(reportName);
    }
  }

  var _;

  var Controller = {
    init: function () {

      _ = navigator.mozL10n.get;

      // We need to anticipate the recovery of the setting values
      // so that when we need the values the promise will be already
      // accomplished
      Settings.init();

      window.addEventListener('onauthentication', _onauthentication);
      window.addEventListener('onlogin', _onlogin);
      window.addEventListener('onaccount', _onAccount);
      window.addEventListener('onlogout', _onlogout);
      window.addEventListener('onloginerror', _onloginerror);

      // Start listening activities
      Activities.init();

      // Channels where I want to listen events from.
      var channels = [
        {
          name: CALLS_CHANNEL_NAME,
          handler: Controller.onConversationEvent
        },
        {
          name: ROOMS_CHANNEL_NAME,
          handler: Controller.onRoomsEvent
        }
      ];

      AccountHelper.init(channels);
    },


    /**
     * Handle the simple push notifications the device receives as an incoming
     * call as Conversation.
     *
     * @param {Numeric} version Simple push notification id (version).
     */
    onConversationEvent: function(version) {
      _getCallScreenManager().then((csm) => {
        csm.launch(
          'incoming',
          {
            version: version,
            frontCamera: Settings.isFrontalCamera,
            vibrate: Settings.shouldVibrate
          }
        );
        _oncall(true /* isIncoming */);
      });
    },

    /**
     * Handle the simple push notifications the device receives when there is a
     * change in any of my rooms (If you are not the owner of the room you will
     * not receive any notification)
     *
     * @param {Numeric} version Simple push notification id (version).
     */
    onRoomsEvent: function(version) {
      debug && console.log('Push notification with version ' + version);
      // Update the list
      _synchronizeRooms();
      // Launch notifications if anyone joined
      Rooms.getChanges(version).then(function(rooms) {
        debug && console.log('Rooms changed ' + JSON.stringify(rooms));
        _getApp().then(function() {
          rooms.forEach(function(room) {
            // Avoid auto-push effect. If the room is full there is no
            // notification (due we are connected and waiting the other
            // peer)
            if (!room.participants ||
                room.participants.length === 0) {
              return;
            }

            var lastStateRoom = _getLastStateRoom(room);
            if (room.participants.length === MAX_PARTICIPANTS) {
              room.participants.forEach((participant) => {
                if (participant.account !== Controller.identity) {
		  document.hidden && Loader.getNotificationHelper().then(
		    function(NotificationHelper) {
		      NotificationHelper.send({
			raw: room.roomName
		      }, {
			body: _('hasJoined', {
			  name: participant.displayName
			}),
			icon: _ownAppInfo.icon,
			tag: room.roomUrl
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
			    'Notification clicked for room: ' + room.roomUrl
			  );
			  _ownAppInfo.app.launch();
			  notification.close();
			};
		      });
		  });
                  RoomController.addParticipant(
                    room.roomToken,
                    participant.displayName,
                    participant.account
                  );
                  _registerOtherJoinEvt(room.roomToken,
                                        participant,
                                        lastStateRoom);
                }
              });
              return;
            }

            room.participants.forEach((participant) => {
              if (participant.account !== Controller.identity) {
                _registerOtherJoinEvt(room.roomToken,
                                      participant,
                                      lastStateRoom);
                Loader.getNotificationHelper().then(function(NotificationHelper) {
                  if (room.roomOwner === Controller.identity) {
                    TonePlayerHelper.init('publicnotification');
                    TonePlayerHelper.playSomeoneJoinedARoomYouOwn();
                  }
                  NotificationHelper.send({
                    raw: room.roomName
                  }, {
                    body: _('hasJoined', {
                      name: participant.displayName
                    }),
                    icon: _ownAppInfo.icon,
                    tag: room.roomUrl
                  }).then((notification) => {
                    notification.onclick = function() {
                      debug && console.log('Notification clicked for room: ' + room.roomUrl);
                      _ownAppInfo.app.launch();
                      notification.close();
                    };
                  });
                });
              }
            });
          });
          _lastChangedRooms = rooms;
        });
      });
    },

    authenticate: function(id) {
      LoadingOverlay.show(_('authenticating'));
      AccountHelper.authenticate(id);
    },

    createRoom: function() {
      Loader.getRoomCreate().then((RoomCreate) => {
        RoomCreate.show();
      });
    },

    editRoom: function(room) {
      Loader.getRoomCreate().then((RoomCreate) => {
        RoomCreate.show(room);
      });
    },

    joinRoom: function(token, roomName) {
      Loader.getRoomController().then((RoomController) => {
        RoomController.join({
          token: token,
          roomName: roomName,
          displayName: Controller.identity,
          video: Settings.isVideoDefault,
          frontCamera: Settings.isFrontalCamera
        });
      });
    },

    onRoomCreated: function(room, navigateToDetail) {
      CallLog.addRoom(room).then(room => {
        navigateToDetail && Controller.showRoomDetails(room);
      });
    },

    onRoomUpdated: function(room) {
      Loader.getRoomDetail().then((RoomDetail) => {
        RoomDetail.update(room);
      });
      CallLog.updateRooms([room]);
    },

    onRoomShared: function(room, contact, identity) {
      Loader.getRoomEvent().then(RoomEvent => {
        RoomEvent.save({
          type: RoomEvent.type.shared,
          token: room.roomToken,
          contactId: contact.id,
          identity: identity
        });
      });
      RoomsDB.addLastSharedPerson(room, contact, identity);
      CallLog.updateRooms([room]);
    },

    onRoomDeleted: function(token) {
      CallLog.removeRooms(token);
    },

    showRoomDetails: function (room) {
      if (!room) {
        return;
      }
      Loader.getRoomDetail().then((RoomDetail) => {
        RoomDetail.show(room);
      });
    },

    pickContact: function(onsuccess, onerror) {
      if (typeof onsuccess !== 'function') {
        onsuccess = function() {};
      }
      if (typeof onerror !== 'function') {
        onerror = function() {};
      }
      var activity = new MozActivity({
        name: 'pick',
        data: {
          type: 'webcontacts/contact',
          fullContact: true
        }
      });

      activity.onsuccess = function() {
        onsuccess(activity.result);
      };
      activity.onerror = onerror;
    },

    startConversation: function() {
      Controller.pickContact(
        function onContactRetrieved(contact) {
          Controller.callContact({
            contact: contact,
            isVideoCall: Settings.isVideoDefault
          }, () => {
            Telemetry.updateReport('callsFromContactPicker');
          });
        },
        function onError() {
          // TODO Check if needed to show any prompt to the user
        }
      )
    },

    callIdentities: function(params, done) {
      // The user could make a call from the contact app and the share screen
      // might be shown. Let's hide it.
      window.ShareScreen && ShareScreen.hide();
      params = params || {};
      Loader.getConversationDetail().then((ConversationDetail) => {
        ConversationDetail.show(params).then((conversationParams) => {
          _getCallScreenManager().then((csm) => {
            csm.launch(
              'outgoing',
              {
                identities: params.identities,
                video: params.isVideoCall,
                contact: params.contact,
                frontCamera: conversationParams.isFrontCamera,
                subject: conversationParams.subject
              }
            );
            _oncall();
          });
          typeof done === 'function' && done();
        }, () => {
          // Dismissed conversation
        });
      });
    },

    callContact: function(params, done) {
      params = params || {};
      if (!AccountHelper.logged) {
        alert(Branding.getTranslation('notLoggedIn'));
        return;
      }

      var contact = params.contact;
      if (!contact ||
          (!contact.email &&
           !contact.tel)) {
        alert(_('pickActivityFail'));
        return;
      }

      // Create an array of identities
      var identities = [];

      var mails = contact.email || [];
      for (var i = 0; i < mails.length; i++) {
        identities.push(mails[i].value);
      }

      var tels = contact.tel || [];
      for (var i = 0; i < tels.length; i++) {
        identities.push(tels[i].value);
      }

      if (identities.length === 0) {
        alert(_('pickActivityFail'));
        return;
      }

      params.identities = identities;
      Controller.callIdentities(params, done);
    },

    callUrl: function(params, done) {
      params = params || {};
      if (!AccountHelper.logged) {
        alert(Branding.getTranslation('notLoggedIn'));
        return;
      }

      if (!params.token) {
        alert(_('invalidURL'));
        return;
      }

      Loader.getConversationDetail().then((ConversationDetail) => {
        ConversationDetail.show(params).then((conversationParams) => {
          _getCallScreenManager().then((csm) => {
            csm.launch(
              'outgoing',
              {
                token: params.token,
                video: params.isVideoCall,
                frontCamera: conversationParams.isFrontCamera,
                subject: conversationParams.subject
              }
            );

            _oncall();
          });
          typeof done === 'function' && done();
        }, () => {
          // Dismissed conversation
        });
      });
    },

    shareUrl: function (params, onsuccess, onerror) {
      debug && console.log('Loop web URL ' + url);

      if (typeof onerror !== 'function') {
        onerror = function() {};
      }

      if (!params.url || params.url.length === 0) {
        console.error('Controller.shareUrl: No url to share');
        onerror(new Error('Controller.shareUrl: No url to share'));
        return;
      }

      Loader.getShare().then((Share) => {
        Share.broadcast(
          params.url,
          function onSent() {
            _onsharedurl();

            if (typeof onsuccess !== 'function') {
              onsuccess = function() {};
            }
          },
          onerror
        );
      });
    },

    sendUrlBySMS: function (params, onsuccess, onerror) {
      params = params || {};

      if (!params.phonenumber || params.phonenumber.length === 0) {
        console.error('Controller.sendURLbySMS: No phone number in params');
        return;
      }

      if (!params.url || params.url.length === 0) {
        console.error('Controller.sendURLbySMS: No url in params');
        return;
      }

      if (typeof onsuccess !== 'function') {
        onsuccess = function() {};
      }

      debug && console.log('Loop web URL for SMS ' + params.url + ' to ' + params.phonenumber);
      Loader.getShare().then((Share) => {
        Share.useSMS(
          params,
          params.phonenumber,
          function onSent() {
            if (params.type === 'call') {
              _onsharedurl();
            }
            onsuccess();
          },
          onerror
        );
      });
    },

    sendUrlByEmail: function (params, onsuccess, onerror) {
      if (!params.email || params.email.length === 0) {
        console.error('Controller.sendURLbyEmail: No phone number in params');
        return;
      }

      if (!params.url || params.url.length === 0) {
        console.error('Controller.sendURLbyEmail: No url in params');
        return;
      }

      if (typeof onsuccess !== 'function') {
        onsuccess = function() {};
      }

      debug && console.log('Loop web URL through EMAIL ' + params.url + ' to ' + params.email);
      Loader.getShare().then((Share) => {
        Share.useEmail(
          params,
          params.email,
          function onSent() {
            if (params.type === 'call') {
              _onsharedurl();
            }
            onsuccess();
          },
          onerror
        );
      });
    },

    getUrlByToken: function(token, callback) {
      if (typeof callback !== 'function') {
        console.error('Error: callback is not defined');
        return;
      }
      ActionLogDB.getUrlByToken(
        function(error, result) {
          if (error) {
            console.error('Error when getting URL from DB ' + error.name);
            return;
          }
          callback(result);
        },
        token
      );
    },

    revokeUrl: function (token, callback) {
      if (!navigator.onLine) {
        LazyLoader.load([
          'js/screens/error_screen.js'
        ], function() {
          var _ = navigator.mozL10n.get;
          OfflineScreen.show(_('noConnection'));
        });
        return;
      }
      ClientRequestHelper.revokeUrl(
        token,
        callback,
        function onError(e) {
          console.error('Error when revoking URL in server: ' + e);
          if (e === 'Not Found') {
            callback(e);
            return;
          }
          LazyLoader.load([
            'js/screens/error_screen.js'
          ], function() {
            var _ = navigator.mozL10n.get;
            ErrorScreen.show(_('genericServerError'), true);
          });
        }
      );
    },

    logout: function() {
      Activities.clear();
      AccountHelper.logout();
    },

    showError: function(reason) {
      switch(reason) {
        case 'gum':
          alert(Branding.getTranslation('cameraPermission'));
          break;
        default:
          alert(_(reason));
          break;
      }
    },

    get identity() {
      return _identity;
    }
  };

  exports.Controller = Controller;
}(this));
