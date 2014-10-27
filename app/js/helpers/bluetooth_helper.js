/* exported BluetoothHelper */

'use strict';

(function(exports) {

  var _profiles = {
    'HFP': 0x111E
  };

  var _bluetooth = null;
  var _isReady = false;
  var _callbacks = [];

  var _adapter = null;

  var _ready = function(callback) {
    if (!callback || !_bluetooth) {
      return;
    }
    if (_isReady) {
      callback();
    } else {
      _callbacks.push(callback);
    }
  };

  var _handleRequest = function(request, callback, errorcb) {
    request.onsuccess = function() {
      if (callback) {
        callback(request.result);
      }
    };
    request.onerror = function(evt) {
      var name = (request.error && request.error.name) || 'unknown';
      if (errorcb) {
        errorcb();
      }
    };
  };

  var _getAdapter = function() {
    var req = _bluetooth.getDefaultAdapter();
    req.onsuccess = function() {
      _isReady = true;
      _adapter = req.result;

      _callbacks.forEach(function(callback) {
        callback();
      });
    };
    req.onerror = function() {
      // We can do nothing without default adapter.
      console.log('Bluetooth: connot get default adapter!!!');
    };
  };

  function BluetoothHelper() {
    _bluetooth = window.navigator.mozBluetooth;
    if (!_bluetooth) {
      return;
    }

    _bluetooth.addEventListener('enabled', _getAdapter);
    _bluetooth.addEventListener('adapteradded', _getAdapter);
    _getAdapter();
  }

  BluetoothHelper.prototype = {
    profiles: _profiles,
    getConnectedDevicesByProfile: function(profileID, cb) {
      _ready(function() {
        _handleRequest(_adapter.getConnectedDevices(profileID), cb);
      });
    },

    connectSco: function(cb) {
      _ready(function() {
        _handleRequest(_adapter.connectSco(), cb);
      });
    },

    disconnectSco: function(cb) {
      _ready(function() {
        _handleRequest(_adapter.disconnectSco(), cb);
      });
    },

    isScoConnected: function(cb) {
      _ready(function() {
        _handleRequest(_adapter.isScoConnected(), cb);
      });
    },

    set onhfpstatuschanged(callback) {
      _ready(function() {
        _adapter.onhfpstatuschanged = callback;
      });
    },

    set onscostatuschanged(callback) {
      _ready(function() {
        _adapter.onscostatuschanged = callback;
      });
    }
  };

  exports.BluetoothHelper = BluetoothHelper;
})(this);
