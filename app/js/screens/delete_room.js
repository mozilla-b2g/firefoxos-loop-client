'use strict';

(function(exports) {

  var _ = navigator.mozL10n.get;

  function _deleteRoomDB(token) {
    return new Promise((resolve, reject) => {
      Rooms.delete(token).then(() => {
        Controller.onRoomDeleted(token);
        resolve();
      }, reject);
    });
  }

  function _delete(token, isOwner) {
    if (!isOwner) {
      return _deleteRoomDB(token);
    }

    if (!navigator.onLine) {
      LazyLoader.load('js/screens/error_screen.js', () => {
        OfflineScreen.show(_('noConnection'));
      });
      return Promise.reject('NO_CONNECTION');
    }
      
    return new Promise((resolve, reject) => {
      var options = new OptionMenu({
        section: _('deleteRoomConfirmation'),
        type: 'confirm',
        items: [
          {
            name: 'Cancel',
            l10nId: 'cancel',
            method: reject
          },
          {
            name: 'Delete',
            class: 'danger',
            l10nId: 'delete',
            method: (token) => {
              _deleteRoomDB(token).then(resolve, reject);
            },
            params: [token]
          }
        ]
      });
    });
  }

  var RoomDelete = {
    show: function(token, isOwner) {
      return _delete(token, isOwner);
    }
  };
 
  exports.RoomDelete = RoomDelete;
 
}(window));
