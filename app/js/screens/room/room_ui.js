(function(exports) {
  'use strict';

  // ID of the DOM element that the Publisher will replace.
  const LOCAL_TARGET_ELEMENT = 'room-local-video';
  // ID of the DOM element that the Subscriber will replace.
  const REMOTE_TARGET_ELEMENT = 'room-remote-video';

  const TIMEOUT_SHIELD = 5000;
  const POLLING_INTERVAL = 100;

  var debug = Config.debug;

  var panel, elementList, leaveButton, toggleMicButton, switchSpeakerButton,
      toggleVideoButton, localVideo, fakeVideoContainer, fakeLocalVideo,
      localStream, remoteVideo, localVideoContainer, remoteVideoContainer,
      roomName, participantName, roomAvatar;

  var noop = function() {};

  var onLeaveButtonClicked = noop,
      onToggleMicButtonClicked = noop,
      onSwitchSpeakerButtonClicked = noop,
      onToggleVideoButtonClicked = noop;

  var isMicEnabled = true,
      isSpeakerEnabled = true,
      isVideoEnabled = true;

  var sessionConstraints, frontCamera, mode, cameraConstraints;

  function updateButtonStatus() {
    toggleMicButton.dataset.enabled = !isMicEnabled;
    switchSpeakerButton.dataset.enabled = isSpeakerEnabled;
    toggleVideoButton.dataset.enabled = !isVideoEnabled;
  }

  var _ = navigator.mozL10n.get;

  function appendTokboxTargets() {
    localVideo = document.getElementById(LOCAL_TARGET_ELEMENT);
    if(!localVideo) {
      localVideo = document.createElement('span');
      localVideo.id = 'room-local-video';
      localVideo.className = 'content';
      localVideoContainer.appendChild(localVideo);
    }

    remoteVideo = document.getElementById(REMOTE_TARGET_ELEMENT);
    if(!remoteVideo) {
      remoteVideo = document.createElement('div');
      remoteVideo.id = 'room-remote-video';
      remoteVideoContainer.appendChild(remoteVideo);
    }
  }

  function render(params) {
    if (!localVideoContainer) {
      panel = document.getElementById('room-ui');
      leaveButton = document.getElementById('leave-room');
      toggleMicButton = document.getElementById('room-settings-togglemic');
      switchSpeakerButton =
        document.getElementById('room-settings-switchspeaker');
      toggleVideoButton = document.getElementById('room-settings-togglevideo');
      fakeVideoContainer = document.getElementById('fake-remote-video-wrapper');
      remoteVideoContainer = document.querySelector('.remote-video-wrapper');
      localVideoContainer = document.querySelector('.local-video-wrapper');
      roomName = document.getElementById('rui-name');
      roomAvatar = document.getElementById('rui-name-avatar');

      participantName = document.getElementById('rui-participant-name');
      Countdown.init();
    }

    // Tokbox is removing the elements where the video is appended to, so
    // we need to restore them if missing
    appendTokboxTargets();

    isSpeakerEnabled = isVideoEnabled = params.video;
    isMicEnabled = true;
    panel.dataset.localVideo = isVideoEnabled;
    frontCamera = params.frontCamera;
    mode = !!frontCamera ? 'user': 'environment';
    cameraConstraints = {facingMode: mode, require: ['facingMode']};
    sessionConstraints = {video: cameraConstraints, audio: true};

    updateButtonStatus();
  }

  function leaveButtonClicked() {
    onLeaveButtonClicked();
    hide();
  }

  function toggleMicButtonClicked() {
    isMicEnabled = !isMicEnabled;
    updateButtonStatus();
    onToggleMicButtonClicked();
  }

  function switchSpeakerButtonClicked() {
    isSpeakerEnabled = !isSpeakerEnabled;
    updateButtonStatus();
    onSwitchSpeakerButtonClicked();
  }

  function toggleVideoButtonClicked() {
    isVideoEnabled = !isVideoEnabled;
    panel.dataset.localVideo = isVideoEnabled;
    updateButtonStatus();
    onToggleVideoButtonClicked();
  }

  var orientationHandler = null;
  function startRotationHandler() {
    LazyLoader.load(
      [
      'libs/orientation_vendor.js'
      ],
      function() {
        orientationHandler = OrientationHandler;
        orientationHandler.on('orientation', function(event) {
          panel.dataset.rotation = event;
        });
        orientationHandler.start();
      }
    );
  }

  function stopRotationHandler() {
    orientationHandler && orientationHandler.stop();
    panel.dataset.rotation = '0';
  }

  function attachHandlers() {
    leaveButton.addEventListener('click', leaveButtonClicked);
    toggleMicButton.addEventListener('click', toggleMicButtonClicked);
    switchSpeakerButton.addEventListener('click', switchSpeakerButtonClicked);
    toggleVideoButton.addEventListener('click', toggleVideoButtonClicked);
    // TODO Enable this in:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1107868
    // startRotationHandler();
  }

  function removeHandlers() {
    leaveButton.removeEventListener('click', leaveButtonClicked);
    toggleMicButton.removeEventListener('click', toggleMicButtonClicked);
    switchSpeakerButton.removeEventListener('click',
      switchSpeakerButtonClicked);
    toggleVideoButton.removeEventListener('click', toggleVideoButtonClicked);
    // TODO Enable this in:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1107868
    // stopRotationHandler();
    onLeaveButtonClicked = onToggleMicButtonClicked =
      onSwitchSpeakerButtonClicked = onToggleVideoButtonClicked = noop;
  }

  function cleanUI() {
    roomName.textContent = '';
    roomAvatar.textContent = '';
    participantName.textContent = '';
  }

  function hide() {
    panel.dataset.status = '';
    removeFakeVideo();
    removeHandlers();
    cleanUI();
    Countdown.reset();
    Navigation.to('calllog-panel', 'bottom');
  }

  function showFakeVideo() {
    // While we are connecting, our own stream will be shown fullscreen.
    // Once the remote stream will be ready, we will remove this element.
    navigator.mozGetUserMedia(
      sessionConstraints,
      function onStreamReady(stream) {
        localStream = stream;
        fakeLocalVideo = document.createElement('video');
        if (frontCamera) {
          fakeLocalVideo.style.transform = 'rotateY(180deg)';
        }
        fakeLocalVideo.muted = true;
        fakeLocalVideo.mozSrcObject = stream;
        fakeVideoContainer.appendChild(fakeLocalVideo);
        fakeLocalVideo.play();
      },
      function(error) {
        // TODO: we should show some kind of error in the UI.
        debug &&
          console.log('Error while showing own video stream through gUM');
      }
    );
  }

  function removeFakeVideo() {
    localStream && localStream.stop();
    localStream = null;
    try {
      if (fakeVideoContainer) {
        fakeVideoContainer.innerHTML = '';
      }
    } catch(e) {
      debug && console.log('Error while removing fake local video');
    }
    fakeLocalVideo = null;
  }

  var RoomUI = {
    get localTargetElement() {
      return LOCAL_TARGET_ELEMENT;
    },

    get remoteTargetElement() {
      return REMOTE_TARGET_ELEMENT;
    },

    set onLeave(onLeave) {
      if (typeof onLeave !== 'function') {
        return;
      }
      onLeaveButtonClicked = onLeave;
    },

    set onToggleMic(onToggleMic) {
      if (typeof onToggleMic !== 'function') {
        return;
      }
      onToggleMicButtonClicked = onToggleMic;
    },

    set onSwitchSpeaker(onSwitchSpeaker) {
      if (typeof onSwitchSpeaker !== 'function') {
        return;
      }
      onSwitchSpeakerButtonClicked = onSwitchSpeaker;
    },

    set onToggleVideo(onToggleVideo) {
      if (typeof onToggleVideo !== 'function') {
        return;
      }
      onToggleVideoButtonClicked = onToggleVideo;
    },

    setWaiting: function() {
      panel.dataset.status = 'waiting';
      panel.dataset.remoteVideo = false;

      var guestText = _('guest');
        roomAvatar.textContent = guestText[0];
        participantName.textContent = guestText;

      showFakeVideo();
    },

    setConnected: function(isRemoteVideo) {
      Countdown.reset();
      // The mozPaintedFrames hack added below solved the long lantency
      // issue described on bug 1087068. Bug 1105707 was filed to get
      // rid of it.

      var pollingInterval, timeoutShield;
      var remoteVideoElement = remoteVideo.querySelector('video');

      if (!remoteVideoElement) {
        return;
      }
      function setCallStatus() {
        window.clearInterval(pollingInterval);
        window.clearTimeout(timeoutShield);
        removeFakeVideo();
        panel.dataset.status = 'connected';
        Countdown.start();
        // TODO Check if we can now this in advance
        RoomUI.showRemoteVideo(true);
      }

      timeoutShield = window.setTimeout(setCallStatus, TIMEOUT_SHIELD);
      pollingInterval = window.setInterval(function() {
        if (remoteVideoElement.mozPaintedFrames == 0) {
          return;
        }
        setCallStatus();
      }, POLLING_INTERVAL);
    },

    showRemoteVideo: function(isRemoteVideo) {
      panel.dataset.remoteVideo = isRemoteVideo;
    },

    updateName: function(name) {
      roomName.textContent = name;
    },

    updateParticipant: function(name, account) {
      if (name && name.length > 0) {
        participantName.textContent = name;
        roomAvatar.textContent = name[0];
      }

      if (!account) {
        return;
      }

      ContactsHelper.find(
        {
          identities: [account]
        },
        function(result) {
          var contacts = result.contacts;
          if (!contacts || contacts.length === 0) {
            return;
          }
          participantName.textContent =
            ContactsHelper.getPrimaryInfo(contacts[0]);
        }
      );
    },

    show: function(params) {
      render(params);
      RoomUI.setWaiting();
      attachHandlers();
      Navigation.to('room-ui', 'top');
    },

    hide: hide
  };

  exports.RoomUI = RoomUI;
}(this));
