/*exported MockNavigatorPush */

'use strict';

(function() {
  var _mozSetMessageHandler;
  
  var _registerRequest = null;
  var _pushMessageHandler;

  var MockNavigatorPush = {
    // isError control if the code executed is 'onsuccess' or 'onerror'
    isError: false,
    fakeEndpoint: null,
    fakePushMessage: null,

    suiteSetup: function() {
      _mozSetMessageHandler = navigator.mozSetMessageHandler;
      navigator.mozSetMessageHandler = function(messageName, handler) {
        _pushMessageHandler = handler;
      };
    },

    suiteTeardown: function() {
      navigator.mozSetMessageHandler = _mozSetMessageHandler;
    },

    setup: function() {
      _registerRequest = {};
    },

    teardown: function() {
      _registerRequest = null;
      _pushMessageHandler = null;
      this.isError = false;
      this.fakeEndpoint = null;
    },

    register: function() {
      _registerRequest = {};
      return _registerRequest;
    },

    emulatePushReceived: function() {
      if (typeof _pushMessageHandler === 'function') {
        _pushMessageHandler(this.fakePushMessage);
      }
    },

    executeRegistration: function() {
      setTimeout(function() {
        if (!this.isError) {
          _registerRequest.result = this.fakeEndpoint;
          if(_registerRequest && typeof _registerRequest.onsuccess === 'function') {
            _registerRequest.onsuccess();
          }
        } else {
          if(_registerRequest && typeof _registerRequest.onerror === 'function') {
            _registerRequest.onerror();
          }
        }
      }.bind(this));
    }
  }

  window.MockNavigatorPush = MockNavigatorPush;
}(this));
