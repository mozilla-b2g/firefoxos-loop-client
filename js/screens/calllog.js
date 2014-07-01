(function(exports) {
  'use strict';

  var _initialized = false;
  
  var CallLog = {
    init: function w_init(identity) {
      // Show the section
      document.body.dataset.layout = 'calllog';

      // Initialize Settings
      Settings.init(identity);

      if (_initialized) {
        return;
      }

      // Add a listener to the right button
      document.getElementById('open-settings-button').addEventListener(
        'click',
        Settings.show
      );

      document.getElementById('call-from-loop').addEventListener(
        'click',
        Controller.pickAndCall
      );

      // Shield against multiple calls
      _initialized = true;
    }

  };

  exports.CallLog = CallLog;
}(this));
