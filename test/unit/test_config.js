/* globals Config */

'use strict';

suite('Tests config', function() {
  suite('Config health', function() {
    test('Config should exist', function() {
      chai.assert.isNotNull(Config);
    });
  });
});
