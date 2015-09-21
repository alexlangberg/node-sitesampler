# node-sitesampler
[![npm version](http://img.shields.io/npm/v/sitesampler.svg)](https://www.npmjs.org/package/sitesampler)
[![Build Status](http://img.shields.io/travis/alexlangberg/node-sitesampler.svg)](https://travis-ci.org/alexlangberg/node-sitesampler)
[![Dependency Status](https://david-dm.org/alexlangberg/node-sitesampler.svg)](https://david-dm.org/alexlangberg/node-sitesampler)
[![devDependency Status](https://david-dm.org/alexlangberg/node-sitesampler/dev-status.svg)](https://david-dm.org/alexlangberg/node-sitesampler#info=devDependencies)

Data collection sometimes includes collecting the same data over time. This module enables you to collect the text content of websites in [goldwasher](https://www.npmjs.com/package/goldwasher) format over time and store them with the [chronostore](https://www.npmjs.com/package/chronostore) module, thus sampling sites. On top of storing the results as files, it also emits the results when collected, enabling you to further process the data, e.g. pushing the data to a database.

A heavy emphasis is put on stability and logging. Everything, even the logging provided by [bunyan](https://www.npmjs.com/package/bunyan), is covered with tests. It also allows you to forward your logging to the console, [loggly](https://www.loggly.com), [logentries](https://logentries.com) and [slack](https://slack.com). 

Linted with ESLint, tested with tape and 100% coverage with covert.

## Installation
```
npm install sitesampler
```

## Methods
### sitesampler(*[settings]*)
When instantiating the sitesampler, it requires settings to work. Settings is thus either an object or a path to a json file containing the settings.

```settings``` (object | string): object with settings or path to settings. Defaults to ```./settings.json```. Properties:

- ```targets``` (object) - an array of targets for the [goldwasher-schedule](https://www.npmjs.com/package/goldwasher-schedule) module under the hood.
- ```options``` (object) - an object where you can add default options that will be passed through to [goldwasher-schedule](https://www.npmjs.com/package/goldwasher-schedule) and [chronostore](https://www.npmjs.com/package/chronostore). See example below or ```settings.default.json```.

### sitesampler.start()
Starts the sitesampler.

### sitesampler.stop()
Stops the sitesampler.

## Events
Sitesampler is an event emitter that will emit collected results or when an error is encountered. See the example below. Remember to handle errors or your program will crash if an error is encountered. This will, however, usually only happen if you point it at something that isn't HTML.

## Example
```javascript
var sitesampler = require('sitesampler');
var ss = sitesampler('settings.default.json');

ss.start();

ss.on('results', function(data) {
  console.log(data);
});

ss.on('error', function(error) {
  console.log(error);
});
```

## settings.default.json
```javascript
{
  "targets": [
    {
      "url": "http://www.github.com",
      "rule": { "second": [15, 35, 55] },
      "goldwasher": {
        "selector": "h1"
      }
    }
  ],
  "options": {
    "goldwasher": {
      "selector": "h1, h2, h3, h4, h5, h6"
    },
    "chronostore": {
      "root": "./chronostore"
    }
  }
}
```
