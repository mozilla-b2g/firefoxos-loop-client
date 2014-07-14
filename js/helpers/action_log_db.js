/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/**
 * Action Log DB Schema.
 *
 * The DB will be holding two different object stores. One store for Loop calls
 * and the other store for URLs.
 *
 * The object for each store will have the following schema:
 *
 * call: {
 *   date: <Date> (primary key),
 *   identities: [<string>],
 *   type: <string> ("incoming" or "outgoing"),
 *   video: <bool>,
 *   connected: <bool>,
 *   duration: <Number> // miliseconds
 *   url: <string>,
 *   urlToken: <string>,
 *   contactId: [<string>],
 *   contactPrimaryInfo: <string>,
 *   contactPhoto: blob
 * }
 *
 * url: {
 *   date: <Date> (primary key),
 *   identities: [<string>],
 *   url: <string>,
 *   urlToken: <string> (index),
 *   expirationDate: <Date>,
 *   revoked: <Boolean>,
 *   contactId: [<string>],
 *   contactPrimaryInfo: <string>,
 *   contactPhoto: blob
 * }
 */

(function(exports) {
  'use strict';

  var _db = null;
  var _dbName = 'actionLog';
  var _dbCallStore = 'actionLogCalls';
  var _dbUrlStore = 'actionLogUrls';
  var _dbVersion = 1;
  var _maxNumberOfRecords = 200;
  var _numOfRecordsToDelete = 50;

  var _dbSchema = {
    "actionLogCalls": [
      "date",
      "identities",
      "type",
      "video",
      "connected",
      "duration",
      "url",
      "urlToken",
      "contactId",
      "contactPrimaryInfo",
      "contactPhoto"
    ],
    "actionLogUrls": [
      "date",
      "identities",
      "url",
      "urlToken",
      "expirationDate",
      "revoked",
      "contactId",
      "contactPrimaryInfo",
      "contactPhoto"
    ]
  };

  function _checkCallback(aCallback) {
    if (!aCallback || typeof aCallback != "function") {
      throw new Error("INVALID_CALLBACK");
    }
  }

  /**
   * Prepare the database. This may include opening the database and upgrading
   * it to the latest schema version.
   *
   * return Promise. The resolved promise will contain as result IDBDatastore
   *                 instance. The rejected promise, an error string.
   */
  function _ensureDB() {
    return new Promise(function(resolve, reject) {
      if (_db) {
        return resolve(_db);
      }

      try {
        var indexedDB = window.indexedDB || window.mozIndexedDB;
        if (!indexedDB) {
          return reject('NO_INDEXED_DB_AVAILABLE');
        }

        var request = indexedDB.open(_dbName, _dbVersion);
        request.onsuccess = (function onsuccess(event) {
          _db = event.target.result;
          resolve(_db);
        }).bind(this);

        request.onerror = function onerror(event) {
          reject(event.target.errorCode);
        };

        request.onblocked = function onblocked() {
          reject('DB_REQUEST_BLOCKED');
        };

        request.onupgradeneeded = function onupgradeneeded(event) {
          var db = event.target.result;
          var txn = event.target.transaction;

          // Initial DB schema.
          var callStore = db.createObjectStore(_dbCallStore, {
            keyPath: 'date'
          });
          callStore.createIndex('identities', 'identities', {
            multiEntry: true
          });
          callStore.createIndex('contactId', 'contactId', {
            multiEntry: true
          });

          var urlStore = db.createObjectStore(_dbUrlStore, {
            keyPath: 'date'
          });
          urlStore.createIndex('urlToken', 'urlToken');
          urlStore.createIndex('identities', 'identities', {
            multiEntry: true
          });
          urlStore.createIndex('contactId', 'contactId', {
            multiEntry: true
          });
        };
      } catch(e) {
        reject(e.message);
      }
    });
  }

  /**
   * Start a new database transaction.
   *
   * param aCallback
   * param txnType
   *        Type of transaction (e.g. 'readwrite').
   * param objectStores
   *        The names of object stores and indexes that are in the scope of the
   *        new transaction as an array of strings. Specify only the object
   *        stores that you need to access. If you need to access only one
   *        object store, you can specify its name as a string.
   *
   */
  function _newTxn(aCallback, aTxnType, aObjectStores) {
    _checkCallback(aCallback);

    if (!Array.isArray(aObjectStores)) {
      aObjectStores = [aObjectStores];
    }
    _ensureDB().then(function(db) {
      var txn = db.transaction(aObjectStores, aTxnType);
      var stores;
      if (aObjectStores.length === 1) {
        stores = txn.objectStore(aObjectStores[0]);
      } else {
        stores = [];
        for (var i = 0; i < aObjectStores.length; i++) {
          stores.push(txn.objectStore(aObjectStores[i]));
        }
      }
      aCallback(null, txn, stores);
    }, function(error) {
      aCallback(error);
    });
  }

  function _close() {
    _db.close();
    _db = null;
  }

  /**
   * Helper to validate a DB record.
   */
  function _isValidRecord(aObjectStoreName, aRecord) {
    if (!aObjectStoreName || !aRecord || !_dbSchema[aObjectStoreName]) {
      return;
    }
    var keys = Object.keys(aRecord);
    for (var i = 0, l = keys.length; i < l; i++) {
      if (_dbSchema[aObjectStoreName].indexOf(keys[i]) == -1) {
        return;
      }
    }
    return true;
  }

  /**
   * Helper method to add a new record to a given object store.
   *
   * param aCallback
   * param aObjectStore
   *       String. Name of the object store where we want to save the record.
   * param aRecord.
   *       Object to be stored.
   */
  function _addRecord(aCallback, aObjectStore, aRecord) {
    _checkCallback(aCallback);

    if (typeof aRecord !== "object") {
      aCallback("INVALID_RECORD");
      return;
    }

    _newTxn(function(error, txn, store) {
      if (error) {
        aCallback(error);
        return;
      }
      txn.oncomplete = function(result) {
        aCallback(null, result);
      };
      txn.onerror = txn.oncancel = function(error) {
        aCallback(error || "UKNOWN_ERROR");
      };
      store.add(aRecord);
    }, "readwrite", [aObjectStore]);
  }

  /**
   * Helper method to get a list of records stored in an specific object
   * store.
   *
   * param aCallback
   * param aObjectStore
   *       String. Name of the object store that we want to query.
   * param aFilter
   *       Object. Contains the constraints of the DB query.
   *       {
   *         prev: <boolean>, // Flag to get the list in reverse order.
   *         sortedBy: <string>, // Field to sort by.
   *       }
   *
   */
  function _getList(aCallback, aObjectStore, aFilter) {
    _checkCallback(aCallback);

    _newTxn(function(error, txn, store) {
      if (error) {
        aCallback(error);
        return;
      }

      if (!aFilter) {
        aFilter = {};
      }

      var cursor = null;
      var direction = aFilter.prev ? "prev" : "next";
      if (aFilter.sortedBy && aFilter.sortedBy !== null) {
        if (!store.indexNames.contains(aFilter.sortedBy)) {
          txn.abort();
          aCallback("INVALID_SORTED_BY_FILTER");
          return;
        }
        cursor = store.index(aFilter.sortedBy).openCursor(null, direction);
      } else {
        cursor = store.openCursor(null, direction);
      }

      cursor.onsuccess = function onsuccess(event) {
        var item = event.target.result;
        if (!item) {
          aCallback();
          return;
        }

        aCallback(null, {
          value: item.value,
          continue: function() { return item.continue(); }
        });
      };
      cursor.onerror = function onerror(event) {
        aCallback(event.target.error.name);
      };
    }, "readonly", [aObjectStore]);
  }

  /**
   * param aFilter.
   *       So far the only use case that we found is an "equal" query,
   *       so we will be taking an object of this kind:
   *       {
   *         key: <any>,
   *         index: {
   *           name: <string>,
   *           value: <any>
   *         }
   *       }
   *       where we would expect "key" or "index" but not both.
   */
  function _getRecord(aCallback, aObjectStore, aFilter) {
    _checkCallback(aCallback);

    if (!aFilter ||
        (!aFilter.key && !aFilter.index) ||
        (aFilter.key && aFilter.index) ||
        (aFilter.index && !aFilter.index.name || !aFilter.index.value) ||
        (aFilter.key && !aFilter.value)) {
      aCallback("INVALID_FILTER");
      return;
    }

    _newTxn(function(error, txn, store) {
      if (error) {
        console.error(error.name);
        aCallback(error.name);
        return;
      }
      var req;
      if (aFilter.index) {
        if (!store.indexNames.contains(aFilter.index.name)) {
          aCallback("INVALID_FILTER");
          return;
        }
        req = store.index(aFilter.index.name).get(aFilter.index.value);
      } else {
        req = store.get(aFilter.key);
      }

      req.onsuccess = function onsuccess(event) {
        aCallback(null, event.target.result);
      };

      req.onerror = function onerror(event) {
        console.error(event.target.error.name);
        aCallback(event.target.error.name);
      };
    }, "readonly", [aObjectStore]);
  }

  function _updateRecord(aCallback, aObjectStore, aIndex, aRecord) {
    _checkCallback(aCallback);

    if (!_isValidRecord(aObjectStore, aRecord)) {
      aCallback("INVALID_RECORD");
      return;
    }

    _newTxn(function(error, txn, store) {
      if (error) {
        aCallback(error);
        return;
      }

      var count = 0;
      var req;
      if (aIndex) {
        if (!store.indexNames.contains(aIndex)) {
          aCallback("INVALID_INDEX_NAME");
          return;
        }
        req = store.index(aIndex).openCursor();
      } else {
        req = store.openCursor();
      }

      req.onsuccess = function onsuccess(event) {
        var cursor = event.target.result;
        if (!cursor) {
          aCallback(null, count);
          return;
        }

        var record = cursor.value;
        Object.keys(aRecord).forEach(function(key) {
          record[key] = aRecord[key];
        });

        cursor.update(record);
        count++;
        cursor.continue();
      };
      req.onerror = function onerror(event) {
        aCallback(event.target.error.name);
      };
    }, "readwrite", [aObjectStore]);
  }

  function _clearObjectStore(aCallback, aObjectStore) {
    _checkCallback(aCallback);

    _newTxn(function(error, txn, store) {
      if (error) {
        aCallback(error);
        return;
      }
      store.clear();
      txn.oncomplete = function() {
        if (typeof aCallback === 'function') {
          aCallback()
        }
      };
      txn.onerror = function(event) {
        if (typeof aCallback === 'function') {
          aCallback(event.target.error.name);
        }
      };
    }, "readwrite", [aObjectStore]);
  }

  function _deleteRecord(aCallback, aObjectStore, aKey) {
    _checkCallback(aCallback);

    if (!aKey) {
      _clearObjectStore(aCallback, aObjectStore);
      return;
    }
    _newTxn(function(error, txn, store) {
      if (error) {
        aCallback(error);
        return;
      }

      if (!Array.isArray(aKey)) {
        aKey = [aKey];
      }

      for (var i = 0, l = aKey.length; i < l; i++) {
        store.delete(aKey[i]);
      }

      txn.oncomplete = function() {
        aCallback();
      };
      txn.onerror = function(event) {
        aCallback(event.target.error.name);
      };
    }, "readwrite", [aObjectStore]);
  }

  /*********************************
   * Contacts related functionality.
   *********************************/
  function _addContactInfoToRecord(aRecord, aContactInfo) {
    // We store multiple IDs in case of a multiple contact match, but we only
    // show the information of the first match. If this first match is removed
    // we will refresh the information being shown for this entry.
    aRecord.contactId = aContactInfo.contactIds || null;
    var contact = aContactInfo.contacts ? aContactInfo.contacts[0] : null;
    if (!contact) {
      return aRecord;
    }
    aRecord.contactPrimaryInfo = contact.name ? contact.name[0] :
                                 contact.email ? contact.email[0].value :
                                 contact.tel ? contact.tel[0].value :
                                 null;
    aRecord.contactPhoto = contact.photo ? contact.photo[0] : null;
    return aRecord;
  }

  /**
   * We store a revision number for the contacts data local cache that we need
   * to keep synced with the Contacts API database.
   * This method stores the revision of the Contacts API database and it will
   * be called after refreshing the local cache because of a contact updated,
   * a contact deletion or a cache sync.
   */
  function _updateCacheRevision() {
    navigator.mozContacts.getRevision().onsuccess = function(event) {
      var contactsRevision = event.target.result;
      if (contactsRevision) {
        window.asyncStorage.setItem("contactsCacheRevision",
                                    contactsRevision);
      }
    };
  }

  /**
   * Updates the records from the groups object store with a given contact
   * information.
   * This function will likely be called within the handlers of the
   * 'oncontactchange' event.
   */
  function _updateContactInfo(aCallback, aContactInfo, aIdentities) {
    _checkCallback(aCallback);

    if (!aContactInfo || !aContactInfo.contactIds) {
      aCallback("INVALID_CONTACT");
      return;
    }

    var objectStores = [_dbCallStore, _dbUrlStore];
    var asyncCalls = objectStores.length;
    var _updateContact = function(event) {
      var cursor = event.target.result;
      if (!cursor || !cursor.value) {
        asyncCalls--;
        if (!asyncCalls) {
          _updateCacheRevision();
          aCallback();
        }
        return;
      }

      var record = cursor.value;

      record = _addContactInfoToRecord(record, aContactInfo);

      cursor.update(record);
      cursor.continue();
    };

    _newTxn(function(error, txn, stores) {
      if (error) {
        aCallback(error);
        return;
      }

      for (var i = 0; i < stores.length; i++) {
        var req = stores[i].index("identities")
                           .openCursor(IDBKeyRange.only(aIdentities));
        req.onsuccess = _updateContact;
      }

      txn.onerror = function(event) {
        aCallback(event.target.error.name);
      };
    }, "readwrite", objectStores);
  }

  /**
   * Removes the contact information matching the given contact id from the
   * list of entries or the contact information from an specific entry.
   *
   * This function will likely be called within the handlers of the
   * 'oncontactchange' event.
   */
  function _removeContactInfo(aCallback, aContactId, aRecord) {
    _checkCallback(aCallback);

    if (!aContactId && !aRecord) {
      aCallback("MISSING_CONTACT_OR_RECORD_INFO");
      return;
    }

    var objectStores = [_dbCallStore, _dbUrlStore];
    var asyncCalls = 0;
    var _deleteContact = function(event) {
      var cursor = event.target.result;
      if (!cursor || !cursor.value) {
        asyncCalls--;
        if (!asyncCalls) {
          _updateCacheRevision();
          aCallback();
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

    _newTxn(function(error, txn, stores) {
      if (error) {
        aCallback(error);
        return;
      }

      for (var i = 0; i < stores.length; i++) {
        asyncCalls++;
        var req;
        if (aContactId) {
          req = stores[i].index("contactId")
                         .openCursor(IDBKeyRange.only(aContactId));
        } else if (aRecord) {
          req = stores[i].openCursor(IDBKeyRange.only(aRecord.key));
        }
        req.onsuccess = _deleteContact;
      }

      txn.onerror = function(event) {
        aCallback(event.target.error.name);
      };

    }, "readwrite", objectStores);
  }

  function _invalidateContactsCache(aCallback) {
    _checkCallback(aCallback);

    var objectStores = [_dbCallStore, _dbUrlStore];
    var asyncCalls = 0;
    var cursorDone = false;

    var _error = null;

    function _onupdated() {
      if (asyncCalls) {
        return;
      }
      aCallback(_error);
      _updateCacheRevision();
    }

    function _updateContact(contactInfo, record, objectStore) {
      // We don't want to queue db transactions that won't update anything.
      var needsUpdate = false;
      if (contactInfo) {
        record = _addContactInfoToRecord(record, contactInfo);
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
        _newTxn(function(error, txn, store) {
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
        }, "readwrite", objectStore);
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
      asyncCalls++;
      ContactsHelper.find({ identities: record.identities },
                          function(contactInfo) {
        asyncCalls--;
        _updateContact(contactInfo, record, cursor.source.name);
      }, function() {
        asyncCalls--;
        _updateContact(null, record, cursor.source.name);
      });
      cursor.continue();
    }

    _newTxn(function(error, txn, stores) {
      if (error) {
        aCallback(error);
        return;
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
    }, "readonly", objectStores);
  }

  var ActionLogDB = {
    /**
     * Gets the list of calls stored in the DB.
     *
     * param aFilter
     *       Object. Check _getList.
     */
    getCalls: function(aCallback, aFilter) {
      _getList(aCallback, _dbCallStore, aFilter);
    },

    /**
     * Gets the list of urls stored in the DB.
     *
     * param aFilter
     *       Object. Check _getList.
     */
    getUrls: function(aCallback, aFilter) {
      _getList(aCallback, _dbUrlStore, aFilter);
    },

    /**
     * Stores a new call in the DB.
     *
     * param aCall
     *       Object holding the information about the new call to be stored in
     *       the DB.
     */
    addCall: function(aCallback, aCall) {
      _addRecord(aCallback, _dbCallStore, aCall);
    },

    /**
     * Stores a new url in the DB.
     *
     * param aUrl
     *       Object holding the information about the new URL to be stored in
     *       the DB.
     */
    addUrl: function(aCallback, aUrl) {
      _addRecord(aCallback, _dbUrlStore, aUrl);
    },

    /**
     * Gets an url given a custom filter.
     */
    getUrlByToken: function(aCallback, aToken) {
      _getRecord(aCallback, _dbUrlStore, {
        index: {
          name: "urlToken",
          value: aToken
        }
      });
    },

    revokeUrl: function(aCallback, aUrlCreationDate) {
      _updateRecord(aCallback, _dbUrlStore, null, { revoked: true });
    },

    deleteCalls: function(aCallback, aCalls) {
      _deleteRecord(aCallback, _dbCallStore, aCalls);
    },

    deleteUrls: function(aCallback, aUrls) {
      _deleteRecord(aCallback, _dbUrlStore, aUrls);
    },

    updateContactInfo: function(aCallback, aContact, aIdentities) {
      _updateContactInfo(aCallback, aContact, aIdentities);
    },

    removeContactInfo: function(aCallback, aContactId, aRecord) {
      _removeContactInfo(aCallback, aContactId, aRecord);
    },

    invalidateContactsCache: function(aCallback) {
      _invalidateContactsCache(aCallback);
    },

    addContactInfoToRecord: function(aRecord, aContactInfo) {
      return _addContactInfoToRecord(aRecord, aContactInfo);
    }
  };

  exports.ActionLogDB = ActionLogDB;
})(window);
