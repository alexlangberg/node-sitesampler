'use strict';

var sitesampler = require('./');
var ss = sitesampler('sitesampler.default.json');

ss.on('response', function(response) {
  console.log(response);
});

ss.on('error', function(error) {
  console.log(error);
});

ss.start();
