'use strict';

require('libs/lazy_loader.js');
require('js/helpers/hawk_creds.js');

suite('Token library: ' +  TOKEN_TEST +' >', function() {

  var testCases = [
    {
      token: "abcd12345678",
      context: "En un lugar de la mancha de cuyo nombre no quiero acordarme" +
        " no ha mucho tiempo que vivía un hidalgo de los de lanza en" +
        " astillero, adarga antigua, rocín flaco y galgo corredor.",
      size: undefined,
      expected: {
        hkdf: "14544a8a181397bb1ff10c2af8e95f2d04cc95940b8d73e0a4489fd104b" +
          "0c5a9db0ca3a3029b29e7ccb00f17f52749d93361c6252bd0c8a35374c22e72" +
          "5da88ad9e96e96fe8199111167f0b6b7ad38380bb9e4caad915ef82a6edee7e" +
          "b2ffe69d781e86f87130b7b970c3dddb3252f2db4f30d0f4c728703cd616a34" +
          "f451b25a",
        derive: {
          algorithm: "sha256",
          id:
            "f67bcc25b640723f289efa10f721269d26658cfe0e505edde952ce7524e7e75f",
          key:
            "11a48ad4cc4190bfa735fb74f8f809455686f10667ff45dd3ab516576728ac7e",
          bundleKey:
            "81b8744ed308a46b1224bc4d99ef36c35b628e62ae4aa129abe219ffb255a629"
        }
      }
    },
    {
      token: "deadfacefacedead",
      context: "Con diez cañones por banda, viento en popa a toda vela, no" +
        " corta el mar, sino vuela, un velero bergantín.Bajel pirata que" +
        " llaman,\npor su bravura, el Temido,\nen todo mar conocido\ndel uno" +
        " al otro confín.\n",
      size: 4*32,
      expected: {
        hkdf: "761afe87fc222f90b22713d9e8e4f4f44d55713ef5028a2860e198d806820" +
          "10be0a3b4476c79fd3f42e6aad7b1e0783af4d02a2bb18b198bdec3651dd26d41" +
          "41e948ad86210b337c1e12c79446e41e0d559d2fae8f680972044c22b7f7506f4" +
          "c0f02cd53fb8aec4ebdb951b9dc07c2b6a030297b6658b3d14ec3bf4b8b7abe40",
        derive: {
          algorithm: "sha256",
          id:
            "1efc3bb0e12ece9309bad58d4fe0aeb34c068ff32be6af4b1d71fccc343117ef",
          key:
            "0ad7c708f683e1d11fcd0180836a38ca9ad418f2794c619ed52398378f8413ab",
          bundleKey: "1b1a6f4695f64bbf81c1470b236ea7fce3e1bc60330116598f6f42" +
            "c8075e8aa350f7071bb8f68518233cb870ef2bc244029e5fc9d3e1b6223e6a7" +
            "8515b00abc9"
        }
      }
    },
    {
      token: "cadafeadebacae",
      context: "El día en que lo iban a matar, Santiago Nasar se levantó a" +
        " las 5.30 de la mañana para esperar el buque en que llegaba el" +
        " obispo.",
      size: 5*32,
      expected: {
        hkdf: "016cb06c84c708bf6c82efb78dded25b3722ab409313de436ba374f27a6" +
          "d2c7722b83ea9fea7a3e6603f31283cf0c233a1c2e17a59a4e670d26e3bc4b4" +
          "77c3596408a64dc5f40047f22d0349259b1fe838bf36c0afa43a258af6d40aa" +
          "02cd05089a62ea835be048c2aa65594d57fdb86edb733afcecd4379a392a8d9" +
          "18ccea4041ef67c6f7e621b8ed52677e027eaa333b5c2a1cf8c869c5cb18ba7" +
          "5f53d6001",
        derive: {
          algorithm: "sha256",
          id:
            "0bec7687f590420d87ca9fca442ae454efc1e1067afe5dba3b37405c62ed0fd9",
          key:
            "83c4eeeb1b2d67367e3101dc81060f1f0183de7a3a6d24c6bda25d8eea9649e8",
          bundleKey: "fd7542384d194d4aece0c2575ab2238c7ecb13e5f1d43d9d3bd0b" +
            "732a281c989915c21e7dc150e3b7fe926df68abe57fa9c1c836e1fbdfa7de6" +
            "d2f1de2b9725e5f969ed17bb5cd5e3ff60b5372a16bd6328dadd8685435b08" +
            "2fa73c781e34287"
        }
      }
    }
  ];

  testCases.forEach(function (testCase) {
    var token = testCase.token;
    var context = testCase.context;
    var size = testCase.size;

    test('HKDF function output for ' + testCase.token, function(done) {
      var expectedOutput = testCase.expected.hkdf;
      window.hawkCredentials.then( hc => {
        hc.hkdf(hc.hex2bin(token), hc.str2bin(context), hc.emptyKey,
                size || 4 * 32).
          then( out => {
            var hexOut = hc.bin2hex(out);
            chai.assert.strictEqual(hexOut, expectedOutput,
                                    'HKDF output is correct');
            done();
          });
      });
    });

    test('Derive function output for ' + testCase.token, function(done) {
      var expectedOutput = testCase.expected.derive;
      window.hawkCredentials.
        then( hc => hc.derive(token, context, size)).
        then( deriveOut => {
            chai.assert.deepEqual(deriveOut, expectedOutput,
                                  'Derive output is correct');
            done();
        });
    });

  });

});

