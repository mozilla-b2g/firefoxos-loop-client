Config = {
  version: '1.1.1d',
  debug: false,
  // Server URL. It might be (depending on the environment):
  //   Development: 'https://loop-dev.stage.mozaws.net'
  //   Stage: 'https://loop.stage.mozaws.net'
  //   Prod: 'https://loop.services.mozilla.com'
  server_url: 'https://loop.services.mozilla.com',
  request_timeout: 15000,
  channel: 'mobile', // The release channel of the calling client.
  // cfg perfLog
  performanceLog: {
    enabled: false,
    persistent: false
  },
  // end
  // cfg metrics
  metrics: {
    enabled: true,
    feedback: {
      serverUrl: 'https://input.allizom.org/api/v1/feedback'
    },
    telemetry: {
      serverUrl: 'https://fxos.telemetry.mozilla.org/submit/telemetry'
    }
  },
  // end
  // This parameters defaults to false
  // (don't allow unsecure connections) if undefined
  allowUnsecure: false,
  offline: {
    signInDelay: 60 * 1000, // 1 min
    maxSignInAttempts: 3 // Max number of sign in attempts before logging out.
  },
  maxVersionCheckAttempts: 3, // Max number of retries checking version.
  tos_url: 'https://www.mozilla.org/about/legal/terms/firefox-hello/',
  pn_url: 'https://www.mozilla.org/privacy/firefox-hello/',
  service_url: 'https://www.mozilla.org/firefox/hello/'
};

window.OTProperties = {
  version: 'v2.2.9.3'
};
window.OTProperties.assetURL = '../libs/tokbox/' + window.OTProperties.version + '/';
window.OTProperties.configURL = window.OTProperties.assetURL + 'js/dynamic_config.min.js';
window.OTProperties.cssURL = window.OTProperties.assetURL + 'css/ot.css';
