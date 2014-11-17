(function(exports) {
  'use strict';

  var debug = Config.debug;
  const TELEMETRY_DICTIONARY = {
    'fxa': 'FxA',
    'msisdn': 'MobileId',
    'cellular': 'callsWithCellular',
    'wifi': 'callsWithWifi'
  };

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

  function _onlogin(event) {
    if (!event.detail || !event.detail.identity) {
      log.error('Unexpected malformed onlogin event');
      return;
    }

    Settings.updateIdentity(event.detail.identity);

    CallLog.init(event.detail.identity);
    _hideSplash();
    LoadingOverlay.hide();
  }

  function _onlogout() {
    _initWizard(false).then(() => {
      _hideSplash();
      Settings.reset();
      setTimeout(function() {
        LoadingOverlay.hide();
        Settings.hide();
      }, 500);
    });
  }

  function _onloginerror(event) {
    _initWizard(false /* isFirstUse */).then(() => {
      _hideSplash();
      LoadingOverlay.hide();
    });
  }

  /**
   * Handle the simple push notifications the device receives as an incoming
   * call.
   *
   * @param {Numeric} notificationId Simple push notification id (version).
   */
  function _onnotification(version) {
    CallScreenManager.launch(
      'incoming',
      {
        version: version,
        frontCamera: Settings.isFrontalCamera,
        vibrate: Settings.shouldVibrate
      }
    );
    _oncall(true /* isIncoming */);
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
      window.addEventListener('onlogout', _onlogout);
      window.addEventListener('onloginerror', _onloginerror);

      // Start listening activities
      Activities.init();

      AccountHelper.init(_onnotification);
    },

    authenticate: function(id) {
      LoadingOverlay.show(_('authenticating'));
      AccountHelper.authenticate(id);
    },

    pickAndCall: function() {
      var activity = new MozActivity({
        name: 'pick',
        data: {
          type: 'webcontacts/contact',
          fullContact: true
        }
      });

      activity.onsuccess = function() {
        Controller.callContact(activity.result, Settings.isVideoDefault);
        Telemetry.updateReport('callsFromContactPicker');
      };

      activity.onerror = function() {
        // TODO Check if needed to show any prompt to the user
      };
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

    sendUrlBySMS: function (id, url, onsuccess, onerror) {
      debug && console.log('Loop web URL for SMS ' + url + ' to ' + id);
      var activity = new MozActivity({
        name: 'new',
        data: {
          type: 'websms/sms',
          number: id,
          body: _('shareMessage') + ' ' + url
        }
      });
      activity.onsuccess = function() {
        onsuccess && onsuccess();
        _onsharedurl();
      };
      activity.onerror = onerror;
    },

    sendUrlByEmail: function (id, url) {
      debug && console.log('Loop web URL for SMS ' + url + ' to ' + id);
      var a = document.createElement('a');
      var params = 'mailto:' + id + '?subject=Firefox Hello' +
        '&body= '+ _('shareMessage') + ' ' + url;

      a.href = params;
      a.classList.add('hide');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      _onsharedurl();
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
    }
  };

  exports.Controller = Controller;
}(this));
