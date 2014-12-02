'use strict';

(function(exports) {

  function onConnected() {
    if (navigator.onLine) {
      return Promise.resolve();
    }

    return new Promise(function(resolve, reject) {
       window.addEventListener('online', function onConnect() {
        window.removeEventListener('online', onConnect);
        resolve();
      });
    });
  }

  function isDiff(remoteRoom, localRoom) {
    return remoteRoom.roomName !== localRoom.roomName;
  }

  function isDeleted(remoteRoom) {
    return remoteRoom.deleted;
  }

  function cleanDeletedRooms(remoteRooms) {
    return remoteRooms.find((room) => {
      return !isDeleted(room);
    });
  }

  function synchronize() {
    return new Promise(function(resolve, reject) {
      onConnected().then(() => {
        Rooms.getAll().then((remoteRooms) => {
          var response = {
            roomsToAdd: remoteRooms,
            roomsToDelete: [],
            roomsToUpdate: []
          };

          CallLog.onReady().then(() => {
            var matching = function(lookFor, compareWith) {
              return lookFor.roomToken === compareWith.roomToken;
            };
            // Getting rooms for my identity...
            RoomsDB.getAll().then((cursor) => {
              if (!cursor) {
                console.error('No rooms cursor');
                return reject(new Error('NO_CURSOR'));
              }

              cursor.onsuccess = function onsuccess(event) {
                var item = event.target.result;
                if (!item) {
                  response.roomsToAdd = cleanDeletedRooms(remoteRooms);
                  return resolve(response);
                }

                var localRoom = item.value;
                var idx = remoteRooms.findIndex(matching.bind(null, localRoom));
                if (idx > -1) {
                  var remoteRoom = remoteRooms[idx];
                  if (isDeleted(remoteRoom)) {
                    response.roomsToDelete.push(localRoom);
                  } else if (isDiff(remoteRoom, localRoom)) {
                    response.roomsToUpdate.push(remoteRoom);
                  }
                  remoteRooms.splice(idx, 1);
                } else if (localRoom.roomOwner === Controller.identity) {
                  // Delete local rooms which are not in the server and I am
                  // the owner (otherwise I was invited and this must not be
                  // deleted from the local BD).
                  response.roomsToDelete.push(localRoom);
                }
                item.continue();
              };

              cursor.onerror = function onerror(event) {
                console.error('Error iterating rooms cursor', error);
                reject(error);
              };
            }, (error) => {
              console.error('Error reading local rooms', error);
              reject(error);
            });
          });
        }, (error) => {
          console.error('Error getting remote rooms', error);
          reject(error);
        });
      });
    });
  }

  exports.RoomsSynchronizer = {
    /*
     * This method returns a Promise and when it is fulfilled the caller will
     * receive an object with two arrays. The first one ("roomsToAdd") is a set
     * of remote rooms that are not registered locally and the second one
     * ("roomsToDelete") represents the set of rooms that exists locally but no
     * remotely.
     */
    synchronize: synchronize
  };

}(window));
