/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported ClientRequestHelper */

/* globals Config */

'use strict';

(function(exports) {
  var SERVER_URL = Config.server_url;
  var TIMEOUT = 15000;

  /** HAWK credentials */
  var _hawkCredentials = null;

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  function _request(options, onsuccess, onerror) {
    var req = new XMLHttpRequest({mozSystem: true});
    req.open(options.method, options.url, true);
    req.setRequestHeader('Content-Type', 'application/json');
    req.responseType = 'json';
    req.timeout = TIMEOUT;

    var authorization = '';
    if (options.credentials) {
      switch (options.credentials.type) {
        case 'BrowserID':
          authorization =
            options.credentials.type + ' ' + options.credentials.value;
          break;
        default:
          var hawkHeader = hawk.client.header(options.url, options.method, {
            credentials: options.credentials.value
          });
          authorization = hawkHeader.field;
          break;
      }
      req.setRequestHeader('authorization', authorization);
    }
    req.onload = function() {
      if (req.status !== 200 && req.status !== 302) {
        _callback(onerror, [req.statusText]);
        return;
      }
      _callback(
        onsuccess, [req.response, req.getResponseHeader('Hawk-Session-Token')]
      );
    };

    req.onerror = req.ontimeout = function(event) {
      _callback(onerror, [event.target.status]);
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

    signUp: function signUp(credentials, pushEndpoint, onsuccess, onerror) {
      _request({
          method: 'POST',
          url: SERVER_URL + '/registration',
          body: {
            simple_push_url: pushEndpoint
          },
          credentials: credentials
        },
        function onSuccess(result, sessionToken) {
          if (!sessionToken) {
            _callback(onerror, [new Error('No session token')]);
            return;
          }
          deriveHawkCredentials(sessionToken, 'sessionToken', 2 * 32,
            function(hawkCredentials) {
              _hawkCredentials = {
                type: 'Hawk',
                value: hawkCredentials
              };
              _callback(onsuccess, [result, _hawkCredentials]);
          });
        },
        onerror);
    },

    signIn: function signIn(credentials, pushEndpoint, onsuccess, onerror) {
      _request({
          method: 'POST',
          url: SERVER_URL + '/registration',
          body: {
            simple_push_url: pushEndpoint
          },
          credentials: credentials
        },
        function onSuccess(result) {
          _hawkCredentials = credentials;
          _callback(onsuccess, [result]);
        },
        onerror
      );
    },

    generateCallUrl: function generateCallUrl(callerId, onsuccess, onerror) {
      if (!_hawkCredentials) {
        _callback(onerror, [new Error('No HAWK credentials')]);
        return;
      }
      _request({
          method: 'POST',
          url: SERVER_URL + '/call-url',
          body: {
           callerId: callerId
          },
          credentials: _hawkCredentials
        },
        onsuccess,
        onerror
      );
    },

    getCallUrl: function getCallUrl(token, onsuccess, onerror) {
      _request({
        method: 'GET',
        url: SERVER_URL + '/calls/' + token
      }, onsuccess, onerror);
    },

    makeCall: function makeCall(token, onsuccess, onerror) {
      _request({
        method: 'POST',
        url: SERVER_URL + '/calls/' + token
      }, onsuccess, onerror);
    },

    deleteCall: function deleteCall(token, onsuccess, onerror) {
      if (!_hawkCredentials) {
        _callback(onerror, [new Error('No HAWK credentials')]);
        return;
      }
      _request({
          method: 'DELETE',
          url: SERVER_URL + '/calls/' + token,
          credentials: _hawkCredentials
        },
        onsuccess,
        onerror
      );
    },

    getCalls: function getCalls(version, onsuccess, onerror) {
      if (!_hawkCredentials) {
        _callback(onerror, [new Error('No HAWK credentials')]);
        return;
      }
      _request({
          method: 'GET',
          url: SERVER_URL + '/calls?version=' + version,
          credentials: _hawkCredentials
        },
        onsuccess,
        onerror
      );
    },

    getCall: function getCall(callId, onsuccess, onerror) {
      _request({
        method: 'GET',
        url: SERVER_URL + '/calls/id/' + callId
      }, onsuccess, onerror);
    },

    rejectCall: function rejectCall(callId, onsuccess, onerror) {
      _request({
        method: 'DELETE',
        url: SERVER_URL + '/calls/id/' + callId
      }, onsuccess, onerror);
    }
  };

  exports.ClientRequestHelper = ClientRequestHelper;
})(this);
