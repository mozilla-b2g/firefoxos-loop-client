/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function(window) {
  'use strict';

  window.hawkCredentials = new Promise(function(defineHC, reject) {

    var PREFIX_NAME = 'identity.mozilla.com/picl/v1/';
    // hash length is 32 because only SHA256 is used at this moment
    var HASH_LENGTH = 32;

    // Methods that will be available on the hawkCredential promise
    // when it's resolved:
    var hC = {
      emptyKey: null,
      bin2hex: null,
      str2bin: null,
      hex2bin: null,
      concatBin: null,
      hkdf: null,
      derive: null
    };


    // Not exported functions whose implementation depends of if we're using
    // window.crypto or sjcl.
    var doImportKey,
        doHMAC,
        bitSlice,
        newEmptyArray;

    /**
     * hkdf - The HMAC-based Key Derivation Function
     *
     * @class hkdf
     * @param {bitArray} ikm Initial keying material
     * @param {bitArray} info Key derivation data
     * @param {bitArray} salt Salt
     * @param {integer} length Length of the derived key in bytes
     * @return promise object- It will resolve with `output` data
     */
    hC.hkdf = function(ikm, info, salt, length) {

      var numBlocks = Math.ceil(length / HASH_LENGTH);

      function doHKDFRound(roundNumber, prevDigest, prevOutput, hkdfKey) {
        // Do the data accumulating part of an HKDF round. Also, it
        // checks if there are still more rounds left and fires the next
        // Or just finishes the process calling the callback.
        function addToOutput(digest) {
          var output = prevOutput + hC.bin2hex(digest);

          if (++roundNumber <= numBlocks) {
            return doHKDFRound(roundNumber, digest, output, hkdfKey);
          } else {
            return new Promise(function(resolve, reject) {
              var truncated = bitSlice(hC.hex2bin(output), 0, length * 8);
              resolve(truncated);
            });
          }
        }
        var input = hC.concatBin(
          hC.concatBin(prevDigest, info),
          hC.str2bin(String.fromCharCode(roundNumber)));
        return doHMAC(input, hkdfKey).then(addToOutput);
      };

      return doImportKey(salt). // Imports the initial key
        then(doHMAC.bind(undefined, ikm)). // Generates the key deriving key
        then(doImportKey). // Imports the key deriving key
        then(doHKDFRound.bind(undefined, 1, newEmptyArray(), ''));
      // Launches the first HKDF round
    };

    /**
     * @class hawkCredentials
     * @method derive
     * @param {String} tokenHex
     * @param {String} context
     * @param {int} size
     * @returns {Promise}
     */
    hC.derive = function(tokenHex, context, size) {
      var token = hC.hex2bin(tokenHex);
      var info = hC.str2bin(PREFIX_NAME + context);

      return hC.hkdf(token, info, hC.emptyKey, size || 3 * 32).then(out => {
          var id = hC.bin2hex(bitSlice(out, 0 , 8 * 32));
          var authKey = hC.bin2hex(bitSlice(out, 8 * 32, 8 * 64));
          // Note that we're currently not using this. Still, passing it
          // in a portable way, just in case we use it at some point.
          var bundleKey = hC.bin2hex(bitSlice(out, 8 * 64));
          return {
            algorithm: 'sha256',
            id: id,
            key: authKey,
            bundleKey: bundleKey
          };
      });
    };


    // If we have WebCrypto available, we default to webcrypto implementations.
    // Otherwise, we'll need to load sjcl and use that implementation.
    if (!window.useSJCLCrypto && window.crypto.subtle) {
      var subtle = window.crypto.subtle;

      // This should be equivalent to:
      // var emptyKey = new Uint8Array(0);
      // According to FIPS-198-1, Section 4, step 3. Sadly it isn't.
      hC.emptyKey = new Uint8Array(HASH_LENGTH);

      hC.concatBin = function concatU8Array(buffer1, buffer2) {
        var aux = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        aux.set(new Uint8Array(buffer1), 0);
        aux.set(new Uint8Array(buffer2), buffer1.byteLength);
        return aux;
      };

      // Convert an ArrayBufferView to a hex string
      hC.bin2hex = function abv2hex(abv) {
        var b = new Uint8Array(abv.buffer, abv.byteOffset, abv.byteLength);
        var hex = "";
        for (var i=0; i <b.length; ++i) {
          var zeropad = (b[i] < 0x10) ? "0" : "";
          hex += zeropad + b[i].toString(16);
        }
        return hex;
      };

      // Convert a hex string to an ArrayBufferView
      hC.hex2bin = function hex2abv(hex) {
        if (hex.length % 2 !== 0) {
          hex = "0" + hex;
        }
        var abv = new Uint8Array(hex.length / 2);
        for (var i=0; i<abv.length; ++i) {
          abv[i] = parseInt(hex.substr(2*i, 2), 16);
        }
        return abv;
      };

      var tEncoder = new TextEncoder('utf8');
      hC.str2bin = tEncoder.encode.bind(tEncoder);

      var alg = {
        name: "HMAC",
        hash: "SHA-256"
      };
      doImportKey = rawKey => subtle.importKey('raw', rawKey, alg,
                                               false, ['sign']);

      doHMAC = (tbsData, hmacKey) =>
        subtle.sign(alg.name, hmacKey, tbsData).
          then(result =>
                ((result.buffer && result) || new Uint8Array(result)));

      bitSlice = (arr, start, end) =>
        (end !== undefined ? arr.subarray(start / 8, end / 8) :
         arr.subarray(start / 8));

      newEmptyArray = () => new Uint8Array(0);

      defineHC(hC);

    } else {
      LazyLoader.load(['libs/sjcl.min.js'], () => {
        hC.hex2bin = sjcl.codec.hex.toBits;
        hC.bin2hex = sjcl.codec.hex.fromBits;
        hC.str2bin = sjcl.codec.utf8String.toBits;
        hC.concatBin = sjcl.bitArray.concat;
        bitSlice = sjcl.bitArray.bitSlice;
        newEmptyArray = () => sjcl.codec.hex.toBits('');
        hC.emptyKey = newEmptyArray();

        doImportKey = rawKey =>
          Promise.resolve(rawKey);

        doHMAC = (tbsData, hmacKey) =>
          new Promise(function(resolve, reject) {
            var mac = new sjcl.misc.hmac(hmacKey, sjcl.hash.sha256);
            mac.update(tbsData);
            resolve(mac.digest());
          });

        defineHC(hC);
      });
    };
  });

})(window);
