Config = {
  version: '1.1',
  debug: false,
  // Server URL. It might be (depending on the environment):
  //   Development: 'http://loop.dev.mozaws.net'
  //   Stage: 'https://loop.stage.mozaws.net'
  //   Prod: 'https://loop.services.mozilla.com'
  server_url: 'https://loop.services.mozilla.com',
  channel: 'mobile', // The release channel of the calling client.
  performanceLog: {
    enabled: false,
    persistent: false
  },
  metrics: {
    enabled: true,
    feedback: {
      serverUrl: 'https://input.allizom.org/api/v1/feedback'
    },
    telemetry: {
      serverUrl: 'https://fxos.telemetry.mozilla.org/submit/telemetry'
    }
  },
  // This parameters defaults to false
  // (don't allow unsecure connections) if undefined
  allowUnsecure: false,
  offline: {
    signInDelay: 60 * 1000, // 1 min
    maxSignInAttempts: 3 // Max number of sign in attempts before logging out.
  },
  maxVersionCheckAttempts: 3 // Max number of retries checking version.
};

window.OTProperties = {
  version: 'v2.2.9.1'
};
window.OTProperties.assetURL = '../libs/tokbox/' + window.OTProperties.version + '/';
window.OTProperties.configURL = window.OTProperties.assetURL + 'js/dynamic_config.min.js';
window.OTProperties.cssURL = window.OTProperties.assetURL + 'css/ot.css';
