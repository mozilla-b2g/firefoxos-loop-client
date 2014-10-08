/* exported LanguageManager */

'use strict';

(function(exports) {

  var LanguageManager = {
    init: function() {
      window.addEventListener('languagechange', () => {
        navigator.mozL10n.language.code = navigator.language;
      });
    }
  };

  exports.LanguageManager = LanguageManager;

}(this));
