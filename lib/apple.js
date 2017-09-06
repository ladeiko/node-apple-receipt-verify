'use strict';

var async = require('async');
var request = require('request');
var shell = require('shelljs');
var fs = require('fs');
var clone = require('clone');
var _ = require('lodash');
var Promise = require('bluebird');

shell.config.silent = true;

var checkreceipt_exists = null;

function EmptyError(msg, id) {
  Error.call(this, msg, id);
}

EmptyError.prototype = Object.create(Error.prototype);

var defaultPurchaseConfig = {
  verbose: false,
  requestDefaults: {
    timeout: 10000
  },
  extended: false,
  ignoreExpiredError: false,
  ignoreExpired: true,
  environment: ['production']
};

var purchaseConfig = clone(defaultPurchaseConfig);

// validation
var VALIDATION = {
  SUCCESS: 0,
  FAILURE: 1,
  POSSIBLE_HACK: 2
};

function logDebug(){
  if (!purchaseConfig.verbose){
    return;
  }
  console.log.apply(null, arguments);
}

function logError(){
  if (!purchaseConfig.verbose){
    return;
  }
  console.error.apply(null,arguments);
}

var errorMap = {
  21000: 'The App Store could not read the JSON object you provided.',
  21002: 'The data in the receipt-data property was malformed.',
  21003: 'The receipt could not be authenticated.',
  21004: 'The shared secret you provided does not match the shared secret on file for your account.',
  21005: 'The receipt server is not currently available.',
  21006: 'This receipt is valid but the subscription has expired. When this status code is returned to your server, the receipt data is also decoded and returned as part of the response.',
  21007: 'This receipt is a sandbox receipt, but it was sent to the production service for verification.',
  21008: 'This receipt is a production receipt, but it was sent to the sandbox service for verification.',
  2: 'The receipt is valid, but purchased nothing.'
};
var REC_KEYS = {
  IN_APP: 'in_app',
  LRI: 'latest_receipt_info',
  BUNDLE_ID: 'bundle_id',
  TRANSACTION_ID: 'transaction_id',
  ORIGINAL_TRANSACTION_ID: 'original_transaction_id',
  PRODUCT_ID: 'product_id',
  PURCHASE_DATE: 'purchase_date',
  PURCHASE_DATE_MS: 'purchase_date_ms',
  EXPIRES_DATE_MS: 'expires_date_ms',
  EXPIRES_DATE: 'expires_date'
};

var sandboxHost = 'sandbox.itunes.apple.com';
var liveHost = 'buy.itunes.apple.com';
var path = '/verifyReceipt';
var initialized = false;

function isValidConfigKey(key) {
  return ['secret', 'ignoreExpired', 'environment', 'verbose', 'extended', 'ignoreExpiredError'].indexOf(key) >= 0;
}

function readConfig(configIn) {
  purchaseConfig = {};
  // Apply any default settings to Request.
  if ('requestDefaults' in configIn) {
    request = request.defaults(configIn.requestDefaults);
  }
  Object.keys(configIn).forEach(function (key) {
    if (isValidConfigKey(key)) {
      purchaseConfig[key] = configIn[key];
    }
  });
}

