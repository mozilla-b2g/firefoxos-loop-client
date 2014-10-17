(function(exports) {
  'use strict';

  var debug = Config.debug;

  var wizardHeader, wizardPanel, wizardTutorial, progressBar;
  var wizardWorld, wizardMainPins, wizardPins, wizardDottedLine, wizardLogin;
  var currentStep = 0, stepsLength;
  var viewportWidth;
  // Desplazamiento a aplicar
  var deltaX = 0;
  var referenceDelta = 0;
  // Parar de traquear
  var stopTracking = false;
  var onAnimation = false;

  var promptTimer = null;
  var pinsAnimation = false;

  function _cancelAnimation() {
    onAnimation = false;
    wizardTutorial.classList.remove('swipe');
    wizardTutorial.removeEventListener('transitionend', _cancelAnimation);
  }

  function _enableAnimation() {
    wizardTutorial.addEventListener('transitionend', _cancelAnimation);
    onAnimation = true;
    wizardTutorial.classList.add('swipe');
  }

  function _moveElement() {
    if (stopTracking) {
      debug && console.log('Stop tracking');
      _enableAnimation();

      if (Math.abs(deltaX) > viewportWidth * 0.25) {
        if (deltaX > 0) {
          if (currentStep > 0) {
            currentStep--;
          }
        } else {
          if (currentStep < stepsLength - 1) {
            currentStep++;
          }
        }
      }

      // Update the progress
      _updateProgress();
      // Move to the right position
      var shiftValue = currentStep * -1 * (100/stepsLength);
      wizardTutorial.style.transform = 'translateX(' + shiftValue + '%)';
      return;
    }


    var total = -1 * viewportWidth * currentStep + deltaX;
    wizardTutorial.style.transform = 'translateX(' + total + 'px)';

    window.requestAnimationFrame(_moveElement);
  }


  function _trackGesture(event) {
    // Call preventDefault in the touch handler to avoid redundant mouse events
    event.preventDefault();
    // Update the Delta based on the X direction
    switch(event.type) {
      case 'mousemove':
        deltaX = event.clientX - referenceDelta;
        break;
      case 'touchmove':
        var touches = event.changedTouches;
        deltaX = touches[0].pageX - referenceDelta;
        break;
    }
  }

  function _terminateGesture(event) {
    debug && console.log('touchend || mouseup event');

    // Call preventDefault in the touch handler to avoid redundant mouse events
    event.preventDefault();

    // Stop UI tracking
    stopTracking = true;

    // Remove listeners when we are done!
    // Touch behaviour
    wizardTutorial.removeEventListener('touchmove', _trackGesture);
    wizardTutorial.removeEventListener('touchend', _terminateGesture);
    // Mouse behaviour
    wizardTutorial.removeEventListener('mousemove', _trackGesture);
    wizardTutorial.removeEventListener('mouseup', _terminateGesture);
  }

  function _enableGestures(event) {
    debug && console.log('touchstart || mousedown started');
    debug && console.log('Lets activate the rest of touch/mouse listeners');
    // If a new toch/mouse gesture starts, we abort the animation if needed
    _cancelAnimation();

    // Call preventDefault in the touch handler to avoid redundant mouse events
    event.preventDefault();

    // As part of the tracking, we need to set some values
    stopTracking = false;
    deltaX = 0;
    switch(event.type) {
      case 'mousedown':
        referenceDelta = event.clientX;
        break;
      case 'touchstart':
        // We are not taking into account the ID of the touch.
        var touches = event.changedTouches;
        referenceDelta = touches[0].pageX;
        break;
    }

    debug && console.log('referenceDelta = ' + referenceDelta);

    // Add the rest of listeners now
    // Touch behaviour
    wizardTutorial.addEventListener('touchmove', _trackGesture);
    wizardTutorial.addEventListener('touchend', _terminateGesture);
    wizardTutorial.addEventListener('touchleave', _terminateGesture);

    // Mouse behaviour
    wizardTutorial.addEventListener('mousemove', _trackGesture);
    wizardTutorial.addEventListener('mouseup', _terminateGesture);
    wizardTutorial.addEventListener('mouseleave', _terminateGesture);

    // Request animation frame
    window.requestAnimationFrame(_moveElement);
  }

  function onAnimateEnd(element, callback) {
    element.addEventListener("transitionend", function onTransitionEnded() {
      element.removeEventListener("transitionend", onTransitionEnded);
      if (!pinsAnimation) {
        clearAnimation();
        return;
      }
      if (typeof callback === 'function') {
        callback();
      }
    });
  }

  function clearAnimation() {
    wizardMainPins.classList.remove('animate');
    wizardPins.classList.remove('animate');
    wizardMainPins.classList.remove('move');
    wizardPins.classList.remove('move');
    wizardPanel.classList.remove('overlay');
  }

  function _updateProgress() {
    var currentProgress = progressBar.querySelector('.active');
    if (currentProgress) {
      currentProgress.classList.remove('active');
    }
    progressBar.querySelector('#progress-step-' + currentStep).classList.add('active');

    // Pin animations
    if (currentStep === 1) {
      if (pinsAnimation) {
        clearAnimation();
        pinsAnimation = false;
      }

      if (promptTimer) {
        clearTimeout(promptTimer);
      }
    }
    if (currentStep === 2) {
      pinsAnimation = true;
      onAnimateEnd(wizardWorld, function(){
        onAnimateEnd(wizardMainPins, function() {
          onAnimateEnd(wizardDottedLine, function(){
            wizardMainPins.classList.add('animate');
            wizardPins.classList.add('move');
            onAnimateEnd(wizardPins, function() {
              wizardPins.classList.add('animate');
              promptTimer = setTimeout(function timer() {
                wizardPanel.classList.add('overlay');
                wizardLogin.classList.add('show');
              },1000);
            });
          })
        });
        wizardMainPins.classList.add('move');
      })
    }
    wizardPanel.dataset.step = currentStep;
  }

  var _initialized = false;
  var Tutorial = {
    init: function w_init(onCompleted) {
      if (_initialized) {
        return;
      }
      // Cache the viewport width
      wizardHeader = document.getElementById('wizard-tutorial-header');
      wizardPanel = document.getElementById('wizard-panel');
      wizardTutorial = document.getElementById('wizard-tutorial-slideshow');
      progressBar = document.getElementById('wizard-tutorial-progress');
      wizardWorld = document.getElementById('wizard-world');
      wizardMainPins = document.getElementById('wizard-main-pins');
      wizardPins = document.getElementById('wizard-pins');
      wizardDottedLine = document.getElementById('wizard-dottedline');
      wizardLogin = document.getElementById('wizard-login');

      // Get the steps directly from the HTML
      var tutorialSteps = wizardTutorial.children;
      stepsLength = wizardTutorial.children.length;
      // We read the width from the viewport. We need it for
      // the swipe gesture
      viewportWidth = Math.max(document.body.clientWidth, window.innerWidth || 0);

      debug && console.log('Number of steps in the Tutorial: ' + stepsLength);

      // We stablish the whole width taking into account the steps
      wizardTutorial.style.width = (stepsLength * 100) + '%';
      // And the width per step
      for (var i = 0; i < stepsLength; i++) {
        tutorialSteps[i].style.width = (100/stepsLength) + '%';
        var progressStep = document.createElement('li');
        progressStep.className = 'tutorial-progress-indicator-step';
        progressStep.id = 'progress-step-' + i;
        progressBar.appendChild(progressStep);
      }

      _updateProgress();

      wizardTutorial.addEventListener('touchstart', _enableGestures);
      wizardTutorial.addEventListener('mousedown', _enableGestures);

      _initialized = true;
    }
  };

  exports.Tutorial = Tutorial;
}(this));
