/* exported HtmlImports */
'use strict';

function _resolvePath(path) {
  var globalPath = window.location.pathname.split('/');
  globalPath.pop();
  var extraPath = globalPath.join('/');
  return path.replace(extraPath, '');
}


function _populateElement(elements, callback) {
  var element = elements.pop();
  var template = element.querySelector('template');

  // Load CSS before in order to avoid any flickering effect
  var styles = [].map.call(element.querySelectorAll('link'), function(element) {
    return _resolvePath(element.href);
  });

  LazyLoader.load(styles, function noop() {});

  // Load the HTML
  var isElement = document.querySelector('[is=' + element.getAttribute('name') + ']');
  isElement.innerHTML = template.innerHTML;
  isElement.removeAttribute('is');

  // Load scripts
  var scripts = [].map.call(element.querySelectorAll('script'), function(element) {
    return _resolvePath(element.src);
  });

  LazyLoader.load(scripts, function() {
    callback();
  });

  LazyLoader.load(scripts, function() {
    if (elements.length === 0) {
      if (typeof callback === 'function') {
        callback();
      }
    } else {
      _populateElement(elements, callback);
    }
  });
}


function _populateElements(singleImport, callback) {
  HtmlImports.getImportContent(singleImport.href, function gotContent(content) {
    // Mapping of all custom element templates
    var elementRoot = document.createElement('div');
    elementRoot.innerHTML = content;
    var elements = [].map.call(elementRoot.querySelectorAll('element'), function(element) {
      return element;
    });

    _populateElement(elements, callback);
  });
}

/**
 * This file is included when we encounter lazy loaded nodes
 * in DEBUG mode.
 */
var HtmlImports = {
  /*
   * Method for populating panels with lazy loading. This includes all JS and styles
   * within the element loaded.
   * @param callback Callback to be executed when everything is loaded
   * @param isIdentifier (optional) If we indicate the specific panel to load,
   * we will just load that one. If no param is present, we will load all panels
   * with 'is';
   */
  populate: function(callback, isIdentifier) {
    if (isIdentifier) {
      var singleImport = document.querySelector('link[rel=import][is=' + isIdentifier + ']');
      if (!singleImport) {
        console.error('HtmlImports.populate: No import with IS ' + isIdentifier);
      } else {
        singleImport.removeAttribute('is');
        _populateElements(singleImport, callback);
      }
      return;
    }

    var imports = document.querySelectorAll('link[rel="import"]');
    if (!imports.length) {
      return;
    }

    var pending = imports.length;

    Array.prototype.forEach.call(imports, function perImport(eachImport) {
      _populateElements(eachImport, callback);
    }, this);
  },

  getImportContent: function(path, callback) {
    // bail out if the imported resource isn't in the same origin
    var parsedURL = new URL(path, location.href);
    if (parsedURL.origin !== location.origin) { return; }
    var xhr = new XMLHttpRequest();
    xhr.onload = function(o) {
      callback(xhr.responseText);
    };
    xhr.open('GET', path, true);
    xhr.send();
  }
};