function validatePurchase(receipt, opts, cb) {
  var prodPath = 'https://' + liveHost + path;
  var sandboxPath = 'https://' + sandboxHost + path;
  var status;
  var validatedData;
  var isValid = false;
  var content = { 'receipt-data': receipt };

  if (purchaseConfig && purchaseConfig.secret) {
    content.password = purchaseConfig.secret;
  }

  if (typeof opts.extended === 'undefined'){
    opts.extended = purchaseConfig.extended;
  }
  
  if (opts.secret) {
  	content.password = opts.secret;
  }

  logDebug('<Apple> Validatation data:', content);

  var tryProd = function (next) {
    if (isValid) {
      return next();
    }
    logDebug('<Apple> Try validate against production:', prodPath);
    send(prodPath, content, function (error, res, data) {
      logDebug('<Apple>', prodPath, 'validation response:', data);
      // request error
      if (error) {
        logDebug('<Apple>', prodPath, 'failed:', error, data);
        // 1 is unknown
        error.data = data;
        status = data ? data.status : 1;
        validatedData = {
          status: status,
          message: errorMap[status] || 'Unknown',
        };
        return next(error);
      }
      // apple responded with error
      if (data.status > 0 && data.status !== 21007 && data.status !== 21002 && (!opts.ignoreExpiredError || data.status !== 21006)) {
        logDebug(prodPath, 'failed:', data);
        status = data.status;
        var emsg = errorMap[status] || 'Unknown';
        var err = new Error(emsg);
        err.data = data;
        validatedData = {
          status: status,
          message: emsg
        };
        return next(err);
      }

      // try sandbox...
      if (data.status === 21007 || data.status === 21002) {
        validatedData = data;
        return next();
      }
      logDebug('<Apple> Production validation successful:', data);
      // production validated
      data.environment = data.environment || 'production';
      validatedData = data;
      isValid = true;
      next();
    });
  };

  var trySandbox = function (next) {
    if (isValid) {
      return next();
    }
    logDebug('<Apple> Try validate against sandbox:', sandboxPath);
    send(sandboxPath, content, function (error, res, data) {
      logDebug('<Apple>', sandboxPath, 'validation response:', data);
      if (error) {
        error.data = data;
        logDebug('<Apple>', sandboxPath, 'failed:', error, data);
        // 1 is unknown
        status = data ? data.status : 1;
        validatedData = {
          status: status,
          message: errorMap[status] || 'Unknown'
        };
        return next(error);
      }
      if (data.status > 0 && (!opts.ignoreExpiredError || data.status !== 21006)) {
        logDebug('<Apple>', sandboxPath, 'failed:', data);
        status = data.status;
        var emsg = errorMap[status] || 'Unknown';
        var err = new Error(emsg);
        err.data = data;
        validatedData = {
          status: status,
          message: emsg
        };
        return next(err);
      }
      logDebug('<Apple> Sandbox validation successful:', data);
      // sandbox validated
      data.environment = data.environment || 'sandbox';
      validatedData = data;
      next();
    });
  };

  var done = function (error) {
    if (error) {
      return cb(error, validatedData);
    }
    handleResponse(opts, receipt, validatedData, cb);
  };

  var tasks = [];

  var sandboxCount = 0;
  var productionCount = 0;
  var environment = opts.environment || purchaseConfig.environment || ['production'];
  if (typeof environment === 'string') {
    environment = [environment];
  }

  environment.forEach(function (e) {
    if (e == 'sandbox'){
      tasks.push(trySandbox);
      sandboxCount++;
    }
    else if (e == 'production'){
      tasks.push(tryProd);
      productionCount++;
    }
  });

  if ((tasks.length == 0) || (sandboxCount > 1) || (productionCount > 1)){
    return process.nextTick(function () {
      done(new Error('invalid environment'));
    });
  }

  async.series(tasks, done);
}

function getEnvironment(value) {
  value = (value || 'production').toLowerCase();
  if (value === 'prod') {
    value = 'production';
  }
  return value;
}

