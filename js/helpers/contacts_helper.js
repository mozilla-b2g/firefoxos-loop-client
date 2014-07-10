/* exported ContactsHelper */

'use strict';

(function(exports) {
  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  function _findById(id, onsuccessCB, onerrorCB) {
    var options = {
      filterBy: ['id'],
      filterOp: 'equals',
      filterValue: id
    };

    var request = navigator.mozContacts.find(options);

    request.onsuccess = function onsuccess(e) {
      var contact = e.target.result[0];
      if (!contact) {
        _callback(onerrorCB);
        return;
      }
      _callback(onsuccessCB, [contact]);
    };

    request.onerror = function onsuccess() {
      _callback(onerrorCB);
    };
  }

  function _findByIdentity(identities, onsuccessCB, onerrorCB) {
    if (!Array.isArray(identities)) {
      identities = [identities];
    }
    var options = {
      filterBy    : ['tel', 'email'],
      filterValue : identities[0],
      filterOp    : 'equal'
    }

    var request = navigator.mozContacts.find(options);

    request.onsuccess = function onsuccess(e) {
      var contact = e.target.result[0];
      if (!contact) {
        _callback(onerrorCB);
        return;
      }
      _callback(onsuccessCB, [contact]);
    };

    request.onerror = function onsuccess() {
      _callback(onerrorCB);
    };
  }

  var ContactsHelper = {
    find: function(filter, onsuccessCB, onerrorCB) {
      if (!navigator.mozContacts) {
        console.error('mozContacts is not available');
        return;
      }

      if (!filter || !filter.identities) {
        return null;
      }

      if (filter.contactId) {
        _findById(
          filter.contactId,
          function onContactIDFound(contact) {
            _callback(onsuccessCB, [contact]);
          },
          function onFallback() {
            _findByIdentity(
              filter.identities,
              onsuccessCB,
              onerrorCB
            )
          }
        )
      } else {
        _findByIdentity(
          filter.identities,
          onsuccessCB,
          onerrorCB
        )
      }
    }  
  };

  exports.ContactsHelper = ContactsHelper;
}(this));
