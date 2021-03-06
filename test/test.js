'use strict';

var test = require('tape');
var http = require('http');
var sinon = require('sinon');
var bunyan = require('bunyan');
var cs = require('chronostore');
var fs = require('fs-extra');
var sitesampler = require('../');
var through2 = require('through2');

function resetSpies(spiesObject) {
  Object.keys(spiesObject).forEach(function(key) {
    spiesObject[key].reset();
  });
}

var spies = {
  'logInfo': sinon.spy(),
  'logWarn': sinon.spy(),
  'logError': sinon.spy()
};

var bunyanStub = {
  'createLogger': function() {
    return {
      'info': spies.logInfo,
      'warn': spies.logWarn,
      'error': spies.logError
    };
  }
};

spies.createLogger = sinon.spy(bunyanStub, 'createLogger');
sinon.stub(bunyan, 'createLogger', bunyanStub.createLogger);

function end(t, ss, spiesObject, clock) {
  if (ss) {
    ss.stop();
  }

  if (spiesObject) {
    resetSpies(spiesObject);
  }

  if (clock) {
    clock.restore();
  }

  t.end();
}

var server;
var serverUrl = 'http://localhost:1337/test';
var serverUrlEmpty = 'http://localhost:1337/empty';
var options = {
  'targets': [
    {
      'url': serverUrl,
      'rule': {'second': 1}
    }
  ],
  'chronostore': {
    'root': './testdata'
  }
};

test('setup', function(t) {
  server = http.createServer(function(request, response) {
    if (request.url === '/test') {
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.end('<h1>foo</h1>');
    }
    if (request.url === '/empty') {
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.end('');
    }
  }).listen(1337);

  server.on('listening', function() {
    t.end();
  });
});

// setup finished, do not place tests above this line.

test('it should get targets and write them to disk', function(t) {
  t.plan(2);
  var clock = sinon.useFakeTimers();
  var ss = sitesampler(options).start();

  ss.on('response', function(result, response, optionsResult) {
    t.equal(optionsResult.url, options.targets[0].url);
    t.true(result.content.indexOf('</h1>') > -1);
    end(t, ss, spies, clock);
  });

  clock.tick(61000);
});

test('it can stop', function(t) {
  t.plan(1);
  var clock = sinon.useFakeTimers();
  var ss = sitesampler(options).start();
  var allResults = [];

  ss.on('response', function(result) {
    allResults.push(result);
    ss.stop();
    clock.tick(200000);
  });

  setTimeout(function() {
    t.equal(allResults.length, 1);
    end(t, ss, spies, clock);
  }, 200000);

  clock.tick(61000);
});

test('it should log', function(t) {
  t.plan(13);
  process.env['SITESAMPLER_LOG'] = true;
  var clock = sinon.useFakeTimers();
  var ss = sitesampler(options).start();

  ss.on('response', function() {
    ss.stop();
    t.equal(spies.createLogger.getCall(0).args[0].name, 'sitesampler');
    t.equal(spies.createLogger.getCall(0).args[0].streams.length, 1);
    t.equal(spies.logInfo.getCall(0).args[0], 'Logging enabled.');
    t.equal(spies.logInfo.getCall(1).args[0], 'Setting up sitesampler...');
    t.equal(spies.logInfo.getCall(2).args[0], 'Setup completed.');
    t.equal(spies.logInfo.getCall(3).args[0], 'Starting sitesampler.');
    t.equal(spies.logInfo.getCall(4).args[1], 'Sitesampler running.');
    t.equal(spies.logInfo.getCall(4).args[0].url, serverUrl);
    t.equal(spies.logInfo.getCall(6).args[1], 'Response from "http://localhost:1337/test".');
    t.equal(spies.logInfo.getCall(6).args[0].url, serverUrl);
    t.equal(spies.logInfo.getCall(7).args[1], 'Writing result to chronostore...');
    t.equal(spies.logInfo.getCall(8).args[1], 'Write to chronostore completed.');
    t.equal(spies.logInfo.getCall(9).args[0], 'Stopping sitesampler.');

    delete process.env['SITESAMPLER_LOG'];
    end(t, ss, spies, clock);
  });

  clock.tick(61000);
});

test('it can log to loggly', function(t) {
  t.plan(2);
  process.env['SITESAMPLER_LOG'] = true;
  process.env['SITESAMPLER_LOGGLY_TOKEN'] = '00000000-0000-0000-0000-000000000000';
  process.env['SITESAMPLER_LOGGLY_SUBDOMAIN'] = 'foooooobar';
  var clock = sinon.useFakeTimers();
  var ss = sitesampler(options).start();

  ss.on('response', function() {
    t.equal(spies.createLogger.getCall(0).args[0].streams.length, 2);
    t.equal(spies.logInfo.getCall(0).args[0], 'Logging enabled.');

    delete process.env['SITESAMPLER_LOG'];
    delete process.env['SITESAMPLER_LOGGLY_TOKEN'];
    delete process.env['SITESAMPLER_LOGGLY_SUBDOMAIN'];
    end(t, ss, spies, clock);
  });

  clock.tick(61000);
});

