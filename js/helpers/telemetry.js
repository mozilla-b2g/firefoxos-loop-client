/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function(exports) {
  const DEBUG = true;

  const TELEMETRY_SERVER_URL = Config.metrics.telemetry.serverUrl;
  const REPORT_INTERVAL = Config.metrics.telemetry.reportInterval ||
                          24 * 60 * 60 * 1000; // 1 day
  const SAFE_TIME = 0.1 * 60 * 1000; // 1 min

  const SHARED_URL = 'shared';
  const GENERATED_URL = 'generated';
  const LAST_REPORT = 'telemetry-urls-last-report';

  const THROTTLE_DELAY = 10 * 1000; // 10 sec

  // Report versions.
  const URL_REPORT_VERSION = 1;

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
    this.ver = version;
    this.info = {
      reason: 'loop',
      appName: 'FirefoxOS',
      appUpdateChannel: 'default',
      appBuildID: Version.id || 'unknown',
      appVersion: Config.version || 'unknown'
    }
  }

  function TelemetryUrlMetricsReport(generatedUrls, sharedUrls) {
    TelemetryReport.call(this, URL_REPORT_VERSION);
    // Report format version.
    this.generatedUrls = generatedUrls || 0;
    this.sharedUrls = sharedUrls || 0;
  }

  TelemetryUrlMetricsReport.prototype = {
    __proto__: TelemetryReport.prototype
  };

  function UrlMetrics() {
    Metrics.call(this, 'telemetry-urls');

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

  UrlMetrics.prototype = {
    __proto__: Metrics.prototype,

    /**
     * So far we only need to report the number of urls generated and shared
     * independently of its date. This can be done in a single report that will
     * contain an incremental number for each kind of url and will be sent
     * periodically to the telemetry servers.
     */
    _updateReport: function(type) {
      this.get(function(report) {
        if (Array.isArray(report)) {
          report = report[0] || null;
        }

        if (!report ||
            report.sharedUrls == undefined ||
            report.generatedUrls == undefined) {
          report = new TelemetryUrlMetricsReport();
        }

        if (!this.uuid) {
          this.uuid = report.uuid;
        }

        switch(type) {
          case GENERATED_URL:
            report.generatedUrls++;
            break;
          case SHARED_URL:
            report.sharedUrls++;
            break;
          default:
            throw new Error('Unknow report type');
        }

        this.save(report);
      }.bind(this));
    },

    recordGeneratedUrl: function() {
      this._updateReport(GENERATED_URL);
    },

    recordSharedUrl: function() {
      this._updateReport(SHARED_URL)
    }
  };

  exports.UrlMetrics = new UrlMetrics();

})(this);
