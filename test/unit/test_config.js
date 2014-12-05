/* globals Config */

'use strict';

require('js/config.js');

suite('Tests config', function() {
  suite('Config health', function() {
    test('Config should exist', function() {
      chai.assert.isNotNull(Config);
    });
  });
});
