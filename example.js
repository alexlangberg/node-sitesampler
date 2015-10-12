'use strict';

var sitesampler = require('./');
var ss = sitesampler('sitesampler.default.json');

ss.on('response', function(result) {
  console.log(result);
});

ss.on('error', function(error) {
  console.log(error);
});

ss.start();