test('it can log to logentries', function(t) {
  t.plan(2);
  process.env['SITESAMPLER_LOG'] = true;
  process.env['SITESAMPLER_LOGENTRIES_TOKEN'] = '00000000-0000-0000-0000-000000000000';
  var clock = sinon.useFakeTimers();
  var ss = sitesampler(options).start();

  ss.on('response', function() {
    t.equal(spies.createLogger.getCall(0).args[0].streams.length, 2);
    t.equal(spies.logInfo.getCall(0).args[0], 'Logging enabled.');

    delete process.env['SITESAMPLER_LOG'];
    delete process.env['SITESAMPLER_LOGENTRIES_TOKEN'];
    end(t, ss, spies, clock);
  });

  clock.tick(61000);
});

test('it can log to slack', function(t) {
  t.plan(2);
  process.env['SITESAMPLER_LOG'] = true;
  process.env['SITESAMPLER_SLACK_WEBHOOKURL'] = 'https://foo';
  var clock = sinon.useFakeTimers();
  var ss = sitesampler(options).start();

  ss.on('response', function() {
    t.equal(spies.createLogger.getCall(0).args[0].streams.length, 2);
    t.equal(spies.logInfo.getCall(0).args[0], 'Logging enabled.');

    delete process.env['SITESAMPLER_LOG'];
    delete process.env['SITESAMPLER_SLACK_WEBHOOKURL'];
    end(t, ss, spies, clock);
  });

  clock.tick(61000);
});

test('it loads sitesampler.json from disk if no file is provided', function(t) {
  t.plan(1);
  var clock = sinon.useFakeTimers();
  var stub = sinon.stub(fs, 'readJsonSync', function() {
    return options;
  });
  var ss = sitesampler().start();

  ss.on('response', function() {
    t.equals(stub.firstCall.args[0], './sitesampler.json');
    fs.readJsonSync.restore();
    end(t, ss, spies, clock);
  });

  clock.tick(61000);
});

test('it throws if no targets are provided', function(t) {
  t.plan(1);

  var explode = function() {
    sitesampler({}).start();
  };

  t.throws(explode);
});

test('it should get targets and write them to disk', function(t) {
  t.plan(1);
  var options = {
    'targets': [
      {
        'url': serverUrlEmpty,
        'rule': {'second': 1}
      }
    ],
    'chronostore': {
      'root': './testdata'
    }
  };
  var clock = sinon.useFakeTimers();
  var ss = sitesampler(options).start();

  ss.on('response', function() {
    t.equal(spies.logWarn.getCall(0).args[1], 'No content in result. Aborting write.');
    end(t, ss, spies, clock);
  });

  clock.tick(61000);
});

test('it throws if chronostore returns an error', function(t) {
  t.plan(2);
  var error = new Error('Stubbed error.');
  var errorStream = function() {
    return through2.obj(function() {
      return this.emit('error', error);
    });
  };

  sinon.stub(cs, 'writeObject', errorStream);

  var clock = sinon.useFakeTimers();
  var ss = sitesampler(options).start();

  ss.on('error', function(err) {
    t.equal(err, error);
    t.equal(spies.logError.getCall(0).args[1], 'Error when writing result to chronostore for "http://localhost:1337/test".');
    cs.writeObject.restore();
    end(t, ss, spies, clock);
  });

  clock.tick(61000);
});


test('it throws if goldwasher returns an error', function(t) {
  t.plan(2);
  var clock = sinon.useFakeTimers();
  var ss = sitesampler(options);
  var error = new Error('Stubbed error.');

  sinon.stub(ss.ns, 'start', function() {
    ss.ns.emit('error', error, options.targets[0], {'start': 0, 'end': 1, 'ms': 1});
  });

  ss.on('error', function(err) {
    t.equal(err, error);
    t.equal(spies.logError.getCall(0).args[1], 'Error with response from "' + options.targets[0].url + '". Duration: 1 ms.');
    end(t, ss, spies, clock);
  });

  ss.start();
  clock.tick(61000);
});

test('it can have disk writing disabled', function(t) {
  t.plan(3);
  var options = {
    'targets': [
      {
        'url': serverUrl,
        'rule': {'second': 1}
      }
    ]
  };
  var clock = sinon.useFakeTimers();
  var ss = sitesampler(options).start();

  ss.on('response', function(result, response, optionsResult) {

    function explode() {
      fs.lstatSync('./chronostore');
    }

    t.throws(explode);
    t.equal(optionsResult.url, options.targets[0].url);
    t.true(result.content.indexOf('</h1>') > -1);

    end(t, ss, spies, clock);
  });

  clock.tick(61000);
});

test('teardown', function(t) {
  server.close();
  t.end();
});
