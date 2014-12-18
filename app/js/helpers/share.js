(function(exports) {
  'use strict';

  // In our code 'params' will be the following:
  // var params = {
  //   type: 'call' || 'room'
  //   value: 'http://foo.es' || 'foo' // This is just an example
  // }

  const MAIL_SUBJECT = 'Firefox Hello';

  var _ = navigator.mozL10n.get;

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

  var Share = {
    toContact: function(params, onsuccess, onerror) {
      if (typeof onsuccess !== 'function') {
        onsuccess = function() {};
      }
      if (typeof onerror !== 'function') {
        onerror = function() {};
      }

      if (!params || !params.type || !params.url) {
        onerror(new Error('Share.toContact: No params'));
        return;
      }

      Controller.pickContact(
        function onContactRetrieved(contact) {
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
        },
        onerror
      )
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
    },

    broadcast: function(params, onsuccess, onerror) {
      var activity = new MozActivity({
        name: 'share',
        data: {
          type: 'url',
          url: _generateText(params)
        }
      });
      activity.onsuccess = onsuccess;
      activity.onerror = onerror;
    }
  };

  exports.Share = Share;

}(this));
