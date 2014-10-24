(function(exports) {
  'use strict';

  var wizardPanel, wizardLogin;

  var _ = navigator.mozL10n.get;

  function localize() {
    document.getElementById('termsOfService').innerHTML = _('termsOfService');
  }

  window.addEventListener('localized', localize);

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
    },

    localize: function w_localize() {
      if (navigator.mozL10n.readyState === 'complete') {
        localize();
      } else {
        navigator.mozL10n.ready(localize);
      }
    }
  };

  exports.Wizard = Wizard;
}(this));

Wizard.localize();
