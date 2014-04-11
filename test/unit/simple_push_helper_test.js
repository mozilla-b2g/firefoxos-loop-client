'use strict';

require('/apps/firefoxos-loop-client/js/simple_push_helper.js');
require('/apps/firefoxos-loop-client/libs/async_storage.js');
require('/apps/firefoxos-loop-client/test/unit/mock_async_storage.js');
require('/apps/firefoxos-loop-client/test/unit/mock_navigator_push.js');

suite('SimplePush >', function() {
  var nativePush, nativeAsyncStorage;

  var fakeEndpoint = 'http://foo.es/test';
  var fooHandler = function() {};
  var fooCachedChannel = {'foo': fakeEndpoint};

  suiteSetup(function() {
    nativePush = navigator.push;
    nativeAsyncStorage = asyncStorage;
    navigator.push = MockNavigatorPush;
    asyncStorage = MockAsyncStorage;
    MockNavigatorPush.suiteSetup();
  });

  suiteTeardown(function() {
    navigator.push = nativePush;
    asyncStorage = nativeAsyncStorage;
    nativePush = null;
    nativeAsyncStorage = null;
    MockNavigatorPush.suiteTeardown();
  });

  setup(function() {
    MockNavigatorPush.setup();
  });

  teardown(function() {
    MockAsyncStorage.teardown();
    MockNavigatorPush.teardown();
    SimplePush.reset();
  });

  suite(' register >', function() {
    
    suiteSetup(function() {
      sinon.spy(navigator.push, 'register');
    });

    suiteTeardown(function() {
      navigator.push.register.reset();
    });

    test(' call navigator.push.register', function() {
      SimplePush.register();
      assert.ok(navigator.push.register.calledOnce);
    });

    test(' retrieve endpoint properly', function(done) {
      MockNavigatorPush.fakeEndpoint = fakeEndpoint;
      SimplePush.register(function(error, endpoint) {
        assert.isTrue(!error);
        assert.equal(endpoint, fakeEndpoint);
        done()
      });
      MockNavigatorPush.executeRegistration();
    });

    test(' handle an error from push', function(done) {
      MockNavigatorPush.isError = true;
      SimplePush.register(function(error, endpoint) {
        assert.isFalse(!error);
        assert.isTrue(!endpoint);
        done()
      });
      MockNavigatorPush.executeRegistration();
    });
  });

  suite(' createChannel >', function() {

    test(' previosly registered', function(done) {
      MockAsyncStorage.value = fooCachedChannel;
      SimplePush.createChannel('foo', fooHandler, function(error, endpoint) {
        assert.isTrue(!error);
        assert.equal(fooCachedChannel['foo'], endpoint);
        done();
      });
    });

    test(' not registered previously', function(done) {
      // As we need to call navigator.push.register, we define
      // a fake endpoint
      MockNavigatorPush.fakeEndpoint = fakeEndpoint;
      // Request a new channel 'foo'
      SimplePush.createChannel('foo', fooHandler, function(error, endpoint) {
        assert.isTrue(!error);
        assert.equal(endpoint, fakeEndpoint);
        done();
      });
      // Execute the registration through the mockup
      MockNavigatorPush.executeRegistration();
    });

    test(' not registered previously and error in push', function(done) {
      MockNavigatorPush.isError = true;
      // Request a new channel 'foo'
      SimplePush.createChannel('foo', fooHandler, function(error, endpoint) {
        assert.isFalse(!error);
        assert.isTrue(!endpoint);
        done();
      });
      // Execute the registration through the mockup
      MockNavigatorPush.executeRegistration();
    });
  });

  suite(' start >', function() {
    test(' Receive a push message!', function(done) {
      // As we need to call navigator.push.register, we define
      // a fake endpoint
      MockNavigatorPush.fakeEndpoint = fakeEndpoint;
      // We define a fake push message
      MockNavigatorPush.fakePushMessage = {
        pushEndpoint: fakeEndpoint,
        version: 10
      };
      // This will be the handler of our push message
      var pushHandler = function() {
        done();
      }
      // Register the channel
      SimplePush.createChannel('foo', pushHandler, function(error, endpoint) {
        // This is async. , so now it's time to start listening!
        SimplePush.start();
        setTimeout(function() {
          MockNavigatorPush.emulatePushReceived();
        });
      });
      // Execute the registration through the mockup
      MockNavigatorPush.executeRegistration();
     
    }); 
  });

});
