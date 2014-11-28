(function(exports) {

  var _dialog, _rateButton;

  var _callback;

  function Feedback(happy, description) {
    this.happy = happy;
    this.description = description;
  }

  function _resetDOM() {
    _dialog.classList.remove('two-options');
    document.querySelector('[data-question]').dataset.question = 1;
    var checked = _dialog.querySelectorAll(':checked');
    for (var i = 0; i < checked.length; i++) {
      checked[i].checked = false;
    }
  }

  var FeedbackScreen = {
    show: function(callback) {
      if (!_dialog) {
        _dialog = document.getElementById('feedback');
        document.getElementById('skip-feedback-button').addEventListener(
          'click',
          function() {
            _callback();
            FeedbackScreen.hide();
          }
        );
        _rateButton = document.getElementById('rate-feedback-button');
        _rateButton.addEventListener(
          'click',
          function onRate() {
            var description = [];
            var checked = _dialog.querySelectorAll(':checked');
            if (checked) {
              for (var i = 0, l = checked.length; i < l; i++) {
                description.push(checked[i].value);
              }
            }

            _callback(new Feedback(false /* happy */, description));
            FeedbackScreen.hide();
          }
        );

        _dialog.querySelector('.fq-options ul').addEventListener('click',
          function onClick() {
            var numberChecked = _dialog.querySelectorAll(':checked').length;
            _rateButton.disabled = numberChecked === 0;
          }
        );

        _dialog.querySelector('#answer-happy').addEventListener(
          'click',
          function onAnswerHappy() {
            _callback(new Feedback(true /* happy */));
            FeedbackScreen.hide();
          }
        );

        document.getElementById('answer-sad').addEventListener(
          'click',
          function onAnswerSad() {
            _dialog.classList.add('two-options');
            document.querySelector('[data-question]').dataset.question = 2;
          }
        );
      }

      _callback = callback;
      if (typeof _callback !== 'function') {
        _callback = function() {};
      }


      Branding.naming(_dialog);

      navigator.mozL10n.translateFragment(_dialog);

      _dialog.classList.remove('hide');
      setTimeout(function() {
        _dialog.classList.add('show');
      }, 400);
    },
    hide: function() {
      _dialog.addEventListener('transitionend', function ended() {
        _dialog.removeEventListener('transitionend', ended);
        _dialog.classList.add('hide');
        _resetDOM();
      })
      _dialog.classList.remove('show');
    }
  };

  exports.FeedbackScreen = FeedbackScreen;
}(this));
