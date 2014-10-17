/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

(function(exports) {

  var _registry = {};

  var _run = Date.now();

  var PerfLog = {
    startTracing: function(name) {
      if (!Config.performanceLog.enabled) {
        return;
      }

      if (_registry[name]) {
        console.warn('Already tracing ' + name);
        return;
      }

      _registry[name] = {
        start: Date.now(),
        logs: [],
        milestones: []
      };
    },

    log: function log(name, record) {
      if (!Config.performanceLog.enabled || !_registry[name]) {
        return;
      }
      _registry[name].logs.push({
        timestamp: Date.now(),
        record: record
      });
    },

    milestone: function milestone(name, milestoneName) {
      if (!Config.performanceLog.enabled || !_registry[name]) {
        return;
      }
      _registry[name].milestones.push({
        name: milestoneName,
        timestamp: Date.now()
      });
    },

    stopTracing: function stopTracing(name) {
      if (!Config.performanceLog.enabled || !_registry[name]) {
        return;
      }

      var logs = ['[================== PERF LOG ' + name + '===============]\n'];
      var lastTimestamp;

      console.log(logs[0]);

      while (_registry[name].logs.length) {
        var logObj = _registry[name].logs.shift();
        var log = 'Global: ' + (logObj.timestamp - _registry[name].start) + 'ms';
        log += lastTimestamp ?
               ' || Step: ' + (logObj.timestamp - lastTimestamp) + 'ms' :
               '';
        for (var i = 0, l = _registry[name].milestones.length; i < l; i++) {
          var milestone = _registry[name].milestones[i];
          var time = logObj.timestamp - milestone.timestamp;
          if (time < 0) {
            continue;
          }
          log += ' || Milestone[' + milestone.name + ']: ' + time + 'ms';
        }

        log += ' || Log: ' + logObj.record + '\n';

        lastTimestamp = logObj.timestamp;

        console.log(log);
        logs.push(log);
      }

      _registry[name] = null;

      if (!Config.performanceLog.persistent) {
        return;
      }

      var file = new Blob(logs, { type: 'text/plain' });
      var sdcard = navigator.getDeviceStorage('sdcard');
      sdcard.addNamed(file, name + '.' + Date.now() + '.perflog.txt')
            .onerror =function(event) {
        console.error('Could not save performance log to disk ' +
                      event.target.error.name);
      };
    }
  };

  exports.PerfLog = PerfLog;

})(this);
