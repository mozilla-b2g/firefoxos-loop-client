# Firefox OS Loop Client

[![Build Status](https://travis-ci.org/mozilla-b2g/firefoxos-loop-client.svg?branch=master)](https://travis-ci.org/mozilla-b2g/firefoxos-loop-client)

Firefox OS client for the Loop service

## Want to contribute?

### Grunt

We rely on Grunt for performing repetetive task such as unit testing, linting,
building and pushing the app onto the device. If this is the first time you
clone the app you must install all the Grunt stuff. Grunt and Grunt plugins are
installed and managed via npm, the Node.js package manager (so we would need to
install Node.js as well).

If you already have Node.js and Grunt you just need to install the Grunt plugins
we use. Please proceed as follow:

```
  $ npm install
```

At the moment we have a few Grunt tasks. Let's see them.

#### build

```
  $ grunt build
```

This the one a regular dev, user, tester o QA guy should use. It builds the app
and push it onto the device (no WebIDE usage is involved).

#### release

```
  $ grunt release
```

This is the task that builds the app for releasing it.

#### test

```
  $ grunt test
```

This is the task we have for unit testing. It launches tests in shell with
PhantomJS.

To add a new test, you only have to write the test (and add it somewhere under
the test/ directory, preferably on test/unit) and then add a new .html file to
test/test_scripts. That file should have the <script> tags to load your unit
test and any other script file you need (like the one you're actually testing).

More notes about testing. We're using SlimerJS and grunt-mocha-slimerjs for
testing.  The Spec reporter (as set by default) do *not* log errors or stack
traces on failures.  So if you want to see the errors (and believe me, you will)
then you need to specify the JSON reporter. The easiest way to do this is with:

grunt test --testReporter=JSON

If you want to run only the test contained on test_name.js, execute:

grunt test --testFile=name

e.g. to run only the test in test_join_room.js:

grunt test --testFile=join_room

#### Grunt options

There are many flags that allow you to configure different parameters of the
generated Loop Applications.

##### loopVersion

Replaces the loop version in both manifest.webapp and config.js with the string
passed as parameter, e.g.
```
$ grunt build --loopVersion=2.2
```
configures loop version to 2.2. Please do not use this parameter unless you
really need as otherwise it might interfere with Loop Production metrics.

##### loopServer

Configures the Loop server to be used. Possible values are
production|stage|development. This changes the server in the config.js and
the origin in the manifest.webapp file. E.g.
```
$ grunt build --loopServer=production
```

##### enforceDevices

When setting this to true, only compatible/tested devices (Fire E) are allowed
to use the app. When setting this to false, any device is allowed. E.g.
```
$ grunt build --enforceDevices=true
```
Using this option modifies the compatiblity.json file as required.

##### debug

When setting this to true, debug mode is enabled so logs are shown in the
logcat. This modifies the parameter in config.js. E.g.

```
$ grunt build --debug=true
```

##### metrics

Configures if metrics are reported and to which server. Possible values
are production|stage|disabled.
<ul>
<li>production: metrics are enabled and production server for input.mozilla is used.</li>
<li>stage: metrics are enabled and stage server for input.mozilla is used.</li>
<li>disabled: metrics are disabled</li>
</ul>
This parameter changes the related attributes in config.js. Please note that
telemetry is always using the production server and the only way to distinguish
production from development data is by the version sent (read from config.js).
```
$ grunt build --metrics=production
```
##### performanceLog

Configures if performance metrics for set-up time are taken. Possible values
are persistent|enabled|disabled.
<ul>
<li>persistent: performance is measured and logs saved in SDCard.</li>
<li>enabled: performance is measured and logs shown in logcat.</li>
<li>disabled: performance is not measured.</li>
</ul>
E.g.
```
$ grunt build --performanceLog=disabled
```
#### Special releases and builds

Additionally, a couple of extra tasks have been added to make easier the generation of
builds for development or publication purposes:

##### releaseProduction and buildProduction

```
$ grunt releaseProduction
```
```
$ grunt buildProduction
```

Releases a build or creates it and pushes it to a device with the following options:

<ul>
<li>--deviceCompatibility=true </li>
<li>--debug=false </li>
<li>--loopServer=production </li>
<li>--performanceLog=disabled</li>
<li>--metrics=production</li>
</ul>
##### releaseDevelopment and buildDevelopment

```
$ grunt releaseDevelopment
```
```
$ grunt buildDevelopment
```
Releases a build or creates it and pushes it to a device with the following options:

<ul>
<li>--deviceCompatibility=false </li>
<li>--debug=true </li>
<li>--loopServer=development </li>
<li>--performanceLog=persistent</li>
<li>--metrics=stage</li>
</ul>

