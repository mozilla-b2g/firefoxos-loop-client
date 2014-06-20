(function(exports) {
  'use strict';

  var Authenticate = {
    init: function a_init(onCompleted) {
      if (typeof onCompleted !== 'function') {
        console.error('onCompleted is not declared in Authenticate');
        return;
      }
      var fxaButton = document.getElementById('authenticate-fxa-button');
      var mobileIDButton = document.getElementById('authenticate-msisdn-button');

      fxaButton.addEventListener(
        'click',
        function onFxaButtonClick() {
          if (!navigator.onLine) {
            alert('Please check your Internet connection.');
            return;
          }
          Controller.isFxaRunning = true;
          navigator.mozId && navigator.mozId.request();
        }
      );

      mobileIDButton.addEventListener(
        'click',
        function onMobileIDButtonClick() {
          navigator.getMobileIdAssertion().then(
            function onLogged(assertion) {
              onCompleted(assertion);
            },
            function onError() {
              alert('Please insert SIM and check your Internet connection.');
            }
          );
        }
      );
    }
  };

  exports.Authenticate = Authenticate;
}(this));