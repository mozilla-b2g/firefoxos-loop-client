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
 *   - Shared With: Time and whom
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
 *   ],
 *   sharedWith: [
 *     {
 *       contactId: [<String>],
 *       contactPrimaryInfo: <String>,
 *       contactPhoto: Blob,
 *       identities: [<String>]
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
  const _fieldsToFilterByUser = ['', 'creationTime', 'localCtime', 'ctime'];
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
        fields: 'roomName'
      }, {
        name: 'creationTime',
        fields: [ 'user', 'creationTime' ]
      }, {
        name: 'localCtime',
        fields: 'localCtime'
      }, {
        name: 'ctime',
        fields: 'ctime'
      }, {
        name: 'user',
        fields: 'user'
      }, {
        name: 'identities',
        fields: 'identities',
        params: {
          multiEntry: true
        }
      }, {
        name: 'contactId',
        fields: 'contactId',
        params: {
          multiEntry: true
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
        'user',
        'smsNotification',
        'emailNotification'
      ]},

    'roomEvents': {
      primary: 'id',
      indexes: [{
        name: 'roomToken',
        fields: 'roomToken'
      }, {
        name: 'date',
        fields: 'date'
      }],
      fields: [
        'id',
        'roomToken',
        'action',
        'date',
        'params'
      ]}
  });

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
     * Update Room object with the last person whom the room was shared with
     * param room
     *       Object with the room
     * param contact
     *       MozContact object that represents the last person whom the room was
     *       shared with
     */
    addLastSharedPerson: function(room, contact, identity) {
      if (!contact) {
        return;
      }

      var person = {
        contactId: contact.id,
        contactPrimaryInfo: ContactsHelper.getPrimaryInfo(contact),
        contactPhoto: contact.photo ? contact.photo[0] : null,
        identities: [identity]
      };

      Object.keys(person).forEach(function(key) {
        room[key] = person[key];
      });

      room.sharedWith = room.sharedWith || [];
      // TODO Bug 1109560. Maybe we want to update existing people instead
      // having dupes.
      room.sharedWith.push(person);
    },

    /**
     * Store a room in our DB.
     *
     * param room
     *       Object created from the API.
     * return Promise.  The resolved promise will contain the stored record.
     *                  The rejected promise, an error string.
     */
    create: function(room) {
      return new Promise(function(resolve, reject) {
        RoomsDB.setLocalCtime(room);
        room.user = Controller.identity;
        room.identities = [];
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
     * Updates a report with the following rules:
     *   - The object can have zero or more attributes which share a name with a
     *      DB attribute of a room.
     *   - For each of those fields, the report will have a attribute for each
     *     frequency (number of times something has happened)
     *   - We will increase by one (or set to one) the frequency of the value
     *     that the corresponding attribute in the room has. If the attribute
     *     doesn't exist then we have to increase the frequency of 0.
     * So, for example, if the report has:
     *   {
     *     dbField: {
     *        0: 5,
     *        2: 6
     *     }
     *  }
     *  Then if there's a room that has room.dbField = undefined, and another
     *  that has room.dbField = 6 the exit report will have:
     *   {
     *     dbField: {
     *        0: 6,
     *        2: 6,
     *        6: 1
     *     }
     *   }
     *
     * param report
     *       Report with the initial set of frequency values to update.
     *       Note that this function does NOT make a in depth copy of report,
     *       and as such it takes ownership of the object. Any other processing
     *       on the report should use the promise value
     * param updateableAttributes
     *       List containing the attribute names that should be updated.
     *
     * return Promise. The resolved promise will contain as result an updated
     *                   Report.
     *                 The rejected promise, an error string.
     */
    updateFrequencyValues: function(report, updateableAttributes) {
      var needUpdateRooms = [];
      return RoomsDB.getAll().then(cursor => {
        return new Promise((resolve, reject) => {
          if (!cursor) {
            console.error('UpdateFrequencyValues. No cursor!');
            return reject();
          }

          cursor.onsuccess = function onsuccess(event) {
            var item = event.target.result;
            if (item) {
              var room = item.value;
              var update = false;
              updateableAttributes.forEach(att => {
                var parsedValue = '0';
                if (room[att]) {
                  parsedValue = room[att].toString();
                  delete room[att];
                  update = true;
                }
                report[att][parsedValue] = report[att][parsedValue]  + 1 || 1;
              });

              update && needUpdateRooms.push(room);
              item.continue();
            } else {
              // Reset updateableAttributes fields.
              if (needUpdateRooms.length > 0) {
                _dbHelper.newTxn(function(error, txn, store) {
                  if (error) {
                    console.error('Error updating telemetry frecuency ' +
                                  'attributes of room');
                    return;
                  }
                  needUpdateRooms.forEach(updateRoom => store.put(updateRoom));
                }, 'readwrite', [_roomsStore]);
              }
              resolve(report);
            }
          };

          cursor.onerror = function(event) {
            console.error('Error iterating roomsCursor');
          };
        });
      }, function() {
          console.log('Could not retrieve rooms from DB');
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
            reject(error);
          } else {
            var filteredCursor = null;
            if (!field || _fieldsToFilterByUser.indexOf(field) !== -1) {
              // These are special cases. We want to filter & sort
              // since this isn't directly supported by IndexedDB, we'll
              // create a filteredCursor in which we'll filter by logged user
              filteredCursor = new FilteredCursor(cursor, {
                name: 'user',
                value: Controller.identity
              });
            } else {
              filteredCursor = new FilteredCursor(cursor);
            }
            resolve(filteredCursor);
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
        return Promise.resolve([]);
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
      if (roomsLength === 0) {
        return Promise.resolve([]);
      }
      var processed = 0;
      return new Promise(function(resolve, reject) {
        var result = [];
        for (var i = 0; i < roomsLength; i++) {
          var room = rooms[i];
          if (typeof room !== 'object') {
            return reject('BAD ROOM OBJECT TYPE');
          }
          if (!room.roomToken) {
            return reject('ROOM WITHOUT roomToken');
          }

          RoomsDB.setLocalCtime(room);

          _dbHelper.updateRecord(function(error, record) {
            if (error) {
              return reject(error);
            }

            result.push(record);
            if (++processed === roomsLength) {
              resolve(result);
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
        RoomsDB.getEvents(token).then(function(roomEvents) {
          RoomsDB.deleteEvent(token, roomEvents.map(e => e.id)).then(
            resolve, reject);
        }, reject);
      });
    },

    /**
     * Get all events given a room token
     *
     * param token
     *       String which identify a room.
     * return Promise.  The resolved promise will contain as result an array
     *                  with all the events given a room token.
     *                  The rejected promise, an error string.
     */
    getEvents: function(token) {
      return new Promise(function(resolve, reject) {
        _dbHelper.getList(function(error, cursor) {
          if (error) {
            return reject(error);
          }

          var eventsArray = [];
          cursor.onsuccess = function(evt) {
            var item = evt.target.result;
            if (!item) {
              return resolve(eventsArray);
            }
            eventsArray.push(item.value);
            item.continue();
          };
          cursor.onerror = reject;
        }, _eventsStore, { index: { name: 'roomToken', value: token }});
      });
    },

    /**************************************************************************
     * Contacts/identities related stuff - FollowUp: Bug 1113489
     **************************************************************************/
    _checkCallback: function(aCallback) {
      if (!aCallback || typeof aCallback != 'function') {
        throw new Error('INVALID_CALLBACK');
      }
    },

    _addContactInfoToRecord: function(aRecord, aContactInfo) {
      // We store multiple IDs in case of a multiple contact match, but we only
      // show the information of the first match. If this first match is removed
      // we will refresh the information being shown for this entry.
      aRecord.contactId = aContactInfo.contactIds || null;
      var contact = aContactInfo.contacts ? aContactInfo.contacts[0] : null;
      if (!contact) {
        return aRecord;
      }
      aRecord.contactPrimaryInfo = ContactsHelper.getPrimaryInfo(contact);
      aRecord.contactPhoto = contact.photo ? contact.photo[0] : null;
      var identities = [];
      ['tel', 'email'].forEach(function(field) {
        if (!contact[field]) {
          return;
        }
        for (var i = 0, l = contact[field].length; i < l; i++) {
          identities.push(contact[field][i].value);
        }
      });
      aRecord.identities = identities;
      return aRecord;
    },

    /**
     * We store a revision number for the contacts data local cache that we need
     * to keep synced with the Contacts API database.
     * This method stores the revision of the Contacts API database and it will
     * be called after refreshing the local cache because of a contact updated,
     * a contact deletion or a cache sync.
     */
    _updateCacheRevision: function() {
      navigator.mozContacts.getRevision().onsuccess = function(event) {
        var contactsRevision = event.target.result;
        if (contactsRevision) {
          window.asyncStorage.setItem('contactsCacheRevision',
                                      contactsRevision);
        }
      };
    },

    /**
     * Updates the records from the groups object store with a given contact
     * information.
     * This function will likely be called within the handlers of the
     * 'oncontactchange' event.
     */
    _updateContactInfo: function(aContact) {
      if (!aContact) {
        console.error('Invalid contact');
        return;
      }

      var objectStores = [_roomsStore];
      var asyncCalls = 0;
      var updateCount = 0;
      var _updateContact = function(event) {
        var cursor = event.target.result;
        if (!cursor || !cursor.value) {
          asyncCalls--;
          if (!asyncCalls) {
            if (updateCount) {
              RoomsDB._updateCacheRevision();
              return;
            }
            // If we didn't update any record that means that the contact
            // information that we have for the affected contact is not valid
            // anymore, and so we need to get rid of it.
            RoomsDB._removeContactInfo(aContact.id);
          }
          return;
        }

        var record = cursor.value;

        record = RoomsDB._addContactInfoToRecord(record, {
          contactIds: [aContact.id],
          contacts: [aContact]
        });

        updateCount++;

        cursor.update(record);
        cursor.continue();
      };

      var identities = [];
      ['tel', 'email'].forEach(function(field) {
        if (!aContact[field]) {
          return;
        }
        for (var i = 0, l = aContact[field].length; i < l; i++) {
          identities.push(aContact[field][i].value);
        }
      });

      _dbHelper.newTxn(function(error, txn, stores) {
        if (error) {
          console.error(error);
          return;
        }
        if (!Array.isArray(stores)) {
          stores = [stores];
        }

        for (var i = 0, ls = stores.length; i < ls; i++) {
          for (var j = 0, li = identities.length; j < li; j++) {
            asyncCalls++;
            var req = stores[i].index('identities')
                .openCursor(IDBKeyRange.only(identities[j]));
            req.onsuccess = _updateContact;
          }
        }

        txn.onerror = function(event) {
          console.error(event.target.error.name);
        };
      }, 'readwrite', objectStores);
    },

    /**
     * Removes the contact information matching the given contact id from the
     * list of entries.
     *
     * This function will likely be called within the handlers of the
     * 'oncontactchange' event.
     */
    _removeContactInfo: function(aContactId) {
      if (!aContactId) {
        console.error('Missing contact id');
        return;
      }

      var objectStores = [_roomsStore];
      var asyncCalls = 0;
      var _deleteContact = function(event) {
        var cursor = event.target.result;
        if (!cursor || !cursor.value) {
          asyncCalls--;
          if (!asyncCalls) {
            RoomsDB._updateCacheRevision();
          }
          return;
        }

        var record = cursor.value;
        if (record.contactId) {
          delete record.contactId;
        }
        if (record.contactPrimaryInfo) {
          delete record.contactPrimaryInfo;
        }
        if (record.contactPhoto) {
          delete record.contactPhoto;
        }
        cursor.update(record);
        cursor.continue();
      };

      _dbHelper.newTxn(function(error, txn, stores) {
        if (error) {
          console.error(error);
          return;
        }
        if (!Array.isArray(stores)) {
          stores = [stores];
        }

        for (var i = 0; i < stores.length; i++) {
          asyncCalls++;
          var req = stores[i].index('contactId')
              .openCursor(IDBKeyRange.only(aContactId));
          req.onsuccess = _deleteContact;
        }

        txn.onerror = function(event) {
          console.error(event.target.error.name);
        };
      }, 'readwrite', objectStores);
    },

    _invalidateContactsCache: function(aCallback) {
      RoomsDB._checkCallback(aCallback);

      var objectStores = [_roomsStore];
      var asyncCalls = 0;
      var cursorDone = false;

      var _error = null;

      function _onupdated() {
        if (asyncCalls) {
          return;
        }
        aCallback(_error);
        RoomsDB._updateCacheRevision();
      }

      function _updateContact(contactInfo, record, objectStore) {
        // We don't want to queue db transactions that won't update anything.
        var needsUpdate = false;
        if (contactInfo) {
          record = RoomsDB._addContactInfoToRecord(record, contactInfo);
          needsUpdate = true;
        } else {
          if (record.contactId) {
            needsUpdate = true;
            delete record.contactId;
          }
          if (record.contactPhoto) {
            needsUpdate = true;
            delete record.contactPhoto;
          }
          if (record.contactPrimaryInfo) {
            needsUpdate = true;
            delete record.contactPrimaryInfo;
          }
        }

        if (needsUpdate) {
          asyncCalls++;
          _dbHelper.newTxn(function(error, txn, store) {
            asyncCalls--;
            if (error) {
              console.error(error);
              _error = error;
              return;
            }

            asyncCalls++;
            var req = store.put(record)
            req.onsuccess = req.onerror = function() {
              asyncCalls--;
              _onupdated();
            };
          }, 'readwrite', objectStore);
        } else {
          _onupdated();
        }
      }

      function _oncursor(event) {
        var cursor = event.target.result;
        if (!cursor) {
          asyncCalls--;
          _onupdated();
          return;
        }

        var record = cursor.value;
        if (record.identities.length > 0) {
          asyncCalls++;
          ContactsHelper.find({ identities: record.identities },
                              function(contactInfo) {
                                asyncCalls--;
                                _updateContact(contactInfo, record, cursor.source.name);
                              }, function() {
                                asyncCalls--;
                                _updateContact(null, record, cursor.source.name);
                              });
        }
        cursor.continue();
      }

      _dbHelper.newTxn(function(error, txn, stores) {
        if (error) {
          aCallback(error);
          return;
        }
        if (!Array.isArray(stores)) {
          stores = [stores];
        }

        for (var i = 0, l = stores.length; i < l; i++) {
          asyncCalls++;
          stores[i].openCursor().onsuccess = _oncursor;
        }

        txn.onerror = function(event) {
          _error = event.target.error.name;
          _onupdated();
          console.error(_error);
        };
      }, 'readonly', objectStores);
    },

    init: function() {
      window.addEventListener('oncontactchange', function(event) {
        var reason = event.detail.reason;
        var contactId = event.detail.contactId;
        if (reason == 'remove') {
          RoomsDB._removeContactInfo(contactId);
          return;
        }
        ContactsHelper.find({
          contactId: contactId
        }, function(contactInfo) {
          RoomsDB._updateContactInfo(contactInfo.contacts[0]);
        }, function() {
          RoomsDB._removeContactInfo(contactId);
        })
      });
    },

    invalidateContactsCache: function (aCallback) {
      RoomsDB._invalidateContactsCache(aCallback);
    }
  };

  exports.RoomsDB = RoomsDB;

})(window);
