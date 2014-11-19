(function(exports) {
  'use strict';
  var _panel;
  var _roomNameUI, _ctimeUI, _ownerUI, _shareSocialButton, _shareContactButton,
      _showHistoryButton, _deleteButton, _backButton, _expirationUI;
  var _room = null, _token = null;
  var _isOwner = false;
  var _ = navigator.mozL10n.get;
 
  function _onBack(event) {
    _room = null;
    _token = null;
    _isOwner = false;

    _removeListeners();
    
    // Back to the call log based on the 'deep' navigation model
    Navigation.to('calllog-panel', 'right').then(_cleanUI);
  }

  function _cleanUI() {
    _roomNameUI.textContent = '';
    _ctimeUI.textContent = '';
    _expirationUI.textContent = '';
    _ownerUI.textContent = '';
    
    _panel.classList.remove('invited');
  }
 
  function _restoreStructure() {
    if (_panel) {
      return;
    }
 
    // Extract the commented code to the panel
    _panel = document.getElementById('room-detail-panel');
    _panel.innerHTML = Template.extract(_panel);

    // Cache all elements to be used in the rest of code
    _backButton = document.getElementById('rdp-back-button');
    _roomNameUI = document.getElementById('rdp-name');
    _ctimeUI = document.getElementById('rdp-creation-date');
    _expirationUI = document.getElementById('rdp-expiration');
    _ownerUI = document.getElementById('rdp-owner');
    _shareSocialButton = document.getElementById('rdp-share-social');
    _shareContactButton = document.getElementById('rdp-share-contact');
    _showHistoryButton = document.getElementById('rdp-show-history');
    _deleteButton = document.getElementById('rdp-delete');
    
    // We emit this event to center properly the header
    window.dispatchEvent(new CustomEvent('lazyload', {
      detail: _panel
    }));
  }

  function _renderInfo(room) {
    _isOwner ?
      _panel.classList.remove('invited') :
      _panel.classList.add('invited');

    // Update details of the room
    _roomNameUI.textContent = room.roomName;
    
    var ms = +_room.creationTime * 1000;
    navigator.mozL10n.localize(_ctimeUI, 'roomCreation', {
      date: Utils.getHeaderDate(ms),
      time: Utils.getFormattedHour(ms)
    });

    _expirationUI.textContent = Utils.getRevokeDate(+_room.expiresAt * 1000);

    if (_isOwner) {
      _ownerUI.textContent = _('createdByYou');
    } else {
      navigator.mozL10n.localize(_ownerUI, 'createdBy', {
        owner: _room.roomOwner
      });

      ContactsHelper.find(
        {
          identities: [_room.roomOwner]
        },
        function onContact(result) {
          // If there is a contact, we update the info async.
          var contact = result.contacts[0];
          var name = ContactsHelper.prettyPrimaryInfo(contact);

          navigator.mozL10n.localize(_ownerUI, 'createdBy', {
            owner: name
          });
        }
      );

    }
  }

  function _shareSocial() {
    Controller.shareUrl(
      _room.roomUrl,
      function() {
        // TODO Add to event history when creating the panel
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1102849
      },
      function() {
        // TODO Add error handling if needed
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1102847
      }
    );
  }

  function _shareBySMS(identity) {
    setTimeout(function() {
      Controller.sendUrlBySMS(
        {
          url: _room.roomUrl,
          phonenumber: identity,
          type: 'room'
        },
        function() {
          // TODO Add to event history when creating the panel
          // https://bugzilla.mozilla.org/show_bug.cgi?id=1102849
        }
      );
    }, 600); // Workaround to get the SMS activity working.
  }

  function _shareByEmail(identity) {
    Controller.sendUrlByEmail(
      {
        url: _room.roomUrl,
        email: identity,
        type: 'room'
      }
    );
    // TODO Add to event history when creating the panel
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1102849
  }

  function _shareToContact() {
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
          _shareBySMS(tels[0]);
          return;
        }

        // If just a email is found, we send email directly
        if (emailsLength === 1 && telsLength === 0) {
          _shareByEmail(emails[0]);
          return;
        }

        // Now we need to get all identities and we create the option dialog
        var identities = emails.concat(tels);
        var items = [];

        function _solveActivity(identity) {
          if (identity.indexOf('@') !== -1) {
            _shareByEmail(identity);
          } else {
            _shareBySMS(identity);
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
      function onError() {
        // TODO Check if show an error is needed
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1102847
      }
    )
  }

  function _deleteRoomDB() {
    Rooms.delete(_token).then(
      function() {
        _onBack();
        Controller.onRoomDeleted(_token);
      },
      function(e) {
        // TODO Add error handling about this
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1102847
        alert('Error while deleting ' + _token + ' ' + e + JSON.stringify(e));
      }
    );
  }

  function _delete() {
    if (!_isOwner) {
      _deleteRoomDB();
      return;
    }

    var options = new OptionMenu({
      section: _('deleteRoomConfirmation'),
      type: 'confirm',
      items: [
        {
          name: 'Cancel',
          l10nId: 'cancel'
        },
        {
          name: 'Delete',
          class: 'danger',
          l10nId: 'delete',
          method: _deleteRoomDB,
          params: []
        }
      ]
    });
  }

  function _showHistory() {
    console.log('Show history panel');
    // TODO Implement when history panel will be created
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1102849
  }

  function _removeListeners() {
    _backButton.removeEventListener('click', _onBack);
    _shareSocialButton.removeEventListener('click', _shareSocial);
    _shareContactButton.removeEventListener('click', _shareToContact);
    _showHistoryButton.removeEventListener('click', _showHistory);
    _deleteButton.removeEventListener('click', _delete);
    window.removeEventListener('localized', _handleLocalization);
  }
 
  function _addListeners() {
    _backButton.addEventListener('click', _onBack);
    _shareSocialButton.addEventListener('click', _shareSocial);
    _shareContactButton.addEventListener('click', _shareToContact);
    _showHistoryButton.addEventListener('click', _showHistory);
    _deleteButton.addEventListener('click', _delete);
    window.addEventListener('localized', _handleLocalization);
  }

  function _handleLocalization() {
    _renderInfo(_room);
  }

  var RoomDetail = {
    show: function(room, token) {
      // Check if we are the owners
      _isOwner = room.roomOwner === Controller.identity;

      // Cache room object for future methods
      _room = room;
      _token = token;

      // Uncomment the code and get the panel ready
      _restoreStructure();
      // Render all info available in the room object
      _renderInfo(room);
      // Navigate to the detail based on the new transition
      // logic. This is based on 'deep' level, so the transition
      // to get in is to the left, to get out to the 'right'
      Navigation.to('room-detail-panel', 'left');

      _addListeners();
    },
    update: _renderInfo
  };
 
  exports.RoomDetail = RoomDetail;
 
}(window));
