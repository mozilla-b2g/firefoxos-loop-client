/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {
  'use strict';

  var _screen;
  var _errorMessage;

  function _init() {
    _screen = document.getElementById('error-screen');
    _errorMessage = document.getElementById('error-message');
    var ok = document.getElementById('error-screen-ok');
    ok.onclick = function() {
      _hide();
    };
  }

  function _show(message) {
    _errorMessage.textContent = message;
    _screen.classList.add('show');
  }

  function _hide() {
    _screen.addEventListener('transitionend', function onTransitionEnd() {
        _screen.removeEventListener('transitionend', onTransitionEnd);
        _screen.classList.remove('show');
    });
    _screen.classList.add('hide');
  }

  function ErrorScreen() {}
  ErrorScreen.prototype = {
    _init: function() {
      this._initialized = true;
      _init();
    },
    show: function(message) {
      if (!this._initialized) {
        this._init();
      }
      _show(message);
    }
  };

  function OfflineScreen() {}
  OfflineScreen.prototype = {
    _init: function() {
      this._initialized = true;
      _init();

      var _ = navigator.mozL10n.get;
      var settings = document.createElement('button');
      settings.textContent = _('checkSettings');
      settings.classList.add('icon');
      settings.classList.add('icon-settings');
      settings.onclick = function() {
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
      };

      var li = document.createElement('li');
      li.appendChild(settings);

      var ul = document.createElement('ul');
      ul.classList.add('skin-dark');
      ul.appendChild(li);

      var section = _screen.querySelector('section');
      section.appendChild(ul);
    },
    show: function(message) {
      if (!this._initialized) {
        this._init();
      }
      _show(message);
    }
  };

  exports.ErrorScreen = new ErrorScreen();
  exports.OfflineScreen = new OfflineScreen();
}(this));
