(function(exports) {
  'use strict';

  var _sharePanel, _closeButton, _shareOthers, _shareSMS,
      _contactName, _urlshown;
  var _contact;

  function _init() {
    if (_sharePanel) {
      return;
    }
    _sharePanel = document.getElementById('share-panel');
    _closeButton = document.getElementById('share-close-button');
    _shareOthers = document.getElementById('share-by-others');
    _shareSMS = document.getElementById('share-by-sms');
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
          _contact.tel[0].value,
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
      function() {
        Controller.sendUrlBySMS(
          _contact.tel[0].value,
          function onSMSShared() {
            Share.hide();
          },
          function onError() {
            // TODO Do we need to show something to the user?
          }
        );
      }.bind(this)
    );
  }

  function _render(contact, url) {
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
      _render(contact, url);
      _sharePanel.classList.add('show');
    },
    hide: function s_hide() {
      _sharePanel.classList.remove('show');
    }
  };

  exports.Share = Share;
}(this));