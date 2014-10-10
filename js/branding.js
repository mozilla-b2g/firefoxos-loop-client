'use strict';

(function(exports) {
  
  var _name = 'Firefox Hello';

  var Branding = {
    init: function b_init() {
      var elements = document.querySelectorAll('[data-service-name]');
      var length = elements.length;
      for (var i = 0; i < length; i++) {
        elements[i].textContent = _name;
      }
    },

    get name() {
      return _name;
    }
  };

  exports.Branding = Branding;
}(this));
