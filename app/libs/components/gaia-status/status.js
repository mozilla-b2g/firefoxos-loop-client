
'use strict';

(function(exports) {

  // How many milliseconds is displayed the status component by default
  var DISPLAYED_TIME = 1500;

  // References to the DOMElement(s) that renders the status UI component
  var section, content;

  // The numerical ID of the timeout in order to hide UI component
  var timeoutID;

  /*
   * Clears the callback in charge of hiding the component after timeout
   */
  function clearHideTimeout() {
    if (timeoutID === null) {
      return;
    }

    window.clearTimeout(timeoutID);
    timeoutID = null;
  }

  /*
   * Shows the status component
   *
   * @param{Object} Message. It could be a string or a DOMFragment that
   *                represents the normal and strong strings
   *
   * @param{int} It defines the time that the status is displayed in ms. This
   *             parameter is optional
   *
   */
  function show(message) {
    initialize();
    clearHideTimeout();
    content.innerHTML = '';

    if (typeof message === 'string') {
      content.textContent = message;
    } else {
      try {
        // Here we should have a DOMFragment
        content.appendChild(message);
      } catch (ex) {
        console.error('DOMException: ' + ex.message);
      }
    }

    section.addEventListener('transitionend', function onShown() {
      section.removeEventListener('transitionend', onShown);
      timeoutID = window.setTimeout(hide, DISPLAYED_TIME);
      window.dispatchEvent(new CustomEvent('status-shown'));
    });

    section.classList.remove('hidden');
    setTimeout(function() {
      section.classList.add('show');
    }, 50);
  }

  /*
   * Hides the status component
   */
  function hide() {
    section.classList.remove('show');

    section.addEventListener('transitionend', function onHide() {
      section.removeEventListener('transitionend', onHide);
      clearHideTimeout();
      section.classList.add('hidden');
      window.dispatchEvent(new CustomEvent('status-hidden'));
    });
  }

  /*
   * Releases memory
   */
  function destroy() {
    document.body.removeChild(section);
    clearHideTimeout();
    section = content = null;
  }

  /*
   * Initializes the library. Basically it creates the markup:
   *
   * <section role="status">
   *   <p>xxx</p>
   * </section>
   */
  function initialize() {
    if (section) {
      return;
    }

    section = document.createElement('section');

    section.setAttribute('role', 'status');
    section.classList.add('hidden');

    content = document.createElement('p');

    section.appendChild(content);

    document.body.appendChild(section);
  }

  exports.Status = {
    /*
     * Shows the status component
     *
     * @param{Object} Message. It could be a string or a DOMFragment that
     *                represents the normal and strong strings
     *
     * @param{int} It defines the time that the status is displayed in ms
     *
     */
    show: show,

    /*
     * Hides the status component
     */
    hide: hide,

    /*
     * Releases memory
     */
    destroy: destroy,

    /*
     * Sets up the duration in milliseconds that a status is displayed
     *
     * @param{int} The time in milliseconds
     *
     */
    setDuration: function setDuration(time) {
      DISPLAYED_TIME = time || DISPLAYED_TIME;
    }
  };

}(window));
