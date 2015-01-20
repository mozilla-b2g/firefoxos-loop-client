(function(exports) {
  'use strict';

  var _ = navigator.mozL10n.get;

  var _optionMenu = null;

  function _showOptionMenu(infoToShow, reason, success, cancel) {
    _optionMenu = new OptionMenu({
      section: _('newRoomFallbackMessage', {
        reason: Branding.getTranslation(reason + 'Message', {
          contactName: infoToShow
        })
      }),
      type: 'confirm',
      items: [
        {
          name: 'Cancel',
          l10nId: 'cancel',
          method: function() {
            _optionMenu = null;
            cancel();
          }
        },
        {
          name: 'New Room',
          class: 'recommend',
          l10nId: 'newRoom',
          method: function() {
            _optionMenu = null;
            success();
          },
          params: []
        }
      ]
    });
  }

  var ShareScreen = {
    show: function s_show(identity, reason, subject) {
      return new Promise(function(resolve, reject) {
        var contact = null;

        var creteRoomAndShare = function() {
          Loader.getRoomCreateObj().then(RoomCreate => {
            RoomCreate.create(subject).then(room => {
              if (!room || !room.roomUrl) {
                reject();
              }

              CallLog.showRooms();
              Loader.getShare().then(Share => {
                var method = contact ? 'toContact' : 'toIdentity';
                var params = {
                  type: 'room',
                  name: room.roomName,
                  url: room.roomUrl,
                  identity: identity,
                  contact: contact
                };
                Share[method](params, function onShared(contact, identity) {
                  Controller.onRoomShared(room, contact, identity);
                }, function onError() {
                  // Currently we dont need to show any error here
                });
              });

              resolve();
            }, reject);
          });
        };

        ContactsHelper.find({
          identities: identity
        }, function(result) {
          contact = result.contacts[0];
          _showOptionMenu(ContactsHelper.getPrimaryInfo(contact), reason,
                                               creteRoomAndShare, reject);
        }, function() {
          _showOptionMenu(identity, reason, creteRoomAndShare, reject);
        });
      });
    },

    hide: function s_hide() {
      if (_optionMenu) {
        _optionMenu.hide();
        _optionMenu = null;
      }
    }
  };

  exports.ShareScreen = ShareScreen;
}(this));
