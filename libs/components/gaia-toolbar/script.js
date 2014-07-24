(function(define){'use strict';define(function(require,exports,module){
/*globals define*//*jshint node:true*/

/**
 * Dependencies
 */

var utils = require('gaia-component-utils');

/**
 * Locals
 */

var packagesBaseUrl = window.packagesBaseUrl || '/bower_components/';
var baseUrl = window.GaiaToolbarBaseUrl || packagesBaseUrl + 'gaia-toolbar/';

var stylesheets = [
  { url: baseUrl + 'style.css', scoped: true }
];

// Extend from the HTMLElement prototype
var proto = Object.create(HTMLElement.prototype);

/**
 * Runs when an instance of the
 * element is first created.
 *
 * When use this moment to create the
 * shadow-dom, inject our template
 * content, setup event listeners
 * and set the draw state to match
 * the initial `open` attribute.
 *
 * @private
 */
proto.createdCallback = function() {
  utils.style.call(this, stylesheets);
};

// Register and return the constructor
module.exports = document.registerElement('gaia-toolbar', { prototype: proto });

});})((function(n,w){'use strict';return typeof define=='function'&&define.amd?
define:typeof module=='object'?function(c){c(require,exports,module);}:
function(c){var m={exports:{}},r=function(n){return w[n];};
w[n]=c(r,m.exports,m)||m.exports;};})('gaia-toolbar',this));
