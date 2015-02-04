'use strict';

(function(global) {

  var MockMozL10n = {
    get: function(key, values) {
      return key + JSON.stringify(values);
    }
  }

  global.navigator.mozL10n = MockMozL10n;

})(this);
