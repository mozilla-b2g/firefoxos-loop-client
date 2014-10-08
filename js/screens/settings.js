(function(exports) {
  'use strict';

  var _settingsPanel, _closeSettingsButton, _logoutSettingsButton,
      _cleanCallsButton, _cleanUrlsButton, _videoDefaultSettings,
      _commitHashTag, _cameraDefaultSettings, _loggedAs;

  var _isVideoDefault = true;
  var _isFrontCameraDefault = true;
  var _isSingleCamera = false;
  const VIDEO_SETTING = 'video-default';
  const CAMERA_SETTING = 'camera-default';

  var _;
  var Settings = {
    get isVideoDefault() {
      return _isVideoDefault;
    },
    reset: function s_clear() {
      asyncStorage.setItem(
        VIDEO_SETTING,
        true
      );
      asyncStorage.setItem(
        CAMERA_SETTING,
        true
      );
      _isVideoDefault = true;
      _isFrontCameraDefault = true;
      _isSingleCamera = false;
    },
    init: function s_init(identity) {
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

      // Set the value taking into account the identity
      _loggedAs.innerHTML = _(
        'loggedInAs',
        {
          username: identity || _('unknown')
        }
      );

      // Set the commit based on the version
      if (_commitHashTag && Version.id) {
        _commitHashTag.textContent = Version.id || _('unknown');
      }

      // Set the value of the default mode (video/audio)
      asyncStorage.getItem(
        VIDEO_SETTING,
        function onSettingRetrieved(isVideoDefault) {
          if (isVideoDefault === null) {
            Settings.reset();
          } else {
            _isVideoDefault = isVideoDefault;
          }
          _videoDefaultSettings.value = _isVideoDefault;
          _videoDefaultSettings.addEventListener(
            'change',
            function() {
              _isVideoDefault = _videoDefaultSettings.options[
                _videoDefaultSettings.selectedIndex
              ].value;
              asyncStorage.setItem(
                VIDEO_SETTING,
                _isVideoDefault
              );
            }
          );
        }
      );

      // Set the value of the default camera if needed
      if (!navigator.mozCameras && navigator.mozCameras.getListOfCameras().length < 2) {
        _isSingleCamera = true;
        _cameraDefaultSettings.parentNode.parentNode.style.display = 'none';
      } else {
        asyncStorage.getItem(
          CAMERA_SETTING,
          function onSettingRetrieved(isFrontCamera) {
            if (isFrontCamera === null) {
              Settings.reset();
            } else {
              _isFrontCameraDefault = isFrontCamera;
            }
            _cameraDefaultSettings.value = _isFrontCameraDefault;
            _cameraDefaultSettings.addEventListener(
              'change',
              function() {
                _isFrontCameraDefault = _cameraDefaultSettings.options[
                  _cameraDefaultSettings.selectedIndex
                ].value;
                asyncStorage.setItem(
                  CAMERA_SETTING,
                  _isFrontCameraDefault
                );
              }
            );
          }
        );
      }
    },
    show: function s_show() {
      if (!_settingsPanel) {
        return;
      }

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
    get isFrontalCamera() {
      return _isSingleCamera ? false : _isFrontCameraDefault;
    }
  };

  exports.Settings = Settings;
}(this));
