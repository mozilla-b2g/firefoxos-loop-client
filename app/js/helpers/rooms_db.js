/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/**
 * Rooms DB
 *
 * This code will be in charge of keeping and maintain a cache of the
 * rooms created and the ones we get an invitation, storing as well
 * all events related with the RoomObject.
 * Events will be:
 *   - Room Created: Time and subject
 *   - Room Renamed: Time and new subject
 *   - Anyone Joined: Time and Who
 *   - I joined: Time
 *   - Communication established: Time and with who
 *
 * The object will have the following schema:
 *
 * RoomSchema: {
 *   roomToken: <string> (primary key),
 *   roomUrl: <string>,
 *   roomName: <string> (index),
 *   roomOwner: <string>,
 *   maxSize: <Number>,
 *   creationTime: <Date> (index),
 *   expiresAt: <Date>,
 *   ctime: <Date>,
 *   identities: [<string>],
 *   contactId: [<string>],
 *   contactPrimaryInfo: <string>,
 *   contactPhoto: blob,
 *   localCtime: <Date> (index), // Automatically updated
 *   user: <string> (index), // Automatically updated
 *   events: [
 *     {
 *       // EventObject
 *       id: <Number>,
 *       action: <String>,
 *       date: <Date> (index),
 *       params: {}
 *     }
 *   ]
 * }
 *
 * Based on this info, we will expose the methods under the Object
 * RoomsDB, you can check above.
 */

