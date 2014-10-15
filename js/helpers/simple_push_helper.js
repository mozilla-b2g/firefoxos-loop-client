/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

(function (exports) {
  var debug = Config.debug;

  // Private handler for handling the cache of channels & endpoints
  // previously registered
  var ChannelCache = {
    CACHE_KEY: 'channels_cache',
    registeredChannels: null,
    registeredHandlers: {},

    // Retrieve a previosly stored endpoint given a channel. If the
    // cache is not in memory, we retrieve it from the storage.
    // @param channel String Channel name
    // @param callback Function Callback to be executed when the
    // endpoint is retrieved
    get: function(channelName, callback = function() {}) {
      if (this.registeredChannels) {
        // Get value from cache
        debug && console.log('Checking cache from memory');
        callback(this.registeredChannels[channelName]);
        return;
      }
      // Populate cache
      debug && console.log('Retrieving Cache');
      asyncStorage.getItem(
        this.CACHE_KEY,
        function onRetrieved(cache) {
          debug && console.log('Checking cache from memory after retrieving');
          this.registeredChannels = cache || {};
          callback(this.registeredChannels[channelName]);
        }.bind(this)
      );
    },

    // Update the cache with a new channel registered
    // @param name String Channel name
    // @param endpoint String endpoint to be registered
    update: function(name, endpoint) {
      debug && console.log('Registering ' + name + ' ' + endpoint);
      this.registeredChannels = this.registeredChannels || {};
      this.registeredChannels[name] = endpoint;
      asyncStorage.setItem(
        this.CACHE_KEY,
        this.registeredChannels
      );
    },

    // Reset all previously stored channels
    reset: function() {
      asyncStorage.removeItem(this.CACHE_KEY);
      this.registeredHandlers = {};
      this.registeredChannels = null;
      if (!navigator.push) {
        console.warn('Could not unregister push endpoints');
        return;
      }
      for (var channel in this.registeredChannels) {
        var req = navigator.push.unregister(this.registeredHandlers[channel]);
        req.onerror = console.error;
      }
    },

    // Set handler for the channels registered
    // @param endpoint String endpoint registered
    // @param handler Function Code to be executed when a push
    // messages arrives.
    setHandler: function(endpoint, handler) {
      this.registeredHandlers[endpoint] = handler;
    },

    // Execute handler
    // @param endpoint String End Point to find
    executeHandler: function(endpoint, version) {
      var handler = this.registeredHandlers[endpoint];
      if (typeof handler === 'function') {
        handler(version);
      }
    }
  };

  // Expose a simple interface to Push. This works as simple as:
  //
  // // 1) Register your channels
  // SimplePush.createChannel(
  //  'fooChannel',
  //  function(version) {
  //    // Implement your logic here
  //    // ...
  //  },
  //  function onRegistered(error, endpoint) {
  //    // Do whatever you need with the endpoint & error
  //    // 2) Start listening! This is inside the registration due to
  //    // we need to ensure that the handler was registered.
  //    // We delegate into the app the logic for registering more than
  //    // one channel recursively.
  //    SimplePush.start()
  //  });
  //

  //
  // Other methods are exposed for getting a simple endpoint, or reset
  // all channels.

  var SimplePush = {
    start: function sp_start() {
      if (!window.navigator.mozSetMessageHandler) {
        console.warn('SystemMessage are not available');
        return;
      }

      window.navigator.mozSetMessageHandler('push', function(event) {
        var endpoint = event.pushEndpoint;
        var version = event.version;

        debug && console.log('Push message from: ' + endpoint);
        debug && console.log('Push message with Version: ' + version);

        ChannelCache.executeHandler(endpoint, version);
      });
    },

    // Get an endpoint without any other logic
    // @param callback Function Code to be executed when endpoint retrieved
    register: function sp_register(callback = function() {}) {
      // Check first if simple push is available
      if (!navigator.push) {
        callback(new Error('Simple Push API not available'));
        return;
      }
      // Request an 'End point'
      var request = navigator.push.register();

      request.onsuccess = function onSuccess() {
        var endpoint = request.result;
        if (!endpoint) {
          callback(new Error('request.onsuccess: endpoint not defined'));
          return;
        }
        callback(null, endpoint);
      };

      request.onerror = function onError() {
        callback(new Error('request.onerror: endpoint not retrieved'));
      };
    },

    // Create a channel adding a handler
    // @param name String Channel name
    // @param handler Function Code to be executed when a push arrives
    // @param onregistered Function Code to be executed when endpoint
    // is known
    createChannel: function sp_createChannel(name, handler, onregistered = function() {}) {
      // Check first if simple push is available
      if (!navigator.push) {
        throw new Error('Simple Push API not available');
        return;
      }
      // Check the cache first
      ChannelCache.get(name, function onRetrieved(registeredEndpoint) {
        if (registeredEndpoint) {
          debug && console.log('Channel ' + name + ' was registered before');
          debug && console.log('Endpoint is ' + registeredEndpoint);
          onregistered(null, registeredEndpoint);
          ChannelCache.setHandler(registeredEndpoint, handler);
        } else {
          debug && console.log('We need to register the push endpoint');
          this.register(function onEndpoint(error, endpoint) {
            if (error) {
              onregistered(error);
              return;
            }
            debug && console.log('Channel ' + name + ' was NOT registered before');
            debug && console.log('Endpoint is ' + endpoint);
            // Return endpoint
            onregistered(null, endpoint);
            // Set handler
            ChannelCache.setHandler(endpoint, handler);
            // Store in Cache the new endpoint
            ChannelCache.update(name, endpoint);
          });
        }
      }.bind(this))
    },

    // This method reset all channels stored
    reset: function sp_reset() {
      ChannelCache.reset();
    }
  };

  exports.SimplePush = SimplePush;

}(this));
