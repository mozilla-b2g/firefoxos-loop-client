(function(exports) {
  'use strict';

  // In our code 'params' will be the following:
  // var params = {
  //   type: 'call' || 'room'
  //   value: 'http://foo.es' || 'foo' // This is just an example
  // }

  const MAIL_SUBJECT = 'Firefox Hello';

  var _ = navigator.mozL10n.get;

  function _getToken(url){
    var slices = url.split('/');
    return slices[slices.length-1];
  }

  function _generateText(params) {
    var body;
    switch(params.type) {
      case 'room':
        body = params.url;
        break;
      case 'call':
        body = _('shareMessage') + ' ' + params.url;
        break;
      default:
        body = params.url;
    }
    return body;
  }

  function _onContactRetrieved(params, onsuccess, onerror) {
    var contact = params.contact;
    // Given a contact we get the array of identities
    function _mapValue(item) {
      return item.value;
    }
    var emails = !contact.email ? [] : contact.email.map(_mapValue);
    var tels = !contact.tel ? [] : contact.tel.map(_mapValue);

    var emailsLength = emails.length;
    var telsLength = tels.length;

    // If no email or tel is found, we show just an alert with the error
    if (emailsLength === 0 && telsLength === 0) {
      alert(_('pickActivityFail'));
      return;
    }

    // If just a phone number is found, we send SMS directly
    if (emailsLength === 0 && telsLength === 1) {
      Share.useSMS(params, tels[0],
                   onsuccess.bind(null, contact, tels[0]), onerror);
      return;
    }

    // If just a email is found, we send email directly
    if (emailsLength === 1 && telsLength === 0) {
      Share.useEmail(params, emails[0],
                     onsuccess.bind(null, contact, emails[0]), onerror);
      return;
    }

    // Now we need to get all identities and we create the option dialog
    var identities = emails.concat(tels);
    var items = [];

    function _solveActivity(identity) {
      var onShared = onsuccess.bind(null, contact, identity);
      if (identity.indexOf('@') !== -1) {
        Share.useEmail(params, identity, onShared, onerror);
      } else {
        Share.useSMS(params, identity, onShared, onerror);
      }
    }

    for (var i = 0, l = identities.length; i < l; i++) {
      items.push(
        {
          name: identities[i],
          method: _solveActivity,
          params: [identities[i]]
        }
      );
    }

    items.push(
      {
        name: 'Cancel',
        l10nId: 'cancel'
      }
    );

    var options = new OptionMenu({
      type: 'action',
      items: items
    });
  }

  function checkCallbacks(onsuccess, onerror) {
    if (typeof onsuccess !== 'function') {
      onsuccess = function() {};
    }
    if (typeof onerror !== 'function') {
      onerror = function() {};
    }
  }

  var Share = {
    toIdentity: function(params, onsuccess, onerror) {
      checkCallbacks(onsuccess, onerror);

      if (!params || !params.type || !params.url || !params.identity) {
        onerror(new Error('Share.toIdentity: No params'));
        return;
      }

      var identity = params.identity;
      var onShared = onsuccess.bind(null, {}, identity);
      if (identity.indexOf('@') !== -1) {
        Share.useEmail(params, identity, onShared, onerror);
      } else {
        Share.useSMS(params, identity, onShared, onerror);
      }
    },

    toContact: function(params, onsuccess, onerror) {
      checkCallbacks(onsuccess, onerror);

      if (!params || !params.type || !params.url || !params.contact) {
        onerror(new Error('Share.toContact: No params'));
        return;
      }

      _onContactRetrieved(params, onsuccess, onerror);
    },

    pickContact: function(params, onsuccess, onerror) {
      checkCallbacks(onsuccess, onerror);

      if (!params || !params.type || !params.url) {
        onerror(new Error('Share.pickContact: No params'));
        return;
      }

      Controller.pickContact(
        function onContactRetrieved(contact) {
          params.contact = contact;
          _onContactRetrieved(params, onsuccess, onerror);
        },
        onerror
      );
    },

    useSMS: function(params, identity, onsuccess, onerror) {
      setTimeout(function() {
        var text = _generateText(params);
        var activity = new MozActivity({
          name: 'new',
          data: {
            type: 'websms/sms',
            number: identity,
            body: text
          }
        });
        activity.onsuccess = onsuccess;
        activity.onerror = onerror;
      }, 600); // Workaround to get the SMS activity working.
      var token = _getToken(params.url);
      RoomsDB.get(token).then(function(room) {
        if (room.SMSnotification === undefined) {
          room.SMSnotification = 1;
        } else {
          room.SMSnotification += 1;
        }
        RoomsDB.update([room]).then(function() {
          console.log('registered SMS notification');
        },function(){
          console.log('error while updating room');
        });
      }, function(){
        console.log('Couldnt find room with such token ' + token);
      });
    },

    useEmail: function(params, identity, onsuccess, onerror) {
      setTimeout(function() {
        var text = _generateText(params);
        var activity = new MozActivity({
          name: 'new',
          data: {
            type: 'mail',
            url: 'mailto:' + identity +
                  '?subject=' + MAIL_SUBJECT +
                  '&body= '+ text
          }
        });
        activity.onsuccess = onsuccess;
        activity.onerror = onerror;
      }, 600); // Workaround to avoid black screen invoking Email activity.
      var token = _getToken(params.url);
      RoomsDB.get(token).then(function(room) {
        if (room.emailNotification === undefined){
          room.emailNotification = 1;
        } else {
          room.emailNotification += 1;
        }
        RoomsDB.update([room]).then(function() {
          console.log('registered Email notification');
        },function(){
          console.log('error while updating room');
        });
      }, function(){
        console.log('Couldnt find room with such token ' + token);
      });
    },

    broadcast: function(url, onsuccess, onerror) {
      var activity = new MozActivity({
        name: 'share',
        data: {
          type: 'url',
          url: url
        }
      });
      activity.onsuccess = onsuccess;
      activity.onerror = onerror;
    }
  };

  exports.Share = Share;

}(this));
