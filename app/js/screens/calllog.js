(function(exports) {
  'use strict';

  var _initialized = false;
  var calllogSectionsContainer, callsTabSelector, roomsTabSelector,
      callsSection, roomsSection, callsSectionEntries, roomsSectionEntries,
      toolbarFooter;
  var _contactsCache = false;
  var _ready = false;

  var _; // l10n get

  // Variables needed to track infinite scrolling
  const CHUNK_SIZE = 10;
  const ONSCROLL_CHUNK_SIZE = 50;
  const SCROLL_EDGE = 50;
  const MAX_PARTICIPANTS = 2;

  var callsRenderedIndex = 0;
  var roomsRenderedIndex = 0;

  /**
   * Function for rendering an option prompt given a list
   * of options
   *
   * @param {Array} items Items to render
   */
  function _showSecondaryMenu(items) {
    // We add 'Cancel' as default one
    items.push(
      {
        name: 'Cancel',
        l10nId: 'cancel'
      }
    );

    var options = new OptionMenu({
      type: 'action',
      items: items
    });
  }

  function _showRoomSecondaryMenu(room) {
    var items = [];

    // Show details
    items.push({
      name: 'Join',
      l10nId: 'join',
      method: function(room) {
        Controller.joinRoom(room.roomToken, room.roomName);
      },
      params: [room]
    });

    // We can share a room *only* if we are the owners.
    if (room.roomOwner === Controller.identity) {
      items.push({
        name: 'Share',
        l10nId: 'shareRoom',
        method: function(element) {
          Loader.getShare().then(() => {
            Share.pickContact(
              {
                type: 'room',
                url: room.roomUrl
              },
              function onShared(contact, identity) {
                console.log('Lets add this to DB');
                Controller.onRoomShared(room, contact, identity);
              },
              function onError() {
                // Currently we dont need to show any error here, add if needed
              }
            );
          });
        },
        params: [room]
      });
    }

    // Delete a room
    items.push({
      name: 'Delete',
      l10nId: 'delete',
      method: function(room) {
        LazyLoader.load('js/screens/delete_room.js', () => {
          RoomDelete.show(room.roomToken,
                          room.roomOwner === Controller.identity).catch(e => {
            if (e && e !== 'NO_CONNECTION') {
              // TODO Add error handling about this
              // https://bugzilla.mozilla.org/show_bug.cgi?id=1102847
              alert('Error while deleting room ' + JSON.stringify(e));
            }
          });
        });
      },
      params: [room]
    });

    _showSecondaryMenu(items);
  }

  function _showCallSecondaryMenu(element) {
    // Options to show
    var items = [];
    // Retrieve important info
    var identities = element.dataset.identities.split(',');
    var contactId = element.dataset.contactId;
    if (!contactId || contactId === 'null' || contactId === 'undefined') {
      var tel, email;
      for (var i = 0, l = identities.length; i < l && !tel && !email; i++) {
        if (identities[i].indexOf('@') === -1) {
          tel = identities[i];
        } else {
          email = identities[i];
        }
      }
      var params = {};
      if (tel) {
        params.tel = tel;
      }
      if (email) {
        params.email = email;
      }

      items.push(
        {
          name: 'Create a new contact',
          l10nId: 'createContact',
          method: function(params) {
            new MozActivity({
              name: 'new',
              data: {
                type: 'webcontacts/contact',
                params: params
              }
            });
          },
          params: [params]
        }
      );
      items.push(
        {
          name: 'Add to a contact',
          l10nId: 'addToContact',
          method: function(params) {
            new MozActivity({
              name: 'update',
              data: {
                type: 'webcontacts/contact',
                params: params
              }
            });
          },
          params: [params]
        }
      );
    }

    if (element.dataset.urlToken && element.dataset.revoked !== 'true') {
      // Delete single item
      items.push(
        {
          name: 'Revoke',
          l10nId: 'revoke',
          method: function(element) {
            var token = element.dataset.urlToken;
            Controller.revokeUrl(token, function onRevoked() {
              ActionLogDB.revokeUrlFromCall(function(error) {
                if (error) {
                  console.error('Error revoking an URL for a call from DB ' +
                                 error);
                  return;
                }

                element.dataset.revoked = true;
                element.querySelector('.url').textContent = _('revoked');
              }, new Date(+element.id));
            });
          },
          params: [element]
        }
      );
    }

    // Delete single item
    items.push(
      {
        name: 'Delete',
        l10nId: 'delete',
        method: function(elementId) {
          _deleteCalls([new Date(+elementId)]);
        },
        params: [element.id]
      }
    );

    // Call through Loop
    if (identities && identities.length) {
      items.push(
        {
          name: 'Call',
          l10nId: 'call',
          method: function(identities) {
            var isVideo = element.dataset.isVideo;
            if (element.dataset.missedCall) {
              isVideo = Settings.isVideoDefault;
            }
            callTo(identities, element.dataset.subject, isVideo);
          },
          params: [identities]
        }
      );
    }

    _showSecondaryMenu(items);
  }

  function callTo(identities, subject, isVideo) {
    Controller.callIdentities({
      identities: identities,
      subject: subject,
      isVideoCall: isVideo
    }, () => {
      Telemetry.updateReport('callsFromCallLog');
    });
  }

  /**
   * Function for updating time related elements marked with 'data-need-update'
   * dataset.
   */
  const MINUTE_MS = 60000;
  var timer;

  function _startTimeUpdates() {
    if (timer) {
      return;
    }
    function _start() {
      if (timer) {
        return;
      }

      function updateTimeElements() {
        var elementsToUpdate = document.querySelectorAll('[data-need-update]');

        for (var i = 0, l = elementsToUpdate.length; i < l; i++) {
          var dataset = elementsToUpdate[i].dataset;
          var value = Utils.getHeaderDate(+dataset.timestamp);
          elementsToUpdate[i].textContent = value || _('unknown');
        }
      }

      updateTimeElements();
      timer = setInterval(updateTimeElements, MINUTE_MS);
    }

    function _stop() {
      clearInterval(timer);
      timer = null;
    }

    // Start listeners
    _start();

    // If we are not visible, stop updating
    document.addEventListener(
      'visibilitychange',
      function checkVisibility() {
        document.hidden ? _stop() : _start();
      }
    );
   }

  /**
   * Function for moving from one section to the targeted one
   *
   * @param {String} section Target section
   */
  function _changeSection(section) {
    if (!section) {
      return;
    }
    // Set the active tab
    callsTabSelector.setAttribute('aria-selected',
          section === 'calls' ? 'true' : 'false');
    roomsTabSelector.setAttribute('aria-selected',
          section === 'rooms' ? 'true' : 'false');
    // Calculate the translation needed
    var translation = 0;
    switch(section) {
      case 'rooms':
        translation = '0';
        break;
      case 'calls':
        translation = '-50%';
        break;
    }
    // Move the panel in order to show the right section
    calllogSectionsContainer.style.transform = 'translateX(' + translation + ')';
  }


  function _deleteElementsFromGroup(ids, type) {
    // decorateId is a decorator for ids that require some additional work
    var sectionEntries, cleanSection, decorateId;
    if (type === 'calls') {
      sectionEntries = callsSectionEntries;
      cleanSection = function() {
        _isCallsSectionEmpty = true;
        _checkEmptyCalls();
      }
      decorateId = function(id) {
        return id.getTime();
      }
    } else {
      sectionEntries = roomsSectionEntries;
      cleanSection = function() {
        _isRoomsSectionEmpty = true;
        _checkEmptyRooms();
      }
      decorateId = function(id) {
        return id;
      };
    }

    // TODO Implement in https://bugzilla.mozilla.org/show_bug.cgi?id=1035693
    for (var i = 0, l = ids.length; i < l; i++) {
      // ID is the timestamp given a date
      var elementToDelete = document.getElementById(decorateId(ids[i]));
      if (!elementToDelete) {
        continue;
      }
      // Delete from DB
      var ul = elementToDelete.parentNode;
      ul.removeChild(elementToDelete);

      var ulChildrensLength = ul.children.length;
      if (ulChildrensLength === 0) {
        var header = ul.previousSibling;
        // Delete the empty group
        sectionEntries.removeChild(header);
        sectionEntries.removeChild(ul);
        // Check if we need to show the empty panel
        if (sectionEntries.children.length === 0) {
          cleanSection();
        }
      }
    };
  }

  /**
   * Append element to group based on timestampIndex
   *
   * @param {HTMLElement} group Group where to place the element
   * @param {HTMLElement} element Element to place
   * @param {HTMLElement} header Header if needed before the element
   */
  function _appendElementToContainer(group, element, header) {
    var selector = element.tagName;
    var entries = group.querySelectorAll(selector);

    var reference;
    for (var i = 0, l = entries.length; i < l; i++) {
      if (+element.dataset.timestampIndex > +entries[i].dataset.timestampIndex) {
        reference = entries[i];
        break;
      }
    }

    if (!reference) {
      header && group.appendChild(header);
      group.appendChild(element);
      return;
    }

    if (header) {
      var headerReference = reference.previousSibling;
      reference.parentNode.insertBefore(element, headerReference);
      reference.parentNode.insertBefore(header, element);
    } else {
      reference.parentNode.insertBefore(element, reference);
    }
  }

  /**
   * Get a group to place the element
   *
   * @param {String} type Type of the element to append ('calls' or 'urls')
   * @param {Date} date Date of the Object to append
   */
  function _getGroup(type, date) {
    // Create an index to search based on date
    var timestampIndex = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).getTime();

    // Create selector based in type & day
    var selector = type + '-' + timestampIndex;

    // Is there any container for this date?
    var ul = document.getElementById(selector);

    if (ul) {
      return ul;
    }

    // If there is no container, we need to create
    // a new one composed by header & ul
    var header = document.createElement('header');
    header.dataset.needUpdate = true;
    header.dataset.formatDate = 'header';
    header.dataset.timestamp = timestampIndex;
    header.textContent = Utils.getHeaderDate(date.getTime());

    var ul = document.createElement('ul');
    ul.classList.add('calllog-elements');
    ul.dataset.timestampIndex = timestampIndex;
    ul.id = type + '-' + timestampIndex;

    // We need to check where to place the new group
    var container = type === 'calls' ? callsSectionEntries : roomsSectionEntries;
    if (callsRenderedIndex > CHUNK_SIZE) {
      header.classList.add('hidden');
    }
    // Append into the right position
    _appendElementToContainer(container, ul, header);

    return ul;
  }

  /**
   * Set of methods & vars related with the 'Calls' section
   */

  var _isCallsSectionEmpty = true;
  var _templateNoUrlCalls, _templateUrlCalls;

  function _checkEmptyCalls() {
    _isCallsSectionEmpty ?
      callsSection.classList.add('empty') : callsSection.classList.remove('empty');
  }

  function _clearCalls() {
    // Delete all entries in call section
    ActionLogDB.deleteCalls(function(error) {
      error && console.error('ERROR when clearing calls db ' + error);
    });
    // Show 'empty' panel
    callsSectionEntries.innerHTML = '';
    _isCallsSectionEmpty = true;
    _checkEmptyCalls();
  }

  function _deleteCalls(ids) {
    ActionLogDB.deleteCalls(
      function(error) {
        error && console.error('Error when deleting calls from DB ' + error.name);
      },
      ids
    );
    _deleteElementsFromGroup(ids, 'calls');
  }

  function _renderCalls(callsCursor, update) {
    var rawCall = callsCursor.value;
    if (update) {
      _updateCall(rawCall);
    } else {
      // Append to DOM
      _appendCall(rawCall, true /* isFirstPaint */);
    }
    // Go to the next position of the cursor
    callsCursor.continue();
  }

  function _createCallDOM(call, element) {
    var callElement = element || document.createElement('li');
    callElement.id = call.date.getTime();
    callElement.dataset.timestampIndex = call.date.getTime();
    callElement.dataset.contactId = call.contactId;
    var subject = callElement.dataset.subject = call.subject || '';
    callElement.dataset.identities = call.identities;
    callElement.dataset.revoked = call.revoked;
    if (call.urlToken) {
      callElement.dataset.urlToken = call.urlToken;
    }

    var datePretty = Utils.getFormattedHour(call.date.getTime());
    var durationPretty = Utils.getDurationPretty(+call.duration);

    var icon;
    if (call.type === 'incoming' && !call.connected) {
      icon = 'missed';
      callElement.dataset.missedCall = true;
    } else {
      icon = call.type + '-' + (call.video && call.video != 'false' ? 'video':'audio')
      callElement.dataset.isVideo =
        call.video && call.video != 'false' ? true : false;
    }

    if (!call.url) {
      callElement.innerHTML = _templateNoUrlCalls.interpolate({
        iconName: icon,
        type: call.type,
        primary: call.contactPrimaryInfo || call.identities[0] || _('unknown'),
        time: datePretty,
        duration: durationPretty,
        subject: subject
      });
    } else {
      callElement.innerHTML = _templateUrlCalls.interpolate({
        iconName: icon,
        type: call.type,
        primary: call.contactPrimaryInfo || call.identities[0] || _('unknown'),
        link: call.revoked ? _('revoked') : call.url,
        time: datePretty,
        duration: durationPretty,
        subject: subject
      });
    }
    return callElement;
  }

  function _appendCall(call, isFirstPaint) {
    if (!call) {
      return;
    }

    if (_isCallsSectionEmpty) {
      _isCallsSectionEmpty = false;
      _checkEmptyCalls();
      _startTimeUpdates();
    }

    // Create elements needed
    var group = _getGroup('calls', call.date);
    var element = _createCallDOM(call);
    callsRenderedIndex++;
    if (isFirstPaint && callsRenderedIndex > CHUNK_SIZE) {
      element.classList.add('hidden');
    }
    // Append to the right position
    _appendElementToContainer(group, element)
  }

  function _updateCall(call) {
    if (!call) {
      return;
    }

    if (_isCallsSectionEmpty) {
      _isCallsSectionEmpty = false;
      _checkEmptyCalls();
      _startTimeUpdates();
    }

    var query = 'li[id="' + call.date.getTime() + '"]';
    var element = callsSectionEntries.querySelector(query);
    _createCallDOM(call, element);
  }

  /**
   * Set of methods & vars related with the 'Rooms' section
   */

  var _isRoomsSectionEmpty = true;
  var _templateRoom;

  function _checkEmptyRooms() {
    _isRoomsSectionEmpty ? roomsSection.classList.add('empty') :
                           roomsSection.classList.remove('empty');
  }

  function _deleteRooms(tokens) {
    if (!Array.isArray(tokens)) {
      tokens = [tokens];
    }
    for (var i = 0; i < tokens.length; i++) {
      RoomsDB.get(tokens[i]).then(function(room){
        Object.keys(room).forEach(function (name) {
          Telemetry.udpateReport(name, room[name]);
        });
      }, function () {
        console.log('Error, could not create telemetry room report');
      });
    }
    return RoomsDB.delete(tokens).then(() => {
      _deleteElementsFromGroup(tokens, 'rooms');
    }, (error) => {
      error && console.error('Error when deleting rooms from DB ' +
                      error.name || error || 'Unknown');
    });
  }

  function _renderRooms(roomsCursor, update) {
    var rawRoom = roomsCursor.value;
    if (update) {
      _updateRoom(rawRoom);
    } else {
      // Append to DOM
      _appendRoom(rawRoom, true /* isFirstPaint */);
    }
    // Go to the next position of the cursor
    roomsCursor.continue();
  }

  function _createRoomDOM(rawRoom, element) {
    var roomElement = element || document.createElement('li');
    roomElement.classList.add('active');
    var lastActivityTime = _getLastActivityDate(rawRoom);
    roomElement.dataset.timestampIndex = lastActivityTime.getTime();
    roomElement.id = roomElement.dataset.roomToken = rawRoom.roomToken;
    roomElement.dataset.isOwner = (rawRoom.roomOwner === Controller.identity);
    roomElement.dataset.roomOwner = rawRoom.roomOwner;
    roomElement.dataset.identities = rawRoom.identities;
    roomElement.dataset.participants =
      rawRoom.participants.length === MAX_PARTICIPANTS ?
        'full':rawRoom.participants.length;
    roomElement.dataset.contactId = rawRoom.contactId;
    var roomName = roomElement.dataset.roomName = rawRoom.roomName;
    var info = rawRoom.contactPrimaryInfo;
    if (info) {
      roomElement.dataset.shared = true;
    }
    var params = {
      roomToken: rawRoom.roomToken,
      roomName: roomName,
      info: info || rawRoom.identities[0] || _('dontBeShy'),
      lastActivityTime: Utils.getFormattedHour(lastActivityTime)
    };

    if (rawRoom.noLongerAvailable) {
      params.info = _('noLongerAvailable');
      roomElement.dataset.noLongerAvailable = true;
    }

    roomElement.innerHTML = _templateRoom.interpolate(params);

    return roomElement;
  }

  function _appendRoom(rawRoom, isFirstPaint) {
    if (!rawRoom) {
      return;
    }

    if (_isRoomsSectionEmpty) {
      _isRoomsSectionEmpty = false;
      _checkEmptyRooms();
    }

    // Create elements needed
    var group = _getGroup('rooms', _getLastActivityDate(rawRoom));
    var element = _createRoomDOM(rawRoom);
    roomsRenderedIndex++;
    if (isFirstPaint && roomsRenderedIndex > CHUNK_SIZE) {
      element.classList.add('hidden');
    }
    // Append to the right position
    _appendElementToContainer(group, element)
  }

  function _updateRoom(room) {
    if (!room) {
      return;
    }

    // We have to remove the existing item and promote this one to the first
    // position in the room list.
    _deleteElementsFromGroup([room.roomToken], 'rooms');
    _appendRoom(room);
  }

  /*****************************
   * Contacts related methods.
   *****************************/
  function _verifyContactsCache() {
    return new Promise((resolve, reject) => {
      // Get the latest contacts cache revision and the actual Contacts API
      // db revision. If both values differ, we need to update the contact
      // cache and its revision and directly query the Contacts API to render
      // the appropriate information while the cache is being rebuilt.
      window.asyncStorage.getItem('contactsCacheRevision', (cacheRevision) => {
        var req = navigator.mozContacts.getRevision();

        req.onsuccess = function(event) {
          var contactsRevision = event.target.result;
          // We don't need to sync if this is the first time that we use the
          // action log.
          if (!cacheRevision || cacheRevision > contactsRevision) {
            window.asyncStorage.setItem('contactsCacheRevision',
                                         contactsRevision);
            reject();
            return;
          }

          var cacheIsValid = _contactsCache = (cacheRevision >= contactsRevision);
          if (cacheIsValid) {
            reject();
            return;
          }

          var pendingCallbacks = 2;
          function checkInvalidateFinished() {
            if (!--pendingCallbacks) {
              _contactsCache = true;
              resolve();
            }
          }

          RoomsDB.invalidateContactsCache(function(error) {
            if (error) {
              console.error('Could not invalidate rooms contacts cache ' + error);
              reject();
              return;
            }

            checkInvalidateFinished();
          });

          ActionLogDB.invalidateContactsCache(function(error) {
            if (error) {
              console.error('Could not invalidate contacts cache ' + error);
              reject();
              return;
            }

            checkInvalidateFinished();
          });

        };

        req.onerror = function(event) {
          reject();
        };
      });
    });
  }

  function _updateContactInfo(aElement, aContact) {
    // '.primary-info > p' -> Calls in call log | '.primary-info' -> Rooms
    var primaryInfo = aElement.querySelector('.primary-info > p') ||
                      aElement.querySelector('.secondary-info');
    var datasetIdentities = aElement.dataset.identities.split(',');

    if (aContact) {
      var identities = [];
      ['tel', 'email'].forEach(function(field) {
        if (!aContact[field]) {
          return;
        }
        for (var i = 0, l = aContact[field].length; i < l; i++) {
          identities.push(aContact[field][i].value);
        }
      });

      // We check if any of the contact identities matches the identities
      // stored for this call log entry.
      var match = [];
      match = identities.filter(function(identity) {
        return datasetIdentities.indexOf(identity) != -1;
      });

      // If no match if found, we just bail out. Unless the contact ID stored
      // in this call log entry is the same as the one from the modified
      // contact. In that case the contact data that we store is not valid
      // anymore and so we need to remove it from the call log.
      if (!match.length) {
        if (aElement.dataset.contactId == aContact.id) {
          aElement.dataset.contactId = null;
          primaryInfo.textContent = datasetIdentities[0] || _('unknown');
        }
        return;
      }

      // If we found a match, we need to update the call log entry with the
      // updated contact information.
      aElement.dataset.identities = identities;
      aElement.dataset.contactId = aContact.id;
      primaryInfo.textContent = ContactsHelper.prettyPrimaryInfo(aContact);
    } else {
      aElement.dataset.contactId = null;
      primaryInfo.textContent = datasetIdentities[0] || _('unknown');
    }
  }

  /**
   * Updates the whole list of groups or part of it with the appropriate
   * contact information.
   *
   * This function will be triggered after receiving a 'oncontactchange' event
   * with 'create', 'remove' or 'update' reasons or during the initial
   * rendering for each chunk of data *only* if we detect that the contacts
   * cache is not valid.
   *
   * param reason
   *        String containing the reason of the 'oncontactchange' event or
   *        null
   *        if the function was triggered because of an invalid contacts cache
   * param contactInfo
   *        WebContact instance or contact ID
   */
  function _updateListWithContactInfo(reason, contactInfo) {
    var entries = [];
    var query;

    // Remove events can be applied to specific entries matching the affected
    // contact. Create or update events require a full list iteration as there
    // might be records with identities corresponding to the added or updated
    // contacts.
    switch (reason) {
      case 'remove':
        query = 'li[data-contact-id="' + contactInfo + '"]';
        break;
      case 'create':
      case 'update':
        query = 'li';
        break;
      default:
        console.warn('_updateListWithContactInfo with no known reason');
        return;
    }

    entries = document.querySelector('.calllog-sections-container')
                      .querySelectorAll(query);

    Object.keys(entries).forEach(function(index) {
      var entry = entries[index];
      if (reason === 'remove') {
        _updateContactInfo(entry);
        return;
      }
      _updateContactInfo(entry, contactInfo);
    });
  }

  function _manageScroll() {
    var scrollTop = this.scrollTop;
    var scrollHeight = this.scrollHeight;
    var clientHeight = this.clientHeight;
    if (scrollTop + clientHeight > scrollHeight - SCROLL_EDGE) {
      _showChunk(this, ONSCROLL_CHUNK_SIZE);
    }
  }

  function _showChunk(container, numOfElements) {
    var candidatesToShow = container.querySelectorAll('.hidden');
    for (var i = 0, l = candidatesToShow.length; i < l && i < ONSCROLL_CHUNK_SIZE; i++) {
      candidatesToShow[i].classList.remove('hidden');
    }
  }

  function _toggleToolbar(cb) {
    if (typeof cb === 'function') {
      var toggleButton = toolbarFooter.querySelector('.toggle-actions');
      toggleButton.addEventListener('transitionend', function onTranstionEnd() {
        toggleButton.removeEventListener('transitionend', onTranstionEnd);
        cb();
      });
    }
    toolbarFooter.classList.toggle('show');
  }

  function _attachToolbarHandlers() {
    toolbarFooter.querySelector('.toggle-actions').addEventListener('click', (e) => {
      e.stopPropagation();
      _toggleToolbar();
    });

    toolbarFooter.querySelector('.create-room').addEventListener('click', () => {
      _toggleToolbar(Controller.createRoom);
    });

    toolbarFooter.querySelector('.new-conversation').addEventListener('click', () => {
      _toggleToolbar(Controller.startConversation);
    });

    document.addEventListener('visibilitychange', () => {
      document.hidden && toolbarFooter.classList.contains('show') && _toggleToolbar();
    });
  }

  function _renderRoomsFromDB(update) {
    return new Promise((resolve, reject) => {
      RoomsDB.getAll('localCtime', 'DESC').then((cursor) => {
        if (!cursor) {
          return resolve();
        }

        cursor.onsuccess = function onsuccess(event) {
          var item = event.target.result;
          if (!item) {
            return resolve();
          }

          _renderRooms(item, update);
        };

        cursor.onerror = function onerror(event) {
          console.error('Error iterating rooms cursor', error);
          resolve();
        };
      }, (error) => {
        console.error('Error rendering rooms', error);
        resolve();
      });
    }).then(_checkEmptyRooms);
  }

  function _renderCallsFromDB(update) {
    return new Promise((resolve, reject) => {
      ActionLogDB.getCalls(function(error, cursor) {
        if (!error && cursor){
          _renderCalls(cursor, update);
        } else {
          resolve();
        }
      }, {prev: 'prev'});
    }).then(_checkEmptyCalls);
  }

  /*
   * This method implements:
   *
   * 1º step: render both logs
   * 2º step: start timer for updating markup related to time
   * 3º step: verify local cache
   * 4º step: if local cache is invalid we have to update entries in the calllog
   * 5º step: dispatch 'calllog-ready' event once finished
   */
  function _renderLogs() {
    return Promise.all([
      _renderRoomsFromDB(),
      _renderCallsFromDB()
    ]).then(
      _startTimeUpdates
    ).then(() => {
      // It rejects when the cache is invalid.
      return _verifyContactsCache();
    }).then(() => {
      // Invalid cache then updating items in the call log.
      return Promise.all([
        _renderRoomsFromDB(true),
        _renderCallsFromDB(true)
      ]);
    }).then(_dispatchReadyEvent, _dispatchReadyEvent);
  }

  function _dispatchReadyEvent() {
    _ready = true;
    window.dispatchEvent(new CustomEvent('calllog-ready'));
  }

  function _initCalls() {
    if (!_templateNoUrlCalls) {
      _templateNoUrlCalls = Template('calls-without-url-tmpl');
    }

    if (!_templateUrlCalls) {
      _templateUrlCalls = Template('calls-url-tmpl');
    }

    callsSectionEntries.innerHTML = '';

    callsSectionEntries.addEventListener(
      'contextmenu',
      function(event) {
        event.stopPropagation();
        event.preventDefault();

        var callElement = event.target;
        if (callElement.tagName !== 'LI') {
          return;
        }

        _showCallSecondaryMenu(callElement);
      }
    );

    callsSectionEntries.addEventListener(
      'click',
      function(event) {
        var callElement = event.target;
        if (callElement.tagName !== 'LI') {
          return;
        }

        var identities = callElement.dataset.identities.split(',');
        var isVideo = callElement.dataset.isVideo;
        if (callElement.dataset.missedCall) {
          isVideo = Settings.isVideoDefault;
        }
        callTo(identities, callElement.dataset.subject, isVideo);
      }
    );

    callsSection.addEventListener('scroll', _manageScroll);
  }

  function _initRooms() {
    if (!_templateRoom) {
      _templateRoom = Template('rooms-tmpl');
    }
    // TODO Optimize this with the bug
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1036351
    roomsSectionEntries.innerHTML = '';

    roomsSectionEntries.addEventListener(
      'contextmenu',
      function(event) {
        event.stopPropagation();
        event.preventDefault();

        var roomElement = event.target;
        var roomToken = roomElement.dataset.roomToken;

        if (!roomToken) {
          console.error('Longpress: action target is wrong');
          return;
        }

        RoomsDB.get(roomToken).then(_showRoomSecondaryMenu)
      }
    );

    roomsSection.addEventListener('scroll', _manageScroll);

    roomsSectionEntries.addEventListener('click', (event) => {
      var element = event.target;
      var roomToken = element.dataset.roomToken;

      if (!roomToken) {
        console.error('No token in the target');
        return;
      }

      if (element.classList.contains('primary-action')) {
        Controller.joinRoom(roomToken, element.dataset.roomName);
      } else {
        RoomsDB.get(roomToken).then(Controller.showRoomDetails);
      }
    });
  }

  function _getRoomCreationDate(room) {
    return new Date(+room.creationTime * 1000);
  }

  function _getLastActivityDate(room) {
    return new Date(+room.localCtime);
  }

  function _addRoom(room) {
    return RoomsDB.create(room).then((room) => {
      if (Controller.identity === room.roomOwner) {
        Loader.getRoomEvent().then(RoomEvent => {
          RoomEvent.save({type: RoomEvent.type.created,
                          token: room.roomToken,
                          name: room.roomName,
                          date: _getRoomCreationDate(room) });
        });
      }
      _appendRoom(room);
      return room;
    }, (error) => {
      // Sometimes we don't know if the room already exists and we want to
      // update this one. So we can call to this methods and it ensures that the
      // room will be created or updated depending on the case.
      console.log('Storing the room failed. Trying to update the existing one');
      return CallLog.updateRoom(room);
    });
  }

  var CallLog = {
    init: function w_init(identity) {
      callsRenderedIndex = 0;
      roomsRenderedIndex = 0;

      if (_initialized) {
        _changeSection('rooms');
        _renderLogs();
        return;
      }

      _ = navigator.mozL10n.get;
      ActionLogDB.init();
      RoomsDB.init();

      callsSection = document.getElementById('calls-section');
      callsSectionEntries = document.getElementById('calls-section-entries');
      roomsSection = document.getElementById('rooms-section');
      roomsSectionEntries = document.getElementById('rooms-section-entries');
      calllogSectionsContainer =
        document.querySelector('.calllog-sections-container');
      callsTabSelector = document.getElementById('calls-section-filter');
      roomsTabSelector = document.getElementById('rooms-section-filter');
      toolbarFooter = document.getElementById('calllog-actions');

      // Add a listener to the right button
      document.getElementById('open-settings-button').addEventListener(
        'click',
        Settings.show
      );

      _attachToolbarHandlers();

      document.getElementById('calls-section-filter').addEventListener(
        'click',
        function() {
          _changeSection('calls');
        }
      );

      document.getElementById('rooms-section-filter').addEventListener(
        'click',
        function() {
           _changeSection('rooms');
        }
      );

      // Shield against multiple calls
      _initialized = true;

      // Init and render both logs
      _initRooms();
      _initCalls();

      // Show the rooms as initial screen
      _changeSection('rooms');
      _renderLogs();

      navigator.mozContacts.oncontactchange = function(event) {
        window.dispatchEvent(new CustomEvent('oncontactchange', {
          detail: {
            reason: event.reason,
            contactId: event.contactID
          }
        }));
        var reason = event.reason;
        var contactId = event.contactID;
        if (reason == 'remove') {
          _updateListWithContactInfo('remove', contactId);
          return;
        }

        ContactsHelper.find({
          contactId: contactId
        }, function(contactInfo) {
          _updateListWithContactInfo(reason, contactInfo.contacts[0]);
        }, function() {
          console.error('Could not retrieve contact after getting ' +
                        'oncontactchange');
        });
      };

      window.addEventListener('localized', function updateStrings() {
        // We need to update the Strings which are tied to the
        // language selected
        var roomsToUpdate =
          roomsSection.querySelectorAll('li:not([data-shared])');
        var textTranslated = _('dontBeShy');
        for (var i = 0, l = roomsToUpdate.length; i < l; i++) {
          roomsToUpdate[i].querySelector('.secondary-info').textContent =
            textTranslated;
        }
      });
    },

    clean: function() {
      CallLog.onReady().then(() => {
        roomsSectionEntries.innerHTML = '';
        _isRoomsSectionEmpty = true;
        _checkEmptyRooms();
        callsSectionEntries.innerHTML = '';
        _isCallsSectionEmpty = true;
        _checkEmptyCalls();
        _ready = false; // Once cleaned the log is not ready
      });
    },

    cleanCalls: function() {
      _clearCalls();
      _changeSection('calls');
    },

    addCall: function(callObject, contactInfo) {
      ActionLogDB.addCall(function(error, callObject) {
        if (error) {
          console.error('ERROR when storing the call ' + error);
          return;
        }
        _appendCall(callObject);
        _changeSection('calls');
      }, callObject, contactInfo);
    },

    addRoom: function(room) {
      return _addRoom(room);
    },

    removeRooms: function(roomTokens) {
      return _deleteRooms(roomTokens);
    },

    updateRooms: function(rooms) {
      return RoomsDB.update(rooms).then(_rooms => {
        _rooms.forEach(_updateRoom);
      });
    },

    updateRoom: function(room) {
      return this.updateRooms([room]);
    },

    get roomsSectionEmpty() {
      return _isRoomsSectionEmpty;
    },

    get callsSectionEmpty() {
      return _isCallsSectionEmpty;
    },

    onReady: function() {
      if (_ready) {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        window.addEventListener('calllog-ready', function _onReady() {
          window.removeEventListener('calllog-ready', _onReady);
          resolve();
        });
      });
    },

    showRooms: function() {
      _changeSection('rooms');
    }
  };

  exports.CallLog = CallLog;
}(this));
