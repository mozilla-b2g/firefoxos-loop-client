window.onload = function() {
  var debug = true;


  // Init the countdown element
  Countdown.init();

  // Enable communications with Controller
  ControllerCommunications.init();
  
  // Get params needed for the UI
  var callParams = CallManager.init();
  
  // Update the UI taking into account the layout
  CallScreenUI.init(callParams);
}
