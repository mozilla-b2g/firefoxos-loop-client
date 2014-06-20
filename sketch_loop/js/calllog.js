(function(exports) {
  'use strict';

  var _initialized = false;
  
  var CallLog = {
    init: function w_init(identity) {
      // Show the section
      document.body.dataset.layout = 'calllog';

      if (_initialized) {
        return;
      }
      // Initialize Settings
      Settings.init(identity);
      // Add a listener to the right button
      document.getElementById('open-settings-button').addEventListener(
        'click',
        Settings.show
      );

      document.getElementById('call-from-loop').addEventListener(
        'click',
        Controller.call
      );

      // Shield against multiple calls
      _initialized = true;
    }

  };

  exports.CallLog = CallLog;
}(this));