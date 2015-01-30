(function(exports) {
  'use strict';

  /*
    This code is in charge of loading the basic UI, and then lazy loading the rest
    of elements needed
  */

  var _title, _callBarContactName, _callStatusInfo, _remoteVideo, _remoteImage;

  var _; // l10n get

  var CallScreenUIMinified = {
    init: function() {

      _ = navigator.mozL10n.get;
      // Cache just the basic elements. The rest will be added by
      // lazy loading.
      _title = document.getElementById('contact-name-details');
      _callBarContactName = document.querySelector('#call-bar .contact-name');
      _callStatusInfo = document.getElementById('call-status-info');
      _remoteVideo = document.getElementById('remote-video');
      _remoteImage = document.getElementById('fullscreen-image');

      // Get params from URL. For the basic layout we are expecting
      // the type/layout of the call, identities and if it's a video
      // call or not.
      var query = window.location.search.slice(1);
      var urlParams = query.split('&');
      var callParams = {};

      for (var i=0; i < urlParams.length; i++) {
        var keyValue = urlParams[i].split('=');
        callParams[keyValue[0]] = decodeURIComponent(keyValue[1]);
      }

      var _fakeScreenDisabledPanel = document.getElementById('fake-disabled-screen');
      window.addEventListener('userproximity', function onProximityEvent(event) {
        if (event.near) {
          _fakeScreenDisabledPanel.classList.add('on');
        } else {
          _fakeScreenDisabledPanel.classList.remove('on');
        }
      });

      var subject = callParams.subject;
      if (subject && subject.trim().length > 0) {
        document.getElementById('subject').textContent =
          document.querySelector('#call-bar .subject').textContent = subject;
        document.body.dataset.subject = true;
      }

      // Based on the type of the call, we are going to render the maximum
      // info available
      if (callParams.layout === 'incoming') {
        document.body.dataset.callStatus = 'incoming';
        LazyLoader.load(
          ['js/ringer.js'],
          function onRingerLoaded() {
            Ringer.play(callParams.vibrate);
          }
        );
      } else {
        document.body.dataset.callStatus = 'dialing';
        if (callParams.token) {
          _callStatusInfo.textContent = _('retrieving');
        } else {
          _callStatusInfo.textContent = _('dialing');
          var identities = callParams.identities.split(',');
          CallScreenUIMinified.updateIdentityInfo(identities);
        }
      }

      // Once all basics are loaded, we are goint to lazy load the rest of
      // functions needed for handling the UI.
      var files = [
        '../js/helpers/speaker_manager.js',
        '../js/helpers/tone_player_helper.js',
        '../js/helpers/audio_competing_helper.js',
        '../js/helpers/countdown.js',
        '../js/helpers/codec_helper.js',
        'js/ringer.js',
        'js/call_manager.js',
        '../js/branding.js',
        'js/call_screen_ui.js'
      ];

      if (Config.performanceLog.enabled) {
        files.push('../js/helpers/performance_log_helper.js');
      }

      LazyLoader.load(
        files,
        function onCallScreen() {
          CallScreenUI.init(
            callParams.layout && callParams.layout === 'incoming',
            callParams.video && callParams.video === 'true',
            callParams.frontCamera && callParams.frontCamera === 'true'
          );
        }
      );
    },
    updateIdentityInfo: function(identities) {
      LazyLoader.load(
        ['../js/helpers/contacts_helper.js'],
        function onContactHelperLoaded() {
          ContactsHelper.find(
            {
              identities: identities
            },
            function onContact(result) {
              if (!result) {
                 _title.textContent = _callBarContactName.textContent = identities[0];
                return;
              }
              // We don't want to show the whole list of contacts in the call screen
              // so we just take the first one.
              var contact = result.contacts[0];
              _title.textContent = _callBarContactName.textContent =
                                   ContactsHelper.prettyPrimaryInfo(contact);

              if (_remoteImage.style.backgroundImage) {
                // The background image is already painted
                return;
              }

              if (contact && contact.photo && contact.photo[0]) {
                var url = URL.createObjectURL(contact.photo[0]);
                var urlString = 'url(' + url + ')';
                _remoteVideo.innerHTML = '';
                _remoteVideo.style.backgroundImage = urlString;
                _remoteImage.style.backgroundImage = urlString;
                _remoteImage.classList.remove('default');
              } else {
                _remoteImage.classList.add('default');
              }
            },
            function onError() {
               _title.textContent = _callBarContactName.textContent = identities[0];
            }
          );
        }
      );
    }
  };

  exports.CallScreenUIMinified = CallScreenUIMinified;

}(this));

window.addEventListener('localized', CallScreenUIMinified.init);
