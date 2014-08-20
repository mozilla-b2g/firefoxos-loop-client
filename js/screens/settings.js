(function(exports) {
  'use strict';

  var _settingsPanel, _closeSettingsButton, _logoutSettingsButton,
      _cleanCallsButton, _cleanUrlsButton, _videoDefaultSettings,
      _commitHashTag;

  var _isVideoDefault = true;
  const VIDEO_SETTING = 'video-default';

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
      _isVideoDefault = true;
    },
    init: function s_init(identity) {
      document.getElementById('settings-logout-identity').innerHTML =
        navigator.mozL10n.get(
          'loggedInAs',
          {
            username: identity || navigator.mozL10n.get('unknown')
          }
        );
      
      if (_settingsPanel) {
        return;
      }
      _ = navigator.mozL10n.get;
      _settingsPanel = document.getElementById('settings-panel');
      _closeSettingsButton = document.getElementById('settings-close-button');
      _logoutSettingsButton = document.getElementById('settings-logout-button');
      _cleanCallsButton = document.getElementById('settings-clean-calls-button');
      _cleanUrlsButton = document.getElementById('settings-clean-urls-button');
      _videoDefaultSettings = document.getElementById('video-default-setting');
      _commitHashTag = document.getElementById('settings-commit-hash-tag');

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

      _cleanCallsButton.addEventListener(
        'click',
        function() {
          var options = new OptionMenu({
            // TODO Change with l10n string when ready
            section: _('deleteAllConfirmation'),
            type: 'confirm',
            items: [
              {
                name: 'Delete',
                l10nId: 'delete',
                method: function() {
                  CallLog.cleanCalls();
                  Settings.hide();
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
                  CallLog.cleanUrls();
                  Settings.hide();
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
        function onLogout() {
          LoadingOverlay.show(_('loggingOut'));
          Controller.logout();
        }.bind(this)
      );

      if (_commitHashTag && Version.id) {
        _commitHashTag.textContent = Version.id || _('unknown');
      }
    },
    show: function s_show() {
      if (!_settingsPanel) {
        return;
      }
      _settingsPanel.classList.add('show');
    },
    hide: function s_hide() {
      if (!_settingsPanel) {
        return;
      }
      _settingsPanel.classList.remove('show');
    }
  };

  exports.Settings = Settings;
}(this));
