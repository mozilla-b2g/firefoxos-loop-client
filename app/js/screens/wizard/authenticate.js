(function(exports) {
  'use strict';

  var _fxaButton, _mobileIdButton, _wizardLogin, _termsOfService;

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
      if (!_fxaButton) {
        _fxaButton = document.getElementById('authenticate-fxa-button');
      }

      if (!_mobileIdButton) {
        _mobileIdButton = document.getElementById('authenticate-msisdn-button');
      }

      if (!_wizardLogin) {
        _wizardLogin = document.getElementById('wizard-login');
      }

      _fxaButton.addEventListener('click', _onFxaButtonClick);
      _mobileIdButton.addEventListener('click', _onMobileIdButtonClick);

      if (!_termsOfService) {
        _termsOfService = document.getElementById('terms-of-service');
        _termsOfService.addEventListener('click', (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          window.open(Config.tos_url);
        });
      }
    }
  };

  exports.Authenticate = Authenticate;
}(this));
