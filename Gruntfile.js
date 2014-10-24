'use strict';

var mountFolder = function (connect, dir) {
  return connect.static(require('path').resolve(dir));
};

module.exports = function(grunt) {
  [
    'grunt-contrib-clean',
    'grunt-contrib-copy',
    'grunt-contrib-connect',
    'grunt-mocha',
    'grunt-html-build'
  ].forEach(grunt.loadNpmTasks);

  grunt.initConfig({
    connect: {
      test: {
        options: {
          port: 9002,
          middleware: function (connect) {
            return [
              mountFolder(connect, '.tmp'),
              mountFolder(connect, 'test'),
              mountFolder(connect, 'app')
            ];
          }
        }
      }
    },

    mocha: {
      all: {
        options: {
          run: true,
          urls: ['http://0.0.0.0:9002/index.html'],
          bail: true,
          logErrors: true,
          reporter: 'Spec'
        }
      }
    },

    clean: {
      server: [
        '.tmp'
      ],
      preTest: [
        'test/index.html'
      ],
      postTest: [
        'src/'
      ]
    },

    copy: {
      test: {
        files: [{
          expand: true,
          cwd: 'src',
          src: ['index.template.html'],
          dest: 'test',
          rename: function() {
            return 'test/index.html';
          }
        }]
      }
    },

    // We use htmlbuild to add the tests dependencies to test/index.html
    // This avoid us to manually add the dependencies every time we add a
    // new test or script file.
    htmlbuild: {
      src: 'test/index.template.html',
      // "dest" is not working with the current htmlbuild version, so we need
      // to manually move src/index.html to test/index.html
      // dest: 'test/',
      options: {
        beautify: true,
        relative: true,
        scripts: {
          libs: 'app/libs/*.js',
          tokbox: 'app/libs/tokbox/**/*.js',
          helpers: 'app/js/helpers/*.js',
          screens: 'app/js/screens/*.js',
          js: 'app/js/*.js',
        }
      }
    }
  });

  grunt.registerTask('test', 'Launch tests in shell with PhantomJS', [
    'clean:server',
    'clean:preTest',
    'htmlbuild',
    'copy:test',
    'clean:postTest',
    'connect:test',
    'mocha'
  ]);

};
