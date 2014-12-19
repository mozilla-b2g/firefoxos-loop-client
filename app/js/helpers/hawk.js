(function(window) {

  // Declare namespace
  window.hawk = {
    headerVersion: '1',

    utils: {
      now: () => new Date().getTime(),

      escapeHeaderAttribute:
        attribute => attribute.replace(/\\/g, '\\\\').replace(/\"/g, '\\"'),

      parseContentType: header =>
        (!header ? '' :
         header.split(';')[0].replace(/^\s+|\s+$/g, '').toLowerCase()),

      parseAuthorizationHeader: function (header, keys) {

        if (!header) {
          return null;
        }

        // Header: scheme[ something]
        var headerParts = header.match(/^(\w+)(?:\s+(.*))?$/);
        if (!headerParts) {
          return null;
        }

        var scheme = headerParts[1];
        if (scheme.toLowerCase() !== 'hawk') {
          return null;
        }

        var attributesString = headerParts[2];
        if (!attributesString) {
          return null;
        }

        var attributes = {};
        var verify =
          attributesString.
            replace(/(\w+)="([^"\\]*)"\s*(?:,\s*|$)/g, function ($0, $1, $2) {

            // Check valid attribute names
            if (keys.indexOf($1) === -1) {
              return null;
            }

            // Allowed attribute value characters:
            // !#$%&'()*+,-./:;<=>?@[]^_`{|}~ and space, a-z, A-Z, 0-9
            var onlyValidChars =
              /^[ \w\!#\$%&'\(\)\*\+,\-\.\/\:;<\=>\?@\[\]\^`\{\|\}~]+$/;
            if ($2.match(onlyValidChars) === null) {
              return null;
            }

            // Check for duplicates
            if (attributes.hasOwnProperty($1)) {
              return null;
            }

            attributes[$1] = $2;
            return '';
        });

        if (verify !== '') {
          return null;
        }

        return attributes;
      },

      randomString: function (size) {
        var randomSource =
          'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var len = randomSource.length;
        var result = [];

        // Use window.crypto.getRandomValues that should be available from
        // b2g32 and upwards
        var indexes = new Uint8Array(size);
        window.crypto.getRandomValues(indexes);
        for (var i = 0; i < size; ++i) {
          result[i] = randomSource[indexes[i] % len];
        }

        return result.join('');
      },

      parseUri: function (input) {
        var uri = new URL(input);
        var port = uri.port;
        if (!port || port === "") {
          port = (uri.protocol === 'http:' ? '80' :
                  (uri.protocol === 'https:' ? '443' : ''));
        }
        return {
          hostname: uri.hostname,
          relative: uri.pathname + uri.search,
          port: port
        };
      },

      generateNormalizedString: function (type, options) {
        var normalized = 'hawk.' + hawk.headerVersion + '.' + type + '\n' +
                          options.ts + '\n' +
                          options.nonce + '\n' +
                          (options.method || '').toUpperCase() + '\n' +
                          (options.resource || '') + '\n' +
                          options.host.toLowerCase() + '\n' +
                          options.port + '\n' +
                          (options.hash || '') + '\n';

        if (options.ext) {
          normalized += options.ext.replace('\\', '\\\\').replace('\n', '\\n');
        }

        normalized += '\n';

        if (options.app) {
          normalized += options.app + '\n' +
            (options.dlg || '') + '\n';
        }

        return normalized;
      }
    }


  };

  // Crypto related functions might need a external library, so let's
  // defer its fulfulling.
  window.hawk.crypto = new Promise(function(resolve, reject) {
    var hawk = window.hawk;

    // This will store the fulfilled value for the window.hawkCredentials
    var hawkCreds;

    var crypto = {

      // Generate an Authorization header for a given request

      /*
       uri: 'http://example.com/resource?a=b'
       method: HTTP verb (e.g. 'GET', 'POST')
       options: {

       // Required
       credentials: {
       id: 'dh37fgj492je',
       key: 'aoijedoaijsdlaksjdl',
       algorithm: 'sha256'                                 // 'sha1', 'sha256'
       },

       // Optional
       // Application specific data sent via the ext attribute
       ext: 'application-specific',
       // A pre-calculated timestamp in seconds
       timestamp: Date.now() / 1000,
       // A pre-generated nonce
       nonce: '2334f34f',
       // Time offset to sync with server time (ignored if timestamp provided)
       localtimeOffsetMsec: 400,
       // UTF-8 encoded string for body hash generation (ignored if hash
       // provided)
       payload: '{"some":"payload"}',
       // Payload content-type (ignored if hash provided)
       contentType: 'application/json',
       // Pre-calculated payload hash
       hash: 'U4MKKSmiVxk37JCCrAVIjV=',
       // Oz application id
       app: '24s23423f34dx',
       // Oz delegated-by application id
       dlg: '234sz34tww3sd'
       }
       */

      getClientHeader: function (uri, method, options) {
        var result = {
          field: '',
          artifacts: {}
        };

        // Validate inputs

        if (!uri || (typeof uri !== 'string' && typeof uri !== 'object') ||
            !method || typeof method !== 'string' ||
            !options || typeof options !== 'object') {

          result.err = 'Invalid argument type';
          return result;
        }

        // Application time

        var timestamp = options.timestamp ||
          Math.floor((hawk.utils.now() + (options.localtimeOffsetMsec || 0)) /
                     1000);

        // Validate credentials

        var credentials = options.credentials;
        if (!credentials ||
            !credentials.id ||
            !credentials.key ||
            !credentials.algorithm) {

          result.err = 'Invalid credential object';
          return result;
        }

        if (crypto.algorithms.indexOf(credentials.algorithm) === -1) {
          result.err = 'Unknown algorithm';
          return result;
        }

        // Parse URI

        if (typeof uri === 'string') {
          uri = hawk.utils.parseUri(uri);
        }

        // Calculate signature

        var artifacts = {
          ts: timestamp,
          nonce: options.nonce || hawk.utils.randomString(6),
          method: method,
          resource: uri.relative,
          host: uri.hostname,
          port: uri.port,
          hash: options.hash,
          ext: options.ext,
          app: options.app,
          dlg: options.dlg
        };

        result.artifacts = artifacts;

        // Calculate payload hash

        var hashPromise = Promise.resolve(undefined);
        if (!artifacts.hash &&
            options.hasOwnProperty('payload')) {
          hashPromise = crypto.calculatePayloadHash(options.payload,
                                                    credentials.algorithm,
                                                    options.contentType);
        }

        return hashPromise.
          then(hashValue => {
            artifacts.hash = artifacts.hash || hashValue;
            return crypto.calculateMac('header', credentials,artifacts);
          }).then(mac => {
          // Construct header

          // Other falsey values allowed
          var hasExt = artifacts.ext !== null && artifacts.ext !== undefined &&
            artifacts.ext !== '';
          var header =
            'Hawk id="' + credentials.id +
              '", ts="' + artifacts.ts +
              '", nonce="' + artifacts.nonce +
              (artifacts.hash ? '", hash="' + artifacts.hash : '') +
              (hasExt ? '", ext="' +
                        hawk.utils.escapeHeaderAttribute(artifacts.ext) : '') +
              '", mac="' + mac + '"';

          if (artifacts.app) {
            header += ', app="' + artifacts.app +
              (artifacts.dlg ? '", dlg="' + artifacts.dlg : '') + '"';
          }

          result.field = header;

          return result;
        });
      },

      algorithms: ['sha256'],

      calculateMac: function (type, credentials, options) {
        var normalized = hawk.utils.generateNormalizedString(type, options);
        var hc = hawkCreds;
        return hc.doImportKey(hc.str2bin(credentials.key)).
          then(hc.doHMAC.bind(undefined, hc.str2bin(normalized))).
          then(hc.bin2base64);
      },

      calculatePayloadHash: function (payload, algorithm, contentType) {
        var dataToHash = 'hawk.' + hawk.headerVersion + '.payload\n' +
          hawk.utils.parseContentType(contentType) + '\n' + (payload || '') +
          '\n';
        console.log("dataToHash = " + dataToHash);
        var hc = hawkCreds;
        return hc.doMAC(dataToHash).then(hc.bin2base64);
      }

    };


    // So as to not do twice the same work, we need to load the hawkCredentials
    // util functions. We might as well do this here.
    LazyLoader.load(['js/helpers/hawk_creds.js'], () => {
      window.hawkCredentials.then(hc => {
        hawkCreds = hc;
        resolve(crypto);
      });
    });

  });

})(window);
