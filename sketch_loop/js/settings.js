(function(exports) {
  'use strict';

  var settingsPanel, closeSettingsButton, logoutSettingsButton;

  var Settings = {
    init: function s_init(identity) {
      document.getElementById('settings-logout-identity').textContent =
        'Logged as ' + identity;

      if (settingsPanel) {
        return;
      }
      settingsPanel = document.getElementById('settings-panel');
      closeSettingsButton = document.getElementById('settings-close-button');
      logoutSettingsButton = document.getElementById('settings-logout-button');

      
      closeSettingsButton.addEventListener(
        'click',
         this.hide.bind(this)
      );

      logoutSettingsButton.addEventListener(
        'click',
        function onLogout() {
          Controller.logout();
          this.hide();
        }.bind(this)
      );

    },
    show: function s_show() {
      settingsPanel.classList.add('show');
    },
    hide: function s_hide() {
      settingsPanel.classList.remove('show');
    }
  };

  exports.Settings = Settings;
}(this));
