(function(exports) {
  'use strict';

  var wizardPanel, wizardLogin;

  var Wizard = {
    init: function w_init(isFirstUse) {

      document.body.dataset.layout = 'wizard';

      wizardPanel = document.getElementById('wizard-panel');
      wizardLogin = document.getElementById('wizard-login');

      Authenticate.init();

      if (!isFirstUse) {
        // Show the right panel
        wizardPanel.dataset.step = 2;
        wizardPanel.classList.add('login');
        wizardLogin.classList.add('show');
        return;
      }

      Tutorial.init();
    }
  };

  exports.Wizard = Wizard;
}(this));
