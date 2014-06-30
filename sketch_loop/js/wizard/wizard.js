(function(exports) {
  'use strict';

  function _showSection(section) {
    if (!section || !section.length || section.length === 0) {
      return;
    }
    var selector = '';
    switch(section) {
      case 'gum':
        selector = '#wizard-gum-section';
        break;
      case 'tutorial':
        selector = '#wizard-tutorial-section';
        break;
      case 'authenticate':
        selector = '#wizard-authenticate-section';
        break;
    }

    var currentScreen = document.querySelector('.wizard-section.current');
    if (currentScreen) {
      currentScreen.classList.remove('current');
    }
    var nextScreen = document.querySelector(selector);
    nextScreen.classList.add('current');
  }

  var Wizard = {
    init: function w_init(isFirstUse) {
      // Show the section
      document.body.dataset.layout = 'wizard';

      function showAuthenticate() {
        // If tutorial is done, let's authenticate!
        Authenticate.init();

        // Show the right panel
        _showSection('authenticate');
      }

      if (!isFirstUse) {
        showAuthenticate();
        return;
      }

      // Init tutorial
      Tutorial.init(function onTutorialCompleted() {
        // Init GUM Section after the Tutorial
        Gum.init(function onGumCompleted() {
          // If tutorial & gUM are done, let's authenticate!
          showAuthenticate();
        });
        _showSection('gum');
      });
      // Show Tutorial Section
      _showSection('tutorial');
    }
  };

  exports.Wizard = Wizard;
}(this));
