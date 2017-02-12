'use strict';

var R = require('ramda');
var util = require('util');
var events = require('events');
var fs = require('fs-extra');
var needleSchedule = require('needle-schedule');
var cs = require('chronostore');
var bunyan = require('bunyan');
var BunyanToLoggly = require('bunyan-loggly');
var BunyanToSlack = require('bunyan-slack');
var logentries = require('le_node');
var log;

function getSettings(settings) {
  var result;

  if (R.is(Object, settings)) {
    result = settings;
  } else {
    result = fs.readJsonSync(settings || './sitesampler.json');
  }

  if (!result.targets || !R.isArrayLike(result.targets) || result.targets.length < 1) {
    throw new Error('No targets provided. Remember to set settings.targets.');
  }

  if (typeof result.rethrowErrors === 'undefined') {
    result.rethrowErrors = true;
  }

  return result;
}

function getLogglyLogger() {
  var loggly = {
    'token': process.env['SITESAMPLER_LOGGLY_TOKEN'],
    'subdomain': process.env['SITESAMPLER_LOGGLY_SUBDOMAIN'],
    'level': process.env['SITESAMPLER_LOGGLY_LEVEL'] || 'info'
  };

  if (loggly.token && loggly.subdomain) {
    return {
      'level': loggly.level,
      'type': 'raw',
      'stream': new BunyanToLoggly(loggly)
    };
  }
}

function getSlackLogger() {
  var slack = {
    'webhook_url': process.env['SITESAMPLER_SLACK_WEBHOOKURL'],
    'channel': process.env['SITESAMPLER_SLACK_CHANNEL'] || null,
    'level': process.env['SITESAMPLER_SLACK_LEVEL'] || 'info',
    'username': process.env['SITESAMPLER_SLACK_USERNAME'] || 'sitesampler'
  };

  if (slack.webhook_url) {
    return {
      'level': slack.level,
      'stream': new BunyanToSlack(slack)
    };
  }
}

function getLogentriesLogger() {
  var logger = {
    'token': process.env['SITESAMPLER_LOGENTRIES_TOKEN']
  };

  if (logger.token) {
    return logentries.bunyanStream(logger);
  }
}

function setupLogger(enabled) {
  if (enabled) {
    var logger = {
      'name': 'sitesampler',
      'streams': [{'level': 'info', 'stream': process.stdout}]
    };

    var loggly = getLogglyLogger();
    if (loggly) {
      logger.streams.push(loggly);
    }

    var slack = getSlackLogger();
    if (slack) {
      logger.streams.push(slack);
    }

    var logentries = getLogentriesLogger();
    if (logentries) {
      logger.streams.push(logentries);
    }

    log = bunyan.createLogger(logger);

    log.info('Logging enabled.');

    if (loggly) {
      log.info('Loggly enabled.');
    }

    if (slack) {
      log.info('Slack enabled.');
    }

    if (logentries) {
      log.info('Logentries enabled.');
    }

  } else {
    log = bunyan.createLogger({'name': 'testing', 'streams': []});
  }
}

var SiteSampler = function(settingsPathOrObject) {
  var self = this;
  var settings = getSettings(settingsPathOrObject);

  setupLogger(process.env['SITESAMPLER_LOG']);

  log.info('Setting up sitesampler...');

  if (settings.chronostore) {
    fs.ensureFileSync(settings.chronostore.root + '/.write_access_test_file');
    //fs.removeSync(settings.chronostore.root + '/.write_access_test_file');
  }

  self.ns = needleSchedule(settings.targets, settings.options);

  self.ns.on('running', function(options) {
    log.info(options, 'Sitesampler running.');
  });

  self.ns.on('response', function(response, body, options, timestamps) {
    var result = {
      'url': options.url,
      'start': timestamps.start,
      'end': timestamps.end,
      'content': response.body
    };

    timestamps.ms = timestamps.end - timestamps.start;
    options = R.merge(options, timestamps);

    log.info(options, 'Response from "' + options.url + '".');

    if (settings.chronostore) {
      self.writeToDisk(result, response, options, settings);
    } else {
      self.emit('response', result, response, options);
    }
  });

  self.ns.on('error', function(error, options, timestamps) {
    var ms = timestamps.end - timestamps.start;

    log.error(error, 'Error with response from "' + options.url + '". Duration: ' + ms + ' ms.');
    if (settings.rethrowErrors) {
      self.emit('error', error);
    }
  });

  events.EventEmitter.call(this);
  log.info('Setup completed.');
};

util.inherits(SiteSampler, events.EventEmitter);

SiteSampler.prototype.start = function() {
  var self = this;

  setImmediate(function() {
    log.info('Starting sitesampler.');
    self.emit('start');
  });

  self.ns.start();

  return self;
};

SiteSampler.prototype.stop = function() {
  var self = this;

  log.info('Stopping sitesampler.');
  self.emit('stop');

  self.ns.stop();

  return self;
};

SiteSampler.prototype.writeToDisk = function(result, response, options, settings) {
  var self = this;

  if (result.content && result.content.length > 0) {
    log.info({'url': options.url}, 'Writing result to chronostore...');

    cs.objectToStream(result)
      .pipe(cs.writeObject(settings.chronostore))
      .on('error', function(error) {
        log.error(error, 'Error when writing result to chronostore for "' + options.url + '".');
        if (settings.rethrowErrors) {
          self.emit('error', error);
        }
      })
      .on('finish', function() {
        log.info({'url': options.url}, 'Write to chronostore completed.');
        self.emit('response', result, response, options);
      });
  } else {
    log.warn({'target': options}, 'No content in result. Aborting write.');
    self.emit('response', result, options);
  }
};


module.exports = function(settingsPathOrObject) {
  return new SiteSampler(settingsPathOrObject);
};
