(function(exports) {
  'use strict';

  // ID of the DOM element that the Publisher will replace.
  const LOCAL_TARGET_ELEMENT = 'room-local-video';
  // ID of the DOM element that the Subscriber will replace.
  const REMOTE_TARGET_ELEMENT = 'room-remote-video';

  var debug = Config.debug;

  var panel, elementList, leaveButton, toggleMicButton, switchSpeakerButton,
      toggleVideoButton, localVideo, fakeLocalVideo, localStream,
      remoteVideo;

  var noop = function() {};

  var onLeaveButtonClicked = noop,
      onToggleMicButtonClicked = noop,
      onSwitchSpeakerButtonClicked = noop,
      onToggleVideoButtonClicked = noop;

  var _ = navigator.mozL10n.get;

  function appendRemoteTargetElement() {
    if (!panel || !elementList) {
      return;
    }
    remoteVideo = document.getElementById(REMOTE_TARGET_ELEMENT);
    if(remoteVideo) {
      return;
    }

    var remoteVideoItem = document.createElement('li');
    var remoteVideoContainer = document.createElement('div');
    remoteVideoContainer.setAttribute('id', REMOTE_TARGET_ELEMENT);
    remoteVideoItem.appendChild(remoteVideoContainer);
    elementList.appendChild(remoteVideoItem);
    remoteVideo = document.getElementById(REMOTE_TARGET_ELEMENT);
  }

  function render(params) {
    panel = document.getElementById('room-ui');
    elementList = panel.querySelector('ul');
    localVideo = document.getElementById(LOCAL_TARGET_ELEMENT);
    if(!localVideo) {
      var localVideoItem = document.createElement('li');
      var localVideoContainer = document.createElement('div');
      localVideoContainer.setAttribute('id', LOCAL_TARGET_ELEMENT);
      localVideoItem.appendChild(localVideoContainer);
      elementList.appendChild(localVideoItem);
      localVideo = document.getElementById(LOCAL_TARGET_ELEMENT);
    }
    appendRemoteTargetElement();
    leaveButton = document.getElementById('leave-room');
    toggleMicButton = document.getElementById('room-settings-togglemic');
    switchSpeakerButton = document.getElementById('room-settings-switchspeaker');
    toggleVideoButton = document.getElementById('room-settings-togglevideo');

    var video = params.video;
    var frontCamera = params.frontCamera;
    var mode = !!frontCamera ? 'user': 'environment';
    var cameraConstraints = {facingMode: mode, require: ['facingMode']};
    var sessionConstraints = {video: cameraConstraints, audio: true};

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
        localVideo.appendChild(fakeLocalVideo);
        fakeLocalVideo.play();
      },
      function(error) {
	// TODO: we should show some kind of error in the UI.
	debug && console.log('Error while joining room');
      }
    );
  }

  function leaveButtonClicked() {
    onLeaveButtonClicked();
    hide();
  }

  function toggleMicButtonClicked() {
    onToggleMicButtonClicked();
  }

  function switchSpeakerButtonClicked() {
    onSwitchSpeakerButtonClicked();
  }

  function toggleVideoButtonClicked() {
    onToggleVideoButtonClicked();
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
    switchSpeakerButton.removeEventListener('click', switchSpeakerButtonClicked);
    toggleVideoButton.removeEventListener('click', toggleVideoButtonClicked);

    onLeaveButtonClicked = onToggleMicButtonClicked =
      onSwitchSpeakerButtonClicked = onToggleVideoButtonClicked = noop;
  }

  function hide() {
    removeHandlers();
    Navigation.to('calllog-panel', 'bottom');
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

    removeFakeVideo: function() {
      localStream && localStream.stop();
      localStream = null;
      try {
        localVideo && fakeLocalVideo && localVideo.removeChild(fakeLocalVideo);
      } catch(e) {
        debug && console.log('Error while removing fake local video');
      }
      fakeLocalVideo = null;
    },

    show: function(params) {
      render(params);
      attachHandlers();
      Navigation.to('room-ui', 'top');
    },

    hide: hide,

    appendRemoteTargetElement: appendRemoteTargetElement
  };

  exports.RoomUI = RoomUI;
}(this));
