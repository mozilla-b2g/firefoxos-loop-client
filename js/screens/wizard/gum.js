(function(exports) {
  'use strict';

  var _stream;
  var Gum = {
    init: function a_init(onCompleted) {
      if (typeof onCompleted !== 'function') {
        console.error('onCompleted must be defined');
        return;
      }

      var fakeCallscreen = document.getElementById('call-snapshot');
      var calllogMockButton = document.getElementById('calllog-action-tap-mocked');

      calllogMockButton.addEventListener(
        'click',
        function onClick() {
          calllogMockButton.removeEventListener('click', onClick);
          // Choose default camera
          var cameraConstraint = navigator.mozCameras.getListOfCameras().length > 1 ?
            {facingMode: 'user', require:['facingMode']} : true;

          // Ask for the Stream
          navigator.mozGetUserMedia(
            {
              // TODO Ask for facing mode if possible
              video: cameraConstraint,
              // video: true,
              audio: true
            },
            function onStreamReady(stream) {
              // Show your own stream as part of the GUM wizard
              var video = document.getElementById('call-mock');
              video.classList.add('show');
              video.mozSrcObject = stream;
              video.play();

              // Show the 'call-screen' mask
              fakeCallscreen.classList.add('show');
              fakeCallscreen.addEventListener('click', function fakeHangup() {
                fakeCallscreen.removeEventListener('click', fakeHangup);
                // Stop the Stream
                stream.stop();
                // Call the oncompleted callback
                onCompleted();
              });
            },
            function(err) {
              Log.error("An error occured! " + err);
            }
          );
        }
      );
    }
  };

  exports.Gum = Gum;
}(this));
