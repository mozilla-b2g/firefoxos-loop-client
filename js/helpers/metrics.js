/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {

  const DEBUG = true;

  const TIMEOUT = Config.metrics.timeout || 20 * 1000; // 20 seconds
  const RETRY_INTERVAL = Config.metrics.retryInterval ||
                         10 * 60 * 1000; // 10 min

  var _retry = null;

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  function _request(options, onsuccess, onerror) {
    if (!navigator.onLine) {
      _callback(onerror, ['Offline']);
      return;
    }

    var req = new XMLHttpRequest({ mozSystem: true });
    req.open(options.method, options.url, true);
    req.setRequestHeader('Content-Type', 'application/json');
    req.responseType = 'json';
    req.timeout = TIMEOUT;

    req.onload = function() {
      if (req.status !== 200 && req.status !== 201 &&
          req.status !== 204 && req.status !== 302) {
         _callback(onerror, [req.statusText]);
        return;
      }

      _callback(onsuccess, [req.response]);
    };

    req.onerror = req.ontimeout = function(event) {
      console.error('Request error ' + event.target.status);
      _callback(onerror, [event.target.status]);
    };

    var body;
    if (options.body) {
      try {
        body = JSON.stringify(options.body);
      } catch(e) {
        console.error(e);
        _callback(onerror, [e]);
        return;
      }
    }

    DEBUG && console.log('Request body ' + body);
    req.send(body);
  }

  function Metrics(type) {
    if (!type) {
      throw new Error('Missing or invalid metrics type');
    }
    this._type = type;
  }

  Metrics.prototype = {
    get: function(callback) {
      window.asyncStorage.getItem(this._type, callback);
    },

    save: function(reports) {
      DEBUG && console.log('Saving reports ' + JSON.stringify(reports));
      window.asyncStorage.setItem(this._type, reports);
    },

    transmit: function(reports, serverUrl, throttleDelay, ondone) {
      if (!reports) {
        ondone && ondone();
        return;
      }

      if (_retry) {
        DEBUG && console.log('Canceling retry');
        clearTimeout(_retry);
        _retry = null;
      }

      DEBUG && console.log('Sending ' + JSON.stringify(reports) + ' to ' +
                           serverUrl);

      if (!Array.isArray(reports)) {
        reports = [reports];
      }

      var pendingRequests = reports.length;

      var self = this;
      function _onresponse(index, success) {
        return function() {
          if (success) {
            // We remove successfully sent reports from memory.
            DEBUG && console.log('Report successfully sent');
            reports.splice(index, 1);
          } else {
            console.error('Could not send report. Retrying in ' +
                          RETRY_INTERVAL + 'ms');
          }

          // And if we are done sending, we save to disk the reports after the
          // transmission and schedule a retry if needed.
          // It is possible that we crash while sending the reports and in that
          // case we might not remove the already sent reports from disk, so
          // the next transmission may include duplicated reports. But I'd
          // rather have a case with duplicated report transmissions than the
          // overhead of an I/O operation per each step.
          pendingRequests--;
          if (!pendingRequests) {
            clearInterval(interval);
            self.save(reports);
            ondone && ondone();
            if (reports.length) {
              _retry = setTimeout(function() {
                self.transmit.call(self, reports, serverUrl, throttleDelay);
              }, RETRY_INTERVAL);
            }
          }
        };
      }

      var index = 0;
      var interval = setInterval(function() {
        if (index > reports.length) {
          return;
        }
        _request({
          method: 'POST',
          url: serverUrl,
          body: reports[index]
        }, _onresponse(index, true), _onresponse(index, false));
        index++;
      }, throttleDelay);
    }
  };

  function noop() {};

  exports.Metrics = Config.metrics && Config.metrics.enabled ?
                    Metrics :
                    { transmit: noop, save: noop, get: noop };

})(this);
