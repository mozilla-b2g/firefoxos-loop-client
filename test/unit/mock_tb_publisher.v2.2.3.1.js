'use strict';

(function(exports) {
  var m_guid;

  function MockPublisher() {
    m_guid = _uuid();
  }

  MockPublisher.prototype = {
    publish: m_publish
  };

  MockPublisher.mGuid = m_guid;

  function m_publish(targetElement, properties) {
    // Since this the first version of this mock do nothing for now.
  }

  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
	return v.toString(16);
    });
  }
  exports.MockPublisher = MockPublisher;
})(this);
