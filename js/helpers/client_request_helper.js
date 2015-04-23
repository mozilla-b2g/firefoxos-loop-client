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
  var TIMEOUT = Config.request_timeout;

  /** HAWK credentials */
  var _hawkCredentials = null;

  var _localtimeOffsetMsec = 0;

  // Until either the user is signed up or signed in we enqueue every request.
  var _ready = false;
  var _requestQueue;

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  function _onready() {
    _ready = true;
    if (!_requestQueue) {
      return;
    }
    while (_requestQueue.length) {
      var params = _requestQueue.pop();
      debug && console.log('Pop request to ' + params.options.url);
      params.options.credentials = _hawkCredentials;
      _request(params.options,
               params.onsuccess,
               params.onerror,
               params.skipRetry);
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
    try {
      var serverDateMsec = Date.parse(dateString);
      _localtimeOffsetMsec = serverDateMsec - hawk.utils.now();
    } catch(err) {
      console.warn('Bad date header in server response: ' + dateString);
    }
  }

  var hawkCrypto = null;

  // Since hawk.crypto and hawk.crypto.getClientHeader are promises now,
  // and so we don't have to change the logic, we just check here and
  // continue when we have all the data we need.
  function _request(options, onsuccess, onerror, skipRetry) {
    if (options.credentials && (options.credentials.type !== 'BrowserID')) {
      if (hawkCrypto === null) {
        window.hawk.crypto.then(hc => {
          // Just retry after getting hawkCrypto
          hawkCrypto = hc;
          _request(options, onsuccess, onerror, skipRetry);
        });
        return;
      }
      // At this point we have hawkCrypto, so we can generate the header and
      // pass it.
      hawkCrypto.getClientHeader(options.url, options.method, {
        credentials: options.credentials.value,
        localtimeOffsetMsec: _localtimeOffsetMsec
      }).then(
        hawkHeader =>
          _fulfillRequest(options, onsuccess, onerror, skipRetry, hawkHeader)
      );

    } else {
      _fulfillRequest(options, onsuccess, onerror, skipRetry);
    }
  }

  function _fulfillRequest(options, onsuccess, onerror, skipRetry, hawkHeader) {
    if (!_ready && (!options.skipQueue)) {
      if (!_requestQueue) {
        _requestQueue = [];
      }
      debug && console.log('Enqueue request to ' + options.url);
      _requestQueue.push({
        options: options,
        onsuccess: onsuccess,
        onerror: onerror,
        skipRetry: skipRetry
      });
      return;
    }

    var req = new XMLHttpRequest({mozSystem: true});
    req.open(options.method, Utils.getSecureURL(options.url), true);
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
          authorization = hawkHeader.field;
          break;
      }
      req.setRequestHeader('authorization', authorization);
    }

    req.onload = function() {
      debug && console.log('Response to request ' + options.url +
                           ' is: ' + JSON.stringify(req.response));
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
        _callback(onerror, [req.response]);
        return;
      }

      if (req.status !== 201 && req.status !== 200 && req.status !== 204 &&
          req.status !== 207 && req.status !== 302) {
        _callback(onerror, [req.response]);
        return;
      }
      _callback(
        onsuccess, [req.response, req.getResponseHeader('Hawk-Session-Token')]
      );
    };

    req.onerror = req.ontimeout = function(event) {
      debug && console.log('Response to request ' + options.url +
                           ' was an error');
      _callback(onerror, [event.target.status]);
    };

    var body;
    if (options.body) {
      body = JSON.stringify(options.body);
    }

    debug && console.log("Request to " + options.url + " with body " + body);
    req.send(body);
  }

  var ClientRequestHelper = {
    get serverUrl() {
      return SERVER_URL;
    },

    /*
     * Methods related with account
     */
    signUp: function signUp(credentials, pushEndpoint, onsuccess, onerror) {
      _request({
          // The sign up request is not added to the queue as it should be the
          // first.
          skipQueue: true,
          method: 'POST',
          url: SERVER_URL + '/registration',
          body: {
            simplePushURLs: pushEndpoint
          },
          credentials: credentials
        },
        function onSuccess(result, sessionToken) {
          if (!sessionToken) {
            _callback(onerror, [new Error('No session token')]);
            return;
          }
          Loader.getHawkCredentials().
              then(hc => hc.derive(sessionToken, 'sessionToken', 2 * 32)).
              then(hawkCredential => {
                _hawkCredentials = {
                  type: 'Hawk',
                  value: hawkCredential
                };
                _onready();
                _callback(onsuccess, [result, _hawkCredentials]);
              });
        },
        onerror);
    },

    signIn: function signIn(credentials, pushEndpoint, onsuccess, onerror) {
      _request({
          // The sign in request is not added to the queue as it should be the
          // first.
          skipQueue: true,
          method: 'POST',
          url: SERVER_URL + '/registration',
          body: {
            simplePushURLs: pushEndpoint
          },
          credentials: credentials
        },
        function onSuccess(result) {
          _hawkCredentials = credentials;
          _onready();
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
            // Now we dont need to send any body
            // http://docs.services.mozilla.com/loop/apis.html#delete-registration
            credentials: credentials
          },
          onsuccess,
          onerror
        );
    },

    /*
     * Methods related with Shared URLs. This will be deprecated in the future
     * based on the new version of the API.
     */
    generateCallUrl: function generateCallUrl(params, onsuccess, onerror) {
      params = params || {};
      if (!_hawkCredentials) {
        _callback(onerror, [new Error('No HAWK credentials')]);
        return;
      }
      _request({
          method: 'POST',
          url: SERVER_URL + '/call-url',
          body: {
            callerId: params.callerId,
            subject: params.subject || ''
          },
          credentials: _hawkCredentials
        },
        function(result) {
          _callback(onsuccess, [result]);
          Telemetry.updateReport('generatedUrls');
        },
        onerror
      );
    },

    getCallUrl: function getCallUrl(params, onsuccess, onerror) {
      _request({
        method: 'GET',
        url: SERVER_URL + '/calls/' + params.token
      }, onsuccess, onerror);
    },

    callUrl: function callUrl(params, onsuccess, onerror) {
      _request({
        method: 'POST',
        url: SERVER_URL + '/calls/' + params.token,
        body: {
          callType: params.isVideoCall ? 'audio-video' : 'audio',
          subject: params.subject || ''
        }
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
    },

    /*
     * Methods related with direct call (conversations)
     */
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

    callUser: function callUser(params, onsuccess, onerror) {
      if (!_hawkCredentials) {
        _callback(onerror, [new Error('No HAWK credentials')]);
        return;
      }

      if (!params.calleeId) {
        _callback(onerror, [new Error('No callee ID')]);
        return;
      }

      // In order to allow the server to normalize the given identity as an
      // MSISDN, we need to also provide the current MCC if it is available.
      var _calleeId = params.calleeId.slice(0);
      var mcc = '';
      var conn = navigator.mozMobileConnections;
      if (conn && (conn[0] || conn[1])) {
        var network =
          (conn[0] &&
           (conn[0].lastKnownHomeNetwork || conn[0].lastKnownNetwork)) ||
          (conn[1] &&
           (conn[1].lastKnownHomeNetwork || conn[1].lastKnownNetwork));
        var mccParts = (network || '-').split('-');
        if (mccParts.length >= 1) {
          // mccParts contains at least mcc and mnc. Recent implementations
          // includes the SPN as a third parameter, but we don't really care
          // about it.
          mcc = mccParts[0];
        }

        for (var i = 0, l = params.calleeId.length; i < l; i++) {
          // Ignore email based identities.
          if (params.calleeId[i].indexOf('@') != -1) {
            continue;
          }
          // The server expects an array of single strings or objects with the
          // form {phoneNumber: <string>, mcc: <string>} for the callee
          // identities.
          _calleeId[i] = {
            phoneNumber: params.calleeId[i],
            mcc: mcc
          };
        }
      }

      _request({
        method: 'POST',
        url: SERVER_URL + '/calls/',
        body: {
          calleeId: _calleeId,
          callType: params.isVideoCall ? 'audio-video' : 'audio',
          channel: CHANNEL,
          subject: params.subject || ''
        },
        credentials: _hawkCredentials
      }, onsuccess, onerror);
    },

    /*
     * Methods related with Rooms
     */
    createRoom: function createRoom(params, onsuccess, onerror) {
      _request({
        method: 'POST',
        url:  SERVER_URL + '/rooms',
        body: params,
        credentials: _hawkCredentials
      }, onsuccess, onerror);
    },

    deleteRooms: function deleteRooms(tokens, onsuccess, onerror) {
      _request({
        method: 'PATCH',
        url: SERVER_URL + '/rooms',
        body: {
          deleteRoomTokens: tokens
        },
        credentials: _hawkCredentials
      }, onsuccess, onerror);
    },

    getRoom: function getRoom(token, onsuccess, onerror) {
      _request({
        method: 'GET',
        url: SERVER_URL + '/rooms/' + token,
        credentials: _hawkCredentials
      }, onsuccess, onerror);
    },

    joinRoom: function joinRoom(token, params, onsuccess, onerror) {
      // Add the action to the params
      params.action = 'join';
      _request({
        method: 'POST',
        url: SERVER_URL + '/rooms/' + token,
        body: params,
        credentials: _hawkCredentials
      }, onsuccess, onerror);
    },

    leaveRoom: function leaveRoom(token, onsuccess, onerror) {
      _request({
        method: 'POST',
        url: SERVER_URL + '/rooms/' + token,
        body: {
          action: 'leave'
        },
        credentials: _hawkCredentials
      }, onsuccess, onerror);
    },

    getRooms: function getRooms(onsuccess, onerror) {
      _request({
        method: 'GET',
        url: SERVER_URL + '/rooms',
        credentials: _hawkCredentials
      }, onsuccess, onerror);
    },

    refreshRoom: function refreshRoom(token, onsuccess, onerror) {
      _request({
        method: 'POST',
        url: SERVER_URL + '/rooms/' + token,
        body: {
          action: 'refresh'
        },
        credentials: _hawkCredentials
      }, onsuccess, onerror);
    },

    getRoomsChanges: function getRoomsChanges(version, onsuccess, onerror) {
      _request({
          method: 'GET',
          url: SERVER_URL + '/rooms?version=' + version,
          credentials: _hawkCredentials
        },
        onsuccess,
        onerror
      );
    },

    updateRoom: function updateRoom(token, params, onsuccess, onerror) {
      _request({
        method: 'PATCH',
        url: SERVER_URL + '/rooms/' + token,
        body: params,
        credentials: _hawkCredentials
      }, onsuccess, onerror);
    }
  };

  exports.ClientRequestHelper = ClientRequestHelper;
})(this);
