(function(exports) {
  'use strict';

  var _initialized = false;
  var _isLogged = false;
  var _currentActivity = null;

  function _handleActivity(activity) {
    // Cache the activity
    _currentActivity = activity;
    // Execute it right now if logged
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
    if (!activityParams || !activityParams.contact) {
      console.error('ERROR: Activity is not sending a Contact object');
      return;
    }

    Controller.call(
      activityParams.contact,
      activityParams.video
    );
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
        'logged',
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
