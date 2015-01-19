(function(exports) {
  'use strict';

  var _fxaButton, _mobileIdButton, _wizardLogin, _termsOfService, _privacyNotice,
      _wizardPanel, _gotItButton;

  function _onButtonClick(id) {
    if (!navigator.onLine) {
      LazyLoader.load([
        'js/screens/error_screen.js'
      ], function() {
        var _ = navigator.mozL10n.get;
        OfflineScreen.show(_('noConnection'));
      });
      return;
    }
    Controller.authenticate(id);
  }

  function _onFxaButtonClick() {
    _onButtonClick('fxa');
  }

  function _onMobileIdButtonClick() {
    _onButtonClick('msisdn');
  }

  var Authenticate = {
    init: function a_init() {
      if (_fxaButton) {
        return;
      }
      _fxaButton = document.getElementById('authenticate-fxa-button');
      _mobileIdButton = document.getElementById('authenticate-msisdn-button');
      _wizardLogin = document.getElementById('wizard-login');
      _wizardPanel = document.getElementById('wizard-panel');
      _gotItButton = document.getElementById('got-it-button');

      _fxaButton.addEventListener('click', _onFxaButtonClick);
      _mobileIdButton.addEventListener('click', _onMobileIdButtonClick);
      _gotItButton.addEventListener('click', function() {
        Navigation.to('calllog-panel', 'left').then(Settings.show);
      });

      if (!_termsOfService) {
        _termsOfService = document.getElementById('terms-of-service');
        _termsOfService.addEventListener('click', (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          window.open(Config.tos_url);
        });
      }

      if (!_privacyNotice) {
        _privacyNotice = document.getElementById('privacy-notice');
        _privacyNotice.addEventListener('click', (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          window.open(Config.pn_url);
        });
      }
    },
    show: function() {
      Authenticate.init();
      _wizardPanel.dataset.step = 6;
      _wizardPanel.classList.add('login');
    },
    hide: function() {
      Authenticate.init();
      _wizardPanel.classList.remove('login');
    }
  };

  exports.Authenticate = Authenticate;
}(this));
