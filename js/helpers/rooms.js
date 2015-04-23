(function(exports) {
  'use strict';

  /*
   * Interface based on the API exposed in [1]. Ensure that this API is
   * in your Loop server!
   *
   * [1] https://wiki.mozilla.org/Loop/Architecture/Rooms
   */

  var Rooms = {
    // Retrieve all rooms
    getAll: function() {
      return new Promise(function(resolve, reject) {
        ClientRequestHelper.getRooms(resolve, reject);
      });
    },
    // Retrieve all rooms given a version number
    getChanges: function(version) {
      return new Promise(function(resolve, reject) {
        ClientRequestHelper.getRoomsChanges(version, resolve, reject);
      });
    },
    // Create one room given some params
    create: function(params) {
      return new Promise(function(resolve, reject) {
        ClientRequestHelper.createRoom(params, resolve, reject);
      });
    },
    // Update params of a room (based on token) previosly created.
    update: function(token, params) {
      return new Promise(function(resolve, reject) {
        ClientRequestHelper.updateRoom(token, params, resolve, reject);
      });
    },
    // Get info from a room given a token
    get: function(token) {
      return new Promise(function(resolve, reject) {
        ClientRequestHelper.getRoom(token, resolve, reject);
      });
    },
    // Delete rooms given a list of tokens
    delete: function(tokens) {
      if (!Array.isArray(tokens)) {
        tokens = [tokens];
      }
      return new Promise(function(resolve, reject) {
        ClientRequestHelper.deleteRooms(tokens, resolve, reject);
      });
    },
    // Join a room given a token
    join: function(token, params) {
      return new Promise(function(resolve, reject) {
        ClientRequestHelper.joinRoom(token, params, resolve, reject);
      });
    },
    // Refresh my status in order to keep me connected to a room.
    // This must be done periodically
    refresh: function(token) {
      return new Promise(function(resolve, reject) {
        ClientRequestHelper.refreshRoom(token, resolve, reject);
      });
    },
    // Leave a room and indicates the reason
    leave: function(token) {
      return new Promise(function(resolve, reject) {
        ClientRequestHelper.leaveRoom(token, resolve, reject);
      });
    }
  };

  exports.Rooms = Rooms;

}(this));
