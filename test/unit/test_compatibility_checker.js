'use strict';

require('unit/utils/mock_mozL10n.js');
require('libs/lazy_loader.js');
require('unit/utils/mock_mozL10n.js');

suite('Tests CompatibilityChecker', function() {

  var cookie;

  function getConfiguration(devices, minimumMajorVersion) {
    return {
      device: {
        names: devices
      },
      os: {
        minimumMajorVersion: minimumMajorVersion
      }
    };
  }

  function restore(objects) {
    objects = Array.isArray(objects) ? objects : [objects];
    objects.forEach(object => object.restore());
  }

  suiteSetup(function(done) {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => 'Mozilla/5.0 (Mobile; rv:32.0) Gecko/32.0 Firefox/32.0'
    });

    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => cookie,
      set: (value) => cookie = value
    });

    require('js/compatibility_checker.js', () => done());
  });

  setup(function() {
    document.cookie = '';
  });

  test('CompatibilityChecker should exist', function() {
    chai.assert.isObject(CompatibilityChecker);
  });

  test('Compatibility already confirmed', function(done) {
    document.cookie = 'compatibility=confirmed';
    CompatibilityChecker.check().then(done);
  });

  test('Compatible device and OS', function(done) {
    sinon.stub(LazyLoader,
           'getJSON', () => Promise.resolve(getConfiguration(['Mozilla'], 32)));

    CompatibilityChecker.check().then(() => {
      chai.assert.equal(document.cookie, 'compatibility=confirmed');
      restore(LazyLoader.getJSON);
      done();
    });
  });

  test('Error getting JSON file', function(done) {
    sinon.stub(LazyLoader, 'getJSON', () => Promise.reject());

    CompatibilityChecker.check().then(() => {
      restore(LazyLoader.getJSON);
      done();
    });
  });

  test('Device not compatible', function(done) {
    sinon.stub(LazyLoader,
      'getJSON', () => Promise.resolve(getConfiguration(['Rocio Jurado'], 32)));

    sinon.stub(window, 'alert', message => {
      chai.assert.equal(message, 'notCompatibleDevice');
    });

    sinon.stub(window, 'close', () => {
      restore([LazyLoader.getJSON, window.alert, window.close]);
      done();
    });

    CompatibilityChecker.check();
  });

  test('Old OS version', function(done) {
    sinon.stub(LazyLoader,
           'getJSON', () => Promise.resolve(getConfiguration(['Mozilla'], 34)));

    sinon.stub(window, 'alert', message => {
      chai.assert.equal(message, 'oldOSVersion');
    });

    sinon.stub(window, 'close', () => {
      restore([LazyLoader.getJSON, window.alert, window.close]);
      done();
    });

    CompatibilityChecker.check();
  });
});
