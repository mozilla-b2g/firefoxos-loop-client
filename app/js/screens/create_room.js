'use strict';

(function(exports) {

  var modal, roomNameInput, saveButton, closeButton, resetButton, form, counter,
      roomNumber, roomNameByDefault, userInteraction;

  var _ = navigator.mozL10n.get;

  var type = null,
      room = null;

  const CONFIG = {
    expiresIn: 24 * 8 * 7, // 8 weeks
    maxSize: 2,
    maxRoomNamesSize: 100
  };

  const ROOM_NAME_COUNTER_KEY = 'room.name.counter';

  function render() {
    if (modal) {
      return;
    }

    modal = document.getElementById('new-room');
    roomNameInput = modal.querySelector('input');
    saveButton = modal.querySelector('#save-room-action');
    closeButton = modal.querySelector('.icon-close');
    resetButton = modal.querySelector('input + button');
    form = modal.querySelector('form');
    counter = modal.querySelector('.charCounter');
  }

  function init(roomObj) {
    room = roomObj;
    type = modal.dataset.type = isInEditMode() ? 'edit' : 'create';
  }

  function isInEditMode() {
    return room;
  }

  function initRoomName() {
    if (isInEditMode()) {
      roomNameInput.value = room.roomName;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      asyncStorage.getItem(ROOM_NAME_COUNTER_KEY, function onCounter(number) {
        roomNumber = number || 1;
        roomNameByDefault = _('roomNamePlaceHolder', {
          number: roomNumber
        });
        if (roomNameInput) {
          roomNameInput.placeholder = roomNameByDefault;
        }
        resolve();
      });
    });
  }

  function show(cb) {
    modal.classList.remove('hide');
    // We emit this event to center properly the header
    window.dispatchEvent(new CustomEvent('lazyload', {
      detail: modal
    }));
    // Allow UI to be painted before launching the animation
    setTimeout(() => {
      modal.addEventListener('transitionend', function onTransitionEnd() {
        modal.removeEventListener('transitionend', onTransitionEnd);
        typeof cb === 'function' && cb();
      });
      modal.classList.add('show');
    }, 50);
  }

  function hide() {
    modal.addEventListener('transitionend', function onTransitionEnd() {
      modal.removeEventListener('transitionend', onTransitionEnd);
      removeHandlers();
      type = room = null;
      roomNameInput.placeholder = roomNameInput.value = '';
      modal.classList.add('hide');
    });
    modal.classList.remove('show');
  }

  function checkButtons() {
    var name = roomNameInput.value.trim();
    var total = name.length;
    var countdown = counter.dataset.countdown = CONFIG.maxRoomNamesSize - total;
    saveButton.disabled = countdown < 0;
    if (!saveButton.disabled && isInEditMode()) {
      saveButton.disabled = name === room.roomName || name === '';
    }
    var key = countdown < 0 ? 'negativeCharactersCountdown' : 'charactersCountdown';
    counter.textContent = _(key, {
      value: countdown
    });
  }

  function clearRoomName(evt) {
    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }
    roomNameInput.value = '';
    checkButtons();
  }

  function saveFromKeyboard(evt) {
    evt.preventDefault();
    evt.stopPropagation();
    !saveButton.disabled && save();
  }

  function showError(message) {
    LazyLoader.load('js/screens/error_screen.js' , () => {
      ErrorScreen.show(message);
    });
  }

  function newRoom(roomName) {
    roomName = roomName || roomNameInput.value.trim();
    var params = {
      roomName: roomName.length ? roomName : roomNameByDefault,
      expiresIn: CONFIG.expiresIn,
      roomOwner: Controller.identity,
      maxSize: CONFIG.maxSize
    };

    var token;
    return Rooms.create(params).then((response) => {
      token = response.roomToken;
      return Rooms.get(token);
    }).then((room) => {
      room.roomToken = token;
      Controller.onRoomCreated(room, userInteraction);
      (roomName === roomNameByDefault || !roomNameInput.value.trim().length) &&
                   asyncStorage.setItem(ROOM_NAME_COUNTER_KEY, ++roomNumber);
      userInteraction && hide();
      return room;
    }).catch((error) => {
      console.error(JSON.stringify(error));
      if (token) {
        // If we have a room token means the error happened getting the
        // room from the server or saving it in our dababase. Anyway, the room
        // couldn't be created so deleting this empty room recently generated
        // from server behind scene.
        Rooms.delete(token);
      }
      showError(_('savingRoomError'));
    });
  }

  function updateRoom() {
    var name = roomNameInput.value.trim();
    return Rooms.update(room.roomToken, {
      roomName: name,
      expiresIn: CONFIG.expiresIn
    }).then((response) => {
      room.roomName = name;
      room.expiresAt = response.expiresAt;
      Controller.onRoomUpdated(room, true);
      Loader.getRoomEvent().then(RoomEvent => {
        RoomEvent.save({type: RoomEvent.type.renamed,
                        token: room.roomToken,
                        name: name});
      });
      hide();
    }).catch((error) => {
      console.error(JSON.stringify(error));
      showError(_('updatingRoomError'));
    });
  }

  function save() {
    if (!navigator.onLine) {
      LazyLoader.load('js/screens/error_screen.js', () => {
        OfflineScreen.show(_('noConnection'));
      });
      return;
    }

    LoadingOverlay.show(_('saving'));

    var action = isInEditMode() ? updateRoom : newRoom;

    action().then(() => {
      LoadingOverlay.hide();
    });
  }

  function attachHandlers() {
    closeButton.addEventListener('click', hide);
    saveButton.addEventListener('click', save);
    resetButton.addEventListener('touchstart', clearRoomName);
    form.addEventListener('input', checkButtons);
    form.addEventListener('submit', saveFromKeyboard);
  }

  function removeHandlers() {
    closeButton.removeEventListener('click', hide);
    saveButton.removeEventListener('click', save);
    resetButton.removeEventListener('touchstart', clearRoomName);
    form.removeEventListener('input', checkButtons);
    form.removeEventListener('submit', saveFromKeyboard);
  }

  exports.RoomCreate = {
    show: (room) => {
      userInteraction = true;
      render();
      init(room);
      initRoomName().then(() => {
        checkButtons();
        show(() => {
          attachHandlers();
          // Focus the input field to trigger showing the keyboard
          roomNameInput.focus();
          var cursorPos = roomNameInput.value.length;
          roomNameInput.setSelectionRange(cursorPos, cursorPos);
        });
      });
    },

    create: (subject) => {
      userInteraction = false;
      return initRoomName().then(() => {
        return newRoom(subject || roomNameByDefault);
      });
    }
  };;

}(window));
