/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {
  const DEBUG = Config.debug;

  const TELEMETRY_SERVER_URL = Config.metrics.telemetry.serverUrl;
  const REPORT_INTERVAL = Config.metrics.telemetry.reportInterval ||
                          24 * 60 * 60 * 1000; // 1 day
  const SAFE_TIME = 0.1 * 60 * 1000; // 1 min

  // We record the number of shared and published URLs.
  const SHARED_URLS = 'sharedUrls';
  const GENERATED_URLS = 'generatedUrls';
  // The number of logins with MobileID and FxA.
  const MOBILEID_LOGINS = 'mobileIdLogins';
  const FXA_LOGINS = 'fxaLogins';
  // The number of calls made with each ID.
  const OUTGOING_CALLS_WITH_MOBILEID = 'outgoingCallsWithMobileId';
  const OUTGOING_CALLS_WITH_FXA = 'outgoingCallsWithFxA';
  const INCOMING_CALLS_WITH_MOBILEID = 'incomingCallsWithMobileId';
  const INCOMING_CALLS_WITH_FXA = 'incomingCallsWithFxA';
  // The source of the calls.
  const CALLS_FROM_CONTACT_DETAILS = 'callsFromContactDetails';
  const CALLS_FROM_CONTACT_PICKER = 'callsFromContactPicker';
  const CALLS_FROM_CALL_LOG = 'callsFromCallLog';
  const CALLS_FROM_URL = 'callsFromUrl';
  // The duration of the calls.
  const CALLS_DURATION = 'callsDuration';
  // The network type used for the call.
  // We only care about cellular or wifi.
  const CALLS_WITH_CELLULAR = 'callsWithCellular';
  const CALLS_WITH_WIFI = 'callsWithWifi';

  const LAST_REPORT = 'telemetry-last-report';

  const THROTTLE_DELAY = 10 * 1000; // 10 sec

  const REPORT_VERSION = 1;

  var _updateLock = null;
  var _updateQueue = [];

  function _getReportUrl(report) {
    if (!report) {
      return;
    }
    // Telemetry Loop report urls should have this format:
    // TELEMETRY_SERVER_URL/UUID/loop/FirefoxOS/VERSION/UPDATE_CHANNEL/BUILD_ID
    return [TELEMETRY_SERVER_URL, uuid(), report.info.reason,
            report.info.appName, report.info.appVersion,
            report.info.appUpdateChannel, report.info.appBuildID].join('/');
  }

  /**
   * Base class for telemetry reports.
   * Reports must contain at least the mandatory parameters described at
   * https://github.com/mozilla/telemetry-server/blob/master/telemetry/telemetry_schema.json
   */
  function TelemetryReport(version) {
    this.ver = REPORT_VERSION;
    this.info = {
      reason: 'loop',
      appName: 'FirefoxOS',
      appUpdateChannel: 'default',
      appBuildID: Version.id || 'unknown',
      appVersion: Config.version || 'unknown'
    };

    [GENERATED_URLS, SHARED_URLS, MOBILEID_LOGINS, FXA_LOGINS,
     CALLS_FROM_CONTACT_DETAILS, CALLS_FROM_CONTACT_PICKER,
     CALLS_FROM_CALL_LOG, CALLS_FROM_URL, CALLS_WITH_CELLULAR,
     CALLS_WITH_WIFI, OUTGOING_CALLS_WITH_MOBILEID,
     OUTGOING_CALLS_WITH_FXA, INCOMING_CALLS_WITH_MOBILEID,
     INCOMING_CALLS_WITH_FXA].forEach((type) => {
       this[type] = 0;
    });
    this[CALLS_DURATION] = [];
  }

  function Telemetry() {
    Metrics.call(this, 'telemetry');

    var self = this;
    // Schedule the next transmission to the telemetry servers.
    asyncStorage.getItem(LAST_REPORT, function(date) {
      var now = Date.now();
      if (!date) {
        date = now;
      }

      var timeSinceLastReport = now - date;
      if (timeSinceLastReport < 0) {
        timeSinceLastReport = 0;
      }

      var timeout = REPORT_INTERVAL - timeSinceLastReport;
      if (timeout < 0) {
        timeout = 0;
      }
      timeout += SAFE_TIME;

      DEBUG && console.log('Scheduled next report in ' + timeout + 'ms');

      setTimeout(function() {
        self.get(function(report) {
          if (!report) {
            return;
          }

          if (Array.isArray(report)) {
            report = report[0] || null;
          }

          self.transmit(report, _getReportUrl(report), THROTTLE_DELAY,
            function() {
              DEBUG && console.log('Setting ' + LAST_REPORT);
              asyncStorage.setItem(LAST_REPORT, Date.now());
            });
        });
      }, timeout);
    });
  }

  Telemetry.prototype = {
    __proto__: Metrics.prototype,

    _updateReport: function(type, value) {

      if (_updateLock) {
        _updateQueue.push({
          type: type,
          value: value
        })
        return;
      }

      _updateLock = true;

      var self = this;

      this.get(function(report) {
        if (Array.isArray(report)) {
          report = report[0] || null;
        }

        if (!report) {
          report = new TelemetryReport();
        }

        if (report[type] == undefined) {
          throw new Error('Unknown metric type ' + type);
        }

        (report[type].push && report[type].push(value)) || report[type]++;

        self.save(report, function() {
          _updateLock = false;
          for (var i = 0, l = _updateQueue.length; i < l; i++) {
            var update = _updateQueue.shift();
            self._updateReport(update.type, update.value);
          }
        });
      });
    },

    recordGeneratedUrl: function() {
      this._updateReport(GENERATED_URLS);
    },

    recordSharedUrl: function() {
      this._updateReport(SHARED_URLS)
    },

    recordMobileIdLogin: function() {
      this._updateReport(MOBILEID_LOGINS);
    },

    recordFxALogin: function() {
      this._updateReport(FXA_LOGINS);
    },

    recordOutgoingCallWithMobileId: function() {
      this._updateReport(OUTGOING_CALLS_WITH_MOBILEID);
    },

    recordOutgoingCallWithFxA: function() {
      this._updateReport(OUTGOING_CALLS_WITH_FXA);
    },

    recordIncomingCallWithMobileId: function() {
      this._updateReport(INCOMING_CALLS_WITH_MOBILEID);
    },

    recordIncomingCallWithFxA: function() {
      this._updateReport(INCOMING_CALLS_WITH_FXA);
    },

    recordCallFromContactDetails: function() {
      this._updateReport(CALLS_FROM_CONTACT_DETAILS);
    },

    recordCallFromContactPicker: function() {
      this._updateReport(CALLS_FROM_CONTACT_PICKER);
    },

    recordCallFromCallLog: function() {
      this._updateReport(CALLS_FROM_CALL_LOG);
    },

    recordCallFromUrl: function() {
      this._updateReport(CALLS_FROM_URL);
    },

    recordCallWithCellular: function() {
      this._updateReport(CALLS_WITH_CELLULAR);
    },

    recordCallWithWifi: function() {
      this._updateReport(CALLS_WITH_WIFI);
    },

    recordCallDuration: function(duration) {
      if (duration === undefined || duration === null) {
        return;
      }
      this._updateReport(CALLS_DURATION, duration);
    }

  };

  exports.Telemetry = new Telemetry();

})(this);
