'use strict';

var sitesampler = require('./');
var ss = sitesampler('settings.default.json');

ss.start();

ss.on('results', function(data) {
    console.log(data);
  });
