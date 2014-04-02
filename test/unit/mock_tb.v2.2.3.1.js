'use strict';

(function(exports) {
  var mtb_sessions = {};
  var mtb_publishers = {};

  function MockTB() {
  }

  MockTB.prototype = {
    initSession: mtb_initSession,
    initPublisher: mtb_initPublisher
  };

  MockTB.mSessions = mtb_sessions;
  MockTB.mPublishers = mtb_publishers;

  MockTB.mTeardown = mtb_mTeardown;

  function mtb_initSession(sessionId) {
    var session = mtb_sessions[sessionId];

    if (!session) {
      session = new MockSession(sessionId);
      mtb_sessions[sessionId] = session;
    }

    return session;
  }

  function mtb_initPublisher(apiKey,
                             targetElement,
                             properties,
                             completionHandler) {
    if(typeof targetElement === 'function') {
      completionHandler = targetElement;
      targetElement = undefined;
    }
    if(typeof properties === 'function') {
      completionHandler = properties;
      properties = undefined;
    }

    var publisher = new MockPublisher();
    mtb_publishers[publisher.mGuid] = publisher;

    publisher.publish(targetElement, properties);
    
    if (completionHandler && (typeof completionHandler === 'function')) {
      completionHandler(null);
    }

    return publisher;
  }

  function mtb_mTeardown() {
    mtb_sessions = {};
    mtb_publishers = {};
  }

  exports.MockTB = MockTB;
})(this);
