'use strict';

var apple = require('./lib/apple');

module.exports = {

  EmptyError: apple.EmptyError,

  config: function (options) {
    apple.config(options);
	},

  extract: function (options, callback) {
    apple.extract(options, callback);
  },

  validate: function (options, callback) {
    apple.validate(options, callback);
	}

};
