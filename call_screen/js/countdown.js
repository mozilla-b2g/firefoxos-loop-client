(function(exports) {
  'use strict';

  var _countdownUI;
  var _counter = 0;
  var _counterTimer;

  function _beautify(value) {
    if (value < 10) {
      return '0' + value;
    } else {
      return value;
    }
  }
  
  function _reset() {
    _counter = 0;
  }

  var Countdown = {
    init: function () {
      _countdownUI = document.getElementById('counter');
      _reset();
      return this;
    },
    start: function(element) {
      _reset();
      _counterTimer = setInterval(function() {
        ++_counter;
        var minutes = _beautify(Math.round(_counter/60));
        var seconds = _beautify(Math.round(_counter%60));
        _countdownUI.textContent = minutes + ':' + seconds;
      }, 1000);
    },
    stop: function() {
      clearInterval(_counterTimer);
      return _counter;
    },
    reset: function() {
      _reset();
    }
  };

  exports.Countdown = Countdown;

}(this));
