(function(exports) {
  'use strict';
  var _panel;
  var _roomNameUI, _ctimeUI, _ownerUI, _shareContactButton, _sharedWithItem, _sharedWithButton, _editButton,
      _showHistoryButton, _deleteButton, _backButton, _expirationUI, _urlUI;
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

  function _onEdit() {
    Controller.editRoom(_room);
  }

  function _cleanUI() {
    _roomNameUI.textContent = '';
    _ctimeUI.textContent = '';
    _expirationUI.textContent = '';
    _ownerUI.textContent = '';
    _urlUI.textContent = '';

    _panel.classList.remove('invited');
  }

  function _restoreStructure() {
    if (_panel) {
      return;
    }

    // Extract the commented code to the panel
    _panel = document.getElementById('room-detail-panel');

    // Cache all elements to be used in the rest of code
    _backButton = document.getElementById('rdp-back-button');
    _editButton = document.getElementById('rdp-edit-button');
    _roomNameUI = document.getElementById('rdp-name');
    _ctimeUI = document.getElementById('rdp-creation-date');
    _expirationUI = document.getElementById('rdp-expiration');
    _ownerUI = document.getElementById('rdp-owner');
    _urlUI = document.getElementById('rdp-url');
    _shareContactButton = document.getElementById('rdp-share-contact');
    _sharedWithItem = document.getElementById('rdp-invitees-section');
    _sharedWithButton = document.getElementById('rdp-show-invitees');
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

    _urlUI.textContent = room.roomUrl;
    
    _isOwner ? _sharedWithItem.classList.remove('hidden') : _sharedWithItem.classList.add('hidden');
    _sharedWithButton.disabled = !_room.sharedWith || _room.sharedWith.length < 1;
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
    Loader.getRoomHistory().then((RoomHistory) => {
      RoomHistory.show(_room);
    });
  }

  function _shareToContact() {
    Loader.getShare().then(() => {
      Share.pickContact(
        {
          type: 'room',
          url: _room.roomUrl
        },
        function onShared(contact, identity) {
          Controller.onRoomShared(_room, contact, identity);
          _sharedWithButton.disabled = false;
        },
        function onError() {
          // TOOD Implement if needed
          console.log('Error when sharing room to a contact');
        }
      );
    });
  }

  function _showSharedWith(){
    var people = _room.sharedWith || [];
    var peopleFiltered = [];    
    people.forEach(function(element){
      var exist = peopleFiltered.some(function(item){
        if(element.contactId == item.contactId) {
          return true;
        }
      });
      if(!exist) {
        peopleFiltered.push(element);
      }
    });
    Loader.getSharedWith().then(function(SharedWith) {
        SharedWith.show(peopleFiltered);
    });
  }

  function _removeListeners() {
    _backButton.removeEventListener('click', _onBack);
    _editButton.removeEventListener('click', _onEdit);
    _shareContactButton.removeEventListener('click', _shareToContact);
    _sharedWithButton.removeEventListener('click', _showSharedWith);
    _showHistoryButton.removeEventListener('click', _showHistory);
    _deleteButton.removeEventListener('click', _delete);
    window.removeEventListener('localized', _handleLocalization);
  }

  function _addListeners() {
    _backButton.addEventListener('click', _onBack);
    _editButton.addEventListener('click', _onEdit);
    _shareContactButton.addEventListener('click', _shareToContact);
    _sharedWithButton.addEventListener('click', _showSharedWith);
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
