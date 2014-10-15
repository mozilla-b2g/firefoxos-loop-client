'use strict';

(function(exports) {
  
  var _name = 'Firefox Hello';

  var mozL10n = navigator.mozL10n;
  var _ = mozL10n.get;

  function getTranslation(id) {
    return _(id, {
      serviceName: _name
    });
  }

  function translate(element) {
    // We have to use innerHTML instead of textContent because of interpreting
    // presentation elements like `<br>`.
    element.innerHTML = getTranslation(element.dataset.brandingServiceName);
  }

  function init() {
    var elements = document.querySelectorAll('[data-branding-service-name]');
    var length = elements.length;
    for (var i = 0; i < length; i++) {
      var element = elements[i];
      if (element.dataset.brandingServiceName) {
        translate(element);
      } else {
        element.textContent = _name;
      }
    }
  }

  var Branding = {
    init: function b_init() {
      mozL10n.readyState === 'complete' ? init() : mozL10n.ready(init);
    },

    get name() {
      return _name;
    },

    getTranslation: getTranslation
  };

  exports.Branding = Branding;
}(this));
