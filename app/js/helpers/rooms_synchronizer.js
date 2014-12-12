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
    return (remoteRoom.roomName !== localRoom.roomName) ||
           (remoteRoom.expiresAt > localRoom.expiresAt);
  }

  function synchronize() {
    return new Promise(function(resolve, reject) {
      onConnected().then(() => {
        Rooms.getAll().then((remoteRooms) => {
          // Remove deleted rooms as candidates, we will identify them later on.
          var candidates = remoteRooms.filter(function(room) {return !room.deleted});

          var response = {
            roomsToAdd: candidates,
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
                  return resolve(response);
                }
                // Retrieve every local room
                var localRoom = item.value;
                // Is between the ones with changes?
                var idx = candidates.findIndex(matching.bind(null, localRoom));
                if (idx > -1) {
                  // If it is, we need to check if it's a new room or not
                  var remoteRoom = candidates[idx];
                  if (isDiff(remoteRoom, localRoom)) {
                    response.roomsToUpdate.push(remoteRoom);
                  }
                  candidates.splice(idx, 1);
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
