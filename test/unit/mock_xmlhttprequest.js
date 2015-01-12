//XXX This was taken from homescreen app tests. Once this land in gaia
//    we should move this to /shared.
'use strict';

(function() {
  var lastInstance;

  function MockXMLHttpRequest() {
    lastInstance = this;
  }

  var throwAtNextSend = false,
      objectToThrow = null;

  function mxhr_mThrowAtNextSend(e) {
    throwAtNextSend = true;
    objectToThrow = e || new Error('throwing an exception');
  }

  function mxhr_mTeardown() {
    throwAtNextSend = false;
    objectToThrow = null;
    delete MockXMLHttpRequest.mLastOpenedUrl;
    lastInstance = null;
  }

  function mxhr_send(body) {
    if (throwAtNextSend) {
      throwAtNextSend = false;
      throw objectToThrow;
    }
    MockXMLHttpRequest.mLastBody = body;
  }

  function mxhr_open(method, url, opts) {
    MockXMLHttpRequest.mLastMethod = method;
    MockXMLHttpRequest.mLastOpenedUrl = url;
    MockXMLHttpRequest.mLastOptions = opts;
  }

  function mxhr_mSendError(error) {
    lastInstance && lastInstance.onerror && lastInstance.onerror({
      target: {
        status: error
      }
    });
  }

  function mxhr_mOnLoad(states) {
    if (lastInstance) {
      lastInstance.status = 200;
      for (var key in states) {
        lastInstance[key] = states[key];
      }
      lastInstance.onload && lastInstance.onload();
    }
  }

  function mxhr_mSendReadyState(states) {
    if (lastInstance) {
      lastInstance.readyState = XMLHttpRequest.DONE;
      lastInstance.status = 200;
      for (var key in states) {
        lastInstance[key] = states[key];
      }
      lastInstance.onreadystatechange && lastInstance.onreadystatechange();
    }
  }

  function mxhr_setRequestHeader(name, value) {
    if (!MockXMLHttpRequest.mLastHeaders) {
      MockXMLHttpRequest.mLastHeaders = [];
    }
    MockXMLHttpRequest.mLastHeaders[name] = value;
  }

  function mxhr_reset() {
    MockXMLHttpRequest.mLastMethod = null;
    MockXMLHttpRequest.mLastOpenedUrl = null;
    MockXMLHttpRequest.mLastOptions = null;;
    MockXMLHttpRequest.mLastHeaders = null;
    MockXMLHttpRequest.mLastBody = null;
  }

  MockXMLHttpRequest.prototype = {
    open: mxhr_open,
    send: mxhr_send,
    DONE: XMLHttpRequest.prototype.DONE,
    overrideMimeType: function() {},
    setRequestHeader: mxhr_setRequestHeader,
  };

  MockXMLHttpRequest.mThrowAtNextSend = mxhr_mThrowAtNextSend;
  MockXMLHttpRequest.mTeardown = mxhr_mTeardown;
  MockXMLHttpRequest.mSendError = mxhr_mSendError;
  MockXMLHttpRequest.mSendOnLoad = mxhr_mOnLoad;
  MockXMLHttpRequest.mSendReadyState = mxhr_mSendReadyState;
  MockXMLHttpRequest.DONE = XMLHttpRequest.DONE;
  MockXMLHttpRequest.reset = mxhr_reset;

  window.MockXMLHttpRequest = MockXMLHttpRequest;
})();
