'use strict';

require('/apps/firefoxos-loop-client/js/call_helper.js');
require('/apps/firefoxos-loop-client/js/client_request_helper.js');

suite('CallHelper >', function() {

  suite('Generate Call Url function', function() {
    var ClientRequestHelperGenerateCallUrlStub;

    suite('Id parameter passed in', function() {
      setup(function() {
	ClientRequestHelperGenerateCallUrlStub =
	  this.sinon.stub(ClientRequestHelper, 'generateCallUrl').callsArgWith(
	    1, {call_url: 'http://loop-server.com'});
      });

      teardown(function() {
	ClientRequestHelperGenerateCallUrlStub.restore();
      });

      test('test', function(done) {
	CallHelper.generateCallUrl('peerId',
	  function onSuccess(result) {
	    assert.isTrue(result.call_url.startsWith('http://'));
	    done();
	  });
      });
    });

    suite('Id parameter not passed in', function() {
      test('test', function(done) {
	CallHelper.generateCallUrl(null, null,
	  function onError(result) {
	    assert.isNotNull(result);
	    done();
	  });
      });
    });
  });
});
