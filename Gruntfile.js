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
    'grunt-gitinfo',
    'grunt-mocha-slimer'
  ].forEach(grunt.loadNpmTasks);

  grunt.loadTasks('tasks');

  var TEST_HEADER = grunt.file.read('test/test_header.html');
  var TEST_FOOTER = grunt.file.read('test/test_footer.html');
  var TEST_DIR = 'test/test_scripts/';
  var TEST_DIR_LENGTH = TEST_DIR.length;

  // We'll use XVFB by default in linux (where it's easy to get).
  var USE_XVFB_DV = (process.platform === 'linux');

  // In any case, we can disable it with the --no-useXvfb and
  // --useXvfb options
  // We should check that the two options are not provided
  // simultaneously but for the time being, this is not really
  // needed. We'll just make whatever changes the default value
  // the one with most priority, and we just ignore the other
  var XVFB_TOGGLE = USE_XVFB_DV ? 'no-useXvfb' : 'useXvfb';
  var USE_XVFB = !!(USE_XVFB_DV ^ grunt.option(XVFB_TOGGLE));

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

    mocha_slimer: {
      all: {
        options: {
          run: true,

          // Generate the test file list automatically... Maybe there's an
          // easier way to do this.
          urls: grunt.file.expand({}, [TEST_DIR + '*.html']).map(
            function(value) {
              var testContent = grunt.file.read(value);
              var outputFile = 'gtest_' + value.substring(TEST_DIR_LENGTH);
              grunt.file.write('test/' + outputFile, TEST_HEADER + testContent +
                               TEST_FOOTER);
              return 'http://0.0.0.0:9002/' + outputFile;
          }),
          bail: true,
          logErrors: true,
          // Please note that the Spec reporter does *not* dump the stack on errors.
          // If you need the stack, use the JSON reporter.
          reporter: grunt.option('testReporter') || 'Spec',
          xvfb: USE_XVFB
        }
      }
    },

    clean: {
      server: [
        '.tmp'
      ],
      postTest: [
        'test/gtest_*.html'
      ],
      app: [
        'application.zip'
      ]
    },

    copy: {
      build: {
          expand: true,
          cwd: 'app',
          src: ['**'],
          dest: 'build'
      },
      deliver: {
          expand: true,
          cwd: '.',
          src: ['application.zip', 'metadata.json'],
          dest: '<%= (process.env.GAIA_OUTOFTREE_DIR || "deliver") + "/" + grunt.config.get("origin") %>'
      }
    },

    'gitinfo': {
      options: {
        cwd: '.'
      }
    },

    bower: {
      install: {
        options: {
          targetDir: 'build/libs/components/',
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
          cwd: 'build',
          expand: true,
          src: '**/*'
        }]
      }
    },

    ffospush: {
      app: {
        appId: '<%= grunt.config.get("origin") %>',
        zip: 'application.zip'
      }
    },

    ffosstop: {
      app: {
        appId: '<%= grunt.config.get("origin") %>'
      }
    },

    ffoslaunch: {
      app: {
        appId: '<%= grunt.config.get("origin") %>',
      }
    }
  });

  grunt.registerTask('test', 'Launch tests in shell with SlimerJS', [
    'clean:server',
    'connect:test',
    'mocha_slimer',
    'clean:postTest'
  ]);

  grunt.registerTask('build', 'Build app for dev', [
    'createApp',
    'ffosstop:app',
    'ffospush:app',
    'ffoslaunch:app'
  ]);

  grunt.registerTask('createApp', 'Build app for release', [
    'clean',
    'bower:install',
    'copy:build',
    'configure',
    'getVersion',
    'compress:release',
  ]);

  grunt.registerTask('buildProduction', 'Build app for dev', [
    'configureProduction',
    'build'
  ]);

  grunt.registerTask('buildDevelopment', 'Build app for dev', [
    'configureDevelopment',
    'build'
  ]);

  grunt.registerTask('release', 'Build app for release', [
    'createApp',
    'copy:deliver',
    'embed-in-gaia'
  ]);

  grunt.registerTask('releaseProduction', 'Build app for release', [
    'configureProduction',
    'release'
  ]);

  grunt.registerTask('releaseDevelopment', 'Build app for release', [
    'configureDevelopment',
    'release'
  ]);

  grunt.registerTask('default', ['build']);
};
