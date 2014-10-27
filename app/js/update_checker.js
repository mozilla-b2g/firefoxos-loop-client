'use strict';

(function(exports) {

  /*
   * This variable indicates the number of retries when there was a connection
   * problem.
   */
  var retries = Config.maxVersionCheckAttempts;

  function closeApp() {
    window.close();
  }

  function showUpdateDialog(app) {
    var onMozL10nReady = function() {
      new OptionMenu({
        section:  Branding.getTranslation('newUpdateAvailable'),
        type: 'confirm',
        items: [{
          name: 'Cancel',
          l10nId: 'cancel',
          method: closeApp
        }, {
          name: 'Download',
          l10nId:'download',
          class: 'recommend',
          method: function onDownload() {
            app.download();
            closeApp();
          }
        }]
      });
    };

    if (navigator.mozL10n.readyState === 'complete') {
      onMozL10nReady();
    } else {
      navigator.mozL10n.ready(onMozL10nReady);
    }
  }

  function connected() {
    return new Promise(function(resolve, reject) {
      if (navigator.onLine) {
        resolve();
      } else {
        window.addEventListener('online', function onConnect() {
          window.removeEventListener('online', onConnect);
          resolve();
        });
      }
    });
  }

  function checkForUpdate(app) {
    if (--retries < 0) {
      return;
    }

    var req = app.checkForUpdate();

    req.onsuccess = function(event) {
      app.downloadAvailable && showUpdateDialog(app);
    };

    req.onerror = function(error) {
      if (error.name === 'NETWORK_ERROR') {
        connected().then(checkForUpdate.bind(null, app));
      }
    };
  }

  exports.UpdateChecker = {
    check: function() {
      navigator.mozApps.getSelf().onsuccess = function(evt) {
        var app = evt.target.result;
        connected().then(checkForUpdate.bind(null, app));
      };
    }
  };

})(window);
