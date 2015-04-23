'use strict';

(function(exports) {

  var _name = 'Firefox Hello';

  var _htmlName = '';
  _name.split(' ').forEach(function(str) {
    _htmlName = _htmlName + '<span>' + str + ' </span>'
  });

  function getName(asHTMLMarkup) {
    return asHTMLMarkup ? _htmlName : _name;
  }

  var mozL10n = navigator.mozL10n;
  var _ = mozL10n.get;

  function getTranslation(id, params) {
    params = params || {};
    params.serviceName = getName(params.asHTMLMarkup);
    return _(id, params);
  }

  function translate(element) {
    // We have to use innerHTML instead of textContent because of interpreting
    // presentation elements like `<br>`.
    element.innerHTML = getTranslation(element.dataset.brandingServiceName,
                   {asHTMLMarkup : 'brandingHtmlMarkup' in element.dataset});
  }

  function naming(container) {
    container = container || document;
    var elements = container.querySelectorAll('[data-branding-service-name]');
    var length = elements.length;
    for (var i = 0; i < length; i++) {
      var element = elements[i];
      if (element.dataset.brandingServiceName) {
        translate(element);
      } else {
        element.innerHTML = getName('brandingHtmlMarkup' in element.dataset);
      }
    }
  }

  var Branding = {
    naming: function b_naming(container) {
      mozL10n.readyState === 'complete' ? naming(container) :
                                    mozL10n.ready(naming.bind(null, container));
    },

    get name() {
      return _name;
    },

    getTranslation: getTranslation
  };

  exports.Branding = Branding;
}(this));
