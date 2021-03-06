# node-sitesampler
[![npm version](http://img.shields.io/npm/v/sitesampler.svg)](https://www.npmjs.org/package/sitesampler)
[![Build Status](http://img.shields.io/travis/alexlangberg/node-sitesampler.svg)](https://travis-ci.org/alexlangberg/node-sitesampler)
[![Dependency Status](https://david-dm.org/alexlangberg/node-sitesampler.svg)](https://david-dm.org/alexlangberg/node-sitesampler)
[![devDependency Status](https://david-dm.org/alexlangberg/node-sitesampler/dev-status.svg)](https://david-dm.org/alexlangberg/node-sitesampler#info=devDependencies)

Data collection sometimes includes collecting the same data over time. This module, which is basically a wrapper around [needle-schedule](https://www.npmjs.com/package/needle-schedule), enables you to collect e.g. the html content of websites over time and (optionally) store the data with the [chronostore](https://www.npmjs.com/package/chronostore) module, thus sampling sites. On top of storing the results as files, it also emits the results when collected, enabling you to further process the data, e.g. pushing the data to a database.

A heavy emphasis is put on stability and logging. Everything, even the logging provided by [bunyan](https://www.npmjs.com/package/bunyan), is covered with tests. It also allows you to forward your logging to the console, [loggly](https://www.loggly.com), [logentries](https://logentries.com) and [slack](https://slack.com). 

Linted with ESLint, tested with tape and 100% coverage with covert.

## Installation
```
npm install sitesampler
```

## Logging
Logging is performed by bunyan and all logging is enabled with env vars. For instance, to run the example with logging turned on, run the command ```SITESAMPLER_LOG=1 node example.js```.

### loggly
Logging can be posted to [loggly](https://www.loggly.com) by setting the following env vars:

- ```SITESAMPLER_LOGGLY_SUBDOMAIN```: your loggly subdomain.
- ```SITESAMPLER_LOGGLY_TOKEN```: your loggly token.
- ```SITESAMPLER_LOGGLY_LEVEL```: the level to log. Defaults to ```info```.

### logentries
Logging can be posted to [logentries](https://logentries.com) by setting the following env vars:

- ```SITESAMPLER_LOGENTRIES_TOKEN```: your logentries token.

### slack
Logging can be posted to [slack](https://slack.com) by setting the following env vars:

- ```SITESAMPLER_SLACK_WEBHOOKURL```: your slack webhook url.
- ```SITESAMPLER_SLACK_CHANNEL```: your slack channel. Defaults to the channel of the webhook.
- ```SITESAMPLER_SLACK_LEVEL```: the level to log. Defaults to ```info```.
- ```SITESAMPLER_SLACK_USERNAME```: the username to post with. Defaults to ```sitesampler```.

## Methods
### sitesampler(*[settings]*)
When instantiating the sitesampler, it requires settings to work. Settings is thus either an object or a path to a json file containing the settings.

```settings``` (object | string): object with settings or path to settings. Defaults to ```./sitesampler.json```. Properties:

- ```targets``` (object) - an array of targets for the [schedule-schedule](https://www.npmjs.com/package/needle-schedule) module under the hood.
- ```options``` (object) - default options that will be passed through to [schedule-schedule](https://www.npmjs.com/package/needle-schedule). See example below or ```sitesampler.default.json```.
- ```chronostore``` (object) - default options that will be passed through to [chronostore](https://www.npmjs.com/package/chronostore). If not defined, nothing will be written to disk. To use chronostore defaults, pass an empty object ```{}```.
- ```rethrowErrors``` (object) - whether sitesampler should rethrow eerrors from goldwasher and chronostore. Defaults to ```true```.

### sitesampler.start()
Starts the sitesampler.

### sitesampler.stop()
Stops the sitesampler.

## Events
Sitesampler is an event emitter that will emit collected results or when an error is encountered. See the example below. Remember to handle errors or your program will crash if an error is encountered. This will, however, usually only happen if you point it at something that isn't HTML.

## Example
```javascript
var sitesampler = require('sitesampler');
var ss = sitesampler('sitesampler.default.json');

ss.on('response', function(result) {
  console.log(result);
});

ss.on('error', function(error) {
  console.log(error);
});

ss.start();
```

## sitesampler.default.json
```javascript
{
  "targets": [
    {
      "url": "http://www.github.com",
      "rule": { "second": [15, 35, 55] }
    }
  ],
  "options": {
    "rule": { "second": [1] },
    "needleRetry": {
      "retries": 10
    }
  },
  "chronostore": {
    "root": "./chronostore"
  }
}

```
