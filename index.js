'use strict';

var apple = require('./lib/apple');

module.exports = {

  config: function (options) {
    apple.config(options);
	},

  validate: function (options, callback) {
    apple.validate(options, callback);
	}

};
