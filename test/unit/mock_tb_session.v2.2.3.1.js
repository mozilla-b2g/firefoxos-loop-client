'use strict';

(function(exports) {
  var ms_sessionId;
  var ms_events;

  function MockSession(sessionId) {
    ms_sessionId = sessionId;
    ms_events = {};
  }

  MockSession.prototype = {
    connect: ms_connect,
    disconnect: ms_disconnect,
    destroy: ms_destroy,
    publish: ms_publish,
    subscribe: ms_subscribe,
    on: ms_on
  };

  MockSession.mSessionId = ms_sessionId;
  MockSession.mTriggerEvent = ms_triggerEvent;

  function ms_connect(apiKey, token, completionHandler) {
    var error = null;

    if(apiKey || (typeof apiKey === 'function')) {
      error = {
        code: 403,
        message: 'API Key is invalid'
      };
    }

    if (completionHandler && (typeof completionHandler === 'function')) {
      completionHandler(error);
    }

    setTimeout(function onTimeout() {
      if (error) {
	ms_triggerEvent('sessionConnectFailed', error);
      } else {
	ms_triggerEvent('sessionConnected', {});
      }
    }, 1000);

    return this;
  }

  function ms_disconnect() {
    setTimeout(function onTimeout() {
      ms_triggerEvent('sessionDisconnected', {});
      ms_triggerEvent('connectionDestroyed', {});
      ms_triggerEvent('streamDestroyed', {});
    }, 1000);
  }

  function ms_destroy() {
    ms_disconnect();
  }

  function ms_publish(publisher, properties, completionHandler) {
    var error = null;

    if(typeof publisher === 'function') {
      completionHandler = publisher;
      publisher = undefined;
    }
    if(typeof properties === 'function') {
      completionHandler = properties;
      properties = undefined;
    }

    if (!publisher ||
        (typeof publisher === 'string') ||
        publisher.nodeType === Node.ELEMENT_NODE) {
      // We should initiate a new Publisher with the new session credentials.
      // Since this the first version of this mock do nothing for now.
    } else {
      error = {
        code: 1,
        message: 'Session.publish :: First parameter passed in is neither a ' +
	         'string nor an instance of the Publisher'
      };
    }

    if (completionHandler && (typeof completionHandler === 'function')) {
      completionHandler(error);
    }

    if (!error) {
      setTimeout(function onTimeout() {
	ms_triggerEvent('streamCreated', {});
      }, 1000);
    }

    return publisher;
  }

  function ms_subscribe(stream, targetElement, properties, completionHandler) {
    // Since this the first version of this mock do nothing for now.
  }

  function ms_on(eventName, callback) {
    if (!ms_events[eventName]) {
      ms_events[eventName] = [];
    }
    if (callback && (typeof callback === 'function')) {
      ms_events[eventName].push(callback);
    }
  }

  function ms_triggerEvent(eventName, event) {
    var callbacks = ms_events[eventName];
    for (var i = 0; i < callbacks; i++) {
      callbacks[i](event);
    }
  }

  exports.MockSession = MockSession;
})(this);
