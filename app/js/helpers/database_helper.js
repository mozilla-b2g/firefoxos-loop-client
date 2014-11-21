/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/**
 * Generic component for IndexedDB management
 *
 * _dbParams: Object with:
 *
 *  name: Database name.
 *  version: Database version.
 *
 *  // TODO Bug# 1035935 (Automatic cleanup)
 *  maxNumberOfRecords: Maximum number of allowed records.
 *  numOfRecordsToDelete: If more records than max. Number of records to delete.
 *
 * _dbSchema: Object with:
 * {
 *   'storeName': {
 *     primary: 'date',
 *     indexes: [{
 *       name: 'indexName',
 *       field: 'indexField',
 *       params: {...}
 *     }],
 *     fields: [...fieldNames...]
 *   }
 * }
 */

function DatabaseHelper(dbParams, dbSchema) {
  ///////////////////////////////////////////////
  // Initialize database object
  ///////////////////////////////////////////////

  this._dbParams = dbParams || {};
  this._dbSchema = dbSchema || {};
  this._db = null;
}

///////////////////////////////////////////////
// Helper methods
///////////////////////////////////////////////

DatabaseHelper.prototype = {

  checkCallback: function _checkCallback(aCallback) {
    if (!aCallback || typeof aCallback != 'function') {
      throw new Error('INVALID_CALLBACK');
    }
  },

  /**
   * Prepare the database. This may include opening the database and upgrading
   * it to the latest schema version.
   *
   * return Promise. The resolved promise will contain as result IDBDatastore
   *                 instance. The rejected promise, an error string.
   */
  ensureDB: function _ensureDB() {
    if (this._db) {
      return Promise.resolve(this._db);
    }

    var self = this;
    return new Promise(function(resolve, reject) {
      try {
        if (!window.indexedDB) {
          return reject('NO_INDEXED_DB_AVAILABLE');
        }
        var request = window.indexedDB.open(self._dbParams.name,
                                            self._dbParams.version);
        request.onsuccess = ((event) => {
          self._db = event.target.result;
          resolve(self._db);
        });

        request.onerror = ((event) => {
          reject(event.target.errorCode);
        });

        request.onblocked = (() => {
          reject('DB_REQUEST_BLOCKED');
        });

        request.onupgradeneeded = ((event) => {
          var db = event.target.result;

          // Create DB Schemas
          var schemaKeys = Object.keys(self._dbSchema);
          var schemaKeysLength = schemaKeys.length;
          for (var _schema = 0; _schema < schemaKeysLength; _schema++) {
            var schemaName = schemaKeys[_schema];
            var schemaData = self._dbSchema[schemaName];
            var schemaIndexes = schemaData.indexes;
            var schemaIndexesLength = schemaIndexes.length;

            var auxStore = db.createObjectStore(schemaName, {
              keyPath: schemaData.primary
            });

            for (var _index = 0; _index < schemaIndexesLength; _index++) {
              auxStore.createIndex(schemaIndexes[_index].name,
                                   schemaIndexes[_index].field,
                                   schemaIndexes[_index].params);
            }
          }
        });
      } catch(e) {
        reject(e.message);
      }
    });
  },

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
  newTxn: function _newTxn(aCallback, aTxnType, aObjectStores) {
    this.checkCallback(aCallback);

    if (!Array.isArray(aObjectStores)) {
      aObjectStores = [aObjectStores];
    }
    this.ensureDB().then(function(db) {
      var txn = db.transaction(aObjectStores, aTxnType);
      var stores;
      if (aObjectStores.length === 1) {
        stores = txn.objectStore(aObjectStores[0]);
      } else {
        stores = [];
        var objectStoresLength = aObjectStores.length;
        for (var i = 0; i < objectStoresLength; i++) {
          stores.push(txn.objectStore(aObjectStores[i]));
        }
      }
      aCallback(null, txn, stores);
    }, function(error) {
      aCallback(error);
    });
  },

  /**
   * Helper to validate a DB record.
   */
  isValidRecord: function _isValidRecord(aObjectStoreName, aRecord) {
    if (!aObjectStoreName || !aRecord || !this._dbSchema[aObjectStoreName]) {
      return false;
    }
    var keys = Object.keys(aRecord);
    for (var i = 0, l = keys.length; i < l; i++) {
      if (this._dbSchema[aObjectStoreName].fields.indexOf(keys[i]) == -1) {
        return false;
      }
    }
    return true;
  },

  /**
   * Helper method to add a new record to a given object store.
   *
   * param aCallback
   * param aObjectStore
   *       String. Name of the object store where we want to save the record.
   * param aRecord.
   *       Object to be stored.
   */
  addRecord: function _addRecord(aCallback, aObjectStore, aRecord) {
    this.checkCallback(aCallback);

    if (typeof aRecord !== 'object') {
      aCallback('INVALID_RECORD');
      return;
    }

    if (aRecord.identities && !Array.isArray(aRecord.identities)) {
      aRecord.identities = [aRecord.identities];
    }

    if (aRecord.contactId && !Array.isArray(aRecord.contactId)) {
      aRecord.contactId = [aRecord.contactId];
    }

    this.newTxn(function(error, txn, store) {
      if (error) {
        aCallback(error);
        return;
      }
      txn.oncomplete = function(result) {
        aCallback(null, aRecord);
      };
      txn.onerror = txn.oncancel = function(error) {
        aCallback(error || 'UKNOWN_ERROR');
      };
      store.add(aRecord);
    }, 'readwrite', [aObjectStore]);
  },

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
  getList: function _getList(aCallback, aObjectStore, aFilter) {
    this.checkCallback(aCallback);

    this.newTxn(function(error, txn, store) {
      if (error) {
        aCallback(error);
        return;
      }

      if (!aFilter) {
        aFilter = {};
      }

      var cursor = null;
      var direction = aFilter.prev ? 'prev' : 'next';
      if (aFilter.sortedBy && aFilter.sortedBy !== null) {
        if (!store.indexNames.contains(aFilter.sortedBy)) {
          txn.abort();
          aCallback('INVALID_SORTED_BY_FILTER');
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
    }, 'readonly', [aObjectStore]);
  },

  /**
   * Helper method to return a record.
   *
   * param aCallback
   * param aObjectStore
   *       String. Name of the object store that we want to query.
   * param aFilter.
   *       So far the only use case that we found is an 'equal' query,
   *       so we will be taking an object of this kind:
   *       {
   *         key: <any>,
   *         index: {
   *           name: <string>,
   *           value: <any>
   *         }
   *       }
   *       where we would expect 'key' or 'index' but not both.
   */
  getRecord: function _getRecord(aCallback, aObjectStore, aFilter) {
    this.checkCallback(aCallback);

    if (!aFilter ||
        (!aFilter.key && !aFilter.index) ||
        (aFilter.key && aFilter.index) ||
        (aFilter.index && (!aFilter.index.name || !aFilter.index.value))) {
      aCallback('INVALID_FILTER');
      return;
    }

    this.newTxn(function(error, txn, store) {
      if (error) {
        console.error(error.name);
        aCallback(error.name);
        return;
      }
      var req;
      if (aFilter.index) {
        if (!store.indexNames.contains(aFilter.index.name)) {
          aCallback('INVALID_FILTER');
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
    }, 'readonly', [aObjectStore]);
  },

  updateRecord: function _updateRecord(aCallback, aObjectStore, aFilter,
                                       aRecord) {
    this.checkCallback(aCallback);

    if (!this.isValidRecord(aObjectStore, aRecord)) {
      aCallback('INVALID_RECORD');
      return;
    }

    var onRecord = ((error, record) => {
      if (error) {
        aCallback(error);
        return;
      }

      if (!record) {
        aCallback('NOT_FOUND');
        return;
      }

      this.newTxn(function(error, txn, store) {
        if (error) {
          aCallback(error);
          return;
        }

        Object.keys(aRecord).forEach((key) => {
          record[key] = aRecord[key];
        });

        var req = store.put(record);
        req.onsuccess = function() {
          aCallback();
        };
        req.onerror = function(e) {
          console.error('Record not updated', e);
          aCallback(e);
        };
      }, 'readwrite', [aObjectStore]);
    });

    this.getRecord(onRecord, aObjectStore, aFilter);
  },

  clearObjectStore: function _clearObjectStore(aCallback, aObjectStore) {
    this.checkCallback(aCallback);

    this.newTxn(function(error, txn, store) {
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
        aCallback(event.target.error.name);
      };
    }, 'readwrite', [aObjectStore]);
  },

  deleteRecord: function _deleteRecord(aCallback, aObjectStore, aKey) {
    this.checkCallback(aCallback);

    if (!aKey) {
      this.clearObjectStore(aCallback, aObjectStore);
      return;
    }

    this.newTxn(function(error, txn, store) {
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
    }, 'readwrite', [aObjectStore]);
  }
};
