/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported ClientRequestHelper */

/* globals Config */

/**
 * Server side docs for this REST client can be found at
 * https://docs.services.mozilla.com/loop/apis.html
 */

'use strict';

(function(exports) {
  var debug = Config.debug;
  var SERVER_URL = Config.server_url;
  var CHANNEL = Config.channel;
  var TIMEOUT = 15000;

  /** HAWK credentials */
  var _hawkCredentials = null;

  var _localtimeOffsetMsec = 0;

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  /**
   * Update clock offset by determining difference from date gives in the (RFC
   * 1123) Date header of a server response.  Because HAWK tolerates a window
   * of one minute of clock skew (so two minutes total since the skew can be
   * positive or negative), the simple method of calculating offset here is
   * probably good enough.  We keep the value in milliseconds to make life
   * easier, even though the value will not have millisecond accuracy.
   *
   * @param dateString
   *        An RFC 1123 date string (e.g., "Mon, 13 Jan 2014 21:45:06 GMT")
   *
   * For HAWK clock skew and replay protection, see
   * https://github.com/hueniverse/hawk#replay-protection
   */
  function _updateClockOffset(dateString) {
    debug && console.log('We need to fix the timestamp in the request. Server date: ' + dateString);
    try {
      var serverDateMsec = Date.parse(dateString);
      _localtimeOffsetMsec = serverDateMsec - hawk.utils.now();
    } catch(err) {
      console.warn('Bad date header in server response: ' + dateString);
    }
  }

  function _request(options, onsuccess, onerror, skipRetry) {
    var req = new XMLHttpRequest({mozSystem: true});
    req.open(options.method, Utils.getSecureURL(options.url), true);
    req.setRequestHeader('Content-Type', 'application/json');
    req.responseType = 'json';
    req.timeout = TIMEOUT;

    var authorization = '';
    if (options.credentials) {
      switch (options.credentials.type) {
        case 'BrowserID':
          debug && console.log('Request using BrowserID');
          authorization =
            options.credentials.type + ' ' + options.credentials.value;
          break;
        default:
          debug && console.log('Request using HAWK');
          var hawkHeader = hawk.client.header(options.url, options.method, {
            credentials: options.credentials.value,
            localtimeOffsetMsec: _localtimeOffsetMsec
          });
          authorization = hawkHeader.field;
          break;
      }
      req.setRequestHeader('authorization', authorization);
    }

    req.onload = function() {
      _updateClockOffset(req.getResponseHeader('Date'));

      // We may fail because of clock skew issues. In that cases we retry once
      // after setting the clock offset.
      if (req.status === 401) {
        if (!skipRetry) {
          _request(options, onsuccess, onerror, true /* skipRetry */);
          return;
        }
        // Getting a second 401 means that our credentials are incorrect and
        // so we need new ones.
        debug && console.log('ERROR 401: ' + JSON.stringify(req.response));
        _callback(onerror, [req.response]);
        return;
      }

      if (req.status !== 200 && req.status !== 204 && req.status !== 302) {
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
          LazyLoader.load(['libs/sjcl.min.js',
                           'libs/token.js'], () => {
            deriveHawkCredentials(sessionToken, 'sessionToken', 2 * 32,
              function(hawkCredentials) {
                _hawkCredentials = {
                  type: 'Hawk',
                  value: hawkCredentials
                };
                _callback(onsuccess, [result, _hawkCredentials]);
            });
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

    unregister: function unregister(
      credentials, pushEndpoint, onsuccess, onerror) {
        _request({
            method: 'DELETE',
            url: SERVER_URL + '/registration',
            body: {
              simple_push_url: pushEndpoint
            },
            credentials: credentials
          },
          onsuccess,
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
        function(result) {
          _callback(onsuccess, [result]);
          Telemetry.recordGeneratedUrl();
        },
        onerror
      );
    },

    getCallUrl: function getCallUrl(token, onsuccess, onerror) {
      _request({
        method: 'GET',
        url: SERVER_URL + '/calls/' + token
      }, onsuccess, onerror);
    },

    callUrl: function callUrl(token, isVideoCall, onsuccess, onerror) {
      _request({
        method: 'POST',
        url: SERVER_URL + '/calls/' + token,
        body: {
          callType: isVideoCall ? 'audio-video' : 'audio'
        }
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
    },

    callUser: function callUser(calleeId, isVideoCall, onsuccess, onerror) {
      if (!_hawkCredentials) {
        _callback(onerror, [new Error('No HAWK credentials')]);
        return;
      }

      if (!calleeId) {
        _callback(onerror, [new Error('No callee ID')]);
        return;
      }

      // In order to allow the server to normalize the given identity as an
      // MSISDN, we need to also provide the current MCC.
      var mcc;
      var conn = navigator.mozMobileConnections;
      if (conn && conn[0]) {
        // TODO: So far we will only provide the MCC of the first SIM if
        //       available, but we'll need to provide the entire list after
        //       bug 1062324 is fixed.
        var network = conn[0].lastKnownHomeNetwork || conn[0].lastKnownNetwork;
        var mccParts = (network || '-').split('-');
        if (mccParts.length >= 1) {
          // mccParts contains at least mcc and mnc. Recent implementations
          // includes the SPN as a third parameter, but we don't really care
          // about it.
          mcc = mccParts[0];
        }
      }

      _request({
        method: 'POST',
        url: SERVER_URL + '/calls/',
        body: {
          calleeId: calleeId,
          callType: isVideoCall ? 'audio-video' : 'audio',
          channel: CHANNEL,
          mcc: mcc
        },
        credentials: _hawkCredentials
      }, onsuccess, onerror);
    },

    revokeUrl: function revokeUrl(token, onsuccess, onerror) {
      if (!_hawkCredentials) {
        _callback(onerror, [new Error('No HAWK credentials')]);
        return;
      }

      _request({
          method: 'DELETE',
          url: SERVER_URL + '/call-url/' + token,
          credentials: _hawkCredentials
        },
        onsuccess,
        onerror
      );
    }
  };

  exports.ClientRequestHelper = ClientRequestHelper;
})(this);
