Config = {
  // Server URL. It might be (depending on the environment):
  //   Development: 'http://loop.dev.mozaws.net'
  //   Stage: 'https://loop.stage.mozaws.net'
  //   Prod: 'https://loop.services.mozilla.com'
  server_url: 'https://loop.services.mozilla.com',
  input_mozilla_url: 'https://input.allizom.org/api/v1/feedback/',
  performanceLog: {
    enabled: true,
    persistent: true
  }
};

window.OTProperties = {
  version: 'v2.2.9.1'
};
window.OTProperties.assetURL = '../libs/tokbox/' + window.OTProperties.version + '/';
window.OTProperties.configURL = window.OTProperties.assetURL + 'js/dynamic_config.min.js';
window.OTProperties.cssURL = window.OTProperties.assetURL + 'css/ot.css';
