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
      roomName, participantName, roomAvatar, roomControls;

  var noop = function() {};

  var onLeaveButtonClicked = noop,
      onToggleMicButtonClicked = noop,
      onSwitchSpeakerButtonClicked = noop,
      onToggleVideoButtonClicked = noop;

  var isMicEnabled = true,
      isSpeakerEnabled = true,
      isVideoEnabled = true;

  var sessionConstraints, frontCamera, cameraConstraints;

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

  function setHeadphonesPresent(status) {
    var headphonesPresent = !!status;
    // What we should do on a headphone change is:
    // Removal (!headphonesPresent)
    //  - If the communication is audio, removing the headphones should leave
    //    the speaker on the same status it was.
    //  - If the communication is video, removing the headphones should turn ON
    //    the speaker
    // Insertion (headphonesPresent)
    //  - If the communication is audio, then inserting the headphones should
    //    disable the speaker if it was enabled.
    //  - If the communication is video, then inserting the headphones should
    //    disable the speaker if it was enabled.
    if ((!headphonesPresent && isVideoEnabled && !isSpeakerEnabled) ||
        (headphonesPresent && isSpeakerEnabled)) {
      // According to the previous description, in those two cases we have
      // to change the speaker status
      switchSpeakerButtonClicked();
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
      roomControls = document.querySelector('.room-controls');
      Countdown.init();
    }

    roomControls.classList.add('hide');
    RoomUI.updateName(params.roomName);
  }

  function leaveButtonClicked() {
    onLeaveButtonClicked();
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
    if (panel.dataset.status !== 'connected') {
      isVideoEnabled ? showFakeVideo() : removeFakeVideo();
    }
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
  }

  function removeHandlers() {
    leaveButton.removeEventListener('click', leaveButtonClicked);
    toggleMicButton.removeEventListener('click', toggleMicButtonClicked);
    switchSpeakerButton.removeEventListener('click',
      switchSpeakerButtonClicked);
    toggleVideoButton.removeEventListener('click', toggleVideoButtonClicked);
    onLeaveButtonClicked = onToggleMicButtonClicked =
      onSwitchSpeakerButtonClicked = onToggleVideoButtonClicked = noop;
  }

  function cleanUI() {
    roomName.textContent = '';
    roomAvatar.textContent = '';
    participantName.textContent = '';
  }

  function hide() {
    panel.dataset.status = panel.dataset.participants = '';
    removeFakeVideo();
    removeHandlers();
    Navigation.to('calllog-panel', 'bottom').then(() => {
      cleanUI();
      Countdown.stop();
      Countdown.reset();
    });
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

  function join(params) {
    roomControls.classList.remove('hide');
    attachHandlers();

    // Tokbox is removing the elements where the video is appended to, so
    // we need to restore them if missing
    appendTokboxTargets();

    isSpeakerEnabled = isVideoEnabled = params.video !== 'false';
    isMicEnabled = true;
    panel.dataset.localVideo = isVideoEnabled;
    frontCamera = params.frontCamera;

    var mode = params.frontCamera ? 'user': 'environment';
    cameraConstraints = {facingMode: mode, require: ['facingMode']};
    sessionConstraints = {video: cameraConstraints, audio: true};

    // Set picked camera to perform proper UI rotation
    panel.dataset.isFrontCamera = params.frontCamera;

    // Set the initial headphone state (and modify the speaker state
    // accordingly)
    setHeadphonesPresent(RoomController.headphonesPresent);
    updateButtonStatus();
    RoomUI.setWaiting();
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

    get isSpeakerEnabled() {
      return isSpeakerEnabled;
    },

    set onToggleVideo(onToggleVideo) {
      if (typeof onToggleVideo !== 'function') {
        return;
      }
      onToggleVideoButtonClicked = onToggleVideo;
    },

    set numberParticipants(number) {
      if (panel) {
        panel.dataset.participants = number;
      }
    },

    setWaiting: function() {
      isVideoEnabled && showFakeVideo();
      panel.dataset.status = 'waiting';
      panel.dataset.remoteVideo = false;
      stopRotationHandler();

      var guestText = _('guestTitle');
        roomAvatar.textContent = guestText[0];
        participantName.textContent = guestText;
    },

    setConnected: function(isRemoteVideo) {
      Countdown.reset();
      startRotationHandler();

      // The mozPaintedFrames hack added below solved the long lantency
      // issue described on bug 1087068. Bug 1105707 was filed to get
      // rid of it.

      var pollingInterval, timeoutShield;

      appendTokboxTargets();

      var remoteVideoElement = remoteVideo.querySelector('video');

      function setCallStatus() {
        window.clearInterval(pollingInterval);
        window.clearTimeout(timeoutShield);
        removeFakeVideo();
        RoomUI.showRemoteVideo(isRemoteVideo);
        panel.dataset.status = 'connected';
        Countdown.start();
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
      panel.dataset.remoteVideo = !!isRemoteVideo;
      debug && console.log('Remote video is being displayed',
                            panel.dataset.remoteVideo);
    },

    updateName: function(name) {
      if (name) {
        roomName.textContent = name;
      }
    },

    updateParticipant: function(name, account) {
      ContactsHelper.getParticipantName({
        displayName: name,
        account: account
      }).then(_name => {
        participantName.textContent = _name;
        roomAvatar.textContent = _name[0];
      });
    },

    show: function(params) {
      return new Promise((resolve, reject) => {
        render(params);
        if (params.video !== 'false') {
          Loader.getJoinRoom(params.roomName).then((JoinRoom) => {
            JoinRoom.show().then((roomParams) => {
              params.frontCamera = roomParams.isFrontCamera;
              join(params);
              resolve();
            }, () => {
              reject();
            });
            Navigation.to('room-ui', 'top');
          });
        } else {
          join(params);
          Navigation.to('room-ui', 'top');
          resolve();
        }
      });
    },

    set headphonesPresent(status) {
      setHeadphonesPresent(status);
    },

    hide: hide
  };

  exports.RoomUI = RoomUI;
}(this));
