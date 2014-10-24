/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {
  const DEBUG = Config.debug;

  const PRODUCT = 'Loop';
  const PLATFORM = 'Firefox OS';
  const HAPPY = 'Happy user';
  const SAD = 'Sad user';
  const THROTTLE_DELAY = 10 * 1000; // 10 sec

  function FeedbackData(happy, description, url) {
    this.product = PRODUCT,
    this.platform = PLATFORM,
    this.happy = happy;
    this.description = description;
    this.url = url;
  }

  function Feedback() {
    Metrics.call(this, 'feedback');
  }

  Feedback.prototype = {
    __proto__: Metrics.prototype,

    send: function(feedback) {
      var description = feedback.description;
      if (!description || !description.length) {
        // The description field is mandatory and cannot be empty.
        description = feedback.happy ? HAPPY : SAD;
      }

      if (Array.isArray(description)) {
        description = description.join(', ');
      }

      this.get(function(reports) {
        if (!reports) {
          reports = [];
        }
        reports.push(new FeedbackData(feedback.happy, description,
                                      feedback.url));
        this.transmit(reports, Config.metrics.feedback.serverUrl, THROTTLE_DELAY);
      }.bind(this));
    }
  };

  exports.Feedback = new Feedback();
})(this);
