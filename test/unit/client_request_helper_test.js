'use strict';

require('/apps/firefoxos-loop-client/js/client_request_helper.js');
require('/apps/firefoxos-loop-client/test/unit/mock_xmlhttprequest.js');

var mocksHelperForClientRequest = new MocksHelper([
  'XMLHttpRequest'
]);

mocksHelperForClientRequest.init();

suite('ClientRequestHelper >', function() {

  var mocksHelper = mocksHelperForClientRequest;

  suiteSetup(function() {
    mocksHelper.suiteSetup();
  });

  setup(function() {
    mocksHelper.setup();
  });

  teardown(function() {
    mocksHelper.teardown();
  });

  suiteTeardown(function() {
    mocksHelper.suiteTeardown();
  });

  [{
    name: 'Register',
    route: '/registration',
    method: 'register',
    args: ['http://arandomurl'],
    body: function() {
      return JSON.stringify({
        'simple_push_url': 'http://arandomurl'
      });
    },
    request: 'POST'
  }, {
    name: 'Generate call URL',
    route: '/call-url',
    method: 'generateCallUrl',
    args: ['callerId'],
    body: function() {
      return JSON.stringify({
        'callerId': 'callerId'
      });
    },
    request: 'POST'
  }, {
    name: 'Get call URL',
    route: '/calls/token',
    method: 'getCallUrl',
    args: ['token'],
    body: function() {},
    request: 'GET'
  }, {
    name: 'Make call',
    route: '/calls/token',
    method: 'callUrl',
    args: ['token'],
    body: function() {},
    request: 'POST'
  }, {
    name: 'Delete call',
    route: '/calls/token',
    method: 'deleteCall',
    args: ['token'],
    body: function() {},
    request: 'DELETE'
  }, {
    name: 'Get calls',
    route: '/calls?version=version',
    method: 'getCalls',
    args: ['version'],
    body: function () {},
    request: 'GET'
  }, {
    name: 'Get call',
    route: '/calls/id/callId',
    method: 'getCall',
    args: ['callId'],
    body: function () {},
    request: 'GET'
  }, {
    name: 'Reject call',
    route: '/calls/id/callId',
    method: 'rejectCall',
    args: ['callId'],
    body: function () {},
    request: 'DELETE'
  }].forEach(function(step) {
    suite(step.name + ' >', function() {
      [200, 302].forEach(function(status) {
        suite('Success > ', function() {
          teardown(function() {
            MockXMLHttpRequest.reset();
          });

          test('Response ' + status, function(done) {
            var expectedResponse = { key: 'value' };
            var _args = [];
            for (var i = step.args.length - 1; i >= 0; i--) {
              _args.push(step.args[i]);
            }
            _args.push(function(response) {
              assert.equal(MockXMLHttpRequest.mLastMethod, step.request);
              assert.equal(MockXMLHttpRequest.mLastOpenedUrl,
                           ClientRequestHelper.serverUrl + step.route);
              assert.ok(MockXMLHttpRequest.mLastOptions);
              assert.deepEqual(MockXMLHttpRequest.mLastHeaders, {
                'Content-Type': 'application/json'
              });
              assert.equal(MockXMLHttpRequest.mLastBody, step.body());
              assert.deepEqual(response, expectedResponse);
              done();
            });

            _args.push(function() {
              assert.ok(false);
              done();
            });

            ClientRequestHelper[step.method].apply(this, _args);
            MockXMLHttpRequest.mSendOnLoad({
              status: status,
              response: expectedResponse
            });
          });
        });
      });

      suite('Error 400 > ', function() {
        var status = 400;

        teardown(function() {
          MockXMLHttpRequest.reset();
        });

        test('Response ' + status, function(done) {
          var expectedResponse = { key: 'value' };
          var _args = [];
          for (var i = step.args.length - 1; i >= 0; i--) {
            _args.push(step.args[i]);
          }
          _args.push(function(response) {
            assert.ok(false);
            done();
          });

          _args.push(function(error) {
            assert.ok(true);
            assert.equal(MockXMLHttpRequest.mLastMethod, step.request);
            assert.equal(MockXMLHttpRequest.mLastOpenedUrl,
                         ClientRequestHelper.serverUrl + step.route);
            assert.ok(MockXMLHttpRequest.mLastOptions);
            assert.deepEqual(MockXMLHttpRequest.mLastHeaders, {
              'Content-Type': 'application/json'
            });
            assert.equal(MockXMLHttpRequest.mLastBody, step.body());
            assert.deepEqual(error, expectedResponse);
            done();
          });

          ClientRequestHelper[step.method].apply(this, _args);
          MockXMLHttpRequest.mSendOnLoad({
            status: status,
            response: expectedResponse
          });
        });
      });

      suite('Error > ', function() {
        teardown(function() {
          MockXMLHttpRequest.reset();
        });

        test('.onerror', function(done) {
          var expectedResponse = { key: 'value' };
          var _args = [];
          for (var i = step.args.length - 1; i >= 0; i--) {
            _args.push(step.args[i]);
          }
          _args.push(function(response) {
            assert.ok(false);
            done();
          });
          _args.push(function(error) {
            assert.ok(true);
            assert.equal(MockXMLHttpRequest.mLastMethod, step.request);
            assert.equal(MockXMLHttpRequest.mLastOpenedUrl,
                         ClientRequestHelper.serverUrl + step.route);
            assert.ok(MockXMLHttpRequest.mLastOptions);
            assert.deepEqual(MockXMLHttpRequest.mLastHeaders, {
              'Content-Type': 'application/json'
            });
            assert.equal(MockXMLHttpRequest.mLastBody, step.body());
            assert.deepEqual(error, expectedResponse);
            done();
          });
          ClientRequestHelper[step.method].apply(this, _args);
          MockXMLHttpRequest.mSendError(expectedResponse);
        });
      });

    });
  });
});