(function(exports) {
  'use strict';

  const _roomsStore = 'rooms';
  const _eventsStore = 'roomEvents';
  var _dbHelper = new DatabaseHelper({
    name: 'roomsLog',
    version: 2,
    maxNumerOfRecords: 200,
    numOfRecordsToDelete: 50
  }, {
    'rooms': {
      primary: 'roomToken',
      indexes: [{
        name: 'roomName',
        fields: 'roomName',
        params: {
          multientry: true
        }
      }, {
        name: 'creationTime',
        fields: [ 'user', 'creationTime' ],
        params: {
          multientry: true
        }
      }, {
        name: 'localCtime',
        fields: 'localCtime',
        params: {
          multientry: true
        }
      }, {
        name: 'user',
        fields: 'user',
        params: {
          multientry: true
        }
      }],
      fields: [
        'roomToken',
        'roomUrl',
        'roomName',
        'roomOwner',
        'maxSize',
        'creationTime',
        'expiresAt',
        'ctime',
        'identities',
        'contactId',
        'contactPrimaryInfo',
        'contactPhoto',
        'localCtime',
        'user'
      ]},

    'roomEvents': {
      primary: 'id',
      indexes: [{
        name: 'roomToken',
        fields: 'roomToken',
        params: {
          multientry: true
        }
      }, {
        name: 'date',
        fields: 'date',
        params: {
          multientry: true
        }
      }],
      fields: [
        'id',
        'roomToken',
        'action',
        'date',
        'params'
      ]}
  });

  function FilteredCursor(cursor, filter) {
    this.cursor = cursor;
    this.filter = filter;
    this.returnedItems = 0;
    this._attachHandlers();
  }

  FilteredCursor.prototype = {
    set onsuccess(success) {
      this._onsuccess = success;
      this._dispatchOnReady();
    },

    set onerror(error) {
      this._onerror = error;
      this._dispatchOnReady();
    },

    _dispatchOnReady: function() {
      if (this._onsuccess && this._onerror) {
        this._onReady && this._onReady();
      }
    },

    _isReady: function() {
      if (this._onsuccess && this._onerror) {
        this._isReady = () => {
          return Promise.resolve();
        }
        return this._isReady();
      }

      return new Promise((resolve, reject) => {
        this._onReady = resolve;
      });
    },

    _attachHandlers: function() {
      var cursor = this.cursor;
      var filter = this.filter;

      cursor.onsuccess = (event) => {
        this._isReady().then(() => {
          var item = event.target.result;
          if (!item) {
            return this._onsuccess(event);
          }

          if (!filter || item.value[filter.name] === filter.value) {
            this.returnedItems++;
            this._onsuccess(event);
          } else {
            if (this.returnedItems > 0) {
              // That's all folks !
              return this._onsuccess({
                target: {
                  result: null
                }});
            }
            item.continue();
          }
        });
      };

      cursor.onerror = (event) => {
        this._isReady().then(() => {
          this._onerror(event);
        });
      };
    }
  };

  var RoomsDB = {
    /**
     * Update the localCtime of a room
     *
     * param room
     *       Object with the room
     */
    setLocalCtime: function(room) {
      room.localCtime = Date.now();
    },

    /**
     * Update Room object with contactInfo
     * param room
     *       Object with the room
     * param contactInfo
     *       Object with the contact information
     */
    setContactInfo: function(room, contactInfo) {
      if (contactInfo) {
        room.contactId = contactInfo.contactIds || null;
        var contact = contactInfo.contacts ? contactInfo.contacts[0] : null;
        if (contact) {
          room.contactPrimaryInfo = ContactsHelper.getPrimaryInfo(contact);
          room.contactPhoto = contact.photo ? contact.photo[0] : null;
        }

        var identities = [];
        ['tel', 'email'].forEach(function(field) {
          if (contact[field]) {
            for (var i = 0, l = contact[field].length; i < l; i++) {
              identities.push(contact[field][i].value);
            }
          }
        });
        room.identities = identities;
      }
    },

    /**
     * Store a room in our DB.
     *
     * param room
     *       Object created from the API.
     * param contactInfo
     *       Contact information object
     * return Promise.  The resolved promise will contain the stored record.
     *                  The rejected promise, an error string.
     */
    create: function(room, contactInfo) {
      return new Promise(function(resolve, reject) {
        RoomsDB.setLocalCtime(room);
        room.user = Controller.identity;
        RoomsDB.setContactInfo(room, contactInfo);
        _dbHelper.addRecord(function(error, storedRecord) {
          if (error) {
            reject(error);
          } else {
            resolve(storedRecord);
          }
        }, _roomsStore, room);
      });
    },

    /**
     * Get a room in our DB given a token.
     *
     * param token
     *       String which identify a room.
     * return Promise.  The resolved promise will contain as result the room
     *                  The rejected promise, an error string.
     */
    get: function(token) {
      return new Promise(function(resolve, reject) {
        _dbHelper.getRecord(function(error, result) {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }, _roomsStore, {
          key: token
        });
      });
    },

    /**
     * Get all rooms stored in our DB given a filter and
     * sorting.
     *
     * param field
     *       String which identify field in RoomSchema.
     * param sorting
     *       String. This could be 'ASC' or 'DESC' based on the
     * sorting we want. By default is 'DESC'
     * return Promise.  The resolved promise will contain as result a cursor
     *                  with all the rooms.
     *                  The rejected promise, an error string.
     */
    getAll: function(field, sorting) {
      var aFilter = {};
      if (field) {
        aFilter.sortedBy = field;
      }
      aFilter.prev = (sorting === 'DESC' ? 'prev' : null);
      return new Promise(function(resolve, reject) {
        _dbHelper.getList(function(error, cursor) {
          if (error) {
            return reject(error);
          } else {
            if (!field || field === '' || field === 'creationTime') {
              // These are special cases. We want to filter & sort
              // since this isn't directly supported by IndexedDB, we'll
              // create a filteredCursor in which we'll filter by logged user
              var filteredCursor = new FilteredCursor(cursor, {
                name: 'user',
                value: Controller.identity
              });
              resolve(filteredCursor);
            } else {
              var myCursor = new FilteredCursor(cursor);
              resolve(myCursor);
            }
          }
        }, _roomsStore, aFilter);
      });
    },

    /**
     * Delete a room in our DB given a token.
     *
     * param token
     *       String which identify a room.
     * return Promise.  The resolved promise will contain no params.
     *                  The rejected promise, an error string.
     */
    delete: function(tokensArray) {
      if (!Array.isArray(tokensArray)) {
        tokensArray = [ tokensArray ];
      }
      var tokensLen = tokensArray.length;
      if (tokensLen === 0) {
        return Promise.resolve();
      }
      return new Promise(function(resolve, reject) {
        tokensArray.forEach(function(token) {
          RoomsDB.deleteAllEvents(token).then(function() {
            _dbHelper.deleteRecord(function(error) {
              if (error) {
                return reject(error);
              }

              if (! --tokensLen) {
                resolve();
              }
            }, _roomsStore, token);
          }, reject);
        });
     });
    },

    /**
     * Change room name in our DB.
     *
     * param token
     *       String which identify a room.
     * param name
     *       String. New name of the room.
     * param expiresAt
     *       String. New expiration date coming from API.
     * return Promise.  The resolved promise will contain no params.
     *                  The rejected promise, an error string.
     */
    changeName: function(token, name, expiresAt) {
      return new Promise(function(resolve, reject) {
        _dbHelper.updateRecord(function(error) {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }, _roomsStore, { key: token }, {
          roomName: name,
          expiresAt: expiresAt,
          localCtime: Date.now()
        });
      });
    },

    /**
     * Update all rooms created by us in our DB.
     *
     * param rooms
     *       Array which contain all rooms we created as owner.
     * return Promise.  The resolved promise will contain no params.
     *                  The rejected promise, an error string.
     */
    update: function(rooms) {
      if (!Array.isArray(rooms)) {
        rooms = [ rooms ];
      }
      var roomsLength = rooms.length;
      var processed = 0;
      return new Promise(function(resolve, reject) {
        for (var i = 0; i < roomsLength; i++) {
          var room = rooms[i];
          if (typeof room !== 'object') {
            return reject('BAD ROOM OBJECT TYPE');
          }
          if (!room.roomToken) {
            return reject('ROOM WITHOUT roomToken');
          }

          RoomsDB.setLocalCtime(room);

          _dbHelper.updateRecord(function(error) {
            if (error) {
              return reject(error);
            }

            if (++processed === roomsLength) {
              resolve();
            }
          }, _roomsStore, { key: room.roomToken }, room);
        }
      });
    },

    /**
     * Store an event in a specific Room.
     *
     * param token
     *       String which identify a room.
     * param eventObject
     *       Object with all params to store.
     * return Promise.  The resolved promise will contain the EventObject stored.
     *                  The rejected promise, an error string.
     */
    addEvent: function(token, eventObject) {
      if (typeof eventObject !== 'object' ||
          typeof eventObject.action !== 'string') {
        return Promise.reject('BAD EVENT OBJECT');
      }
      if (eventObject.params && typeof eventObject.params !== 'object') {
        return Promise.reject('BAD EVENT PARAMS');
      }

      return new Promise(function(resolve, reject) {
        RoomsDB.get(token).then(function(room) {
          if (!room) {
            return reject('ROOM ' + token + ' NOT FOUND');
          }

          eventObject.roomToken = token;
          eventObject.id = window.performance.now();
          eventObject.date = new Date();

          _dbHelper.addRecord(function(error, storedRecord) {
            if (error) {
              reject(error);
            }
            resolve(storedRecord);
          }, _eventsStore, eventObject);
        }, reject);
      });
    },

    /**
     * Delete a group of events in our DB given a token.
     *
     * param token
     *       String which identify a room.
     * param eventIds
     *       Array with all event IDs to remove
     * return Promise.  The resolved promise will contain no params.
     *                  The rejected promise, an error string.
     */
    deleteEvent: function(token, eventsIds) {
      if (!Array.isArray(eventsIds)) {
        eventsIds = [ eventsIds ];
      }
      var eventsLen = eventsIds.length;
      if (eventsLen === 0) {
        return Promise.resolve();
      }
      return new Promise(function(resolve, reject) {
        RoomsDB.get(token).then(function(room) {
          if (!room) {
            return reject('ROOM ' + token + ' NOT FOUND');
          }

          eventsIds.forEach(function(eventId) {
            _dbHelper.deleteRecord(function(error) {
              if (error) {
                return reject(error);
              }

              if (! --eventsLen) {
                resolve();
              }
            }, _eventsStore, eventId);
          });
        }, reject);
      });
    },

    /**
     * Delete a events in our DB for given a token.
     *
     * param token
     *       String which identify a room.
     * return Promise.  The resolved promise will contain no params.
     *                  The rejected promise, an error string.
     */
    deleteAllEvents: function(token) {
      var itemsToRemove = [];
      return new Promise(function(resolve, reject) {
        RoomsDB.getEvents(token).then(function(cursor) {

          cursor.onsuccess = function onsuccess(event) {
            var item = event.target.result;
            if (!item) {
              RoomsDB.deleteEvent(token, itemsToRemove).then(resolve, reject);
              return;
            }

            itemsToRemove.push(item.value.id);
            item.continue();
          };

          cursor.onerror = function onerror(event) {
            reject(event.target.error.name);
          };
        }, reject);
      });
    },

    /**
     * Get all events given a room token
     *
     * param token
     *       String which identify a room.
     * return Promise.  The resolved promise will contain as result a cursor
     *                  with all the events given a room token.
     *                  The rejected promise, an error string.
     */
    getEvents: function(token) {
      return new Promise(function(resolve, reject) {
        _dbHelper.getList(function(error, cursor) {
          if (error) {
            reject(error);
          } else {
            resolve(cursor);
          }
        }, _eventsStore, { index: { name: 'roomToken', value: token }});
      });
    }
  };

  exports.RoomsDB = RoomsDB;

})(window);
