'use strict';

var apple = require('./lib/apple');

module.exports = {

  EmptyError: apple.EmptyError,

  config: function (options) {
    apple.config(options);
	},

  extract: function (options, callback) {
    return apple.extract(options, callback);
  },

  validate: function (options, callback) {
    return apple.validate(options, callback);
	}

};
