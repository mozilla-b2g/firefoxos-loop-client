(function(exports) {
  'use strict';

  var _initialized = false;
  var calllogSectionsContainer, callsTabSelector, urlsTabSelector,
      callsSection, urlsSection, callsSectionEntries, urlsSectionEntries;
  

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
              console.log('DATASET ' +  JSON.stringify(dataset));
              value = Utils.getRevokeDate(+dataset.timestamp) || 'Expired';
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
    // TODO Implement in https://bugzilla.mozilla.org/show_bug.cgi?id=1035693
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
    callElement.dataset.timestampIndex = call.date.getTime();

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
    // TODO Implement in https://bugzilla.mozilla.org/show_bug.cgi?id=1035693
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

  function _createUrlDOM(rawUrl) {
    var urlElement = document.createElement('li');
    urlElement.dataset.timestampIndex = rawUrl.date.getTime();

    var datePretty =  Utils.getFormattedHour(rawUrl.date);
    var revokeTimestamp = '' + rawUrl.expiration.getTime();
    var revokeDatePretty = Utils.getRevokeDate(revokeTimestamp);
    var timestamp = '' + rawUrl.date.getTime();
    
    urlElement.innerHTML = _templateUrl.interpolate({
      type: 'url',
      primary: rawUrl.contactPrimaryInfo || rawUrl.identities[0],
      link: rawUrl.url,
      time: datePretty,
      revokeTimestamp: revokeTimestamp,
      expiration: revokeDatePretty || 'Expired'
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
      ActionLogDB.getCalls(_renderCalls);

      // Render urls
      if (!_templateUrl) {
        _templateUrl = Template('url-tmpl');
      }
      // TODO Optimize this with the bug
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1036351
      urlsSectionEntries.innerHTML = '';
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
