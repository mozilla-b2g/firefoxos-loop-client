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
          // Ask for the Stream
          navigator.mozGetUserMedia(
            {
              // TODO Ask for facing mode if possible
              // video: {facingMode: 'user', require:['facingMode']},
              video: true,
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
              console.log("An error occured! " + err);
            }
          );
        }
      );
    }
  };

  exports.Gum = Gum;
}(this));