function getPurchaseData(purchase, options) {
  if (!purchase || !purchase.receipt) {
    return null;
  }
  var data = [];
  if (purchase.receipt[REC_KEYS.IN_APP]) {
    // iOS 6+
    var tids = {};
    var list = purchase.receipt[REC_KEYS.IN_APP];
    var lri = purchase[REC_KEYS.LRI];
    if (lri && Array.isArray(lri)) {
      list = list.concat(lri);
    }

    var pendingRenewalInfo;
    if (purchase.pending_renewal_info) {
      pendingRenewalInfo = purchase.pending_renewal_info;
    }

    for (var i = 0, len = list.length; i < len; i++) {
      var item = list[i];
      var tid = item['original_' + REC_KEYS.TRANSACTION_ID];
      var pdate = parseInt(item[REC_KEYS.PURCHASE_DATE_MS], 10);
      var exp = getSubscriptionExpireDate(item);
      var pur = getSubscriptionPurchaseDate(item);
      var index = data.length;

      if (options && options.ignoreExpired && exp && Date.now() - exp >= 0) {
        // we are told to ignore expired item and it is expired
        continue;
      }

      if (tids[tid] && tids[tid].time < pdate) {
        // avoid duplicate and keep the latest
        index = tids[tid].index;
      }

      tids[tid] = { time: pdate, index: data.length };
      data[index] = {
        transactionId: item[REC_KEYS.TRANSACTION_ID],
        originalTransactionId: item[REC_KEYS.ORIGINAL_TRANSACTION_ID],
        bundleId: purchase.receipt[REC_KEYS.BUNDLE_ID],
        productId: item[REC_KEYS.PRODUCT_ID],
        purchaseDate: pur,
        expirationDate: exp,
        quantity: parseInt(item.quantity, 10)
      };

      if (options.extended) {

        if (data[index].expirationDate) {
          data[index].isTrialPeriod = item.is_trial_period === 'true';
        }

        data[index].environment = getEnvironment(purchase.environment);
        data[index].originalPurchaseDate = getDate(item, 'original_purchase_date_ms', 'original_purchase_date');
        data[index].applicationVersion = purchase.receipt.application_version;
        data[index].originalApplicationVersion = purchase.receipt.original_application_version;

        if (typeof item.cancellation_date === 'string') {
          data[index].cancellationDate = getDate(item, 'cancellation_date_ms', 'cancellation_date');
          if (typeof item.cancellation_reason === 'string') {
            data[index].cancellationReason = item.cancellation_reason;
          }
        }

        if (purchase.pending_renewal_info) {
          data[index].pendingRenewalInfo = pendingRenewalInfo;
        }
      }
    }
    return data;
  }
  // old and will be deprecated by Apple

  const r = {
    bundleId: purchase.receipt[REC_KEYS.BUNDLE_ID] || purchase.receipt.bid,
    transactionId:  purchase.receipt[REC_KEYS.TRANSACTION_ID],
    originalTransactionId: purchase.receipt[REC_KEYS.ORIGINAL_TRANSACTION_ID],
    productId: purchase.receipt[REC_KEYS.PRODUCT_ID],
    purchaseDate: parseInt(purchase.receipt[REC_KEYS.PURCHASE_DATE_MS]),
    quantity: parseInt(purchase.receipt.quantity, 10),
    expirationDate: getSubscriptionExpireDate(purchase.receipt)
  };

  if (options.extended) {
    const item = purchase.receipt;
    if (r.expirationDate) {
      r.isTrialPeriod = item.is_trial_period === 'true';
    }
    r.environment = getEnvironment(purchase.environment);
    r.originalPurchaseDate = getDate(item, 'original_purchase_date_ms', 'original_purchase_date');
    r.applicationVersion = item.application_version || item.bvrs;
    r.originalApplicationVersion = item.original_application_version || '1.0';

    if (typeof item.cancellation_date === 'string') {
      r.cancellationDate = getDate(item, 'cancellation_date_ms', 'cancellation_date');
      if (typeof item.cancellation_reason === 'string') {
        r.cancellationReason = item.cancellation_reason;
      }
      else if (typeof purchase.cancellation_reason === 'string') {
        r.cancellationReason = purchase.cancellation_reason;
      }
    }

    if (purchase.pending_renewal_info) {
      r.pendingRenewalInfo = pendingRenewalInfo;
    }
    else {
      if (typeof purchase.auto_renew_status !== 'undefined'){
        r.pendingRenewalInfo = [{
          auto_renew_status: purchase.auto_renew_status.toString(),
          product_id: purchase.auto_renew_product_id
        }];
      }
    }
  }

  data.push(r);
  return data;
}

function getDate(data, ms_key, key) {
  if (data[ms_key]) {
    return parseInt(data[ms_key], 10);
  }
  if (data[key]) {
    if (/^\d+$/.test(data[key])) {
      return parseInt(data[key], 10);
    }
    else {
      return Math.ceil((new Date(data[key])).getTime() / 1000);
    }
  }
  return 0;
}

function getSubscriptionExpireDate(data) {
  return getDate(data, REC_KEYS.EXPIRES_DATE_MS, REC_KEYS.EXPIRES_DATE);
}

function getSubscriptionPurchaseDate(data) {
  return getDate(data, REC_KEYS.PURCHASE_DATE_MS, REC_KEYS.PURCHASE_DATE);
}

function handleResponse(opts, receipt, data, cb) {
  if (!data){
    return cb(new Error('invalid server response'), data);
  }
  if (data.status === 21006 && opts.ignoreExpiredError) {
    return cb(null, data);
  }
  if (data.status === VALIDATION.SUCCESS) {
    if (data.receipt[REC_KEYS.IN_APP] && !data.receipt[REC_KEYS.IN_APP].length) {
      // receipt is valid, but the receipt bought nothing
      // probably hacked: https://forums.developer.apple.com/thread/8954
      // https://developer.apple.com/library/mac/technotes/tn2413/_index.html#//apple_ref/doc/uid/DTS40016228-CH1-RECEIPT-HOW_DO_I_USE_THE_CANCELLATION_DATE_FIELD_
      data.status = VALIDATION.POSSIBLE_HACK;
      data.message = errorMap[data.status];
      logDebug(
        '<Apple>',
        'Empty purchased detected: in_app array is empty:',
        'consider invalid and does not validate',
        data
      );
      return cb(new EmptyError('failed to validate for empty purchased list'), data);
    }
    // validated successfully
    return cb(null, data);
  } else {
    // error -> add error message
    data.message = errorMap[data.status] || 'Unknown';
  }

  // failed to validate
  cb(new Error('failed to validate purchase'), data);
}

