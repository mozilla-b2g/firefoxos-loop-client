(function(exports) {
  'use strict';

  var _countdownElements;
  var _counter = 0;
  var _counterTimer = null;

  var debug = Config.debug;

  function _beautify(value) {
    if (value < 10) {
      return '0' + value;
    } else {
      return value;
    }
  }

  function _reset() {
    _counter = 0;
    _paint(0, 0);
  }

  function _paint(minutes, seconds) {
    var len = _countdownElements.length;
    minutes = _beautify(minutes);
    seconds = _beautify(seconds);
    for (var i = 0; i < len; i++) {
      _countdownElements[i].textContent = minutes + ':' + seconds;
    }
  }

  var Countdown = {
    init: function () {
      _countdownElements = document.querySelectorAll('.counter');
      _reset();
      return this;
    },
    start: function(element) {
      if (_counterTimer !== null) {
        debug && console.log('Warning, a countdown timer is running!');
        return;
      }
      _counterTimer = setInterval(function() {
        ++_counter;
        var minutes = Math.floor(_counter/60);
        var seconds = Math.floor(_counter%60);
        _paint(minutes, seconds);
      }, 1000);
    },
    stop: function() {
      clearInterval(_counterTimer);
      _counterTimer = null;
      return _counter;
    },
    reset: function() {
      _reset();
    }
  };

  exports.Countdown = Countdown;

}(this));
