(function(exports) {
  'use strict';

  /*
    This code is in charge of loading the basic UI, and then lazy loading the rest
    of elements needed
  */

  var _title, _callStatusInfo, _remoteVideo, _remoteImage;

  var _; // l10n get

  var CallScreenUIMinified = {
    init: function() {

      _ = navigator.mozL10n.get;
      // Cache just the basic elements. The rest will be added by
      // lazy loading.
      _title = document.getElementById('contact-name-details');
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

      // Update the layout of the HTML based on the dataset
      document.body.dataset.callStatus = callParams.layout;

      // Based on the type of the call, we are going to render the maximum
      // info available
      if (callParams.layout === 'incoming') {
        LazyLoader.load(
          ['js/ringer.js'],
          function onRingerLoaded() {
            Ringer.play();
          }
        );
      } else {
        if (callParams.token) {
          _callStatusInfo.textContent = _('retrieving');
        } else {
          _callStatusInfo.textContent = _('calling');
          var identities = callParams.identities.split(',');
          CallScreenUIMinified.updateIdentityInfo(identities);
        }
      }

      // Once all basics are loaded, we are goint to lazy load the rest of functions needed
      // for handling the UI.
      LazyLoader.load(
        [
          '../js/helpers/tone_player_helper.js',
          'js/countdown.js',
          'js/ringer.js',
          'js/call_manager.js',
          'js/call_screen_ui.js'
        ],
        function onCallScreen() {
          CallScreenUI.init(callParams.video && callParams.video === 'true');
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
                 _title.textContent = identities[0];
                return;
              }
              // We don't want to show the whole list of contacts in the call screen
              // so we just take the first one.
              _title.textContent = result.contacts[0].name[0];

              if (result.contacts[0] &&
                  result.contacts[0].photo &&
                  result.contacts[0].photo[0]) {
                var url = URL.createObjectURL(result.contacts[0].photo[0]);
                var urlString = 'url(' + url + ')';
                _remoteVideo.innerHTML = '';
                _remoteVideo.style.backgroundImage = urlString;
                _remoteImage.style.backgroundImage = urlString;
              }
            },
            function onError() {
               _title.textContent = identities[0];
            }
          );
        }
      );
    }
  };

  exports.CallScreenUIMinified = CallScreenUIMinified;

}(this));

CallScreenUIMinified.init();
