'use strict';

(function(exports) {

  var modal, roomNameInput, saveButton, closeButton, resetButton, form, counter,
      roomNumber;

  var _ = navigator.mozL10n.get;

  const CONFIG = {
    expiresIn: 24,
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
    counter = modal.querySelector('.counter');
  }

  function initRoomName() {
    return new Promise((resolve, reject) => {
      asyncStorage.getItem(ROOM_NAME_COUNTER_KEY, function onCounter(number) {
        number = number || 1;
        roomNameInput.placeholder = _('roomNamePlaceHolder', {
          number: number
        });
        resolve(number);
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
      modal.classList.add('hide');
    });
    modal.classList.remove('show');
  }

  function checkButtons() {
    var total = roomNameInput.value.trim().length;
    var countdown = counter.dataset.countdown = CONFIG.maxRoomNamesSize - total;
    saveButton.disabled = countdown < 0;
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

  function save() {
    if (!navigator.onLine) {
      LazyLoader.load('js/screens/error_screen.js', () => {
        OfflineScreen.show(_('noConnection'));
      });
      return;
    }

    LoadingOverlay.show(_('saving'));

    var roomName = roomNameInput.value.trim();
    var roomNameLength = roomName.length;
    var params = {
      roomName: roomNameLength ? roomName : roomNameInput.placeholder,
      expiresIn: CONFIG.expiresIn,
      roomOwner: Controller.identity,
      maxSize: CONFIG.maxSize
    };

    var token;
    Rooms.create(params).then((response) => {
      token = response.roomToken;
      return Rooms.get(token);
    }).then((room) => {
      room.roomToken = token;
      Controller.onRoomCreated(room);
      !roomNameLength && asyncStorage.setItem(ROOM_NAME_COUNTER_KEY, ++roomNumber);
      hide();
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
    }).then(() => {
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
    show: () => {
      render();
      initRoomName().then((number) => {
        roomNumber = number;
        clearRoomName();
        show(() => {
          attachHandlers();
          // Focus the input field to trigger showing the keyboard
          roomNameInput.focus();
        });
      });
    }
  };;

}(window));
