(function(exports) {
  'use strict';

  var _settingsPanel, _closeSettingsButton, _logoutSettingsButton,
      _cleanCallsButton, _cleanUrlsButton, _videoDefaultSettings,
      _commitHashTag, _cameraDefaultSettings, _loggedAs, _vibrateSettings;

  const SETTINGS_ITEM = 'settings';

  const _SETTING_DEFAULTS = {
    video: true,
    frontCamera: true,
    vibrate: true
  };

  var _settingValues = {};

  function _setVisualSettingValues() {
    _videoDefaultSettings.value = _settingValues.video;
    _cameraDefaultSettings.value = _settingValues.frontCamera;
    _vibrateSettings.checked =  _settingValues.vibrate;
  };

  function _settingHandler() {
    // Retrieve current values of the settings
    _settingValues.video =
      _videoDefaultSettings.options[
        _videoDefaultSettings.selectedIndex
      ].value;
    _settingValues.frontCamera =
      _cameraDefaultSettings.options[
        _cameraDefaultSettings.selectedIndex
      ].value;
    _settingValues.vibrate = _vibrateSettings.checked;
    asyncStorage.setItem(SETTINGS_ITEM, _settingValues);
  };

  var _;
  var _identity;
  var Settings = {
    reset: function s_clear() {
      var settingNames = Object.keys(_SETTING_DEFAULTS);
      settingNames.forEach(function(settingName) {
        _settingValues[settingName] = _SETTING_DEFAULTS[settingName];
      });

      if (!navigator.mozCameras &&
          navigator.mozCameras.getListOfCameras().length < 2) {
        _settingValues.frontCamera = false;
      }

      asyncStorage.setItem(SETTINGS_ITEM, _settingValues);
    },

    init: function s_init(identity) {
      _identity = identity;
      if (!_settingsPanel) {
        // Cache mozL10n functionality
        _ = navigator.mozL10n.get;
        // Cache DOM elements
        _loggedAs = document.getElementById('settings-logout-identity');
        _settingsPanel = document.getElementById('settings-panel');
        _closeSettingsButton = document.getElementById('settings-close-button');
        _logoutSettingsButton = document.getElementById('settings-logout-button');
        _cleanCallsButton = document.getElementById('settings-clean-calls-button');
        _cleanUrlsButton = document.getElementById('settings-clean-urls-button');
        _videoDefaultSettings = document.getElementById('video-default-setting');
        _cameraDefaultSettings = document.getElementById('camera-default-setting');
        _commitHashTag = document.getElementById('settings-commit-hash-tag');
        _vibrateSettings = document.getElementById('vibrate-setting');

        // Add listeners just once
        _cleanCallsButton.addEventListener(
          'click',
          function() {
            var options = new OptionMenu({
              section: _('deleteAllConfirmation'),
              type: 'confirm',
              items: [
                {
                  name: 'Cancel',
                  l10nId: 'cancel'
                },
                {
                  name: 'Delete',
                  class: 'danger',
                  l10nId: 'delete',
                  method: function() {
                    CallLog.cleanCalls();
                    Settings.hide();
                  },
                  params: []
                }
              ]
            });
            options.show();
          }.bind(this)
        );

        _cleanUrlsButton.addEventListener(
          'click',
           function() {
            var options = new OptionMenu({
              type: 'action',
              items: [
                {
                  name: 'Clean just revoked URLs',
                  l10nId: 'cleanJustRevoked',
                  method: function() {
                    CallLog.cleanRevokedUrls();
                    Settings.hide();
                  },
                  params: []
                },
                {
                  name: 'Clean all',
                  l10nId: 'cleanAll',
                  method: function() {
                    var doubleConfirmation = new OptionMenu({
                      section: _('deleteAllUrlsConfirmation'),
                      type: 'confirm',
                      items: [
                        {
                          name: 'Cancel',
                          l10nId: 'cancel'
                        },
                        {
                          name: 'Delete',
                          class: 'danger',
                          l10nId: 'delete',
                          method: function() {
                            CallLog.cleanUrls();
                            Settings.hide();
                          },
                          params: []
                        }
                      ]
                    });
                    doubleConfirmation.show();
                  },
                  params: []
                },
                {
                  name: 'Cancel',
                  l10nId: 'cancel'
                }
              ]
            });
            options.show();
          }.bind(this)
        );

        _closeSettingsButton.addEventListener(
          'click',
           this.hide.bind(this)
        );

        _logoutSettingsButton.addEventListener(
          'click',
          function() {
            var options = new OptionMenu({
              section: _('logOutMessage'),
              type: 'confirm',
              items: [
                {
                  name: 'Cancel',
                  l10nId: 'cancel'
                },
                {
                  name: 'Delete',
                  class: 'recommend',
                  l10nId: 'logOut',
                  method: function onLogout() {
                    LoadingOverlay.show(_('loggingOut'));
                    Controller.logout();
                  }.bind(this),
                  params: []
                }
              ]
            });
            options.show();
          }.bind(this)
        );
      }

      this.localize();
      // In this point the code is localized, but we want to listen new change
      // in language in order to update it properly.
      window.addEventListener('localized', this.localize.bind(this));

      // Set the value of the default mode (video/audio)
      // Set settings values.
      // Currently video/audio, camera front/back and vibration mode
      asyncStorage.getItem(
        SETTINGS_ITEM,
        function onSettingRetrieved(settingValues) {
          if (!settingValues) {
            Settings.reset();
          } else {
            _settingValues = settingValues;
          }
          _setVisualSettingValues(settingValues);

          _videoDefaultSettings.addEventListener(
            'change', _settingHandler);
          _vibrateSettings.addEventListener(
            'change', _settingHandler);

          // Set the value of the default camera if needed
          if (!navigator.mozCameras &&
              navigator.mozCameras.getListOfCameras().length < 2) {
            _settingValues.frontCamera = false;
            _cameraDefaultSettings.parentNode.parentNode.style.display = 'none';
          } else {
            _cameraDefaultSettings.addEventListener(
              'change', _settingHandler);
          }
        }
      );
    },

    localize: function s_localize() {
      // Set the value taking into account the identity
      if (_loggedAs) {
        _loggedAs.innerHTML = _(
          'loggedInAs',
          {
            username: _identity || _('unknown')
          }
        );
      }

      // Set the commit based on the version
      if (_commitHashTag && Version.id) {
        _commitHashTag.textContent = Version.id || _('unknown');
      }
    },

    show: function s_show() {
      if (!_settingsPanel) {
        return;
      }
      document.getElementById('settings-container').scrollTop = 0;

      _settingsPanel.classList.add('show');
      Settings.onShown();
    },
    /*
     * This method is performed once settings view is displayed
     */
    onShown: function s_onShown() {
      _cleanCallsButton.disabled = CallLog.callsSectionEmpty;
      _cleanUrlsButton.disabled = CallLog.urlsSectionEmpty;
    },
    hide: function s_hide() {
      if (!_settingsPanel) {
        return;
      }
      _settingsPanel.classList.remove('show');
    },
    get isVideoDefault() {
      return _settingValues.video;
    },
    get isFrontalCamera() {
      return _settingValues.frontCamera;
    },
    get shouldVibrate() {
      return _settingValues.vibrate;
    }
  };

  exports.Settings = Settings;
}(this));
