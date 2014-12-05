'use strict';

require('js/config.js');
require('js/helpers/call_helper.js');
require('js/helpers/client_request_helper.js');

suite('CallHelper >', function() {

  suite('Generate Call Url function', function() {
    var ClientRequestHelperGenerateCallUrlStub;

    setup(function() {
      ClientRequestHelperGenerateCallUrlStub =
        sinon.stub(ClientRequestHelper, 'generateCallUrl').callsArgWith(
	        1, {call_url: 'http://loop-server.com'});
    });

    teardown(function() {
      console.log("Restoring!");
      ClientRequestHelperGenerateCallUrlStub.restore();
    });

    test('Id parameter present', function(done) {
      CallHelper.generateCallUrl({ callerId: 'partnerId'},
                                 function onSuccess(result) {
                                   chai.assert.isTrue(result.call_url.startsWith('http://'));
                                   done();
                                 },
                                 function onError(error) {
                                   chai.assert.fail("", "", "Got an unexpected error " + JSON.stringify(error));
                                   done();
                                 }
      );
    });

    test('Id parameter not present', function(done) {
      CallHelper.generateCallUrl(null, function onSuccess(result) {
            chai.assert.fail("", "", "Got an unexpected success: " + JSON.stringify(result));
            done();
          },
          function onError(result) {
            chai.assert.isNotNull(result);
            done();
          }
      );
    });
  });
});

