(function(exports) {
  'use strict';

  var _isOwner = false;
  var _room = null;
  var _token = null;
  var _panel;
  var _ = navigator.mozL10n.get;
  //var _elements = [];
  var _renderedIndex = 0;

  var _backButton, _templateEvent, _eventsSectionEntries;

  const CHUNK_SIZE = 10;
  const ONSCROLL_CHUNK_SIZE = 50;
  const SCROLL_EDGE = 50;

  function _restoreStructure() {
    if (_panel) {
      return;
    }

    _panel = document.getElementById('room-history-panel');
    _backButton = document.getElementById('rhp-back-button');
    _eventsSectionEntries =
        document.getElementById('rhp-events-section-entries');
    _templateEvent = Template('rhp-history-tmpl');
  };

  /**
   * Append element to group based on timestamp
   *
   * @param {HTMLElement} group Group where to place the element
   * @param {HTMLElement} element Element to place
   * @param {HTMLElement} header Header if needed before the element
   */
  function _appendElementToContainer(aGroup, aElement, aHeader) {
    var selector = aElement.tagName;
    var entries = aGroup.querySelectorAll(selector);

    var reference;
    var elemtTimestamp = +aElement.dataset.timestamp;
    for (var i = 0, l = entries.length; i < l; i++) {
      if ( elemtTimestamp > +entries[i].dataset.timestamp) {
        reference = entries[i];
        break;
      }
    }

    if (!reference) {
      aHeader && aGroup.appendChild(aHeader);
      aGroup.appendChild(aElement);
      return;
    }

    var parentNode = reference.parentNode;
    if (aHeader) {
      var headerReference = reference.previousSibling;
      parentNode.insertBefore(aElement, headerReference);
      parentNode.insertBefore(aHeader, aElement);
    } else {
      parentNode.insertBefore(aElement, reference);
    }
  }

  function _getGroup(aDate) {
    var timestamp = new Date (aDate.getFullYear(),
                              aDate.getMonth(),
                              aDate.getDate()).getTime();

    // Is there any container for this date?
    var ul = document.getElementById(timestamp);
    if (ul) {
      return ul;
    }

    // If there is no container, we need to create
    // a new one composed by header & ul
    var header = document.createElement('header');
    header.textContent = Utils.getHeaderDate(aDate.getTime());

    ul = document.createElement('ul');
    ul.id = timestamp;

    if (_renderedIndex > CHUNK_SIZE) {
      header.classList.add('hidden');
    }

    // Append into the right position
    _appendElementToContainer(_eventsSectionEntries, ul, header);

    return ul;
  }

  function _createEventDOM(aEvtItem) {
    return new Promise(function(resolve, reject) {
      var evtElement = document.createElement('li');
      var timestamp = aEvtItem.date.getTime();
      evtElement.id = evtElement.dataset.timestamp = timestamp;

      var params = {};
      Loader.getRoomEvent().then(RoomEvent => {
        RoomEvent.toString(aEvtItem).then(params => {
          evtElement.innerHTML = _templateEvent.interpolate({
            evtString: params.txt,
            evtTime: Utils.getFormattedHour(params.date),
            evtDuration: (params.length !== undefined &&
                          Utils.getDurationPretty(params.length)) || ''
          });
          resolve(evtElement);
        })
      });
    });
  }

  function _renderEvt(aEvtItem) {
    if (!aEvtItem) {
      return;
    }
    var group = _getGroup(aEvtItem.date);
    _createEventDOM(aEvtItem).then(element => {;
      _renderedIndex++;
      if (_renderedIndex > CHUNK_SIZE) {
        element.classList.add('hidden');
      }
      _appendElementToContainer(group, element);
    });
  }

  function _getAll(aToken) {
    var _elements = [];
    return new Promise((resolve, reject) => {
      RoomsDB.getEvents(aToken).then((cursor) => {
        if (!cursor) {
          return resolve();
        }

        cursor.onsuccess = function onsuccess(evt) {
          var item = evt.target.result;
          if (!item) {
            return resolve();
          }
          _elements.push(item.value);
          item.continue();
        };

        cursor.onerror = function onerror(evt) {
          console.error('Error iterating events cursor', error);
          return resolve();
        };
      }, (error) => {
        console.error('Error getEvents', error);
      });
    });
  }

  function _renderInfo(aRoom) {
    if (!aRoom || !aRoom.roomToken) {
      return;
    }

    _eventsSectionEntries.innerHTML = '';

    RoomsDB.getEvents(aRoom.roomToken).then(function(_elements) {
      // We're always goint to have a event (create) at least
      if (_elements && _elements.length > 0) {
        _elements.sort(function(a, b) {
          // We want desc sorting
          return b.date.getTime() - a.date.getTime();
        });
        _elements.forEach(_renderEvt);
      }
    });
  };

  function _onBack(aEvt) {
    _room = null;
    _token = null;

    _removeListeners();

    // Back to the room detail based on the 'deep' navigation model
    Navigation.to('room-detail-panel', 'right');
  };

  function _showChunk(aContainer) {
    var candidatesToShow = aContainer.querySelectorAll('.hidden');
    for (var i = 0, l = candidatesToShow.length;
         i < l && i < ONSCROLL_CHUNK_SIZE;
         i++) {
      candidatesToShow[i].classList.remove('hidden');
    }
  }

  function _manageScroll() {
    var scrollTop = this.scrollTop;
    var scrollHeight = this.scrollHeight;
    var clientHeight = this.clientHeight;
    if (scrollTop + clientHeight > scrollHeight - SCROLL_EDGE) {
      _showChunk(this, ONSCROLL_CHUNK_SIZE);
    }
  }

  function _removeListeners() {
    _backButton.removeEventListener('click', _onBack);
    _eventsSectionEntries.removeEventListener('scroll', _manageScroll);
    window.removeEventListener('localized', _handleLocalization);
  }

  function _addListeners() {
    _backButton.addEventListener('click', _onBack);
    _eventsSectionEntries.addEventListener('scroll', _manageScroll);
    window.addEventListener('localized', _handleLocalization);
  }

  function _handleLocalization() {
    _renderInfo(_room);
  }

  var RoomHistory = {
    show: function(room) {
      _renderedIndex = 0;
      _room = room;
      _token = room.roomToken;

      _restoreStructure();
      _renderInfo(room);

      Navigation.to('room-history-panel', 'left');
      _addListeners();
    }
  };

  exports.RoomHistory = RoomHistory;
})(this);
