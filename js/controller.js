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
    // TODO Add LoadingOverlay.hide() when implemented
  }

  function _onlogout() {
    Wizard.init(false);
    SplashScreen.hide();
  }

  function _onloginerror(event) {
    Wizard.init(false /* isFirstUse */);
    SplashScreen.hide();
    // TODO Add error message
    // TODO Add LoadingOverlay.hide() when implemented
  }

  /**
   * Handle the simple push notifications the device receives as an incoming
   * call.
   *
   * @param {Numeric} notificationId Simple push notification id (version).
   */
  function _onnotification(version) {
    navigator.mozApps.getSelf().onsuccess = function (event) {
      var app = event.target.result;
      app.launch();
      ClientRequestHelper.getCalls(
        version,
        function onsuccess(callsArray) {
          var call = callsArray.calls[0];
          // TODO Add search of the Contact and pass to the
          // callscreen when ready. We should NOT block the attention
          // until getting the info.
          // This will be handled in bug #1036309
          CallScreenManager.launch('incoming', call, [call.callerId]);
        },
        function onerror(e) {
          debug && console.log('Error: ClientRequestHelper.getCalls ' + e);
        }
      )
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
        Controller.call(activity.result);
      };

      activity.onerror = function() {
        // TODO Check if needed to show any prompt to the user
      };
    },

    call: function(contact, isVideoOn) {
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

      // TODO When doing the direct call, use 'isVideoOn' or
      // the param retrieved from Loop Settings. By default
      // this param will be true.

      CallHelper.callUser(
        identities,
        function onLoopIdentity(call) {
          CallScreenManager.launch('outgoing', call, identities, contact);
        },
        function onFallback() {
          // TODO Update this when an array of identities will be ready
          CallHelper.generateCallUrl(identities[0],
            function onCallUrlSuccess(result) {
              console.log(JSON.stringify(result));
              Share.show(contact, result);
            },
            function() {
              alert('Unable to retrieve link to share');
            }
          );
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

    logout: function() {
      AccountHelper.logout();
    }
  };

  exports.Controller = Controller;
}(this));
