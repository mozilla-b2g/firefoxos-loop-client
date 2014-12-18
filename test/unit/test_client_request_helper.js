'use strict';

require('js/config.js');
require('js/utils.js');
require('libs/lazy_loader.js');
require('js/helpers/client_request_helper.js');
require('js/helpers/loader.js');

var hawk = {
  utils: {
    now: () => Date.now()
  }
};

// This is currently only needed to run the test on the browser, not on slimerJS
mocha.globals(['hawkCredentials']);
suite('ClientRequestHelper >', function() {

  suite('signUp', function() {
    var xmlRequestStub, requests;

    setup(function() {
      requests = [];
      xmlRequestStub =
        sinon.useFakeXMLHttpRequest();
      xmlRequestStub.onCreate = xhr => {
        xhr.onreadystatechange = () => {
          if (xhr.readyState === sinon.FakeXMLHttpRequest.DONE) {
            xhr.onload && xhr.onload();
          }
        };
        requests.push(xhr);
      };
    });

    teardown(function() {
      xmlRequestStub.restore();
    });

    test('Successful BrowserID sign up', function(done) {

      var expectedHCResult = {
        type: "Hawk",
        value: {
          algorithm: "sha256",
          id: "6eff646ab2ee4f3bdc6af6d952aa9c0a541f4db922e375316898b77dcbaea935",
          key: "c9bc6b84bd72128fceab0b69c6994879470db71b92ea0cd3370c813b197efd6f",
          bundleKey: ""
        }
      };
      ClientRequestHelper.signUp({type: "BrowserID",
                                  value: "abcd1234"},"http://a.endpoint",
                                  (result, hc) => {
                                    chai.assert.deepEqual(hc, expectedHCResult,
                                    'Derive output is correct');
                                    done();
                                  },
                                 (error) => {
                                   chai.assert.fail("Success", error);
                                   done();
                                 }
      );
      chai.assert.equal(1, requests.length);
      requests[0].respond(200, {
          "Content-Type": "application/json",
          "Hawk-Session-Token": "deadfacefacedead",
          "Date": new Date().toUTCString()
        }, '[{ "this": "does not really matter" }]'); });
  });
});

