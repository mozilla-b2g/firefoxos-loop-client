(function(exports) {

  // We will accept a list of channels to be listened, and each channel must
  // have the structure below.
  // [
  //   {
  //     channel: $NAME, // $NAME is the name of the channel
  //     handler: function() {}
  //   },
  //   ....
  // ]
  // If any of the channels is incomplete, or we can not register to that
  // channel properly, we will execute a rollback in order to get wrong
  // NotificationChannels

  var NotificationChannels = {
    // Create a channel adding a handler
    // @param Array List of channels to be subscribed
    listen: function(channels) {
      if (!Array.isArray(channels) || channels.length === 0) {
        return Promise.reject(
          new Error('NotificationChannels: No channels to listen')
        );
      }

      var _channels = channels.slice();
      return new Promise(function(resolve, reject) {
        // Cache endpoint per channel created
        var endpoints = {};
        
        function _rollback() {
          // If there is any issue, we will remove all channels
          SimplePush.reset();
          reject(
            new Error('NotificationChannels: Some channels with no params')
          );
        }

        function _registerChannel() {
          if (_channels.length === 0) {
            // Once we are done, we resolve the promise and we start listening
            SimplePush.start();
            resolve(endpoints);
            return;
          }

          var channel = _channels.pop();
          if (!channel.name ||
              !channel.handler ||
              typeof channel.handler !== 'function') {
            // If any of the params is invalid, we remove all channels
            _rollback();
          }

          SimplePush.createChannel(
            channel.name,
            channel.handler,
            function(e, endpoint) {
              if (e) {
                _rollback();
                return;
              }
              if (!endpoint) {
                reject(new Error('Invalid endpoint'));
                return;
              }
              endpoints[channel.name] = endpoint;
              _registerChannel();
            }
          );
        }

        // Let's start registering all channels
        _registerChannel();
      }); 
    },
    reset: function() {
      SimplePush.reset();
    }
  };

  exports.NotificationChannels = NotificationChannels;
}(this));
