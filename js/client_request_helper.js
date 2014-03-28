/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {

  var SERVER_URL = 'http://192.168.0.11:5000';
  var TIMEOUT = 15000;

  function callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  function request(options, onsuccess, onerror) {
    var req = new XMLHttpRequest();
    req.open(options.method, options.url, true);
    req.setRequestHeader('Content-Type', 'application/json');
    req.responseType = 'json';
    req.timeout = TIMEOUT;
    req.withCredentials = true;

    req.onload = function() {
      if (req.status !== 200 && req.status !== 302) {
        callback(onerror, [req.response]);
        return;
      }
      callback(onsuccess, [req.response]);
    };

    req.onerror = req.ontimeout = function(event) {
      callback(onerror, [event.target.status]);
    };

    var body;
    if (options.body) {
      body = JSON.stringify(options.body);
    }

    req.send(body);
  }

  var ClientRequestHelper = {
    get serverUrl() {
      return SERVER_URL;
    },

    register: function register(pushEndpoint, onsuccess, onerror) {
      request({
        method: 'POST',
        url: SERVER_URL + '/registration',
        body: {
          simple_push_url: pushEndpoint
        }
      }, onsuccess, onerror);
    },

    generateCallUrl: function generateCallUrl(callerId, onsuccess, onerror) {
      request({
        method: 'POST',
        url: SERVER_URL + '/call-url',
        body: {
          callerId: callerId
        }
      }, onsuccess, onerror);
    },

    getCallUrl: function getCallUrl(token, onsuccess, onerror) {
      request({
        method: 'GET',
        url: SERVER_URL + '/calls/' + token
      }, onsuccess, onerror);
    },

    makeCall: function makeCall(token, onsuccess, onerror) {
      request({
        method: 'POST',
        url: SERVER_URL + '/calls/' + token
      }, onsuccess, onerror);
    },

    deleteCall: function deleteCall(token, onsuccess, onerror) {
      request({
        method: 'DELETE',
        url: SERVER_URL + '/calls/' + token
      }, onsuccess, onerror);
    },

    getCalls: function getCalls(version, onsuccess, onerror) {
      request({
        method: 'GET',
        url: SERVER_URL + '/calls?version=' + version
      }, onsuccess, onerror);
    },

    getCall: function getCall(callId, onsuccess, onerror) {
      request({
        method: 'GET',
        url: SERVER_URL + '/calls/id/' + callId
      }, onsuccess, onerror);
    },

    rejectCall: function rejectCall(callId, onsuccess, onerror) {
      request({
        method: 'DELETE',
        url: SERVER_URL + '/calls/id/' + callId
      }, onsuccess, onerror);
    }
  };

  exports.ClientRequestHelper = ClientRequestHelper;
})(this);
