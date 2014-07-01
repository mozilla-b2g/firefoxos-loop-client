(function(exports) {
  'use strict';

  var debug = false;

  var wizardTutorial, skipButton, progressBar;
  var currentStep = 0, stepsLength;
  var viewportWidth;
  // Desplazamiento a aplicar
  var deltaX = 0;
  var referenceDelta = 0;
  // Parar de traquear
  var stopTracking = false;
  var onAnimation = false;


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
      _updateProgress()
      // Move to the right position
      var shiftValue = currentStep * -1 * (100/stepsLength);
      wizardTutorial.style.webkitTransform = 'translateX(' + shiftValue + '%)';
      wizardTutorial.style.MozTransform = 'translateX(' + shiftValue + '%)';
      if (currentStep === stepsLength - 1) {
        document.getElementById('skip-tutorial-button').classList.add('visible');
      } else {
        document.getElementById('skip-tutorial-button').classList.remove('visible');
      }
      return;
    }

    var total = -1 * viewportWidth * currentStep + deltaX;
    wizardTutorial.style.webkitTransform = 'translateX(' + total + 'px)';
    wizardTutorial.style.MozTransform = 'translateX(' + total + 'px)';

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

  function _updateProgress() {
    var currentProgress = progressBar.querySelector('.active');
    if (currentProgress) {
      currentProgress.classList.remove('active');
    }
    progressBar.querySelector('#progress-step-' + currentStep).classList.add('active');
  }

  var _initialized = false;
  var Tutorial = {
    init: function w_init(onCompleted) {
      if (_initialized) {
        return;
      }
      // Cache the viewport width
      wizardTutorial = document.getElementById('wizard-tutorial-slideshow');
      skipButton = document.getElementById('skip-tutorial-button');
      progressBar = document.getElementById('wizard-tutorial-progress');
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

      skipButton.addEventListener(
        'click',
        onCompleted || function() {}
      );
      _initialized = true;
    }
  };

  exports.Tutorial = Tutorial;
}(this));
