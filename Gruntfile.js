'use strict';

var mountFolder = function (connect, dir) {
  return connect.static(require('path').resolve(dir));
};

module.exports = function(grunt) {
  [
    'grunt-contrib-clean',
    'grunt-contrib-compress',
    'grunt-contrib-connect',
    'grunt-contrib-copy',
    'grunt-bower-task',
    'grunt-firefoxos',
    'grunt-git-describe',
    'grunt-html-build',
    'grunt-mocha'
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
      ],
      app: [
        'application.zip'
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
    },

    'git-describe': {
      options: {
        prop: 'meta.revision'
      },
      me: {}
    },

    bower: {
      install: {
        options: {
          targetDir: 'app/libs/components/',
          verbose: true,
          copy: false
        }
      }
    },

    compress: {
      release: {
        options: {
          archive: 'application.zip',
        },
        files: [{
          cwd: 'app',
          expand: true,
          src: '**/*'
        }]
      }
    },

    ffospush: {
      app: {
        appId: 'loop.services.mozilla.org',
        zip: 'application.zip'
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

  grunt.registerTask('saveRevision', function() {
    grunt.event.once('git-describe', function (rev) {
      grunt.file.write('app/js/version.js', 'Version = { id: \'' +
        rev.object + '\' }');
    });
    grunt.task.run('git-describe');
  });

  grunt.registerTask('build', 'Build app for dev', [
    'bower:install',
    'saveRevision',
    'compress:release',
    'ffospush:app'
  ]);

  grunt.registerTask('release', 'Build app for release', [
    'clean',
    'bower:install',
    'saveRevision',
    'test',
    'compress:release',
    'ffospush:app'
  ]);

  grunt.registerTask('default', ['build']);
};
