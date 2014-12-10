'use strict'

module.exports = function(grunt) {

  grunt.registerTask('getVersion', 'Fills-in version.js with version info', [
    'gitinfo',
    'writeVersionFile'
  ]);

  grunt.registerTask('writeVersionFile', function() {
    var version = grunt.option('loopVersion');
    if (version != undefined) {
      grunt.file.write('build/js/version.js', 'Version = { id: \'' + version + 
                 ' ('+ grunt.config('gitinfo.local.branch.current.shortSHA') + ')\' }');
    } else {
      grunt.file.write('build/js/version.js', 'Version = { id: \'' +
                     grunt.config('gitinfo.local.branch.current.name') + '/' +
                     grunt.config('gitinfo.local.branch.current.shortSHA') + '\' };');
    }
  });
}
