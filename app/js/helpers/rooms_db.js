/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/**
 * Rooms DB
 *
 * This code will be in charge of keeping and maintain a cache of the
 * rooms created and the ones we get an invitation, storing as well
 * all events related with the RoomObject.
 * Events will be:
 *   - Room Created: Time and subject
 *   - Room Renamed: Time and new subject
 *   - Anyone Joined: Time and Who
 *   - I joined: Time
 *   - Communication established: Time and with who
 *
 * The object will have the following schema:
 *
 * RoomSchema: {
 *   roomToken: <string> (primary key),
 *   roomUrl: <string>,
 *   roomName: <string> (index),
 *   roomOwner: <string>,
 *   maxSize: <Number>,
 *   creationTime: <Date> (index),
 *   expiresAt: <Date>,
 *   ctime: <Date>,
 *   localCtime: <Date> (index), // Automatically updated
 *   events: [
 *     {
 *       // EventObject
 *       id: <Number>,
 *       action: <String>,
 *       date: <Date> (index),
 *       params: {}
 *     }
 *   ]
 * }
 *
 * Based on this info, we will expose the methods under the Object
 * RoomsDB, you can check above.
 */

(function(exports) {
  'use strict';

  // TODO Remove this in bug
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1101490
  var _dummyObject = {};
  var _dummyObjects = [];

  var RoomsDB = {
    /**
     * Store a room in our DB.
     *
     * param room
     *       Object created from the API.
     * return Promise.  The resolved promise will contain no params.
     *                  The rejected promise, an error string.
     */
    create: function(room) {
      return Promise.resolve(room);
    },

    /**
     * Get a room in our DB given a token.
     *
     * param token
     *       String which identify a room.
     * return Promise.  The resolved promise will contain as result the room
     *                  The rejected promise, an error string.
     */
    get: function(token) {
      return Promise.resolve(_dummyObject);
    },

    /**
     * Get all rooms stored in our DB given a filter and
     * sorting.
     *
     * param field
     *       String which identify field in RoomSchema.
     * param sorting
     *       String. This could be 'ASC' or 'DESC' based on the
     * sorting we want. By default is 'DESC'
     * return Promise.  The resolved promise will contain as result a cursor
     *                  with all the rooms.
     *                  The rejected promise, an error string.
     */
    getAll: function(field, sorting) {
      return Promise.resolve();
    },

    /**
     * Delete a room in our DB given a token.
     *
     * param token
     *       String which identify a room.
     * return Promise.  The resolved promise will contain no params.
     *                  The rejected promise, an error string.
     */
    delete: function(tokensArray) {
      return Promise.resolve();
    },

    /**
     * Change room name in our DB.
     *
     * param token
     *       String which identify a room.
     * param name
     *       String. New name of the room.
     * param expiresAt
     *       String. New expiration date coming from API.
     * return Promise.  The resolved promise will contain no params.
     *                  The rejected promise, an error string.
     */
    changeName: function(token, name, expiresAt) {
      return Promise.resolve();
    },
    
    /**
     * Update all rooms created by us in our DB.
     *
     * param rooms
     *       Array which contain all rooms we created as owner.
     * return Promise.  The resolved promise will contain no params.
     *                  The rejected promise, an error string.
     */
    update: function(rooms) {
      // TODO If rooms is an object, we must encapsulate this in an Array.
      return Promise.resolve();
    },
    
    /**
     * Store an event in a specific Room.
     *
     * param token
     *       String which identify a room.
     * param eventObject
     *       Object with all params to store.
     * return Promise.  The resolved promise will contain the EventObject stored.
     *                  The rejected promise, an error string.
     */
    addEvent: function(token, eventObject) {
      return Promise.resolve(_dummyObject);
    },
    
    /**
     * Delete a room in our DB given a token.
     *
     * param token
     *       String which identify a room.
     * param eventIds
     *       Array with all event IDs to remove
     * return Promise.  The resolved promise will contain no params.
     *                  The rejected promise, an error string.
     */
    deleteEvent: function(token, eventIds) {
      return Promise.resolve();
    },
    
    /**
     * Get all events given a room token
     *
     * param token
     *       String which identify a room.
     * return Promise.  The resolved promise will contain as result a cursor
     *                  with all the events given a room token.
     *                  The rejected promise, an error string.
     */
    getEvents: function(token) {
      return Promise.resolve(_dummyObjects);
    }
  };

  exports.RoomsDB = RoomsDB;

})(window);
