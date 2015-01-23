/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {
  const DEBUG = Config.debug;

  const TELEMETRY_SERVER_URL = Config.metrics.telemetry.serverUrl;
  const REPORT_INTERVAL = Config.metrics.telemetry.reportInterval ||
                          24 * 60 * 60 * 1000; // 1 day
  const SAFE_TIME = 0.1 * 60 * 1000; // 1 min

  const LAST_REPORT = 'telemetry-last-report';

  const THROTTLE_DELAY = 10 * 1000; // 10 sec

  const REPORT_VERSION = 1;

  var _updateLock = null;
  var _updateQueue = [];
  var _updateObjectFields;
  var _updateableAttributes = null;

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

    Object.keys(TelemetryReport.prototype).forEach(key => {
      var value = TelemetryReport.prototype[key];
      this[key] = value.push && [] || typeof value === 'object' && {} || 0;
    });
  }

  TelemetryReport.prototype = {
    // We record the number of shared and published URLs.
    generatedUrls: 0,
    sharedUrls: 0,
    // The number of logins with MobileID and FxA.
    mobileIdLogins: 0,
    fxaLogins: 0,
    // The source of the calls.
    callsFromContactDetails: 0,
    callsFromContactPicker: 0,
    callsFromCallLog: 0,
    callsFromUrl: 0,
    // We only care about cellular or wifi.
    callsWithCellular: 0,
    callsWithWifi: 0,
    // The number of calls made with each ID.
    outgoingCallsWithMobileId: 0,
    outgoingCallsWithFxA: 0,
    incomingCallsWithMobileId: 0,
    incomingCallsWithFxA: 0,
    // The duration of the calls.
    callsDuration: [],
    // The network type used for the call.
    audioCodecName: [],
    videoCodecName: [],
    defaultCamera: [],
    usedCamera: [],
    defaultRoomCamera: [],
    roomCamera: [],
    receivedRooms: 0,
    fteLaunch: 0,
    smsNotification: {},
    smsNotificationWithSubject: {},
    emailNotification: {},
    emailNotificationWithSubject: {},
    timesRoomRenamed: {},
    backgroundMode: {},
    numberTimesIJoined: {},
    numberEstablishedConnections: {}
  };

  function _getReportAttributes() {
    if (!_updateableAttributes) {
      _updateableAttributes = [];
      var reportAttributes = TelemetryReport.prototype;
      for (var key in reportAttributes) {
        var att = reportAttributes[key];
        !att.push && (typeof att === 'object') && _updateableAttributes.push(key);
      };
    }
    return _updateableAttributes;
  };

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

          if (!report) {
            report = new TelemetryReport();
          }

          var updatedReport =
            (_updateObjectFields &&
             _updateObjectFields(report, _getReportAttributes())) ||
            Promise.resolve(report);

          updatedReport.then(finalReport => {
            self.transmit(finalReport, _getReportUrl(finalReport), THROTTLE_DELAY,
                          function() {
                            DEBUG && console.log('Setting ' + LAST_REPORT);
                            asyncStorage.setItem(LAST_REPORT, Date.now());
                          });
            });
        });
      }, timeout);
    });
  }

  Telemetry.prototype = {
    __proto__: Metrics.prototype,

    suffixSubject: 'WithSubject',

    set updateObjectFields(callback) {
      _updateObjectFields = callback;
    },

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
        } else {
          if (report[type] == undefined) {
            var newReport = new TelemetryReport();
            // Copy the new fields..
            for(var key in newReport) {
              if (report[key] == undefined) {
                report[key] = newReport[key];
              }
            }
            newReport = null; // freeing newReport
          }
        }
        if (report[type] == undefined) {
          throw new Error('Unknown metric type ' + type);
        }

        // We have three kinds of types with different behavior:
        // * Numerics: We only need to increase
        // * Array: We push the value
        // * Object: We increase the key 'value' or we create it with 1 value
        var field = report[type];
        if (!(field.push && field.push(value) ||
            typeof field === 'number' &&  ++report[type])) {
          var key = value.toString();
          field[key] = field[key] + 1 || 1;
        }

        self.save(report, function() {
          _updateLock = false;
          for (var i = 0, l = _updateQueue.length; i < l; i++) {
            var update = _updateQueue.shift();
            self._updateReport(update.type, update.value);
          }
        });
      });
    },

    updateReport: function(name, value) {
      if (TelemetryReport.prototype[name] === undefined ||
          Array.isArray(TelemetryReport.prototype[name]) &&
          (value === undefined || value ===  null)) {
        return;
      }
      this._updateReport(name, value);
    },

    get reportAttributes() {
      return _getReportAttributes();
    }

  };

  exports.Telemetry = new Telemetry();

})(this);
