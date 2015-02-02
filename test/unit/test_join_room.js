'use strict';

require('unit/utils/mock_telemetry.js');
require('js/config.js');
require('js/utils.js');
require('js/screens/room/join_room.js');

suite('Tests JoinRoom', function() {
  var dialog, rearCamera, frontCamera, cancelButton, joinButton;

  suiteSetup(function() {
    requireElement('elements/join_room.html', 'join-room');
    dialog = document.getElementById('join-room');
    rearCamera = dialog.querySelector('input[value="camera-back"]');
    frontCamera = dialog.querySelector('input[value="camera-front"]');
    cancelButton = dialog.querySelector('menu .cancel');
    joinButton = dialog.querySelector('menu .join');
    sinon.stub(Utils, 'onForeground', () => {
      return {
        then: function(resolve) {
          resolve();
        }
      }
    });
  });

  suiteTeardown(function() {
    document.body.innerHTML = '';
    Utils.onForeground.restore();
  });

  function checkInitialization() {
    chai.assert.isTrue(dialog.classList.contains('show'));
  }

  test('JoinRoom should exist', function() {
    chai.assert.isNotNull(JoinRoom);
  });

  test('The UI is displayed properly with front camera', function() {
    window.Settings = {
      isFrontalCamera: true
    };

    JoinRoom.show();

    checkInitialization();

    chai.assert.isTrue(frontCamera.checked);
    chai.assert.isFalse(rearCamera.checked);
  });

  test('The UI is displayed properly with rear camera', function() {
    window.Settings = {
      isFrontalCamera: false
    };

    JoinRoom.show();

    checkInitialization();

    chai.assert.isFalse(frontCamera.checked);
    chai.assert.isTrue(rearCamera.checked);
  });

  test('The user cancels and the UI is hidden', function(done) {
    JoinRoom.show().then(() => {
      // Do nothing
    }, () => {
      chai.assert.isFalse(dialog.classList.contains('show'));
      done();
    });

    checkInitialization();
    cancelButton.click();
  });

  test('The user chooses front camera', function(done) {
    window.Settings = {
      isFrontalCamera: true
    };

    JoinRoom.show().then((params) => {
      chai.assert.isFalse(dialog.classList.contains('show'));
      chai.assert.isTrue(params.isFrontCamera);
      done();
    });

    checkInitialization();
    joinButton.click();
  });

  test('The user chooses rear camera', function(done) {
    window.Settings = {
      isFrontalCamera: false
    };

    JoinRoom.show().then((params) => {
      chai.assert.isFalse(dialog.classList.contains('show'));
      chai.assert.isFalse(params.isFrontCamera);
      done();
    });

    checkInitialization();
    joinButton.click();
  });
});
