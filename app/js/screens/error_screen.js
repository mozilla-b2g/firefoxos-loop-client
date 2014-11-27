/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {
  'use strict';

  var _screen;
  var _errorMessage;
  var _okButton;
  var _settingsButton;

  function _attachHandlers() {
    _okButton.addEventListener('click', _hide);
    _settingsButton.addEventListener('click', _onSettingsClicked);
    window.addEventListener('online', _onLine);
  }

  function _removeHandlers() {
    _okButton.removeEventListener('click', _hide);
    _settingsButton.removeEventListener('click', _onSettingsClicked);
    window.removeEventListener('online', _onLine);
  }

  function _onLine() {
    _screen.dataset.type === 'offline' && _hide();
  }

  function _onSettingsClicked(evt) {
    _hide(evt);

    var activity = new window.MozActivity({
      name: 'configure',
      data: {
         target: 'device',
        section: 'root',
        filterBy: 'connectivity'
      }
    });

    activity.onerror = function() {
      console.warn('Configure activity error:', activity.error.name);
    };
  }

  function _init() {
    if (_screen) {
      return;
    }

    _screen = document.getElementById('error-screen');
    _screen.innerHTML = Template.extract(_screen);
    Branding.naming(_screen);
    _errorMessage = document.getElementById('error-message');
    _okButton = document.getElementById('error-screen-ok');
    _settingsButton = document.getElementById('error-screen-settings');
  }

  function _show(screenObj, message) {
    _init();
    _screen.dataset.type = screenObj.type;
    _screen.dataset.unrecoverable = screenObj.unrecoverable;
    _attachHandlers();
    _errorMessage.textContent = message;
    _screen.classList.add('show');
  }

  function _hide(evt) {
    if (_screen.dataset.unrecoverable !== 'true') {
      // We have to avoid the form submission if this is a recoverable error
      evt && evt.preventDefault();
    }

    delete _screen.dataset.type;
    _removeHandlers();
    _screen.classList.remove('show');
  }

  function ErrorScreen() {
    this.type = 'error';
  }

  ErrorScreen.prototype.show = function(message, unrecoverable) {
    this.unrecoverable = !!unrecoverable;
    _show(this, message);
  };

  function OfflineScreen() {
    this.type = 'offline';
    this.unrecoverable = false;
  }

  OfflineScreen.prototype.show = function(message) {
    _show(this, message);
  };

  exports.ErrorScreen = new ErrorScreen();
  exports.OfflineScreen = new OfflineScreen();
}(this));
