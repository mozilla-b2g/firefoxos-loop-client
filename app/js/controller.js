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

  function _hideSplash() {
    setTimeout(function() {
      SplashScreen && SplashScreen.hide();
    }, 1000);
  }

  function _initWizard(isFirstUse) {
    return new Promise((resolve, reject) => {
      LazyLoader.load(['style/wizard.css',
                       'js/screens/wizard/authenticate.js',
                       'js/screens/wizard/tutorial.js',
                       'js/screens/wizard/wizard.js'], () => {
        Navigation.to('wizard-panel', 'right');
        Wizard.init(isFirstUse, resolve, reject);
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
    // TODO When we are logged in with the server, we are ready
    // to call the API in order to update our DB (i.e. rooms).
  }

  function _onlogout() {
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
      CallScreenManager.launch(
        'incoming',
        {
          version: version,
          frontCamera: Settings.isFrontalCamera,
          vibrate: Settings.shouldVibrate
        }
      );
      _oncall(true /* isIncoming */);
    },

    /**
     * Handle the simple push notifications the device receives when there is a
     * change in any of my rooms (If you are not the owner of the room you will
     * not receive any notification)
     *
     * @param {Numeric} version Simple push notification id (version).
     */
    onRoomsEvent: function(version) {
      // TODO Use for the implementation of bug
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1104018
    },

    authenticate: function(id) {
      LoadingOverlay.show(_('authenticating'));
      AccountHelper.authenticate(id);
    },

    createRoom: function() {
      LazyLoader.load(['style/create_room.css',
                       'js/screens/create_room.js'], () => {
        RoomCreate.show();
      });
    },

    onRoomCreated: function(room, token) {
      Controller.showRoomDetails(room, token);
      // TODO Update log UI
    },

    onRoomDeleted: function(token) {
      // TODO Update log UI
    },

    showRoomDetails: function (room, token) {
      LazyLoader.load(
        [
          'style/room_detail.css',
          'js/screens/room_detail.js'],
          function() {
            RoomDetail.show(room, token);
          }
      );
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

    pickAndCall: function() {
      Controller.pickContact(
        function onContactRetrieved(contact) {
          Controller.callContact(contact, Settings.isVideoDefault);
          Telemetry.updateReport('callsFromContactPicker');
        },
        function onError() {
          // TODO Check if needed to show any prompt to the user
        }
      )
    },

    callIdentities: function(identities, contact, isVideoCall) {
      CallScreenManager.launch(
        'outgoing',
        {
          identities: identities,
          video: isVideoCall,
          contact: contact,
          frontCamera: Settings.isFrontalCamera
        }
      );
      _oncall();
    },

    callContact: function(contact, isVideoCall) {
      if (!AccountHelper.logged) {
        alert(Branding.getTranslation('notLoggedIn'));
        return;
      }

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

      Controller.callIdentities(identities, contact, isVideoCall);
    },

    callUrl: function(token, isVideoCall) {
      if (!AccountHelper.logged) {
        alert(Branding.getTranslation('notLoggedIn'));
        return;
      }

      if (!token) {
        alert(_('invalidURL'));
        return;
      }

      CallScreenManager.launch(
        'outgoing',
        {
          token: token,
          video: isVideoCall,
          frontCamera: Settings.isFrontalCamera
        }
      );

      _oncall();
    },

    shareUrl: function (url, onsuccess, onerror) {
      debug && console.log('Loop web URL ' + url);
      var activity = new MozActivity({
        name: 'share',
        data: {
          type: 'url',
          url: url
        }
      });
      activity.onsuccess = function() {
        onsuccess && onsuccess();
        _onsharedurl();
      };
      activity.onerror = onerror;
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

      debug && console.log('Loop web URL for SMS ' + params.url + ' to ' + params.phonenumber);

      var text = '';
      switch(params.type) {
        case 'room':
          text = params.url;
          break;
        case 'conversation':
          text = _('shareMessage') + ' ' + params.url;
          break;
        default:
          text = params.url;
      }

      if (typeof onsuccess !== 'function') {
        onsuccess = function() {};
      }
      if (typeof onerror !== 'function') {
        onerror = function() {};
      }

      var activity = new MozActivity({
        name: 'new',
        data: {
          type: 'websms/sms',
          number: params.phonenumber,
          body: text
        }
      });
      activity.onsuccess = function() {
        onsuccess();
        if (params.type === 'conversation') {
          _onsharedurl();
        }
      };
      activity.onerror = onerror;
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
      if (typeof onerror !== 'function') {
        onerror = function() {};
      }

      debug && console.log('Loop web URL through EMAIL ' + params.url + ' to ' + params.email);

      // This is a workaround to add subject & body clicking on a '<a>' element
      var body = '';
      var subject = 'Firefox Hello';
      switch(params.type) {
        case 'room':
          body = params.url;
          break;
        case 'conversation':
          body = _('shareMessage') + ' ' + params.url;
          _onsharedurl();
          break;
      }

      debug && console.log('Loop web URL for email ' + url + ' to ' + id);
      var activity = new MozActivity({
        name: 'new',
        data: {
          type: 'mail',
          url: 'mailto:' + params.email +
                '?subject=' + subject +
                '&body= '+ body
        }
      });
      activity.onsuccess = function() {
        onsuccess();
        _onsharedurl();
      };
      activity.onerror = onerror;
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
            ErrorScreen.show(_('genericServerError'));
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
