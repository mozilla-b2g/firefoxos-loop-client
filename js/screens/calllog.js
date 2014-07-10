(function(exports) {
  'use strict';

  var _initialized = false;
  var calllogSectionsContainer, callsTabSelector, urlsTabSelector,
      callsSection, urlsSection, callsSectionEntries, urlsSectionEntries;
  

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
        name: 'Cancel'
      }
    );
    
    var options = new OptionMenu({
      type: 'action',
      items: items
    });
    options.show();
  }

  function _showUrlSecondaryMenu(element) {
    // Options to show
    var items = [];

    // TODO Add revoke in bug
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1037008
    
    // Delete single item
    items.push(
      {
        name: 'Delete',
        method: function(elementId) {
          _deleteUrls([new Date(+elementId)]);
        },
        params: [element.id]
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
    if (!contactId || !contactId.length) {
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

    // TODO Add revoke if it's a call from an URL in
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1037008

    // Delete single item
    items.push(
      {
        name: 'Delete',
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
          method: function(identities) {
            Controller.callIdentities(identities);
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
        var elementsToUpdate = document.querySelectorAll("[data-need-update]");
        
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
          elementsToUpdate[i].textContent = value || 'Unknown';
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

  function _renderCalls(error, callsCursor) {
    if (!callsCursor) {
      _showEmptyCalls();
      _startTimeUpdates();
      return;
    }

    var rawCall = callsCursor && callsCursor.value;
    // Append to DOM
    _appendCall(rawCall);
    // Go to the next position of the cursor
    callsCursor.continue();
  }

  function _createCallDOM(call) {
    var callElement = document.createElement('li');
    callElement.id = call.date.getTime();
    callElement.dataset.timestampIndex = call.date.getTime();
    callElement.dataset.contactId = call.contactId;
    callElement.dataset.identities = call.identities;


    var datePretty = Utils.getFormattedHour(call.date.getTime());
    var durationPretty = Utils.getDurationPretty(+call.duration);

    var icon;
    if (call.type === 'incoming' && !call.connected) {
      icon = 'missed';
    } else {
      icon = call.type + '-' + (call.video ? 'video':'audio')
    }

    if (!call.url) {
      callElement.innerHTML = _templateNoUrlCalls.interpolate({
        iconName: icon,
        type: call.type,
        primary: call.contactPrimaryInfo || call.identities[0],
        time: datePretty,
        duration: durationPretty
      });
    } else {
      callElement.innerHTML = _templateUrlCalls.interpolate({
        iconName: icon,
        type: call.type,
        primary: call.contactPrimaryInfo || call.identities[0],
        link: call.url,
        time: datePretty,
        duration: durationPretty
      });
    }
    return callElement;
  }
 
  function _appendCall(call) {
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
    // Append to the right position
    _appendElementToContainer(group, element)
  }

  

  /**
   * Set of methods & vars related with the 'Calls' section
   */
  
  var _isUrlsSectionEmpty = true;
  var _templateUrl;

  function _showEmptyUrls() {
    _isUrlsSectionEmpty ?
      urlsSection.classList.add('empty'):urlsSection.classList.remove('empty');
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

  function _deleteUrls(ids) {
    ActionLogDB.deleteUrls(
      function(error) {
        error && console.error('Error when deleting calls from DB ' + error.name);
      },
      ids
    );
    _deleteElementsFromGroup(ids, 'urls');
  }

  function _renderUrls(error, urlsCursor) {
    if (!urlsCursor) {
      _showEmptyUrls();
      return;
    }

    var rawUrl = urlsCursor.value;
    // Append to DOM
    _appendUrl(rawUrl);
    // Go to the next position of the cursor
    urlsCursor.continue();
  }

  function _getExpiration(timestamp, revoked) {
    return revoked ? 'Revoked' : (Utils.getRevokeDate(timestamp) || 'Expired');
  }

  function _createUrlDOM(rawUrl) {
    var urlElement = document.createElement('li');
    urlElement.dataset.timestampIndex = rawUrl.date.getTime();
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

  function _appendUrl(rawUrl) {
    if (_isUrlsSectionEmpty) {
      _isUrlsSectionEmpty = false;
      _showEmptyUrls();
    }

    // Create elements needed
    var group = _getGroup('urls', rawUrl.date);
    var element = _createUrlDOM(rawUrl);
    // Append to the right position
    _appendElementToContainer(group, element)
  }

  var CallLog = {
    init: function w_init(identity) {
      // Show the section
      document.body.dataset.layout = 'calllog';

      // Initialize Settings
      Settings.init(identity);

      if (_initialized) {
        return;
      }

      callsSection = document.getElementById('calls-section');
      callsSectionEntries = document.getElementById('calls-section-entries');
      urlsSection = document.getElementById('urls-section');
      urlsSectionEntries = document.getElementById('urls-section-entries');
      calllogSectionsContainer = document.querySelector('.calllog-sections-container');
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
          Controller.callIdentities(identities);
        }
      )
      ActionLogDB.getCalls(_renderCalls);

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
      ActionLogDB.getUrls(_renderUrls);

      // Show the calls as initial screen
      _changeSection('calls');
    },
    cleanCalls: function() {
      _clearCalls();
      _changeSection('calls');
    },
    cleanUrls: function() {
      _clearUrls();
      _changeSection('urls');
    },
    addCall: function(callObject) {
      ActionLogDB.addCall(function(error) {
        error && console.error('ERROR when storing the call ' + error);
      }, callObject);
      _appendCall(callObject);
      _changeSection('calls');
    },
    addUrl: function(urlObject) {
      ActionLogDB.addUrl(function(error) {
        error && console.log('ERROR when storing the URL ' + error);
      }, urlObject);
      _appendUrl(urlObject);
      _changeSection('urls');
    }
  };

  exports.CallLog = CallLog;
}(this));
