'use strict';

var R = require('ramda');
var util = require('util');
var events = require('events');
var fs = require('fs-extra');
var gs = require('goldwasher-schedule');
var cs = require('chronostore');
var bunyan = require('bunyan');
var BunyanToLoggly = require('bunyan-loggly').Bunyan2Loggly;
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

  if (!result.rethrowErrors) {
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

var SiteSampler = function(settingsPathOrObject, callback) {
  var self = this;
  var settings = getSettings(settingsPathOrObject);

  setupLogger(process.env['SITESAMPLER_LOG']);

  log.info('Setting up sitesampler...');

  self.gs = gs.setup(
    settings.targets,
    settings.options,
    callback || self.writeToDisk(settings)
  );

  events.EventEmitter.call(this);
  log.info('Setup completed.');
};

util.inherits(SiteSampler, events.EventEmitter);

SiteSampler.prototype.start = function() {
  var self = this;

  setImmediate(function() {
    self.emit('start');
  });

  self.gs.start();

  return self;
};

SiteSampler.prototype.stop = function() {
  var self = this;

  self.emit('stop');

  self.gs.stop();

  return self;
};

SiteSampler.prototype.writeToDisk = function(settings) {
  var self = this;

  return function(error, results, target) {
    if (error) {
      log.error(error, 'Error with results from goldwasher. Aborting write.');
      if (settings.rethrowErrors) {
        self.emit('error', error);
      }
    } else if (results.length > 0) {
      log.info({'url': target.url}, 'Writing results to chronostore...');

      cs.objectToStream(results)
        .pipe(cs.writeObject(settings.chronostore))
        .on('error', function(error) {
          log.error(error, 'Error when writing results to chronostore for "' + target.url + '".');
          if (settings.rethrowErrors) {
            self.emit('error', error);
          }
        })
        .on('finish', function() {
          log.info({'url': target.url}, 'Write to chronostore completed.');
          self.emit('results', results);
        });

    } else {
      log.warn({'target': target}, 'No results from goldwasher. Aborting write.');
      self.emit('results', results);
    }
  };
};


module.exports = function(settingsPathOrObject) {
  return new SiteSampler(settingsPathOrObject);
};
