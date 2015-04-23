'use strict';

var OptionMenu = function(options) {
  LazyLoader.load(['js/screens/option_menu_impl.js'], () => {
    OptionMenuImpl.call(this, options);
    this.hide = OptionMenuImpl.prototype.hide;
    OptionMenuImpl.prototype.show.call(this);
  });
};
