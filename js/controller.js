(function(exports) {
  'use strict';

  var debug = true;

  function _hideSplash() {
    setTimeout(SplashScreen.hide, 1000);
  }

  function _onauthentication(event) {
    Wizard.init(event.detail.firstRun);
    _hideSplash();
    window.removeEventListener('onauthentication', _onauthentication);
  }

  function _onlogin(event) {
    if (!event.detail || !event.detail.identity) {
      log.error('Unexpected malformed onlogin event');
      return;
    }
    CallLog.init(event.detail.identity);
    _hideSplash();
    LoadingOverlay.hide();
  }

  function _onlogout() {
    Wizard.init(false);
    _hideSplash();
    Settings.reset();
    setTimeout(function() {
      LoadingOverlay.hide();
      Settings.hide();
    }, 500);
  }

  function _onloginerror(event) {
    Wizard.init(false /* isFirstUse */);
    _hideSplash();
    LoadingOverlay.hide();
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
        frontCamera: Settings.isFrontalCamera
      }
    );
  }

  function _onsharedurl() {
    UrlMetrics.recordSharedUrl();
  }

  var _;

  var Controller = {
    init: function () {

      _ = navigator.mozL10n.get;

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
    },

    callContact: function(contact, isVideoCall) {
      if (!AccountHelper.logged) {
        alert(_('notLoggedIn'));
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
        alert(_('notLoggedIn'));
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

    revokeUrl: function (token, date, callback) {
      ClientRequestHelper.revokeUrl(
        token,
        function onDeleted() {
          ActionLogDB.revokeUrl(
            function(error) {
              if (error) {
                console.error('Error when deleting calls from DB ' + error.name);
                return;
              }

              if (typeof callback === 'function') {
                callback();
              }
            },
            date
          );
        },
        function onError(e) {
          console.error('Error when revoking URL in server: ' + e);
        }
      );
    },

    logout: function() {
      AccountHelper.logout();
    },

    showError: function(reason) {
      switch(reason) {
        case 'gum':
          alert(_('cameraPermission'));
          break;
        case 'failed':
          alert(_('failed'));
          break;
      }
    }
  };

  exports.Controller = Controller;
}(this));
