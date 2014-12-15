'use strict';

(function(exports) {

  var dialog, cancelButton, joinButton, frontCamera, rearCamera,
      cameraOptions, cameraContainer;

  var joinAction, cancelAction;

  function render() {
    if (dialog) {
      return;
    }

    dialog = document.getElementById('join-room');
    cancelButton = dialog.querySelector('menu .cancel');
    joinButton = dialog.querySelector('menu .join');
    rearCamera = dialog.querySelector('input[value="camera-back"]');
    frontCamera = dialog.querySelector('input[value="camera-front"]');
    cameraOptions = [rearCamera, frontCamera];
    cameraContainer = dialog.querySelector('.camera-container');
    dialog.classList.remove('hide');
  }

  function initCameraByDefault() {
    var isFrontalCamera = Settings.isFrontalCamera;
    var camera;
    var defaultCameraReport;
    if (isFrontalCamera === true || isFrontalCamera === 'true') {
      camera = frontCamera;
      defaultCameraReport = 'front';
    } else {
      camera = rearCamera;
      defaultCameraReport = 'back';
    }
    Telemetry.updateReport('defaultRoomCamera', defaultCameraReport);
    camera.checked = true;
    onCameraChange(camera);
  }

  function onCameraChange(evt) {
    var element = evt.target || evt;
    cameraContainer.dataset.camera = element.value;
  }

  function show() {
    initCameraByDefault();
    dialog.classList.add('show');
  }

  function hide() {
    removeHandlers();
    dialog.classList.remove('show');
  }

  function onCancel() {
    hide();
    cancelAction();
  }

  function onJoin() {
    hide();
    joinAction({
      isFrontCamera: frontCamera.checked
    });
  }

  function attachHandlers() {
    cancelButton.addEventListener('click', onCancel);
    joinButton.addEventListener('click', onJoin);
    cameraOptions.forEach((cameraOption) => {
      cameraOption.addEventListener('change', onCameraChange);
    });
  }

  function removeHandlers() {
    cancelButton.removeEventListener('click', onCancel);
    joinButton.removeEventListener('click', onJoin);
    cameraOptions.forEach((cameraOption) => {
      cameraOption.removeEventListener('change', onCameraChange);
    });
  }

  exports.JoinRoom = {
    show: function() {
      return new Promise((resolve, reject) => {
        joinAction = resolve;
        cancelAction = reject;
        render();
        attachHandlers();
        show();
      });
    }
  };

}(window));
