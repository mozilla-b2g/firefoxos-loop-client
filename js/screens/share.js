(function(exports) {
  'use strict';

  var _sharePanel, _closeButton, _shareOthers, _shareSMS,
      _shareEmail, _contactName, _urlshown;
  var _contact, _url;

  function _newSMS(id) {
    Controller.sendUrlBySMS(
      id,
      _url,
      function onSMSShared() {
        Share.hide();
      },
      function onError() {
        // TODO Do we need to show something to the user?
      }
    );
  }
    
  function _newMail(id) {
    Controller.sendUrlByEmail(
      id,
      _url,
      function onSMSShared() {
        Share.hide();
      },
      function onError() {
        // TODO Do we need to show something to the user?
      }
    );
  }

  function _newFromArray(identities, newCB) {
    // If we have more than one option
    var items = [];

    for (var i = 0; i < identities.length; i++) {
      items.push(
        {
          name: identities[i].value,
          method: newCB,
          params: [identities[i].value]
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
    _sharePanel = document.getElementById('share-panel');
    _closeButton = document.getElementById('share-close-button');
    _shareOthers = document.getElementById('share-by-others');
    _shareSMS = document.getElementById('share-by-sms');
    _shareEmail = document.getElementById('share-by-email');
    _contactName = document.getElementById('contact-name-to-share')
    _urlshown = document.getElementById('link-to-share')

    _closeButton.addEventListener(
      'click',
      function() {
        Share.hide();
      }
    );

    _shareOthers.addEventListener(
      'click',
      function() {
        Controller.shareUrl(
          _url,
          function onShared() {
            Share.hide();
          },
          function onError() {
            // TODO Do we need to show something to the user?
          }
        );
      }
    );

    _shareSMS.addEventListener(
      'click',
      function sendThroughSMS() {
        if (_contact.tel.length === 1) {
          _newSMS(_contact.tel[0].value);
          return;
        }
        _newFromArray(_contact.tel, _newSMS);
      }
    );


    _shareEmail.addEventListener(
      'click',
      function sendThroughEmail() {
        if (_contact.email.length === 1) {
          _newMail(_contact.email[0].value);
          return;
        }
        _newFromArray(_contact.email, _newMail);
      }
    );
  }

  function _render(contact, url) {
    if (!contact.tel) {
      _shareSMS.style.display = 'none';
    } else {
      _shareSMS.style.display = 'block';
    }

    if (!contact.email) {
      _shareEmail.style.display = 'none';
    } else {
      _shareEmail.style.display = 'block';
    }

    _contactName.textContent = contact.name[0];
    _urlshown.textContent = url;
  }
    

  var Share = {
    show: function s_show(contact, url) {
      if (!contact) {
        console.log('ERROR: Contact is undefined in SHARE').
        return;
      }
      _init();
      _contact = contact;
      _url = url;
      _render(contact, url);
      _sharePanel.classList.add('show');
    },
    hide: function s_hide() {
      _sharePanel.classList.remove('show');
      _contact = null;
      _url = null;
    }
  };

  exports.Share = Share;
}(this));