/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/** exported CallProgressHelper, WebSocket, Utils */

/** globals Config,  */

'use strict';

(function(exports) {
  var WS_SERVER_URL = Config.ws_server_url;

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  /**
   * The CallProgressHelper object helps the loop client logic to implement the
   * client side part of the call progress protocol implemented by the server.
   */
  function CallProgressHelper(callId, token) {
    this._callId = callId;
    this._token = token;
    this._ws = new WebSocket(WS_SERVER_URL);
    this._onstatechange = null;
    this._onerror = null;

    var that = this;
    this._ws.onmessage = function onWSMessage(evt) {
      var message = JSON.parse(evt.data);
      if (message.messageType === 'progress') {
        _callback(that._onstatechange, [message]);
      }
      if (message.messageType === 'error') {
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
  }

  CallProgressHelper.prototype = {
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
