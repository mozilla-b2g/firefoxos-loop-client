'use strict';

require('js/helpers/database_helper.js');
require('js/helpers/rooms_db.js');
require('js/screens/calllog.js');

suite('Tests CallLog', function() {

  test('CallLog should exist', function() {
    chai.assert.isNotNull(CallLog);
  });

  test('Update room when addition fails', function(done) {
    var room = {
      roomToken: 'ab583hfkskls'
    };

    sinon.stub(CallLog, 'updateRoom', function(myRoom) {
      chai.assert.equal(myRoom.roomToken, room.roomToken);
      done();
    });

    sinon.stub(RoomsDB, 'create', function(myRoom) {
      return Promise.reject();
    });

    CallLog.addRoom(room);
  });

});
