Config = {
  "version": "1.1.1d",
  "debug": false,
  "server_url": "https://loop.services.mozilla.com",
  "request_timeout": 15000,
  "channel": "mobile",
  "performanceLog": {
    "enabled": false,
    "persistent": false
  },
  "metrics": {
    "enabled": true,
    "feedback": {
      "serverUrl": "https://input.mozilla.org/api/v1/feedback"
    },
    "telemetry": {
      "serverUrl": "https://fxos.telemetry.mozilla.org/submit/telemetry"
    }
  },
  "allowUnsecure": false,
  "offline": {
    "signInDelay": 60000,
    "maxSignInAttempts": 3
  },
  "maxVersionCheckAttempts": 3,
  "tos_url": "https://www.mozilla.org/about/legal/terms/firefox-hello/",
  "pn_url": "https://www.mozilla.org/privacy/firefox-hello/",
  "service_url": "https://www.mozilla.org/firefox/hello/"
};

window.OTProperties = {
  "version": "v2.2.9.3",
  "assetURL": "../libs/tokbox/v2.2.9.3/",
  "configURL": "../libs/tokbox/v2.2.9.3/js/dynamic_config.min.js",
  "cssURL": "../libs/tokbox/v2.2.9.3/css/ot.css"
};
