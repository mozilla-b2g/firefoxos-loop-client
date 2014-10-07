/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/** exported CallProgressHelper */

/** globals WebSocket */

'use strict';

(function(exports) {
  var debug = true;

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  /**
   * Several Loop use cases necessitate the ability to communicate information
   * about the state of a call during its setup phase from the server to the
   * clients, as well as a means to convey call setup control information from
   * the clients to the server. These use cases include:
   *
   *   Caller informed when remote party is alerting.
   *   Caller informed when call setup fails.
   *   Caller informed when remote party answers call.
   *   Called user informed when call is canceled.
   *   Called user informed when call is answered/rejected on another device.
   *
   * To facilitate these operations in a timely fashion, the client will
   * establish a WebSockets connection to the resource indicated in the
   * "progressURL" when it receives it. The client never closes this
   * connection; that is the responsibility of the server. If the server sees
   * the client close the connection, it assumes that the client has failed,
   * and informs the other party of such call failure.
   *
   * CallProgressHelper abstracts the communication through the WebSocket
   * channel.
   */
  function CallProgressHelper(callId, progressURL, token) {
    this._state = 'unknown';
    this._reason = 'unknown';
    this._callId = callId;
    this._token = token;
    this._ws = new WebSocket(Utils.getSecureURL(progressURL));
    this._onstatechange = null;
    this._onerror = null;
    this._onreadyExternal = function foo() {};

    this._messageQueue;

    var that = this;
    this._ws.onmessage = function onWSMessage(evt) {
      var message = JSON.parse(evt.data);

      debug && console.log("onmessage " + JSON.stringify(message));

      switch (message.messageType) {
        case 'hello':
          that._state = message.state;
          that._ready = true;
          that._onready();
          break;
        case 'progress':
          that._state = message.state;
          that._reason = message.reason;
          _callback(that._onstatechange, [message]);
          break;
        case 'error':
          that._state = message.state = 'error';
          _callback(that._onerror, [message]);
          break;
        default:
          console.warn('Unhandled WS message ' + message.messageType);
      }
    };

    this._ws.onopen = function onOpenWS(evt) {
      debug && console.log("WebSocket opened");
      that._ws.send(JSON.stringify({
        messageType: 'hello',
        auth: that._token,
        callId: that._callId
      }));
      debug && console.log("Hello message sent");
    };

    this._ws.onclose = function onCloseWS(evt) {
      debug && console.log("WebSocket closed");
      if (that._state !== 'connected') {
        var message = {};
        that._state = message.state = 'terminated';
        message.reason = 'Websocket onclose fired';
        _callback(that._onerror, [message]);
        return;
      }
      that._state = 'closed';
    };

    this._ws.onerror = function onErrorWS(evt) {
      var message = {};
      that._state = message.state = 'terminated';
      message.reason = 'Websocket onerror fired';
      _callback(that._onerror, [message]);
    };
  }

  CallProgressHelper.prototype = {
    get state() {
      return this._state;
    },

    get reason() {
      return this._reason;
    },

    set onstatechange(onstatechange) {
      this._onstatechange = onstatechange;
    },

    set onerror(onerror) {
      this._onerror = onerror;
    },

    set onready(onready) {
      this._onreadyExternal = onready;
    },

    _onready: function cph_onready() {

      this._onreadyExternal();

      if (!this._messageQueue) {
        return;
      }
      while (this._messageQueue.length) {
        this._send(this._messageQueue.pop());
      }
    },

    _send: function cph_send(message) {
      if (!this._ready) {
        if (!this._messageQueue) {
          this._messageQueue = [];
        }
        this._messageQueue.push(message);
        return;
      }
      if (typeof message.cb === 'function') {
        message.cb();
        delete message.cb;
      }
      debug && console.log("Sending message " + JSON.stringify(message));
      this._ws.send(JSON.stringify(message));
    },

    accept: function cph_accept() {
      this._send({
        messageType: 'action',
        event: 'accept'
      });
    },

    mediaUp: function cph_mediaUp() {
      this._send({
        messageType: 'action',
        event: 'media-up'
      });
    },

    terminate: function cph_terminate(reason, cb) {
      this._send({
        messageType: 'action',
        event: 'terminate',
        reason: reason,
        cb: cb
      });
    },

    finish: function cph_finish() {
      this._ws.close();
    }
  };

  exports.CallProgressHelper = CallProgressHelper;
}(this));
