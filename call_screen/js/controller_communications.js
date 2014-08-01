
(function(exports) {
  'use strict';
  var debug = true;
  var controllerWindow;

  var ControllerCommunications = {
    init: function cc_init() {
      debug && console.log('ControllerCommunications INIT');
      // We are going to communicate with Controller through post messages
      window.addEventListener(
        'message',
        function(event) {
          // We need to ensure we are receiving from the same origin
          if (event.origin !== 'app://loop.services.mozilla.com') {
            return;
          }
          // As OpenTok is using window.postMessage in the same
          // window object, we need to shield our code against this type of
          // issues
          try {
            var messageFromController = JSON.parse(event.data);
            if (messageFromController.id !== 'controller') {
              debug && console.log('CallScreen: PostMessage not from Controller');
              return;
            }

            var answer;
            controllerWindow = event.source;
            switch(messageFromController.message) {
              case 'ping':
                answer = {
                  id: 'call_screen',
                  message: 'pong'
                };
                break;
            }
            ControllerCommunications.send(answer);
          } catch(e) {}
        }.bind(this)
      );
    },
    send: function cc_send(params) {
      controllerWindow.postMessage(JSON.stringify(params), '*');
    }
  };

  exports.ControllerCommunications = ControllerCommunications;
}(this));