function send(url, content, cb) {
  var options = {
    encoding: null,
    url: url,
    body: content,
    json: true
  };
  request.post(options, function (error, res, body) {
    return cb(error, res, body);
  });
}

function isValidated(response) {
  if (response && response.status === VALIDATION.SUCCESS) {
    return true;
  }
  return false;
}

module.exports = {

  EmptyError: EmptyError,

  config: function (options) {

    options = options || {};
    options = _.merge({}, defaultPurchaseConfig, options );

    logDebug('config: %j', options);

    readConfig(options);

    initialized = true;
  },

  extract: function (options) {
    options = _.cloneDeep(options);
    return new Promise(function (resolve, reject) {
      try {
        resolve(getPurchaseData(options.response, options));
      }
      catch (e) {
        reject(e);
      }
    });
  },

  validate: function (options, cb) {

    options = _.cloneDeep(options);
    cb = cb || function () {};

    return new Promise(function (resolve, reject) {

      function done(err, result) {
        cb(err, result);
        if (err) {
          reject(err);
        }
        else {
          resolve(result);
        }
      }

      if (!initialized) {
        return process.nextTick(function () {
          done(new Error('Module not initialized'));
        });
      }

      if (!_.isString(options.receipt)){
          return process.nextTick(function () {
            done(new Error('Invalid parameters'));
          });
      }

      var tasks = [];

      if (options.device) {
        if (checkreceipt_exists === null) {
          checkreceipt_exists = fs.existsSync(__dirname + '/../bin/checkreceipt');
        }
        if (checkreceipt_exists) {
          tasks.push(function (taskCallback) {
            const cmdLine = __dirname + '/../bin/checkreceipt --uuid ' + options.device + ' --json-string ' + options.receipt;
            shell
              .exec(cmdLine, function (code, stdout, stderr) {
                if (code !== 0) {
                  taskCallback(new Error('invalid receipt'));
                }
                else {
                  try {
                    var resp = JSON.parse(stdout.toString());
                    if (resp.status !== 0) {
                      taskCallback(null);
                    }
                    else {
                      taskCallback(new Error('invalid receipt'));
                    }
                  }
                  catch (e) {
                    taskCallback(new Error('internal error'));
                  }
                }
              });
          });
        }
        else {
          if (console && console.warn) {
            console.warn('node-apple-receipt-verify: [NOTE] receipt will not be verified with vendor identifier!')
          }
        }
      }

      tasks.push(function (taskCallback) {
        var opts = {
          secret: options.secret,
          environment: options.environment,
          extended: options.extended,
          ignoreExpiredError: typeof options.ignoreExpiredError !== 'undefined' ? (options.ignoreExpiredError || false) : (purchaseConfig.ignoreExpiredError || false)
        };
        validatePurchase(options.receipt, opts, function (err, response) {
          if (err) {
            taskCallback(err);
          }
          else {
            try {
              if (isValidated(response)) {
                var opt = _.defaults({}, options, purchaseConfig);
                var purchaseDataList = getPurchaseData(response, opt);
                taskCallback(null, purchaseDataList);
              }
              else if (response.status === 21006 && opts.ignoreExpiredError) {
                var opt = _.defaults({}, options, purchaseConfig);
                var purchaseDataList = getPurchaseData(response, opt);
                taskCallback(null, purchaseDataList);
              }
              else {
                taskCallback(new Error('Invalid receipt'));
              }
            }
            catch (e) {
              taskCallback(e);
            }
          }
        });
      })

      async.waterfall(tasks, function (err, purchasedProducts) {

        // remove duplicates
        const dirtySubscriptions = _.filter(purchasedProducts, function (p) { return !_.isNil(p.expirationDate); });
        const used = new Set();
        const filtered = _.filter(dirtySubscriptions, function (s) {
          if (used.has(s.transactionId)){
            return false;
          }
          used.add(s.transactionId);
          return true;
        });

        done(err, filtered);
      });

    });
  }

};
