(function(exports) {
  var _mirrorCurrent, _mirrorFuture;
  var _currentPanelID;
  const _transitions = ['right', 'left', 'top', 'bottom'];

  function _setMainPanel(panel) {
    panel.classList.add('main');
    _currentPanelID = panel.id;
  }

  function _start(from) {
    var fromPanel = document.getElementById(from);
    if (!fromPanel) {
      return Promise.reject(new Error('ERROR Navigation.start: No panel is found given ID'));
    }
    _setMainPanel(fromPanel);
    return Promise.resolve();
  }

  var Navigation = {
    to: function(to, transition) {
      if (!_currentPanelID || _currentPanelID === to) {
        return _start(to);
      }
      return Navigation.go(_currentPanelID, to, transition);
    },
    go: function(from, to, transition) {
      return new Promise(function(resolve, reject) {
        var fromPanel = document.getElementById(from);
        var toPanel = document.getElementById(to);
        if (!fromPanel || !toPanel) {
          reject(new Error('ERROR Navigation.go: No panel is found given ID'));
          return;
        }

        if (!_mirrorCurrent) {
          _mirrorCurrent = document.getElementById('mirror-current');
        }

        if (!_mirrorFuture) {
          _mirrorFuture = document.getElementById('mirror-future');
        }

        if (!_mirrorCurrent || !_mirrorFuture) {
          reject(new Error('ERROR Navigation.go: No mirrors found in HTML'));
          return;
        }
        // Use debug if requested
        document.body.dataset.uidebug = Config.debug;
        
        // Show panels we want to 'mirror'. All panels are hidden in order to
        // improve performance.
        fromPanel.classList.add('show');
        toPanel.classList.add('show');

        // We emit this event to center properly the header
        window.dispatchEvent(new CustomEvent('lazyload', {
          detail: toPanel
        }));

        // Add mirror targets
        _mirrorCurrent.style.background = '-moz-element(#' + from + ')';
        _mirrorFuture.style.background = '-moz-element(#' + to + ')';

        // Add transition effect
        // If transition is not supported or not requested. We will add
        // 'right' as default
        if (!transition || _transitions.indexOf(transition) === -1) {
          transition = _transitions[0];
        }
        document.body.dataset.transition = transition;

        // Add listeners in order to remove the mirror and show the final panel
        _mirrorCurrent.addEventListener('transitionend', function transitionEnded() {
          _mirrorCurrent.removeEventListener('transitionend', transitionEnded);
          // Keep 'to' panel as main one (the one will be shown after the transition)
          fromPanel.classList.remove('main');
          _setMainPanel(toPanel);

          // Clean transition vars
          document.body.classList.remove('animate');
          document.body.dataset.transition = '';

          // Clean mirrors
          _mirrorCurrent.style.background = '';
          _mirrorFuture.style.background = '';

          // Hide panels involved (main will be shown due to 'main' class)
          fromPanel.classList.remove('show');
          toPanel.classList.remove('show');
          
          // Resolve the promise when the transition is done
          resolve();
        });

        // Ensure the panel is shown properly
        setTimeout(function() {
          document.body.classList.add('animate');
        }, 100);
      });
    }
  };

  exports.Navigation = Navigation;

}(this))
