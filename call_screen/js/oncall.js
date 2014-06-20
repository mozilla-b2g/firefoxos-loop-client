window.onload = function() {
  var debug = true;
  // Flags & Objects needed
  var call = {};
  var session;
  var publisher;
  var state;
  var startDate = 0;
  var _speakerManager;
  var _isVideoEnabled;

  // Notification via ringer channel
  Ringer.play();

  // Enable communications with Controller
  ControllerCommunications.init();
  
  // Retrieve params from the URL
  var query = window.location.search.slice(1);
  var urlParams = query.split('&');
  for (var i=0; i < urlParams.length; i++) {
    var keyValue = urlParams[i].split('=');
    call[keyValue[0]] = decodeURIComponent(keyValue[1]);
  }

  // Cache UI elements
  var hangoutButton = document.getElementById('hang-out');
  var answerAudioButton = document.getElementById('answer');
  var answerVideoButton = document.getElementById('answer-video');
  var settingsButton = document.getElementById('call-settings');
  

  function _toggleLocalVideo(enable) {
    if (!_speakerManager) {
      _speakerManager = new window.MozSpeakerManager();
    }

    _isVideoEnabled = enable;

    if (enable) {
      // TODO Enable VIDEO Stream via LOOP
      publisher.publishVideo(true);
      document.body.dataset.callType = 'video';
      _speakerManager.forcespeaker = true;
      return;
    }
    // We need to disable...
    // TODO Enable VIDEO Stream via LOOP
    publisher.publishVideo(false);
    document.body.dataset.callType = 'audio';
    _speakerManager.forcespeaker = false;
  }


  function _setCallState(state) {
    switch(state) {
      case 'incoming':
        // Show 'answer' with video/audio & 'hangout'
        break;
      case 'outgoing':
        // Show 'hangout' & 'settings'
        break;
      case 'connected':
        // Show 'hangout' & 'settings'
        break;
      case 'disconnected':
        // TODO Styles not defined yet.
        break;
      case 'feedback':
        // TODO Implement this when ready
        break;
      case 'hold':
        // TODO Implement this when ready
        break;
    }
  }

  // TODO Implement all options in Settings. Currently
  // we have just the video on/off
  settingsButton.addEventListener(
    'click',
    function() {
      _toggleLocalVideo(!_isVideoEnabled);
    }
  )

  // Hangout button. We need to stop the ringer
  // and the countdown. Session should be disconnected
  // as well.
  hangoutButton.addEventListener(
    'click',
    function hangOutClick() {
      Ringer.stop();
      Countdown.stop();
      if (session) {
        try {
          session.disconnect();
        } catch(e) {
          console.log('Session is not available to disconnect ' + e);
        }
      }

      // Let's pass the params from the call to the Controller
      // in order to insert an entry in the Call log
      var hangoutMessage = {
        id: 'call_screen',
        message: 'hangout',
        params: {
          duration: new Date().getTime() - startDate
        }
      }
      ControllerCommunications.send(hangoutMessage);
    }
  );

  // We have 2 buttons for answering a call, depending on if we are
  // publishing video or not
  function _answer(isVideo) {
    answerAudioButton.style.display = 'none';
    answerVideoButton.style.display = 'none';
    _joinCall(isVideo);
  }

  answerAudioButton.addEventListener(
    'click',
    function answerClick() {
      Ringer.stop();
      _answer(false);
    }
  );

  answerVideoButton.addEventListener(
    'click',
    function answerVideo() {
      Ringer.stop();
      _answer(true);
    }
  );


  function _joinCall(isVideoOn) {
    // Choose default camera
    var cameraConstraint = navigator.mozCameras.getListOfCameras().length > 1 ?
      {facingMode: 'user', require:['facingMode']} : true;
    var constraints = {
      // TODO Ask for facing mode if possible
      video: cameraConstraint,
      audio: true
    };
    Opentok.setConstraints(constraints);
      var session = TB.initSession(call.apiKey, call.sessionId);
      session.on({
        streamCreated: function(event) {
          session.subscribe(event.stream, 'fullscreen-video', null);
          var container =  document.querySelector('.OT_subscriber');
          if (!container) {
            return;
          }
          startDate = new Date().getTime();
          // Update the styles of the video strem
          container.style.width = '100%';
          container.style.height = '100%';
        }
      });
      session.connect(call.sessionToken, function(e) {
        if (e) {
          console.log('Session connect error ' + e.message);
          return;
        }
        publisher = session.publish('local-video', null, function onPublish(ee) {
          if (ee) {
            console.log('Session publish error ' + ee.message);
          }
          var container =  document.querySelector('.OT_publisher');
          if (!container) {
            return;
          }
          Countdown.init(document.getElementById('counter')).start();
          
          if (isVideoOn) {
            container.style.width = '140%';
            container.querySelector('video').style.width = '140% !important';
          }

          _toggleLocalVideo(isVideoOn);
        });
      }
    );
  }
}
