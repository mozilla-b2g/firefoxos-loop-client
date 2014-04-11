/*exported MockAsyncStorage */

'use strict';

var MockAsyncStorage = {
  value: {},
  getItem: function(key, callback) {
    if (typeof callback === 'function') {
      callback(this.value);
    }
  },
  setItem: function(key, value) {},
  removeItem: function() {},
  setup: function() {

  },
  teardown: function() {
    this.value = {};
  },
  clear: function() {}
};
