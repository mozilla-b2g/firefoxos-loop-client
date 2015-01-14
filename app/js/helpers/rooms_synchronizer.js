'use strict';

/*
 * RoomsSynchronizer is a module that deals with synchronization between remote
 * and local rooms.
 *
 * How it works:
 *
 * 1) Wait for connection and get all remote rooms from loop server.
 * 2) Compare new, renamed and deleted rooms between local and remote data.
 * 3) Update the local DB and call log accordingly.
 *
 * If several synchronizations are requested while one is running, only once it
 * finishes, the last pending synchronization requested will be performed
 * omitting the rest of them because previous requests do not make sense.
 */
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
           (remoteRoom.expiresAt > localRoom.expiresAt) ||
           (remoteRoom.participants.length !== localRoom.participants.length);
  }

  var lastPendingSynchronization = null;

  function onSynchronizationEnd() {
    if (lastPendingSynchronization !== null) {
      doSynchronization(lastPendingSynchronization.resolve,
                        lastPendingSynchronization.reject);
    }
  }

  function synchronize() {
    return new Promise(function(resolve, reject) {
      if (lastPendingSynchronization !== null) {
        // Only needed the last pending synchronization
        lastPendingSynchronization = {
          resolve: resolve,
          reject: reject
        };
      } else {
        doSynchronization(resolve, reject);
      }
    });
  }

  function doSynchronization(resolve, reject) {
    lastPendingSynchronization = null;
    return onConnected().then(() => {
      Rooms.getAll().then((remoteRooms) => {
        // Remove deleted rooms as candidates, we will identify them later on.
        var roomsToAdd = remoteRooms.filter(function(room) {return !room.deleted}),
            roomsToDelete = [],
            roomsToUpdate = [];

        CallLog.onReady().then(() => {
          var matching = function(lookFor, compareWith) {
            return lookFor.roomToken === compareWith.roomToken;
          };
          // Getting rooms for my identity...
          RoomsDB.getAll().then((cursor) => {
            if (!cursor) {
              console.error('No rooms cursor');
              onSynchronizationEnd();
              return reject(new Error('NO_CURSOR'));
            }

            cursor.onsuccess = function onsuccess(event) {
              var item = event.target.result;
              if (!item) {
                var actions = [
                  // STEP 1: update rooms
                  CallLog.updateRooms(roomsToUpdate),
                  // STEP 2: remove rooms
                  CallLog.removeRooms(roomsToDelete.map((room) => {
                    return room.roomToken;
                  }))
                  // STEP 3: add rooms
                ].concat(roomsToAdd.map((room) => {
                  return CallLog.addRoom(room);
                }));

                return Promise.all(actions)
                              .then(onSynchronizationEnd, error => {
                                console.error('Error while synchronizing',
                                              error);
                                onSynchronizationEnd();
                              })
                              .then(resolve);
              }
              // Retrieve every local room
              var localRoom = item.value;
              // Is between the ones with changes?
              var idx = roomsToAdd.findIndex(matching.bind(null, localRoom));
              if (idx > -1) {
                // If it is, we need to check if it's a new room or not
                var remoteRoom = roomsToAdd[idx];
                if (isDiff(remoteRoom, localRoom)) {
                  roomsToUpdate.push(remoteRoom);
                }
                roomsToAdd.splice(idx, 1);
              } else if (localRoom.roomOwner === Controller.identity) {
                // Delete local rooms which are not in the server and I am
                // the owner (otherwise I was invited and this must not be
                // deleted from the local BD).
                roomsToDelete.push(localRoom);
              }
              item.continue();
            };

            cursor.onerror = function onerror(event) {
              console.error('Error iterating rooms cursor', error);
              onSynchronizationEnd();
              reject(error);
            };
          }, (error) => {
            console.error('Error reading local rooms', error);
            onSynchronizationEnd();
            reject(error);
          });
        });
      }, (error) => {
        console.error('Error getting remote rooms', error);
        onSynchronizationEnd();
        reject(error);
      });
    });
  }

  exports.RoomsSynchronizer = {
    /*
     * This method returns a Promise and when it is fulfilled the
     * synchronizaction finished.
     */
    synchronize: synchronize
  };

}(window));
