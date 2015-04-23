(function(exports) {
  'use strict';
/**
 * Events will be:
 *   - Room Created: Time and subject
 *   - Room Renamed: Time and new subject
 *   - Anyone Joined: Time and Who
 *   - I joined: Time
 *   - Communication established: Time and with who
 *   - Shared With: Time and whom
 */
  const EVT_TYPE = {
    created: 'created',
    renamed: 'renamed',
    iJoin: 'iJoin',
    otherJoin: 'otherJoin',
    communication: 'communication',
    shared: 'shared'
  };

  const IDENTITY_UNKNOWN = '__identityUnkwon__';

  function _addEvent(aAction, aToken, aParam) {
    if (!aToken) {
      return;
    }

    if (!aParam || typeof aParam !== 'object') {
      console.error('Registering ' + aAction +
                    ' event without parameters or incorrect type');
      return;
    }
    var evtObj = {
      action: aAction,
      params: aParam
    };
    RoomsDB.addEvent(aToken, evtObj).catch(function (error) {
      console.error('Error saving event [' + JSON.stringify(evtObj) +
                    '] of room '+ aToken +
                    '. Error:' + JSON.stringify(error));
    });
  };

  function _resolveUserName(aResolve, aFilter, aTagLocale, aData, aResult) {
    var _ = navigator.mozL10n.get;
    function onNoContact(aName) {
      aResult.txt = _(aTagLocale, { name: aName || aData.params.identity});
      aResolve(aResult);
    }

    if (aFilter.identities &&
        aFilter.identities === IDENTITY_UNKNOWN) {
      onNoContact(_('guest'));
    } else {
      ContactsHelper.find(
        aFilter,
        function onContact(contact) {
          var pretName = ContactsHelper.prettyPrimaryInfo(contact.contacts[0]);
          aResult.txt = _(aTagLocale, { name: pretName });
          aResolve(aResult);
        },
        onNoContact
      );
    }
  }

  var RoomEvent = {
    get identityUnknown() {
      return IDENTITY_UNKNOWN;
    },

    get type() {
      return EVT_TYPE;
    },

    _created: function re_createRoom(aParams) {
      if (!aParams.name) {
        console.error('Trying add a create event without name of the room');
        return;
      };
      var creationTime = aParams.date;
      if (!creationTime  || !creationTime  instanceof Date) {
        console.warn('Trying add a create event with incorrect type of date, ' +
                     'we will use current time');
        creationTime = new Date();
      }
      _addEvent(aParams.type, aParams.token, { date: creationTime,
                                             name: aParams.name });
    },

    _renamed: function re_renamed(aParams) {
      if (!aParams.name) {
        console.error('Trying add a rename event without new name of the room');
        return;
      };
      _addEvent(aParams.type, aParams.token, { name: aParams.name });
    },

    _shared: function re_shared(aParams) {
      _addEvent(aParams.type, aParams.token, {id: aParams.contactId,
                                              identity: aParams.identity });
    },

    _otherJoin: function re_otherJoin(aParams) {
      if (!aParams.identity) {
        console.error('Trying to log a other join event without identity');
        return;
      }
      _addEvent(aParams.type, aParams.token, { identity: aParams.identity });
    },

    _iJoin: function re_iJoin(aParams) {
      _addEvent(aParams.type, aParams.token, {});
    },

    _communication: function re_communication(aParams) {
      _addEvent(aParams.type, aParams.token, {identity: aParams.otherIdentity,
                                              length: aParams.length});
    },

    save: function re_save(aDatas) {
      if (!aDatas.type) {
        console.error('Event type has not been received');
        return;
      }

      var fcName = "_" + aDatas.type;

      if (!this[fcName] || (typeof this[fcName] !== "function")) {
        console.error('Event type unknown');
        return;
      }

      this[fcName](aDatas);
    },

    toString: function re_toString(event) {
      return new Promise(function(resolve, reject) {
        var _ = navigator.mozL10n.get;
        var result = {
          date: event.date
        };
        switch (event.action) {
          case EVT_TYPE.created:
            result.txt = _('evtCreate');
            result.date = event.params.date;
            break;
          case EVT_TYPE.renamed:
            result.txt = _('evtRename', { name: event.params.name });
            break;
          case EVT_TYPE.iJoin:
            result.txt = _('evtIJoin');
            break;
          case EVT_TYPE.otherJoin:
            _resolveUserName(resolve,
                             { identities: event.params.identity },
                             'evtOtherJoin', event, result);
            break;
          case EVT_TYPE.communication:
              result.length = event.params.length;
              _resolveUserName(resolve,
                               { identities: event.params.identity },
                               'evtCommunication', event, result);
              break;
          case EVT_TYPE.shared:
            _resolveUserName(resolve,
                             {contactId: event.params.id},
                             'evtShare', event, result);
            break;
        }
        result.txt && resolve(result);
      });
    }
  };

  exports.RoomEvent = RoomEvent;

})(this);
