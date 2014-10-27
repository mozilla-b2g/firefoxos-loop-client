/* -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {
  var DEBUG = Config.debug;

  //change default path for gaia-component-utils
  window.packagesBaseUrl = 'libs/components/';

  function _beautify(value) {
    if (value < 10) {
      return '0' + value;
    } else {
      return value;
    }
  }

  var Utils = {
    date: {
      shared: new Date(),
      get format() {
        // Remove the accessor
        delete Utils.date.format;
        // Late initialization allows us to safely mock the mozL10n object
        // without creating race conditions or hard script dependencies
        return (Utils.date.format = new navigator.mozL10n.DateTimeFormat());
      }
    },
    getFormattedHour: function ut_getFormattedHour(time) {
      this.date.shared.setTime(+time);
      return this.date.format.localeFormat(
        this.date.shared, navigator.mozL10n.get('shortTimeFormat')
      );
    },
    getDayDate: function ut_getDayDate(time) {
      this.date.shared.setTime(+time);
      this.date.shared.setHours(0, 0, 0, 0);
      return this.date.shared.getTime();
    },
    getDurationPretty: function ut_getDurationPretty(time) {
      var minutes = _beautify(Math.floor(time/60));
      var seconds = _beautify(Math.floor(time%60));
      return minutes + ':' + seconds + ' min';
    },
    getRevokeDate: function ut_getDurationPretty(time) {
      var currentMs = (new Date()).getTime();
      var diff = time - currentMs;

      var args = {
        value: 0
      };

      if (diff > 0) {
        args.value = Math.round(diff/86400000);
      }
      return navigator.mozL10n.get('daysLeft', args);
    },
    getHeaderDate: function ut_giveHeaderDate(time) {
      var _ = navigator.mozL10n.get;
      var today = Utils.getDayDate(Date.now());
      var otherDay = Utils.getDayDate(time);
      var dayDiff = (today - otherDay) / 86400000;
      this.date.shared.setTime(+time);

      if (isNaN(dayDiff)) {
        return _('incorrectDate');
      }

      if (dayDiff < 0) {
        // future time
        return this.date.format.localeFormat(
          this.date.shared, '%x'
        );
      }

      if (dayDiff < 6) {
        return _('days-ago-long', {
          value: Math.round(dayDiff)
        });
      } else {
        return this.date.format.localeFormat(this.date.shared, '%x');
      }
    },
    /**
     * Helper function. Check whether the id parameter is a phone number.
     *
     * @param {String} id The id to check.
     *
     * @return {Boolean} Result.
     */
    isPhoneNumberValid: function u_isPhoneNumberValid(id) {
      if (id) {
        var re = /^([\+]*[0-9])+$/;
        if (re.test(id)) {
          return true;
        }
      }
      return false;
    },

    /**
     * Helper function. Check whether the id parameter is a email address.
     *
     * @param {String} id The id to check.
     *
     * @return {Boolean} Result.
     */
    isEmailValid: function u_isEmailValid(id) {
      // TODO.
      return true;
    },

    /**
     * Helper function. Unpack the given assertion.
     *
     * @param {String} assertion The assertion to unpack
     *
     * @return {Object} Unpacked assertion object.
     */
    unpackAssertion: function u_unpackAssertion(assertion) {
      var parts = assertion.split('.');
      return {
        header: atob(parts[0]),
        claim: atob(parts[1]),
        payload: atob(parts[3])
      };
    },
    /**
     * Helper function. Return the claim from the assertion.
     *
     * @param {String} assertion The assertion to unpack
     *
     * @return {Object} Claim object.
     */
    parseClaimAssertion: function u_parseClaimAssertion(assertion) {
      if (!assertion) {
        return null;
      }
      var unpacked = this.unpackAssertion(assertion);

      return unpacked.claim ?
        JSON.parse(unpacked.claim) : null;
    },

    /**
     * Simple dump function.
     *
     * @param {String} s Message.
     */
    log: function u_log(s) {
      DEBUG && console.log(s);
    },

    /**
     * If config.allowUnsecure is true return the same value received by
     * parameter. Otherwise return the url upgrading the protocol to the
     * secure version (wss for ws and https for http)
     */
    getSecureURL: function u_getSecureURL(url) {
      if (Config.allowUnsecure) {
        return url;
      }
      return url.replace(/^(http|ws):\/\//i,"$1s:\/\/");
    }
  };

  exports.Utils = Utils;
}(this));
