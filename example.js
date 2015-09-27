'use strict';

var sitesampler = require('./');
var ss = sitesampler('sitesampler.default.json');

ss.on('results', function(data) {
  console.log(data);
});

ss.on('error', function(error) {
  console.log(error);
});

ss.start();
