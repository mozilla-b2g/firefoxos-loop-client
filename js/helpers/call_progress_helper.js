/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/** exported CallProgressHelper */

/** globals WebSocket */

'use strict';

(function(exports) {
  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  /**
   * The CallProgressHelper object helps the loop client logic to implement the
   * client side part of the call progress protocol implemented by the server.
   */
  function CallProgressHelper(callId, progressURL, token) {
    this._state = 'unknown';
    this._callId = callId;
    this._token = token;
    this._ws = new WebSocket(progressURL);
    this._onstatechange = null;
    this._onerror = null;

    var that = this;
    this._ws.onmessage = function onWSMessage(evt) {
      var message = JSON.parse(evt.data);
      if (message.messageType === 'progress') {
        that._state = message.state;
        _callback(that._onstatechange, [message]);
      }
      if (message.messageType === 'error') {
        that._state = message.state = 'error';
        _callback(that._onerror, [message]);
      }
    };
    this._ws.onopen = function onOpenWS(evt) {
      that._ws.send(JSON.stringify({
        messageType: 'hello',
        auth: that._token,
        callId: that._callId
      }));
    };
    this._ws.onclose = function onCloseWS(evt) {
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

    set onstatechange(onstatechange) {
      this._onstatechange = onstatechange;
    },

    set onerror(onerror) {
      this._onerror = onerror;
    },

    accept: function cph_accept() {
     this._ws.send(JSON.stringify({
          messageType: 'action',
          event: 'accept'
      }));
    },

    mediaUp: function cph_mediaUp() {
     this._ws.send(JSON.stringify({
          messageType: 'action',
          event: 'media-up'
      }));
    },

    terminate: function cph_terminate(reason) {
     this._ws.send(JSON.stringify({
          messageType: 'action',
          event: 'terminate',
          reason: reason
      }));
    },

    finish: function cph_finish() {
      this._ws.close();
    }
  };

  exports.CallProgressHelper = CallProgressHelper;
}(this));
