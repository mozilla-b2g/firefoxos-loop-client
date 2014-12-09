'use strict';

(function(exports) {

  var modal, subjectInput, closeButton, resetButton, callButton, counter, form,
      frontCamera, rearCamera, cameraOptions, cameraContainer;

  var callAction, dismissAction;

  var _ = navigator.mozL10n.get;

  const CONFIG = {
    maxSubjectSize: 124
  };

  function render() {
    if (modal) {
      return;
    }

    modal = document.getElementById('conversation-detail');
    subjectInput = modal.querySelector('input');
    subjectInput.placeholder = _('subjectPlaceHolder');
    closeButton = modal.querySelector('.icon-close');
    callButton = modal.querySelector('.call');
    resetButton = modal.querySelector('input + button');
    rearCamera = modal.querySelector('input[value="camera-back"]');
    frontCamera = modal.querySelector('input[value="camera-front"]');
    cameraOptions = [rearCamera, frontCamera];
    cameraContainer = modal.querySelector('.camera-container');
    counter = modal.querySelector('.counter');
    form = modal.querySelector('form');
  }

  function initCameraByDefault() {
    var camera = Settings.isFrontalCamera !== 'false' ? frontCamera : rearCamera;
    camera.checked = true;
    onCameraChange(camera);
  }

  function onCameraChange(evt) {
    var element = evt.target || evt;
    cameraContainer.dataset.camera = element.value;
  }

  function show(cb) {
    modal.classList.remove('hide');
    // We emit this event to center properly the header
    window.dispatchEvent(new CustomEvent('lazyload', {
      detail: modal
    }));
    // Allow UI to be painted before launching the animation
    setTimeout(() => {
      modal.addEventListener('transitionend', function onTransitionEnd() {
        modal.removeEventListener('transitionend', onTransitionEnd);
        cb();
      });
      modal.classList.add('show');
    }, 50);
  }

  function hide() {
    modal.addEventListener('transitionend', function onTransitionEnd() {
      modal.removeEventListener('transitionend', onTransitionEnd);
      removeHandlers();
      clearSubject();
      modal.classList.add('hide');
    });
    modal.classList.remove('show');
  }

  function onClose() {
    dismissAction();
    hide();
  }

  function onCall() {
    callAction({
      subject: subjectInput.value.trim(),
      isFrontCamera: frontCamera.checked
    });
    hide();
  }

  function preventDefault(evt) {
    if (!evt) {
      return;
    }

    evt.stopPropagation();
    evt.preventDefault();
  }

  function clearSubject(evt) {
    preventDefault(evt);
    subjectInput.value = '';
    calculateCounter();
  }

  function calculateCounter() {
    var subject = subjectInput.value.trim();
    var countdown = counter.dataset.countdown = CONFIG.maxSubjectSize - subject.length;
    var key = countdown < 0 ? 'negativeCharactersCountdown' : 'charactersCountdown';
    counter.textContent = _(key, {
      value: countdown
    });
    callButton.disabled = countdown < 0;
  }

  function init(params) {
    params = params || {};

    var subject = params.subject;
    if (subject) {
      subjectInput.value = subject;
    }
    calculateCounter();

    var isVideoCall = modal.dataset.isVideo = 'isVideoCall' in params ?
                      params.isVideoCall : Settings.isVideoDefault;

    isVideoCall && initCameraByDefault();
  }

  function attachHandlers() {
    closeButton.addEventListener('click', onClose);
    callButton.addEventListener('click', onCall);
    resetButton.addEventListener('touchstart', clearSubject);
    cameraOptions.forEach((cameraOption) => {
      cameraOption.addEventListener('change', onCameraChange);
    });
    form.addEventListener('input', calculateCounter);
    form.addEventListener('submit', preventDefault);
  }

  function removeHandlers() {
    closeButton.removeEventListener('click', onClose);
    callButton.removeEventListener('click', onCall);
    resetButton.removeEventListener('touchstart', clearSubject);
    cameraOptions.forEach((cameraOption) => {
      cameraOption.removeEventListener('change', onCameraChange);
    });
    form.removeEventListener('input', calculateCounter);
    form.removeEventListener('submit', preventDefault);
  }

  exports.ConversationDetail = {
    show: function(params) {
      return new Promise((resolve, reject) => {
        callAction = resolve;
        dismissAction = reject;
        render();
        init(params);
        show(attachHandlers);
      });
    }
  };

}(window));
