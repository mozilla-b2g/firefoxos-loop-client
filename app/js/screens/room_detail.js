(function(exports) {
  'use strict';
  var _panel;
  var _roomNameUI, _ctimeUI, _ownerUI, _shareContactButton,
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
    _shareContactButton = document.getElementById('rdp-share-contact');
    _showHistoryButton = document.getElementById('rdp-show-history');
    _deleteButton = document.getElementById('rdp-delete');
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
  function _delete() {
    LazyLoader.load('js/screens/delete_room.js', () => {
      RoomDelete.show(_token, _isOwner).then(
        function() {
          _onBack();
        },
        function(e) {
          if (e && e !== 'NO_CONNECTION') {
            // TODO Add error handling about this
            // https://bugzilla.mozilla.org/show_bug.cgi?id=1102847
            alert('Error while deleting ' + _token + ' ' + e + JSON.stringify(e));
          }
        }
      );
    });
  }

  function _showHistory() {
    console.log('Show history panel');
    // TODO Implement when history panel will be created
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1102849
  }

  function _shareToContact() {
    Loader.getShare().then(() => {
      Share.toContact(
        {
          type: 'room',
          url: _room.roomUrl
        },
        function onShared() {
          console.log('Lets add this to DB');
          // TODO Implement when
          // https://bugzilla.mozilla.org/show_bug.cgi?id=1104749
        },
        function onError() {
          // TOOD Implement if needed
          console.log('Error when sharing room to a contact');
        }
      );
    });
  }

  function _removeListeners() {
    _backButton.removeEventListener('click', _onBack);
    _shareContactButton.removeEventListener('click', _shareToContact);
    _showHistoryButton.removeEventListener('click', _showHistory);
    _deleteButton.removeEventListener('click', _delete);
    window.removeEventListener('localized', _handleLocalization);
  }

  function _addListeners() {
    _backButton.addEventListener('click', _onBack);
    _shareContactButton.addEventListener('click', _shareToContact);
    _showHistoryButton.addEventListener('click', _showHistory);
    _deleteButton.addEventListener('click', _delete);
    window.addEventListener('localized', _handleLocalization);
  }

  function _handleLocalization() {
    _renderInfo(_room);
  }

  var RoomDetail = {
    show: function(room) {
      // Check if we are the owners
      _isOwner = room.roomOwner === Controller.identity;

      // Cache room object for future methods
      _room = room;
      _token = room.roomToken;

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
