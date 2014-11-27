(function(exports) {
  'use strict';
  
  /*
   * The goal of this code is to have a unique entry point to request
   * the lazy loading of a given piece of code.
   */

  var Loader = {
    getShare: function() {
      if (window.Share) {
        return Promise.resolve(Share);
      }
      return new Promise((resolve, reject) => {
        LazyLoader.load(
          ['js/helpers/share.js'],
          () => {
            resolve(Share);
          }
        );
      });
    },
    getWizard: function() {
      if (window.Wizard) {
        return Promise.resolve(Wizard);
      }

      return new Promise((resolve, reject) => {
        LazyLoader.load(
          [
            'style/wizard.css',
            'js/screens/wizard/authenticate.js',
            'js/screens/wizard/tutorial.js',
            'js/screens/wizard/wizard.js'
          ],
          () => {
            resolve(Wizard);
          }
        );
      });
    },
    getRoomCreate: function() {
      if (window.RoomCreate) {
        return Promise.resolve(RoomCreate);
      }

      return new Promise((resolve, reject) => {
        LazyLoader.load(
          [
            'style/create_room.css',
            'js/screens/create_room.js'
          ],
          () => {
            resolve(RoomCreate);
          }
        );
      });
    },
    getRoomDetail: function() {
      if (window.RoomDetail) {
        return Promise.resolve(RoomDetail);
      }

      return new Promise((resolve, reject) => {
        LazyLoader.load(
          [
            'style/room_detail.css',
            'js/screens/room_detail.js'
          ],
          () => {
            resolve(RoomDetail);
          }
        );
      });
    }
  };
  
  exports.Loader = Loader;
}(this));
