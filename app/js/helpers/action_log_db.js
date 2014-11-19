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
 *   type: <string> ('incoming' or 'outgoing'),
 *   video: <bool>,
 *   connected: <bool>,
 *   duration: <Number> // miliseconds
 *   url: <string>,
 *   urlToken: <string>,
 *   revoked: <Boolean>,
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

  var _dbCallStore = 'actionLogCalls';
  var _dbUrlStore = 'actionLogUrls';
  var _dbHelper = new DatabaseHelper({
    name: 'actionLog',
    version: 1,
    maxNumberOfRecords: 200,
    numOfRecordsToDelete: 50
  }, {
    'actionLogCalls': {
      primary: 'date',
      indexes: [{
        name: 'identities',
        field: 'identities',
        params: {
          multientry: true
        }
      }, {
        name: 'contactId',
        field: 'contactId',
        params: {
          multientry: true
        }
      }],
      fields: [
        'date',
        'identities',
        'type',
        'video',
        'connected',
        'duration',
        'url',
        'urlToken',
        'revoked',
        'contactId',
        'contactPrimaryInfo',
        'contactPhoto'
      ]
    },
    'actionLogUrls': {
      primary: 'date',
      indexes: [{
        name: 'urlToken',
        field: 'urlToken'
      }, {
        name: 'identities',
        field: 'identities',
        params: {
          multientry: true
        }
      }, {
        name: 'contactId',
        field: 'contactId',
        params: {
          multientry: true
        }
      }],
      fields: [
        'date',
        'identities',
        'url',
        'urlToken',
        'expirationDate',
        'revoked',
        'contactId',
        'contactPrimaryInfo',
        'contactPhoto'
      ]
    }
  });

  function _checkCallback(aCallback) {
    if (!aCallback || typeof aCallback != 'function') {
      throw new Error('INVALID_CALLBACK');
    }
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
        window.asyncStorage.setItem('contactsCacheRevision',
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
  function _updateContactInfo(aContact) {
    if (!aContact) {
      console.error('Invalid contact');
      return;
    }

    var objectStores = [_dbCallStore, _dbUrlStore];
    var asyncCalls = 0;
    var updateCount = 0;
    var _updateContact = function(event) {
      var cursor = event.target.result;
      if (!cursor || !cursor.value) {
        asyncCalls--;
        if (!asyncCalls) {
          if (updateCount) {
            _updateCacheRevision();
            return;
          }
          // If we didn't update any record that means that the contact
          // information that we have for the affected contact is not valid
          // anymore, and so we need to get rid of it.
          _removeContactInfo(aContact.id);
        }
        return;
      }

      var record = cursor.value;

      record = _addContactInfoToRecord(record, {
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
  }

  /**
   * Removes the contact information matching the given contact id from the
   * list of entries.
   *
   * This function will likely be called within the handlers of the
   * 'oncontactchange' event.
   */
  function _removeContactInfo(aContactId) {
    if (!aContactId) {
      console.error('Missing contact id');
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

    _dbHelper.newTxn(function(error, txn, stores) {
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
    }, 'readonly', objectStores);
  }

  var ActionLogDB = {
    init: function() {
      window.addEventListener('oncontactchange', function(event) {
        var reason = event.detail.reason;
        var contactId = event.detail.contactId;
        if (reason == 'remove') {
          _removeContactInfo(contactId);
          return;
        }
        ContactsHelper.find({
          contactId: contactId
        }, function(contactInfo) {
          _updateContactInfo(contactInfo.contacts[0]);
        }, function() {
          _removeContactInfo(contactId);
        })
      });
    },
    /**
     * Gets the list of calls stored in the DB.
     *
     * param aFilter
     *       Object. Check _dbHelper.getList.
     */
    getCalls: function(aCallback, aFilter) {
      _dbHelper.getList(aCallback, _dbCallStore, aFilter);
    },

    /**
     * Gets the list of urls stored in the DB.
     *
     * param aFilter
     *       Object. Check _dbHelper.getList.
     */
    getUrls: function(aCallback, aFilter) {
      _dbHelper.getList(aCallback, _dbUrlStore, aFilter);
    },

    /**
     * Stores a new call in the DB.
     *
     * param aCall
     *       Object holding the information about the new call to be stored in
     *       the DB.
     */
    addCall: function(aCallback, aCall, aContactInfo) {
      if (aContactInfo && aContactInfo.contactIds) {
        aCall = _addContactInfoToRecord(aCall, aContactInfo);
      }
      _dbHelper.addRecord(aCallback, _dbCallStore, aCall);
    },

    /**
     * Stores a new url in the DB.
     *
     * param aUrl
     *       Object holding the information about the new URL to be stored in
     *       the DB.
     */
    addUrl: function(aCallback, aUrl, aContactInfo) {
      if (aContactInfo && aContactInfo.contactIds) {
        aUrl = _addContactInfoToRecord(aUrl, aContactInfo);
      }
      _dbHelper.addRecord(aCallback, _dbUrlStore, aUrl);
    },

    /**
     * Gets an url given a custom filter.
     */
    getUrlByToken: function(aCallback, aToken) {
      _dbHelper.getRecord(aCallback, _dbUrlStore, {
        index: {
          name: 'urlToken',
          value: aToken
        }
      });
    },

    revokeUrl: function(aCallback, aToken) {
      _dbHelper.updateRecord(aCallback, _dbUrlStore, {
        index: {
          name: 'urlToken',
          value: aToken
        }
      }, { revoked: true });
    },

    revokeUrlFromCall: function(aCallback, aDate) {
      _dbHelper.updateRecord(aCallback, _dbCallStore, { key: aDate }, { revoked: true });
    },

    deleteCalls: function(aCallback, aCalls) {
      _dbHelper.deleteRecord(aCallback, _dbCallStore, aCalls);
    },

    deleteUrls: function(aCallback, aUrls) {
      _dbHelper.deleteRecord(aCallback, _dbUrlStore, aUrls);
    },

    invalidateContactsCache: function(aCallback) {
      _invalidateContactsCache(aCallback);
    }

  };

  exports.ActionLogDB = ActionLogDB;

})(window);
