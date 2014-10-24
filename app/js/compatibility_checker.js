'use strict';

(function(exports) {

  var userAgent = navigator.userAgent;

  var regExpForVersion = /firefox\/(\d+)\.(\d+)/i;

  /*
   * It returrns an object that defines the major and minor operating system
   * versions based on user-agent header
   */
  function getVersion() {
    var version = {
      major: null,
      minor: null
    };

    var result = regExpForVersion.exec(userAgent);

    var length = result.length;
    if (result !== null && length > 1) {
      version.major = toInteger(result[1]);
      if (length > 2) {
        version.minor = toInteger(result[2]);
      }
    }

    return version;
  }

  function toInteger(str) {
    try {
      return window.parseInt(str, 10);
    } catch (ex) {
      return null;
    }
  }

  function handleError (error) {
    var showError = function() {
      window.alert(navigator.mozL10n.get(error));
      window.close();
    };

    if (navigator.mozL10n.readyState === 'complete') {
      showError();
    } else {
      navigator.mozL10n.ready(showError);
    }
  }

  function onConfirmed() {
    document.cookie = 'compatibility=confirmed';
  }

  function isConfirmed() {
    return document.cookie.contains('compatibility=confirmed');
  }

  exports.CompatibilityChecker = {
    check: function() {
      if (isConfirmed()) {
        return;
      }

      LazyLoader.getJSON('compatibility.json').then((conf) => {
        // Check device
        var matching = false;

        var deviceNames = conf.device.names;
        var length = deviceNames.length;
        for (var i = 0; i < length; i++) {
          matching = userAgent.contains(deviceNames[i]);
          if (matching) {
            break;
          }
        }

        if (!matching) {
          handleError('notCompatibleDevice');
          return;
        }

        // Check operating system version
        var majorVersion = getVersion().major;
        // No message if we aren't able to know the version
        if (majorVersion !== null &&
            majorVersion < conf.os.minimumMajorVersion) {
          handleError('oldOSVersion');
          return;
        }
        onConfirmed();
      }, (error) => {
        onConfirmed();
        console.error('Error parsing compatibility JSON file', error);
      });
    }
  };

})(window);
