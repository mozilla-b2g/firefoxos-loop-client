(function(exports) {
  'use strict';

  var _sharePanel, _closeButton, _shareOthers, _shareSMS,
      _shareEmail, _contactName, _urlshown, _shareInfo,
      _shareInfoPhoto, _sharingReason;
  
  var _contact, _contactInfo, _url, _urlObject, _identities = [];
  var _tels = [], _mails = [];

  var _; // l10n

  function _cleanVars() {
    // Clean vars
    _contact = null;
    _url = null;
    _tels = [];
    _mails = [];
    _identities = null;
    _contactInfo = null;
  }

  function _generateUrlObject() {
    var expirationDate = new Date(+_urlObject.expiresAt * 1000);
    var tokenTmp = _url.split('/');
    var token = tokenTmp[tokenTmp.length - 1];
    var contactId = _contact ? _contact.id : null;
    var contactPrimaryInfo = _contact ? _contact.name[0] : _identities[0];

    var objectToStore = {
      date: new Date(),
      identities: _identities,
      url: _url,
      urlToken: token,
      expiration: expirationDate,
      revoked: false,
      contactId: contactId,
      contactPrimaryInfo: contactPrimaryInfo,
      contactPhoto: null
    };

    return objectToStore;
  }

  function _newSMS(id) {
    Controller.sendUrlBySMS(
      id,
      _url,
      function onSMSShared() {
        CallLog.addUrl(_generateUrlObject(), _contactInfo);
        // See bug https://bugzilla.mozilla.org/show_bug.cgi?id=1107862
        // The 'websms/sms' activity only executes the `onsuccess` callback of
        // the activity when the user hits the close button in the Messaging
        // app. We took out the action of hidding the share screen from here for
        // that reason.
        _cleanVars();
      },
      function onError() {
        _cleanVars();
        // TODO Do we need to show something to the user?
      }
    );
    Share.hide();
  }
    
  function _newMail(id) {
    Controller.sendUrlByEmail(
      id,
      _url
    );
    CallLog.addUrl(_generateUrlObject(), _contactInfo);
    _cleanVars();
    Share.hide();
  }

  function _newFromArray(identities, newCB) {
    // If we have more than one option
    var items = [];

    for (var i = 0; i < identities.length; i++) {
      items.push(
        {
          name: identities[i],
          method: newCB,
          params: [identities[i]]
        }
      );
    }

    items.push(
      {
        name: 'Cancel'
      }
    );

    var options = new OptionMenu({
      type: 'action',
      items: items
    });
    options.show();
  }


  function _init() {
    if (_sharePanel) {
      return;
    }

    _ = navigator.mozL10n.get;

    _sharePanel = document.getElementById('share-panel');
    _closeButton = document.getElementById('share-close-button');
    _shareOthers = document.getElementById('share-by-others');
    _shareSMS = document.getElementById('share-by-sms');
    _shareEmail = document.getElementById('share-by-email');
    _contactName = document.getElementById('contact-name-to-share');
    _sharingReason = document.getElementById('sharing-reason');
    _urlshown = document.getElementById('link-to-share');
    _shareInfo = document.querySelector('.share-contact-info');
    _shareInfoPhoto = document.querySelector('.share-contact-photo');
    
    
    _closeButton.addEventListener(
      'click',
      function() {
        _cleanVars();
        Share.hide();
      }
    );

    _shareOthers.addEventListener(
      'click',
      function() {
        Controller.shareUrl(
          _url,
          function onShared() {
            CallLog.addUrl(_generateUrlObject(), _contactInfo);
            _cleanVars();
            Share.hide();
          },
          function onError() {
            _cleanVars();
            // TODO Do we need to show something to the user?
          }
        );
      }
    );

    _shareSMS.addEventListener(
      'click',
      function sendThroughSMS() {
        if (_tels.length === 1) {
          _newSMS(_tels[0]);
          return;
        }
        _newFromArray(_tels, _newSMS);
      }
    );


    _shareEmail.addEventListener(
      'click',
      function sendThroughEmail() {
        if (_mails.length === 1) {
          _newMail(_mails[0]);
          return;
        }
        _newFromArray(_mails, _newMail);
      }
    );
  }


  function _renderOptions(identities) {

    // Classify the identities taking into account the group
    for (var i = 0, l = identities.length; i < l; i++) {
      if (identities[i].indexOf('@') === -1) {
        _tels.push(identities[i]);
      } else {
        _mails.push(identities[i]);
      }
    }

    // Show the right set of options
    if (_tels.length === 0) {
      _shareSMS.style.display = 'none';
    } else {
      _shareSMS.style.display = 'block';
    }

    if (_mails.length === 0) {
      _shareEmail.style.display = 'none';
    } else {
      _shareEmail.style.display = 'block';
    }
  }

  function _getIdentities(contact) {
    var phones = contact.tel || [];
    var emails = contact.email || [];
    var candidates = phones.concat(emails);
    var identities = [];

    for (var i = 0, l = candidates.length; i < l; i++) {
      identities.push(candidates[i].value);
    }
    return identities;
  }
  
  function _render(identities, url, sharingReason) {
    _identities = identities;
    // Firsf of all we update the basics, the reason and
    // the info related with URL and identities
    _sharingReason.textContent = Branding.getTranslation(sharingReason);
    _contactName.textContent = identities[0];
    _urlshown.textContent = url;

    // Now we update with the contacts info if available
    ContactsHelper.find(
      {
        identities: identities
      },
      function onContact(result) {
        _contactInfo = result;
        _contact = result.contacts[0];
        // Update the name
        _contactName.textContent = ContactsHelper.getPrimaryInfo(_contact);
        // Update the photo
        if (_contact.photo && _contact.photo.length > 0) {
          var url = URL.createObjectURL(_contact.photo[0]);
          var urlString = 'url(' + url + ')';
          _shareInfoPhoto.style.backgroundImage = urlString;
          _shareInfo.classList.remove('has-no-photo');
        } else {
          _shareInfo.classList.add('has-no-photo');
        }
        // Render options from contact
        _renderOptions(_getIdentities(_contact));
      },
      function onFallback() {
        _shareInfo.classList.add('has-no-photo');
        _renderOptions(identities);
      }
    );
  }

  var Share = {
    show: function s_show(urlObject, identities, sharingReason, callback) {
      // Init listeners
      _init();

      // Init global vars
      _urlObject = urlObject;
      _url = urlObject.callUrl;

      // Render the UI
      _render(identities, _url, sharingReason);

      // Show the panel and execute the callback when shown.
      _sharePanel.addEventListener(
        'transitionend',
        function onTransition() {
          if (typeof callback === 'function') {
            callback();
          }
        }
      );
      _sharePanel.classList.add('show');
    },
    hide: function s_hide() {
      // Clean UI
      _shareSMS.style.display = 'none';
      _shareEmail.style.display = 'none';

      // Hide panel
      _sharePanel.classList.remove('show');
    }
  };

  exports.Share = Share;
}(this));
