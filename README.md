# Firefox OS Loop Client

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
  $ grunt biuld
```

This the one a regular dev should use. It biulds the app and push it onto the
device (no WebIDE usage is involved).

#### release

```
  $ grunt release
```

This the one a regular user, tester or QA guys dev should use. It biulds the app
and push it onto the device (no WebIDE usage is involved).

#### test

```
  $ grunt release
```

This is the task we have for unit testing. It launches tests in shell with
PhantomJS.

#### saveRevision

```
  $ grunt saveRevision
```

We encourange you to use either the build or the release task for installing the
app but we could choose WebIDE for that as well. The saveRevision task is in
charge of saving the revision the app currently has. Every time you update the
app code run this task before installing the app via WebIDE.
