
require("./libs/hawk.js");

var testCases = [
  {
    uri: "https://any.url.will.do/here/for/this",
    method: "POST",
    options:{
      timestamp: 1231355112,
      nonce: "asag32",
      credentials: {
        algorithm: "sha256",
        id: "f67bcc25b640723f289efa10f721269d26658cfe0e505edde952ce7524e7e75f",
        key: "11a48ad4cc4190bfa735fb74f8f809455686f10667ff45dd3ab516576728ac7e"
      }
    },
    expectedOutput: {
      field: "Hawk id=\"f67bcc25b640723f289efa10f721269d26658cfe0e505edde952ce7524e7e75f\", ts=\"1231355112\", nonce=\"asag32\", mac=\"lZEca42blRLTS+vkSjk8N0Jq30viBr5FD1Kfknw7Z44=\"",
      artifacts: {
        ts: 1231355112,
        nonce: "asag32",
        method: "POST",
        resource: "/here/for/this",
        host: "any.url.will.do",
        port: "443"
      }
    }
  },
  {
    uri: "http://an.unsecure.host.com/with/a/path",
    method: "GET",
    options:{
      timestamp: 123235121,
      nonce: "ADggse",
      credentials: {
        algorithm: "sha256",
        id: "f67bcc25b640723f289efa10f721269d26658cfe0e505edde952ce7524e7e75f",
        key: "11a48ad4cc4190bfa735fb74f8f809455686f10667ff45dd3ab516576728ac7e"
      }
    },
    expectedOutput: {
      field: "Hawk id=\"f67bcc25b640723f289efa10f721269d26658cfe0e505edde952ce7524e7e75f\", ts=\"123235121\", nonce=\"ADggse\", mac=\"njHOc7CLJYkkFxSrW8W/rgWGk7uFwDJpROpEY318T3g=\"",
      artifacts: {
        ts: 123235121,
        nonce: "ADggse",
        method: "GET",
        resource: "/with/a/path",
        host: "an.unsecure.host.com",
        port: "80"
      }
    }
  },
  {
    uri: "https://any.url.will.do/here/for/this",
    method: "GET",
    options:{
      timestamp: 123671256,
      nonce : "zjNulA",
      credentials: {
        algorithm: "sha256",
        id: "f67bcc25b640723f289efa10f721269d26658cfe0e505edde952ce7524e7e75f",
        key: "11a48ad4cc4190bfa735fb74f8f809455686f10667ff45dd3ab516576728ac7e"
      }
    },

    expectedOutput: {
      field: "Hawk id=\"f67bcc25b640723f289efa10f721269d26658cfe0e505edde952ce7524e7e75f\", ts=\"123671256\", nonce=\"zjNulA\", mac=\"crLkfNetp5b6T4coPKn5XyxNipimfGmCSJiSYfdqX8M=\"",
      artifacts: {
        ts: 123671256,
        nonce: "zjNulA",
        method: "GET",
        resource: "/here/for/this",
        host: "any.url.will.do",
        port: "443"
      }
    }
  },
  {
    uri: "http://an.unsecure.host.com/with/a/path",
    method: "POST",
    options:{
      timestamp: 12367891,
      nonce: "fKBqOP",
      credentials: {
        algorithm: "sha256",
        id: "f67bcc25b640723f289efa10f721269d26658cfe0e505edde952ce7524e7e75f",
        key: "11a48ad4cc4190bfa735fb74f8f809455686f10667ff45dd3ab516576728ac7e"
      }
    },

    expectedOutput: {
      field: "Hawk id=\"f67bcc25b640723f289efa10f721269d26658cfe0e505edde952ce7524e7e75f\", ts=\"12367891\", nonce=\"fKBqOP\", mac=\"YuKL1SrR+aQvddE+ev52wx+Qbp22+bqg3dFZ7B+TrWw=\"",
      artifacts: {
        ts: 12367891,
        nonce: "fKBqOP",
        method: "POST",
        resource: "/with/a/path",
        host: "an.unsecure.host.com",
        port: "80"
      }
    }
  },
  {
    uri: "https://any.url.will.do/here/for/this",
    method: "POST",
    options:{
      timestamp: 1231355112,
      nonce: "asag32",
      credentials: {
        algorithm: "sha256",
        id: "1efc3bb0e12ece9309bad58d4fe0aeb34c068ff32be6af4b1d71fccc343117ef",
        key: "0ad7c708f683e1d11fcd0180836a38ca9ad418f2794c619ed52398378f8413ab"
      }
    },
    expectedOutput: {
      field: "Hawk id=\"1efc3bb0e12ece9309bad58d4fe0aeb34c068ff32be6af4b1d71fccc343117ef\", ts=\"1231355112\", nonce=\"asag32\", mac=\"rY+OVEK3LvSBLvlT2VT94P9oU1hzHS0NWW5fI+bH2FI=\"",
      artifacts: {
        ts: 1231355112,
        nonce: "asag32",
        method: "POST",
        resource: "/here/for/this",
        host: "any.url.will.do",
        port: "443"
      }
    }
  },
  {
    uri: "http://an.unsecure.host.com/with/a/path",
    method: "GET",
    options:{
      timestamp: 123235121,
      nonce: "ADggse",
      credentials: {
        algorithm: "sha256",
        id: "1efc3bb0e12ece9309bad58d4fe0aeb34c068ff32be6af4b1d71fccc343117ef",
        key: "0ad7c708f683e1d11fcd0180836a38ca9ad418f2794c619ed52398378f8413ab"
      }
    },
    expectedOutput: {
      field: "Hawk id=\"1efc3bb0e12ece9309bad58d4fe0aeb34c068ff32be6af4b1d71fccc343117ef\", ts=\"123235121\", nonce=\"ADggse\", mac=\"Lfs6N4/6a/ixCLV/4fX5u+rJcmRv79ZZ3xI3tzpuCQQ=\"",
      artifacts: {
        ts: 123235121,
        nonce: "ADggse",
        method: "GET",
        resource: "/with/a/path",
        host: "an.unsecure.host.com",
        port: "80"
      }
    }
  },
  {
    uri: "https://any.url.will.do/here/for/this",
    method: "GET",
    options:{
      timestamp: 123671256,
      nonce: "pggYrb",
      credentials: {
        algorithm: "sha256",
        id: "1efc3bb0e12ece9309bad58d4fe0aeb34c068ff32be6af4b1d71fccc343117ef",
        key: "0ad7c708f683e1d11fcd0180836a38ca9ad418f2794c619ed52398378f8413ab"
      }
    },
    expectedOutput: {
      field: "Hawk id=\"1efc3bb0e12ece9309bad58d4fe0aeb34c068ff32be6af4b1d71fccc343117ef\", ts=\"123671256\", nonce=\"pggYrb\", mac=\"w7Lvzte34vmfqe/3syn1Cd2/F0CP15C2QJ4FaphDIjg=\"",
      artifacts: {
        ts: 123671256,
        nonce: "pggYrb",
        method: "GET",
        resource: "/here/for/this",
        host: "any.url.will.do",
        port: "443"
      }
    }
  },
  {
    uri: "http://an.unsecure.host.com/with/a/path",
    method: "POST",
    options:{
      timestamp: 12367891,
      nonce: "fKBqOP",
      credentials: {
        algorithm: "sha256",
        id: "1efc3bb0e12ece9309bad58d4fe0aeb34c068ff32be6af4b1d71fccc343117ef",
        key: "0ad7c708f683e1d11fcd0180836a38ca9ad418f2794c619ed52398378f8413ab"
      }
    },
    expectedOutput: {
      field: "Hawk id=\"1efc3bb0e12ece9309bad58d4fe0aeb34c068ff32be6af4b1d71fccc343117ef\", ts=\"12367891\", nonce=\"fKBqOP\", mac=\"ylqIeymibk8UbzLXihPnHvXwb4D50L/vIAFarRBFSgs=\"",
      artifacts: {
        ts: 12367891,
        nonce: "fKBqOP",
        method: "POST",
        resource: "/with/a/path",
        host: "an.unsecure.host.com",
        port: "80"
      }
    }
  },
  {
    uri: "https://any.url.will.do/here/for/this",
    method: "POST",
    options:{
      timestamp: 1231355112,
      nonce: "asag32",
      credentials: {
        algorithm: "sha256",
        id: "0bec7687f590420d87ca9fca442ae454efc1e1067afe5dba3b37405c62ed0fd9",
        key: "83c4eeeb1b2d67367e3101dc81060f1f0183de7a3a6d24c6bda25d8eea9649e8"
      }
    },
    expectedOutput: {
      field: "Hawk id=\"0bec7687f590420d87ca9fca442ae454efc1e1067afe5dba3b37405c62ed0fd9\", ts=\"1231355112\", nonce=\"asag32\", mac=\"8EaaiZdgjna4pN18WTmLb1WaRw+n/jqBnS7Sa7ydxJk=\"",
      artifacts: {
        ts: 1231355112,
        nonce: "asag32",
        method: "POST",
        resource: "/here/for/this",
        host: "any.url.will.do",
        port: "443"
      }
    }
  },
  {
    uri: "http://an.unsecure.host.com/with/a/path",
    method: "GET",
    options:{
      timestamp: 123235121,
      nonce: "ADggse",
      credentials: {
        algorithm: "sha256",
        id: "0bec7687f590420d87ca9fca442ae454efc1e1067afe5dba3b37405c62ed0fd9",
        key: "83c4eeeb1b2d67367e3101dc81060f1f0183de7a3a6d24c6bda25d8eea9649e8"
      }
    },
    expectedOutput: {
      field: "Hawk id=\"0bec7687f590420d87ca9fca442ae454efc1e1067afe5dba3b37405c62ed0fd9\", ts=\"123235121\", nonce=\"ADggse\", mac=\"YYn7ntN752o+tAcugmF1eY6IBz4XpUsL/lLesMpwpr8=\"",
      artifacts: {
        ts: 123235121,
        nonce: "ADggse",
        method: "GET",
        resource: "/with/a/path",
        host: "an.unsecure.host.com",
        port: "80"
      }
    }
  },
  {
    uri: "https://any.url.will.do/here/for/this",
    method: "GET",
    options:{
      timestamp: 123671256,
      nonce: "MFucGB",
      credentials: {
        algorithm: "sha256",
        id: "0bec7687f590420d87ca9fca442ae454efc1e1067afe5dba3b37405c62ed0fd9",
        key: "83c4eeeb1b2d67367e3101dc81060f1f0183de7a3a6d24c6bda25d8eea9649e8"
      }
    },
    expectedOutput: {
      field: "Hawk id=\"0bec7687f590420d87ca9fca442ae454efc1e1067afe5dba3b37405c62ed0fd9\", ts=\"123671256\", nonce=\"MFucGB\", mac=\"MEJ39Atpj1IuZuZHQkYfRMZ3K0ENDAd8pNkd22g0bSI=\"",
      artifacts: {
        ts: 123671256,
        nonce: "MFucGB",
        method: "GET",
        resource: "/here/for/this",
        host: "any.url.will.do",
        port: "443"
      }
    }
  },
  {
    uri: "http://an.unsecure.host.com/with/a/path",
    method: "POST",
    options:{
      timestamp: 12367891,
      nonce: "fKBqOP",
      credentials: {
        algorithm: "sha256",
        id: "0bec7687f590420d87ca9fca442ae454efc1e1067afe5dba3b37405c62ed0fd9",
        key: "83c4eeeb1b2d67367e3101dc81060f1f0183de7a3a6d24c6bda25d8eea9649e8"
      }
    },
    expectedOutput: {
      field: "Hawk id=\"0bec7687f590420d87ca9fca442ae454efc1e1067afe5dba3b37405c62ed0fd9\", ts=\"12367891\", nonce=\"fKBqOP\", mac=\"kOmxlgZHgWyp+5TfbJoGjw5+iuHWNXZTCC5P29JYbkg=\"",
      artifacts: {
        ts: 12367891,
        nonce: "fKBqOP",
        method: "POST",
        resource: "/with/a/path",
        host: "an.unsecure.host.com",
        port: "80"
      }
    }
  }
];

var extraUndefinedProperties = ['app', 'dlg', 'ext', 'hash'];

suite("Hawk tests > ", function()  {
  testCases.forEach(function(testCase) {
    // Due to the way we generated the test cases, we need to
    // add some extra properties.
    for(var i = 0, len = extraUndefinedProperties.length; i < len; i++) {
      testCase.expectedOutput.artifacts[extraUndefinedProperties[i]] = undefined;
    }
    test('Key: ' + testCase.options.credentials.id.substring(0,5) +
         ' ' + testCase.method + ' ' + testCase.uri, function(done) {
      var testOutput =
        hawk.client.header(testCase.uri, testCase.method, testCase.options);
      chai.assert.deepEqual(testCase.expectedOutput, testOutput);
      done();
    });
  });
});
