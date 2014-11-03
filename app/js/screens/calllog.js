(function(exports) {
  'use strict';

  var _initialized = false;
  var calllogSectionsContainer, callsTabSelector, urlsTabSelector,
      callsSection, urlsSection, callsSectionEntries, urlsSectionEntries;
  var _contactsCache = false;
  var _renderingCalls = false;
  var _renderingUrls = false;
  var _invalidatingCache = false;

  var _; // l10n get

  // Variables needed to track infinite scrolling
  const CHUNK_SIZE = 10;
  const ONSCROLL_CHUNK_SIZE = 50;
  const SCROLL_EDGE = 50;

  var callsRenderedIndex = 0;
  var urlsRenderedIndex = 0;

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

  function _showUrlSecondaryMenu(element) {
    // Options to show
    var items = [];

    var revokeElement = element.querySelector('[data-revoked]');
    if (revokeElement && revokeElement.dataset.revoked === 'false') {
      // Revoke single item
      items.push(
        {
          name: 'Revoke',
          l10nId: 'revoke',
          method: function(element) {
            var token = element.dataset.urlToken;
            Controller.revokeUrl(token, function onRevoked() {
              ActionLogDB.revokeUrl(function(error) {
                if (error) {
                  console.error('Error revoking an URL from DB ' + error.name);
                  return;
                }

                var revokedElement = element.querySelector('[data-revoked]');
                revokedElement.dataset.revoked = true;
                revokedElement.textContent = _('revoked');
              }, token);
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
        method: function(element) {
          var tmp = element.querySelector('[data-revoked]');
          var isRevoked = tmp.dataset.revoked === 'true';

          function deleteElement() {
            _deleteUrls([new Date(+element.id)]);
          }

          if (isRevoked) {
            deleteElement();
            return;
          }
          var options = new OptionMenu({
            section: _('deleteConfirmation'),
            type: 'confirm',
            items: [
              {
                name: 'Cancel',
                l10nId: 'cancel'
              },
              {
                name: 'Delete',
                class: 'danger',
                l10nId: 'delete',
                method: function() {
                  deleteElement();
                },
                params: []
              }
            ]
          });
        },
        params: [element]
      }
    );

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
            Controller.callIdentities(identities, null, isVideo);
            Telemetry.recordCallFromCallLog();
          },
          params: [identities]
        }
      );
    }

    _showSecondaryMenu(items);
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
          var value;
          switch(dataset.formatDate) {
            case 'header':
              value = Utils.getHeaderDate(+dataset.timestamp);
              break;
            case 'revoke':
              value = _getExpiration(+dataset.timestamp, dataset.revoked === 'true');
              break;
          }
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
    urlsTabSelector.setAttribute('aria-selected',
          section === 'urls' ? 'true' : 'false');
    // Calculate the translation needed
    var translation = 0;
    switch(section) {
      case 'urls':
        translation = '-50%';
        break;
      case 'calls':
        translation = '0';
        break;
    }
    // Move the panel in order to show the right section
    calllogSectionsContainer.style.transform = 'translateX(' + translation + ')';
  }


  function _deleteElementsFromGroup(ids, type) {
    var sectionEntries, cleanSection;
    if (type === 'calls') {
      sectionEntries = callsSectionEntries;
      cleanSection = function() {
        _isCallsSectionEmpty = true;
        _showEmptyCalls();
      }
    } else {
      sectionEntries = urlsSectionEntries;
      cleanSection = function() {
        _isUrlsSectionEmpty = true;
        _showEmptyUrls();
      }
    }

    // TODO Implement in https://bugzilla.mozilla.org/show_bug.cgi?id=1035693
    for (var i = 0, l = ids.length; i < l; i++) {
      // ID is the timestamp given a date
      var elementToDelete = document.getElementById(ids[i].getTime());
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
    var container = type === 'calls' ? callsSectionEntries : urlsSectionEntries;
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

  function _showEmptyCalls() {
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
    _showEmptyCalls();
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

  function _renderCalls(error, callsCursor, update) {
    if (!callsCursor) {
      _showEmptyCalls();
      _startTimeUpdates();
      _renderingCalls = false;
      _verifyContactsCache();
      return;
    }

    _renderingCalls = true;

    var rawCall = callsCursor && callsCursor.value;
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
        duration: durationPretty
      });
    } else {
      callElement.innerHTML = _templateUrlCalls.interpolate({
        iconName: icon,
        type: call.type,
        primary: call.contactPrimaryInfo || call.identities[0] || _('unknown'),
        link: call.revoked ? _('revoked') : call.url,
        time: datePretty,
        duration: durationPretty
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
      _showEmptyCalls();
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
      _showEmptyCalls();
      _startTimeUpdates();
    }

    var query = 'li[id="' + call.date.getTime() + '"]';
    var element = callsSectionEntries.querySelector(query);
    _createCallDOM(call, element);
  }

  /**
   * Set of methods & vars related with the 'Calls' section
   */

  var _isUrlsSectionEmpty = true;
  var _templateUrl;

  function _showEmptyUrls() {
    _isUrlsSectionEmpty ? urlsSection.classList.add('empty') :
                          urlsSection.classList.remove('empty');
  }

  function _clearUrls() {
    // Delete all entries in call section
    ActionLogDB.deleteUrls(function(error) {
      error && console.error('ERROR when clearing urls db ' + error);
    });
    // Show 'empty' panel
    urlsSectionEntries.innerHTML = '';
    _isUrlsSectionEmpty = true;
    _showEmptyUrls();
  }

  function _clearRevokedUrls() {
    // Get elements to be deleted
    var revokedUrls = urlsSection.querySelectorAll('[data-revoked="true"]');
    // For deleting nodes we are going to use the ID (timestamp)
    var ids = [];
    for (var i = 0, l = revokedUrls.length; i < l; i++) {
      var id = revokedUrls[i].parentNode.parentNode.id;
      ids.push(new Date(+id));
    }
    // Delete just the revoked URLs
    _deleteUrls(ids);
  }

  function _deleteUrls(ids) {
    ActionLogDB.deleteUrls(
      function(error) {
        console.error('Error when deleting calls from DB ' +
                      error.name || error || 'Unknown');
      },
      ids
    );
    _deleteElementsFromGroup(ids, 'urls');
  }

  function _renderUrls(error, urlsCursor, update) {
    if (!urlsCursor) {
      _showEmptyUrls();
      _renderingUrls = false;
      _verifyContactsCache();
      return;
    }

    _renderingUrls = true;

    var rawUrl = urlsCursor.value;
    if (update) {
      _updateUrl(rawUrl);
    } else {
      // Append to DOM
      _appendUrl(rawUrl, true /* isFirstPaint */);
    }
    // Go to the next position of the cursor
    urlsCursor.continue();
  }

  function _getExpiration(timestamp, revoked) {
    return revoked ? _('revoked') : Utils.getRevokeDate(timestamp);
  }

  function _createUrlDOM(rawUrl) {
    var urlElement = document.createElement('li');
    urlElement.dataset.timestampIndex = rawUrl.date.getTime();
    urlElement.dataset.urlToken = rawUrl.urlToken;
    urlElement.dataset.contactId = rawUrl.contactId;
    urlElement.dataset.identities = rawUrl.identities;
    urlElement.id = rawUrl.date.getTime();

    var datePretty =  Utils.getFormattedHour(rawUrl.date);
    var revokeTimestamp = rawUrl.expiration.getTime();
    var timestamp = '' + rawUrl.date.getTime();
    var revoked = rawUrl.revoked;
    urlElement.innerHTML = _templateUrl.interpolate({
      type: 'url',
      primary: rawUrl.contactPrimaryInfo || rawUrl.identities[0],
      link: rawUrl.url,
      time: datePretty,
      revoked: '' + revoked,
      revokeTimestamp: '' + revokeTimestamp,
      expiration: _getExpiration(revokeTimestamp, revoked)
    });

    return urlElement;
  }

  function _appendUrl(rawUrl, isFirstPaint) {
    if (!rawUrl) {
      return;
    }

    if (_isUrlsSectionEmpty) {
      _isUrlsSectionEmpty = false;
      _showEmptyUrls();
    }

    // Create elements needed
    var group = _getGroup('urls', rawUrl.date);
    var element = _createUrlDOM(rawUrl);
    urlsRenderedIndex++;
    if (isFirstPaint && urlsRenderedIndex > CHUNK_SIZE) {
      element.classList.add('hidden');
    }
    // Append to the right position
    _appendElementToContainer(group, element)
  }

  function _updateUrl(url) {
    if (!url) {
      return;
    }

    if (_isUrlsSectionEmpty) {
      _isUrlsSectionEmpty = false;
      _showEmptyUrls();
    }

    var query = 'li[id="' + call.date.getTime() + '"]';
    var element = urlsSectionEntries.querySelector(query);
    _createUrlDOM(url, element);
  }

  /*****************************
   * Contacts related methods.
   *****************************/
  function _verifyContactsCache() {
    // We don't want to verify and potentially rebuild the contacts cache
    // if we are still rendering the screen as it may lead to unexpected
    // behaviors.
    if (_renderingCalls || _renderingUrls || _invalidatingCache) {
      return;
    }

    _invalidatingCache = true;

    // Get the latest contacts cache revision and the actual Contacts API
    // db revision. If both values differ, we need to update the contact
    // cache and its revision and directly query the Contacts API to render
    // the appropriate information while the cache is being rebuilt.
    window.asyncStorage.getItem('contactsCacheRevision',
                                function onItem(cacheRevision) {
      navigator.mozContacts.getRevision()
            .onsuccess = function(event) {
        var contactsRevision = event.target.result;
        // We don't need to sync if this is the first time that we use the
        // action log.
        if (!cacheRevision || cacheRevision > contactsRevision) {
          window.asyncStorage.setItem('contactsCacheRevision',
                                      contactsRevision);
          return;
        }

        var cacheIsValid = _contactsCache = (cacheRevision >= contactsRevision);
        if (cacheIsValid) {
          _invalidatingCache = false;
          return;
        }

        ActionLogDB.invalidateContactsCache(function(error) {
          _invalidatingCache = false;
          if (error) {
            console.error('Could not invalidate contacts cache ' + error);
            return;
          }
          _contactsCache = true;
          ActionLogDB.getCalls(function(error, cursor) {
            _renderCalls(error, cursor, true /* update */);
          }, {prev: 'prev'});
          ActionLogDB.getUrls(function(error, cursor) {
            _renderUrls(error, cursor, true /* update */);
          }, {prev: 'prev'});
        });
      };
    });
  }

  function _updateContactInfo(aElement, aContact) {
    // '.primary-info > p' -> Calls in call log | '.primary-info' -> Shared URLs
    var primaryInfo = aElement.querySelector('.primary-info > p') || 
                      aElement.querySelector('.primary-info');

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

      var datasetIdentities = aElement.dataset.identities.split(',');

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
          primaryInfo.textContent = aElement.dataset.identities || _('unknown');
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
      primaryInfo.textContent = aElement.dataset.identities || _('unknown');
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
    var updateEntry;

    // Remove events can be applied to specific entries matching the affected
    // contact. Create or update events require a full list iteration as there
    // might be records with identities corresponding to the added or updated
    // contacts.
    switch (reason) {
      case 'remove':
        query = 'li[data-contact-id="' + contactInfo + '"]';
        updateEntry = _updateContactInfo;
        break;
      case 'create':
        query = 'li';
        updateEntry = function(entry) {
          _updateContactInfo(entry, contactInfo);
        }
        break;
      case 'update':
        query = 'li';
        updateEntry = _updateContactInfoCheckingMatching;
        break;
      default:
        console.warn('_updateListWithContactInfo with no known reason');
        return;
    }

    entries = document.querySelector('.calllog-sections-container')
                      .querySelectorAll(query);

    Object.keys(entries).forEach(function(index) {
      updateEntry(entries[index]);
    });
  }

  function _updateContactInfoCheckingMatching(entry) {
    ContactsHelper.find({
      identities: entry.dataset.identities
    }, function(contactInfo) {
      _updateContactInfo(entry, contactInfo.contacts[0]);
    }, _updateContactInfo.bind(null, entry));
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

  var CallLog = {
    init: function w_init(identity) {
      // Show the section
      document.body.dataset.layout = 'calllog';

      if (_initialized) {
        return;
      }

      _ = navigator.mozL10n.get;
      ActionLogDB.init();

      callsSection = document.getElementById('calls-section');
      callsSectionEntries = document.getElementById('calls-section-entries');
      urlsSection = document.getElementById('urls-section');
      urlsSectionEntries = document.getElementById('urls-section-entries');
      calllogSectionsContainer =
        document.querySelector('.calllog-sections-container');
      callsTabSelector = document.getElementById('calls-section-filter');
      urlsTabSelector = document.getElementById('urls-section-filter');

      // Add a listener to the right button
      document.getElementById('open-settings-button').addEventListener(
        'click',
        Settings.show
      );

      document.getElementById('call-from-loop').addEventListener(
        'click',
        Controller.pickAndCall
      );

      document.getElementById('calls-section-filter').addEventListener(
        'click',
        function() {
          _changeSection('calls');
        }
      );

      document.getElementById('urls-section-filter').addEventListener(
        'click',
        function() {
           _changeSection('urls');
        }
      );

      // Shield against multiple calls
      _initialized = true;

      // Render calls
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
          Controller.callIdentities(identities, null, isVideo);
          Telemetry.recordCallFromCallLog();
        }
      )

      ActionLogDB.getCalls(_renderCalls, {prev: 'prev'});

      callsSection.addEventListener('scroll', _manageScroll);
      urlsSection.addEventListener('scroll', _manageScroll);

      // Render urls
      if (!_templateUrl) {
        _templateUrl = Template('url-tmpl');
      }
      // TODO Optimize this with the bug
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1036351
      urlsSectionEntries.innerHTML = '';
      urlsSectionEntries.addEventListener(
        'contextmenu',
        function(event) {
          event.stopPropagation();
          event.preventDefault();

          var urlElement = event.target;
          if (urlElement.tagName !== 'LI') {
            return;
          }

          _showUrlSecondaryMenu(urlElement);
        }
      );

      ActionLogDB.getUrls(_renderUrls, {prev: 'prev'});

      // Show the calls as initial screen
      _changeSection('calls');


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
    },

    cleanCalls: function() {
      _clearCalls();
      _changeSection('calls');
    },

    cleanUrls: function() {
      _clearUrls();
      _changeSection('urls');
    },

    cleanRevokedUrls: function() {
      _clearRevokedUrls();
      _changeSection('urls');
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

    addUrl: function(urlObject, contactInfo) {
      ActionLogDB.addUrl(function(error, urlObject) {
        if (error) {
          console.error('ERROR when storing the URL ' + error);
        }
        _appendUrl(urlObject);
        _changeSection('urls');
      }, urlObject, contactInfo);
    },
    clean: function() {
      _clearCalls();
      _clearUrls();
    },

    get urlsSectionEmpty() {
      return _isUrlsSectionEmpty;
    },

    get callsSectionEmpty() {
      return _isCallsSectionEmpty;
    }
  };

  exports.CallLog = CallLog;
}(this));
