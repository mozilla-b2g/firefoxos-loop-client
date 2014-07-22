/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* exported Log */

/* globals Config */

window.Log = (function() {
  'use strict';

  var _logLevel = Config.logLevel || 1; // warn by default.

  var _logMethods = ['none', 'error', 'warn', 'info', 'log', 'debug'];

  var Log = {};

  var index = _logMethods.length;
  while ( --index >= 0) {
    (function(index, level) {
      Log[level] = function() {
        if (index > _logLevel) {
          return;
        }
        var args = Array.prototype.slice.call(arguments);
        for (var i = 0, l = args.length; i < l; i++) {
          if (typeof args[i] === 'object') {
            try {
              args[i] = JSON.stringify(args[i]);
            } catch (e) {}
          }
        }
        Function.prototype.call.call(console[level], console, args);
      };
    })(index, _logMethods[index]);
  };

  return Log;
})();
