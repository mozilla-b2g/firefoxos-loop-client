(function(exports) {
  'use strict';

  var debug = true;

  function _onauthentication(event) {
    Wizard.init(event.detail.firstRun);
    SplashScreen.hide();
    window.removeEventListener('onauthentication', _onauthentication);
  }

  function _onlogin(event) {
    if (!event.detail || !event.detail.identity) {
      log.error('Unexpected malformed onlogin event');
      return;
    }
    CallLog.init(event.detail.identity);
    SplashScreen.hide();
    LoadingOverlay.hide();
  }

  function _onlogout() {
    Wizard.init(false);
    SplashScreen.hide();
    Settings.reset();
    setTimeout(function() {
      LoadingOverlay.hide();
      Settings.hide();
    }, 500);
  }

  function _onloginerror(event) {
    Wizard.init(false /* isFirstUse */);
    SplashScreen.hide();
    LoadingOverlay.hide();
    // TODO Add error message
  }

  /**
   * Handle the simple push notifications the device receives as an incoming
   * call.
   *
   * @param {Numeric} notificationId Simple push notification id (version).
   */
  function _onnotification(version) {
    navigator.mozApps.getSelf().onsuccess = function (event) {
      CallScreenManager.launch(
        'incoming',
        {
          version: version
        }
      );
    }
  }

  var Controller = {
    init: function () {
      window.addEventListener('onauthentication', _onauthentication);
      window.addEventListener('onlogin', _onlogin);
      window.addEventListener('onlogout', _onlogout);
      window.addEventListener('onloginerror', _onloginerror);

      // Start listening activities
      Activities.init();

      AccountHelper.init(_onnotification);
    },

    authenticate: function(id) {
      LoadingOverlay.show('Authenticating...');
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
          contact: contact
        }
      );
    },

    callContact: function(contact, isVideoCall) {
      if (!AccountHelper.logged) {
        alert('You need to be logged in before making a call with Loop');
        return;
      }

      if (!contact ||
          (!contact.email &&
           !contact.tel)) {
        alert('The pick activity result is invalid.');
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
        alert('The pick activity result is invalid.');
      }

      Controller.callIdentities(identities, contact, isVideoCall);
    },

    callUrl: function(token, isVideoCall) {
      if (!AccountHelper.logged) {
        alert('You need to be logged in before making a call with Loop');
        return;
      }

      if (!token) {
        alert('Invalid call URL');
        return;
      }

      CallScreenManager.launch(
        'outgoing',
        {
          token: token,
          video: isVideoCall
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
      activity.onsuccess = onsuccess;
      activity.onerror = onerror;
    },

    sendUrlBySMS: function (id, url, onsuccess, onerror) {
      debug && console.log('Loop web URL for SMS ' + url + ' to ' + id);
      var activity = new MozActivity({
        name: 'new',
        data: {
          type: 'websms/sms',
          number: id,
          body: 'Lets join the call with Loop! ' + url
        }
      });
      activity.onsuccess = onsuccess;
      activity.onerror = onerror;
    },

    sendUrlByEmail: function (id, url) {
      debug && console.log('Loop web URL for SMS ' + url + ' to ' + id);
      var a = document.createElement('a');
      var params = 'mailto:' + id + '?subject=Loop' +
        '&body=Lets join the call with Loop! ' + url;

      a.href = params;
      a.classList.add('hide');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
    }
  };

  exports.Controller = Controller;
}(this));
