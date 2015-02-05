'use strict';

require('js/config.js');
require('js/utils.js');
require('unit/utils/mock_mozL10n.js');
require('js/screens/conversation_detail.js');

suite('Tests ConversationDetail', function() {
  var modal, rearCamera, frontCamera, cameraContainer, callButton, subjectInput,
      counter;

  const MAX_SUBJECT_SIZE = 124;

  suiteSetup(function() {
    requireElement('elements/conversation_detail.html', 'conversation-detail');
    modal = document.getElementById('conversation-detail');
    rearCamera = modal.querySelector('input[value="camera-back"]');
    frontCamera = modal.querySelector('input[value="camera-front"]');
    callButton = modal.querySelector('.call');
    cameraContainer = modal.querySelector('.camera-container');
    subjectInput = modal.querySelector('input');
    counter = modal.querySelector('.charCounter');
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

  function dispatchTransitionEndEvent() {
    modal.dispatchEvent(new CustomEvent('transitionend'));
  }

  function showConversationDetail(params) {
    var clock = sinon.useFakeTimers();
    var promise = ConversationDetail.show(params);
    clock.tick(50);
    dispatchTransitionEndEvent();
    chai.assert.isTrue(modal.classList.contains('show'));
    return promise;
  }

  function checkHiddenState() {
    dispatchTransitionEndEvent();
    chai.assert.isFalse(modal.classList.contains('show'));
    chai.assert.isTrue(modal.classList.contains('hide'));
  }

  function initSettings(type) {
    // Audio by default
    window.Settings = {
      isVideoDefault: false,
      isFrontalCamera: false
    };

    switch(type) {
      case 'FRONT_CAMERA':
        window.Settings.isVideoDefault = true;
        window.Settings.isFrontalCamera = true;
        break;
      case 'REAR_CAMERA':
        window.Settings.isVideoDefault = true;
        break;
    };
  }

  test('ConversationDetail should exist', function() {
    chai.assert.isObject(ConversationDetail);
  });

  test('Video call by default in settings', function() {
    initSettings('FRONT_CAMERA');

    showConversationDetail();

    chai.assert.equal(modal.dataset.isVideo, 'true');
  });

  test('Audio call by default in settings', function() {
    initSettings('AUDIO');

    showConversationDetail();

    chai.assert.equal(modal.dataset.isVideo, 'false');
  });

  test('Video call defined as parameter', function() {
    initSettings('AUDIO');

    showConversationDetail({
      isVideoCall: true
    });

    chai.assert.equal(modal.dataset.isVideo, 'true');
  });

  test('Audio call defined as parameter', function() {
    initSettings('FRONT_CAMERA');

    showConversationDetail({
      isVideoCall: false
    });

    chai.assert.equal(modal.dataset.isVideo, 'false');
  });

  test('Video call with front camera', function() {
    initSettings('FRONT_CAMERA');

    showConversationDetail();

    chai.assert.isTrue(frontCamera.checked);
    chai.assert.isFalse(rearCamera.checked);
    chai.assert.equal(cameraContainer.dataset.camera, frontCamera.value);
  });

  test('Video call with rear camera', function() {
    initSettings('REAR_CAMERA');

    showConversationDetail();

    chai.assert.isFalse(frontCamera.checked);
    chai.assert.isTrue(rearCamera.checked);
    chai.assert.equal(cameraContainer.dataset.camera, rearCamera.value);
  });

  test('Show conversation detail without subject', function() {
    showConversationDetail();

    chai.assert.equal(subjectInput.value, '');
  });

  test('Show conversation detail with subject shorter than 124 chars',
    function() {
    var expectedSubject = 'Tapas y birras';

    callButton.disabled = true;

    showConversationDetail({
      subject: expectedSubject
    });

    var countdown = MAX_SUBJECT_SIZE - expectedSubject.length;

    chai.assert.equal(subjectInput.value, expectedSubject);
    chai.assert.equal(counter.dataset.countdown, countdown);
    chai.assert.isFalse(callButton.disabled);
    chai.assert.equal(counter.textContent,
                     'charactersCountdown{"value":' + countdown + '}');
  });

  test('Show conversation detail with subject longer than 124 chars',
    function() {
    var expectedSubject = 'Tapas y birras es lo que más me gusta cuando' +
                          'salgo con los amigos los Sabados despues de ver' +
                          'jugar a mi equipo preferido de futbol y éste gana' +
                          'como no puede ser de otra manera :)';

    callButton.disabled = false;

    showConversationDetail({
      subject: expectedSubject
    });

    var countdown = MAX_SUBJECT_SIZE - expectedSubject.length;

    chai.assert.equal(subjectInput.value, expectedSubject);
    chai.assert.equal(counter.dataset.countdown, countdown);
    chai.assert.isTrue(callButton.disabled);
    chai.assert.equal(counter.textContent,
                     'negativeCharactersCountdown{"value":' + countdown + '}');
  });

  test('The user cancels and the UI is hidden', function(done) {
    showConversationDetail().then((params) => {
      chai.assert.fail('User cancelled', params);
      done();
    }, () => {
      checkHiddenState();
      done();
    });

    modal.querySelector('.icon-close').click();
  });

  test('The user calls and the UI is hidden', function(done) {
    showConversationDetail().then(() => {
      checkHiddenState();
      done();
    });

    callButton.click();
  });

  test('The user calls with a predefined subject', function(done) {
    var expectedSubject = 'Petinto';

    showConversationDetail({
      subject: expectedSubject
    }).then((params) => {
      checkHiddenState();
      chai.assert.equal(params.subject, expectedSubject);
      done();
    });

    callButton.click();
  });

  test('The user types the subject and calls', function(done) {
    var expectedSubject = 'Manolito';

    showConversationDetail().then((params) => {
      checkHiddenState();
      chai.assert.equal(params.subject, expectedSubject);
      done();
    });

    subjectInput.value = expectedSubject;
    callButton.click();
  });

  test('Front camera by default - User keeps selection', function(done) {
    initSettings('FRONT_CAMERA');

    showConversationDetail().then((params) => {
      checkHiddenState();
      chai.assert.isTrue(params.isFrontCamera);
      done();
    });

    callButton.click();
  });

  test('Front camera by default - User changes to rear camera', function(done) {
    initSettings('FRONT_CAMERA');

    showConversationDetail().then((params) => {
      checkHiddenState();
      chai.assert.isFalse(params.isFrontCamera);
      done();
    });

    rearCamera.click();
    callButton.click();
  });

  test('Rear camera by default - User keeps selection', function(done) {
    initSettings('REAR_CAMERA');

    showConversationDetail().then((params) => {
      checkHiddenState();
      chai.assert.isFalse(params.isFrontCamera);
      done();
    });

    callButton.click();
  });

  test('Rear camera by default - User changes to front camera', function(done) {
    initSettings('REAR_CAMERA');

    showConversationDetail().then((params) => {
      checkHiddenState();
      chai.assert.isTrue(params.isFrontCamera);
      done();
    });

    frontCamera.click();
    callButton.click();
  });
});
