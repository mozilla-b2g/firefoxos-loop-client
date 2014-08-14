(function(exports) {
  'use strict';

  var _fxaButton, _mobileIdButton, _wizardLogin;

  function _onButtonClick(id) {
    if (!navigator.onLine) {
      // TODO: localize
      alert('Please check your Internet connection.');
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

      // Add web view handler
      var links = _wizardLogin.querySelectorAll('[data-webview]');
      for (var i = 0, l = links.length; i < l; i++) {
        var title = links[i].dataset.title;
        var url = links[i].dataset.url;

        if (!url || !title) {
          return;
        }

        links[i].addEventListener(
          'click',
          function launchWebview(e) {
            e.preventDefault();
            e.stopPropagation();
            WebviewOverlay.show(title, url);
          }
        );
      }
    }
  };

  exports.Authenticate = Authenticate;
}(this));
