'use strict';

(function(exports) {

  var panel = null;
  var backButton = null;
  var section = null;
  var templateSharedWith = null;
  var sharedWith = [];
  var previouslyRendered = [];

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
    window.addEventListener('oncontactchange', updateSharedWithList);
    Navigation.to('shared-with', 'left');
  }

  function close(){
    previouslyRendered = [];
    window.removeEventListener('oncontactchange', updateSharedWithList);
    Navigation.to('room-detail-panel', 'right').then(cleanUI);
  }

  function showUI(){
    createSharedWithList();
  }

  function cleanUI(){
    section.innerHTML = '';
  }

  function createSharedWithList() {
    var list = document.createElement('ul');
    for(var i = sharedWith.length-1; i >= 0; i--){
      if(previouslyRendered.indexOf(sharedWith[i].identities[0]) >= 0){
        continue;
      }
      previouslyRendered.push(sharedWith[i].identities[0]);

      var li = document.createElement('li');
      
      li.innerHTML = templateSharedWith.interpolate({
        info: sharedWith[i].identities[0],
        identity: 'invitee-'+sharedWith[i].identities[0]
      });

      list.appendChild(li);
    }
    section.appendChild(list);
    updateSharedWithList();
  }

  function updateSharedWithList(){
    for(var i = 0, l = previouslyRendered.length; i < l; i++){
      updateElementByIdentity(previouslyRendered[i]);
    }
  }
  
  function updateElementByIdentity(identity){
    ContactsHelper.find(
      {
        identities: identity
      },
      function onContact(result) {
        if(result.contacts && result.contacts.length === 0) {
          return;
        }
        var contact = result.contacts[0];
        if(contact.name && contact.name.length > 0) {
          var p = document.getElementById('invitee-'+identity);
          p.textContent = contact.name;
        }
      }
    );
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
