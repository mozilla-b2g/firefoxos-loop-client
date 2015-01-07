'use strict';

(function(exports) {

  var _ = navigator.mozL10n.get;

  var debug = Config.debug;

  function _showConfirmation(title, onDelete) {
    var options = new OptionMenu({
      section: _(title),
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
          method: onDelete,
          params: []
        }
      ]
    });
  }

  function _showOfflineError() {
    Loader.getOfflineScreen().then(OfflineScreen => {
      OfflineScreen.show(_('noConnection'));
    });
    return Promise.reject('NO_CONNECTION');
  }

  function _deleteRemoteRooms(tokens) {
    debug && console.log('We are going to remove from server', tokens);
    return Rooms.delete(tokens).then(result => {
      debug && console.log('Response from server after deleting', JSON.stringify(result));
      var responses = result.responses;
      var deletedRooms = [];
      Object.keys(responses).forEach(token => {
        var code = responses[token].code;
        // Rooms deleted properly + rooms not found in server
        if (code === 200 || code === 404) {
          deletedRooms.push(token);
        }
      });
      debug && console.log('Rooms removed from server:', deletedRooms);
      return deletedRooms;
    });
  }

  function _getAllRooms() {
    var asOwner = [];
    var asInvited = [];
    var myIdentity = Controller.identity;

    return new Promise((resolve, reject) => {
      RoomsDB.getAll().then(cursor => {
        if (!cursor) {
          console.error('No rooms cursor');
          return reject(new Error('NO_CURSOR'));
        }

        cursor.onsuccess = function onsuccess(event) {
          var item = event.target.result;
          if (!item) {
            var params = {
              asOwner: asOwner,
              asInvited: asInvited
            };
            debug && console.log('Getting all rooms from DB:', JSON.stringify(params));
            return resolve(params);
          }

          var room = item.value;
          room.roomOwner === myIdentity ? asOwner.push(room.roomToken) :
                                          asInvited.push(room.roomToken);

          item.continue();
        };

        cursor.onerror = function onerror(event) {
          console.error('Error iterating rooms cursor', error);
          reject(error);
        };
      }, error => {
        console.error('Error reading local rooms', error);
        reject(error);
      });
    });
  }

  function _deleteAll() {
    return new Promise((resolve, reject) => {
      _showConfirmation('deleteAllRoomsConfirmation', function onDelete() {
        var roomTokens;

        // STEP 1: Users are aware of deleting action is being performed
        LoadingOverlay.show(_('deleting'));

        // STEP 2: Get all rooms stored in the local database
        _getAllRooms()

        // STEP 3: Remove my list of rooms from server (owner === identity)
        .then(_roomTokens => {
          roomTokens = _roomTokens;
          var roomTokensAsOwner = roomTokens.asOwner;
          if (roomTokensAsOwner.length === 0) {
            debug && console.log('There is no rooms created by', Controller.identity);
            return roomTokensAsOwner;
          }

          if (!navigator.onLine) {
            return _showOfflineError();
          } else {
            return _deleteRemoteRooms(roomTokensAsOwner);
          }
        })

        // STEP 4: We have to remove rooms in DB once rooms have been removed
        // remotely (all invited rooms + my rooms that were deleted from the
        // server successfully)
        .then(remotelyRemovedTokens => {
          var toBeRemoved = roomTokens.asInvited.concat(remotelyRemovedTokens);
          debug && console.log('We are going to remove from loca DB', toBeRemoved);
          return Controller.onRoomDeleted(toBeRemoved);
        })

        // STEP 5: Resolve the promise when the process finishes or reject it
        // when an error happens displaying an error message to users
        .then(() => {
          debug && console.log('All rooms were removed');
          LoadingOverlay.hide();
          resolve();
        }, error => {
          console.error('Error deleting rooms', JSON.stringify(error));
          LoadingOverlay.hide();
          Loader.getErrorScreen().then(ErrorScreen => {
            ErrorScreen.show(_('errorDeletingRooms'));
          });
          reject(error);
        });
      });
    });
  }

  function _delete(obj) {
    var token = obj.token;
    var isOwner = obj.isOwner;

    if (!isOwner) {
      return new Promise((resolve, reject) => {
        Loader.getStatus().then(Status => {
          Controller.onRoomDeleted(token).then(() => {
            Status.show(_('roomsDeleted', {
              value: 1
            }));
            resolve();
          });
        }, reject);
      });
    }

    if (!navigator.onLine) {
      return _showOfflineError();
    }

    return new Promise((resolve, reject) => {
      _showConfirmation('deleteRoomConfirmation', function onDelete() {
        _deleteRemoteRooms([token]).then(result => {
          if (result.length > 0) {
            Controller.onRoomDeleted(token).then(resolve);
          } else {
            reject('NOT_DELETED_REMOTE_ROOM');
          }
        }, reject);
      });
    });
  }

  var RoomDelete = {
    /*
     * It deals with deleting rooms.
     *
     * @obj {Object} Optional object which defines a room to be
     *               removed. If this argument is not defined the method will
     *               remove all rooms in log. E.g: { token: 'a', isOwner: true }
     */
    show: function(obj) {
      obj = obj || {};

      if (obj.token) {
        return _delete(obj);
      } else {
        return _deleteAll();
      }
    }
  };

  exports.RoomDelete = RoomDelete;

}(window));
