'use strict';

(function(exports) {

  var panel = null;
  var backButton = null;
  var section = null;
  var templateSharedWith = null;
  var sharedWith = [];

  function render(){
    if(panel){
      return;
    }
    panel = document.getElementById('shared-with');
    backButton = panel.querySelector('#back-button');
    section = panel.querySelector('#shared-with-section');
    backButton.addEventListener('click', close);
    templateSharedWith = Template('shared-with-tmpl');
  }

  function open(){
    showUI();
    Navigation.to('shared-with', 'left');
  }

  function close(){
    Navigation.to('room-detail-panel', 'right').then(cleanUI);
  }

  function showUI(){
    var list = createSharedWithList();
  }

  function cleanUI(){
    section.innerHTML = '';
  }

  function createSharedWithList() {
    var list = document.createElement('ul');
    for(var i = 0, l = sharedWith.length; i < l; i++){
      var li = document.createElement('li');
      li.innerHTML = templateSharedWith.interpolate({
        person: sharedWith[i].contactPrimaryInfo || sharedWith[i].identities[0]
      });
      list.appendChild(li);
    }
    section.appendChild(list);
  }


  var SharedWith = {
    show: function(people) {
      if (!people) {
        return;
      }
      sharedWith = people;
      render();
      open();
    }
  };

  exports.SharedWith = SharedWith;

}(window));
