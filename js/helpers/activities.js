(function(exports) {
  'use strict';

  const WEBRTC_CALL = 'webrtc-call';
  const LOOP_CALL = 'loop-call';

  var _initialized = false;
  var _isLogged = false;
  var _currentActivity = null;

  function _handleActivity(activity) {
    // Cache the activity
    _currentActivity = activity;

    // If we are already logged, we can execute the activity right away.
    // Otherwise, we need to wait until a valid login is available. At
    // that point we'll handle the cached _currentActivity.
    if (_isLogged) {
      _executeActivity();
      return;
    }
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
        Controller.call(activityParams.contact, activityParams.video);
        break;
      case LOOP_CALL:
        if (!activityParams.token) {
          console.error('Activity is not sending required data');
          return;
        }
        Controller.callUrl(activityParams.token, activityParams.video || true);
        break;
    }
  }

  var Activities = {
    init: function() {
       if (_initialized) {
        return;
      }

      window.navigator.mozSetMessageHandler(
        'activity',
        _handleActivity
      );

      window.addEventListener(
        'onlogin',
        function onLogged() {
          _isLogged = true;
          _executeActivity();
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
