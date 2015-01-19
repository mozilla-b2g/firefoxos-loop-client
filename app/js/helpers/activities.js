(function(exports) {
  'use strict';

  var debug = Config.debug;

  const WEBRTC_CALL = 'webrtc-call';
  const LOOP_CALL = 'loop-call';
  const ROOM_CALL = 'room-call';

  var _initialized = false;
  var _isLogged = false;
  var _currentActivity = null;

  var _optionLog = null;

  function _showOptionMenu() {
    _optionLog = new OptionMenu({
      section:  Branding.getTranslation('notLoggedIn'),
      type: 'confirm',
      items: [
        {
          name: 'Cancel',
          l10nId: 'cancel',
          method: function onCancel() {
            window.close();
          },
          params: []
        },
        {
          name: 'logIn',
          l10nId:'logIn',
          class: 'recommend',
          method: function onLogIn() {
            _optionLog.hide();
            _optionLog = null;
          }
        }
      ]
    });
  }

  function _handleActivity(activity) {
    // Cache the activity
    _currentActivity = activity;

    // If we are already logged, we can execute the activity right away.
    // Otherwise, we need to show a message and wait until a valid login is
    // available. At that point we'll handle the cached _currentActivity.
    if (_isLogged) {
      _executeActivity();
    } else {
      _showOptionMenu();
    }
    return;
  }

  function _executeActivity() {
    if (!_currentActivity) {
      return;
    }

    var activityParams = _currentActivity.source.data;
    var activityName = _currentActivity.source.name;

    if (!activityParams) {
      console.error('Activity is not sending required data');
      return;
    }

    switch (activityName) {
      case WEBRTC_CALL:
        if (!activityParams.contact) {
          console.error('Activity is not sending required data');
          return;
        }
        Controller.callContact({
          contact: activityParams.contact,
          isVideoCall: activityParams.video,
          subject: activityParams.subject
        }, () => {
          Telemetry.updateReport('callsFromContactDetails');
        });
        break;
      case LOOP_CALL:
        if (!activityParams.token) {
          console.error('Activity is not sending required data');
          return;
        }
        Controller.callUrl({
          token: activityParams.token,
          isVideoCall: activityParams.video != false,
          subject: activityParams.subject
        }, () => {
          Telemetry.updateReport('callsFromUrl');
        });
        break;
      case ROOM_CALL:
        if (!activityParams.token) {
          console.error('Activity is not sending required data');
          return;
        }
        Controller.joinRoom(activityParams.token);
        // TODO: Perhaps some Telemetry here
        break;
    }
  }

  var Activities = {
    init: function() {
       if (_initialized) {
        return;
      }

      // This must be called only when we're logged in, so it's safe to
      // assume _isLogged to be true here
      _isLogged = true;

      window.navigator.mozSetMessageHandler(
        'activity',
        _handleActivity
      );

      window.addEventListener(
        'onlogin',
        function onLogged() {
          _isLogged = true;
          if (_optionLog !== null) {
            _optionLog.hide();
            _optionLog = null;
          }
          _executeActivity();
        }
      );

      window.addEventListener(
        'onlogout',
        function onLogout() {
          _isLogged = false;
        }
      );

      _initialized = true;
    },
    clear: function() {
      _currentActivity = null;
    }
  };

  exports.Activities = Activities;
})(window);
