(function(exports) {
  'use strict';

  var _fxaButton;
  var _mobileIdButton;

  function _onButtonClick(id) {
    if (!navigator.onLine) {
      // TODO: localize
      alert('Please check your Internet connection.');
      return;
    }
    Controller.authenticate(id);
    _teardown();
  }

  function _onFxaButtonClick() {
    _onButtonClick('fxa');
  }

  function _onMobileIdButtonClick() {
    _onButtonClick('msisdn');
  }

  function _teardown() {
    _fxaButton.removeEventListener('click', _onFxaButtonClick);
    _mobileIdButton.removeEventListener('click', _onMobileIdButtonClick);
  }

  var Authenticate = {
    init: function a_init() {
      if (!_fxaButton) {
        _fxaButton = document.getElementById('authenticate-fxa-button');
      }

      if (!_mobileIdButton) {
        _mobileIdButton = document.getElementById('authenticate-msisdn-button');
      }

      _fxaButton.addEventListener('click', _onFxaButtonClick);
      _mobileIdButton.addEventListener('click', _onMobileIdButtonClick);
    }
  };

  exports.Authenticate = Authenticate;
}(this));
