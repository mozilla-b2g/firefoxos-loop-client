/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {
  var SERVER_URL = Config.input_mozilla_url;
  const TIMEOUT = 1500;
  const DEBUG = true;
  const PRODUCT = 'Loop';
  const PLATFORM = 'Firefox OS';
  const HAPPY = 'Happy user';
  const SAD = 'Sad user';

  var _feedback;

  function _callback(cb, args) {
    if (cb && typeof cb === 'function') {
      cb.apply(null, args);
    }
  }

  /**
   * We store in disk the feedback that for any reason can not be sent when it
   * is provided by the user.
   */
  function _getFeedback(feedback, callback) {
    var description = feedback.description;
    if (!description || !description.length) {
      // The description field is mandatory and cannot be empty.
      description = feedback.happy ? HAPPY : SAD;
    }

    if (Array.isArray(description)) {
      description = description.join(', ');
    }

    var feedback = {
      product: PRODUCT,
      platform: PLATFORM,
      happy: feedback.happy,
      description: description,
      url: feedback.url
    };

    // If we already tried to get the previously stored feedback, we just add
    // the new feedback and return.
    if (_feedback) {
      _feedback.push(feedback);
      DEBUG && console.log('Existing feedback ' + JSON.stringify(_feedback));
      _callback(callback, [_feedback]);
      return;
    }

    // Otherwise, we need to try to get not sent feedback from disk before
    // returning.
    _feedback = [];
    window.asyncStorage.getItem('feedback', function(value) {
      if (!value) {
        _feedback = [];
      }
      _feedback.push(feedback);
      _callback(callback, [_feedback]);
    });
  }

  function _removeFeedback(index) {
    DEBUG && console.log('Removing ' + index + ' from ' +
                         JSON.stringify(_feedback));
    _feedback.splice(index, 1);
  }

  function _saveFeedback() {
    window.asyncStorage.setItem('feedback', _feedback);
  }

  function _request(options, onsuccess, onerror) {
    var req = new XMLHttpRequest({mozSystem: true});
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

    req.send(body);
  }

  function _onsuccess(index, length, callback) {
    return function() {
      // If we were able to send the feedback, we remove it from the
      // local cache that will be stored in disk once all the feedback
      // is sent (or tried to send).
      DEBUG && console.log('Feedback sent ' + JSON.stringify(_feedback[index]));
      _removeFeedback(index);
      if (index == length) {
        // Once we are done trying to send all the feedback, we store the
        // remaining feedback that could not be sent if any and return
        _saveFeedback();
        _callback(callback, []);
      }
    };
  }

  function _onerror(index, length, callback) {
    return function() {
      console.error('Could not send feedback ');
      if (index == length) {
        _saveFeedback();
        _callback(callback, []);
      }
    };
  }

  var FeedbackClient = {
    sendFeedback: function(newFeedback, callback) {
      _getFeedback(newFeedback, function(feedback) {
        for (var i = 0, l = feedback.length; i < l; i++) {
          _request({
            method: 'POST',
            url: SERVER_URL,
            body : feedback[i]
          }, _onsuccess(i, l, callback), _onerror(i, l, callback));
        }
      });
    }
  };

  exports.FeedbackClient = FeedbackClient;
})(this);
