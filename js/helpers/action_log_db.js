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
          db.createObjectStore(_dbCallStore, { keyPath: 'date' });
          db.createObjectStore(_dbUrlStore, { keyPath: 'date' })
            .createIndex('urlToken', 'urlToken');
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
    if (typeof aCallback !== 'function') {
      aCallback = function(){};
    }

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

    if (!aCallback || typeof aCallback != "function") {
      console.error("INVALID_CALLBACK");
      return;
    }

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
     *
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

    updateContactInfo: function(aCallback, aContactId, aContact, aRecord) {
      // TODO: bug 1035931
    },

    removeContactInfo: function(aCallback, aContactId, aRecord) {
      // TODO: bug 1035931
    },

    invalidateContactsCache: function(aCallback) {
      // TODO: bug 1035931
    }
  };

  exports.ActionLogDB = ActionLogDB
})(window);
