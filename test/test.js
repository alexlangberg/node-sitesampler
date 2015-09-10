'use strict';

var test = require('tape');
var subject = require('../');

test('returns true', function(t) {
  t.plan(1);

  t.equal(subject(), true);
});
