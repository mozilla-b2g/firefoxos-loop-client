'use strict';

/**
 *
 * How do Firefox Hello versions work?
 *
 * First release: 1.1 (major: 1, minor: 1)
 * Revisions: 1.1.0.x (where 'x' is an integer, e.g: 8 or 43)
 *
 * Second release 1.1.1 (major: 1, minor: 1.1)
 * Revisions: 1.1.1.x (where 'x' is an integer, e.g: 6 or 69)
 *
 * Version can be suffixed with 'd' in the manifest file to denote development
 * for telemetry (see bug 1093497).
 * 
 */

(function(exports) {

  const PREV_VERSION_PROP = 'loop.previous.version';

  const FIRST_MAJOR_VERSION = '1';

  const FIRST_MINOR_VERSION = '1.0.0';

  var previous, current;

  function Version(str) {
    str = str ? str.replace(/[a-zA-Z]/g, '') : (FIRST_MAJOR_VERSION + '.' +
                                                FIRST_MINOR_VERSION);
    var parts = str.split('.');
    this.major = parts[0];
    this.minor = parts.slice(1).toString().replace(/\s*,\s*|\s+,/g, '.');
    while (this.minor.length < FIRST_MINOR_VERSION.length) {
      this.minor += '.0';
    }
  }

  Version.prototype.toString = function() {
    return this.major + '.' + this.minor;
  }

  function getCurrent() {
    if (current) {
      return Promise.resolve(current);
    }

    return new Promise((resolve, reject) => {
      var self = navigator.mozApps.getSelf();

      self.onsuccess = (evt) => {
        var manifest = evt.target.result.manifest;
        current = current || new Version(manifest.version);
        resolve(current);
      };

      self.onerror = () => {
        current = current || new Version();
        resolve(current);
      };
    });
  }

  function getPrevious() {
    if (previous) {
      return Promise.resolve(previous);
    }

    return new Promise((resolve, reject) => {
      asyncStorage.getItem(PREV_VERSION_PROP, (value) => {
        previous = previous || value || new Version();
        resolve(previous);
      });
    });
  }

  function updatePrevious() {
    if (current.toString() === previous.toString()) {
      return;
    }

    asyncStorage.setItem(PREV_VERSION_PROP, current);
  }

  function getVersionInfo() {
    var result = {};

    return new Promise((resolve, reject) => {
      Promise.all([
        getCurrent().then((version) => {
          result.current = version;
        }),
        getPrevious().then((version) => {
          result.previous = version;
        })
      ]).then(() => {
        resolve(result);
        updatePrevious();
      }, reject);
    });
  }

  exports.VersionHelper = {
    getVersionInfo: getVersionInfo
  };

})(window);
