'use strict';

var OptionMenu = function(options) {
  LazyLoader.load(['style/bb/action_menu.css',
                   'style/bb/confirm.css',
                   'js/screens/option_menu_impl.js'], () => {
    OptionMenuImpl.call(this, options);
    this.hide = OptionMenuImpl.prototype.hide;
    OptionMenuImpl.prototype.show.call(this);
  });
};
