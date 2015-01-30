'use strict';

(function(exports) {
  // These strings will be found in SDP answer if H264 video codec is used
  const H264_STRING_126 = 'a=rtpmap:126 H264';
  const H264_STRING_97 = 'a=rtpmap:97 H264';
  // This string will be found in SDP answer if VP8 video codec is used
  const VP8_STRING = 'a=rtpmap:120 VP8';
  // This string will be found in SDP answer if OPUS audio codec is used
  const OPUS_STRING = 'a=rtpmap:109 opus';

  var CodecHelper = {
    getAVCodecNames: function ut_getAVCodecNames(publisher) {

      var codecName = {audio: 'unknown',
                       video: 'unknown'};
      if (!publisher || !publisher.answerSDP) {
        return codecName
      }
      var description = publisher.answerSDP;
      if (!description){
        return codecName;
      }
      if (description.indexOf(H264_STRING_126) != -1 ||
          description.indexOf(H264_STRING_97) != -1) {
        codecName.video = 'H264';
      } else if (description.indexOf(VP8_STRING) != -1) {
        codecName.video = 'VP8';
      } else {
        codecName.video = 'unknown';
      }
      if (description.indexOf(OPUS_STRING) != -1) {
        codecName.audio = 'OPUS';
      } else {
        codecName.audio = 'unknown';
      }
      return codecName;
    }
  };

  exports.CodecHelper = CodecHelper;
}(this));
