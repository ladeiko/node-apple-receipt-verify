'use strict';

const async = require('async');
const _ = require('lodash');
const Joi = require('joi');
const https = require('https');
const url = require('url');
const HttpsProxyAgent = require('https-proxy-agent');
const HttpProxyAgent = require('http-proxy-agent');

function parseUrl(adr) {
  return url.parse(adr);
}

function EmptyError(message, extra) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.extra = extra;
}

function ServiceUnavailableError(message, extra) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.extra = extra;
}

require('util').inherits(EmptyError, Error);

const defaultPurchaseConfig = {
  verbose: false,
  extended: false,
  ignoreExpiredError: false,
  ignoreExpired: true,
  environment: ['production'],
  excludeOldTransactions: false
};

let purchaseConfig = _.cloneDeep(defaultPurchaseConfig);

// validation
const VALIDATION = Object.freeze({
  SUCCESS: 0,
  FAILURE: 1,
  POSSIBLE_HACK: 2
});

function logDebug(){
  if (!console || !purchaseConfig.verbose){
    return;
  }
  console.log.apply(null, arguments);
}

function logWarn(){
  if (!console || !purchaseConfig.verbose){
    return;
  }
  console.warn.apply(null, arguments);
}

function logError(){
  if (!console || !purchaseConfig.verbose){
    return;
  }
  console.error.apply(null,arguments);
}

const ERROR_CODES = Object.freeze({

  /** The receipt validated successfully. */
  SUCCESS: 0,

  /** The receipt is valid, but purchased nothing. */
  VALID_BUT_EMPTY: 2,

  /** The App Store could not read the JSON object you provided. */
  INVALID_JSON: 21000,

  /** The data in the receipt-data property was malformed or missing. */
  INVALID_RECEIPT_DATA: 21002,

  /** The receipt could not be authenticated. */
  COULD_NOT_AUTHENTICATE: 21003,

  /** The shared secret you provided does not match the shared secret on file for your account. */
  INVALID_SECRET: 21004,

  /** The receipt server is not currently available. */
  UNAVAILABLE: 21005,

  /** This receipt is valid but the subscription has expired. When this status code is returned to your server, the receipt data is also decoded and returned as part of the response.
   Only returned for iOS 6 style transaction receipts for auto-renewable subscriptions. */
  EXPIRED_SUBSCRIPTION: 21006,

  /** This receipt is from the test environment, but it was sent to the production environment for verification. Send it to the test environment instead. */
  TEST_RECEIPT: 21007,

  /** This receipt is from the production environment, but it was sent to the test environment for verification. Send it to the production environment instead. */
  PROD_RECEIPT: 21008,

  /** This receipt could not be authorized. Treat this the same as if a purchase was never made. */
  COULD_NOT_AUTHORIZE: 21010,
});

const errorMap = Object.freeze({
  21000: 'The App Store could not read the JSON object you provided.',
  21002: 'The data in the receipt-data property was malformed.',
  21003: 'The receipt could not be authenticated.',
  21004: 'The shared secret you provided does not match the shared secret on file for your account.',
  21005: 'The receipt server is not currently available.',
  21006: 'This receipt is valid but the subscription has expired. When this status code is returned to your server, the receipt data is also decoded and returned as part of the response.',
  21007: 'This receipt is a sandbox receipt, but it was sent to the production service for verification.',
  21008: 'This receipt is a production receipt, but it was sent to the sandbox service for verification.',
  2: 'The receipt is valid, but purchased nothing.',
  21010: 'This receipt could not be authorized. Treat this the same as if a purchase was never made.',
});

const REC_KEYS = Object.freeze({
  IN_APP: 'in_app',
  LRI: 'latest_receipt_info',
  BUNDLE_ID: 'bundle_id',
  TRANSACTION_ID: 'transaction_id',
  ORIGINAL_TRANSACTION_ID: 'original_transaction_id',
  PRODUCT_ID: 'product_id',
  PURCHASE_DATE: 'purchase_date',
  PURCHASE_DATE_MS: 'purchase_date_ms',
  EXPIRES_DATE_MS: 'expires_date_ms',
  EXPIRES_DATE: 'expires_date',
  PREORDER_DATE: 'preorder_date',
  PREORDER_DATE_MS: 'preorder_date_ms',
});

const sandboxHost = 'sandbox.itunes.apple.com';
const liveHost = 'buy.itunes.apple.com';
const path = '/verifyReceipt';
let initialized = false;

function isValidConfigKey(key) {
  return ['secret', 'ignoreExpired', 'environment', 'verbose', 'extended', 'ignoreExpiredError', 'excludeOldTransactions'].indexOf(key) >= 0;
}

function readConfig(configIn) {
  purchaseConfig = {};
  Object.keys(configIn).forEach(function (key) {
    if (isValidConfigKey(key)) {
      purchaseConfig[key] = configIn[key];
    }
    else {
      logWarn('Unsupported node-apple-receipt-verify option "' + key + '" found');
    }
  });
}

function validatePurchase(receipt, options, cb) {
  const prodPath = 'https://' + liveHost + path;
  const sandboxPath = 'https://' + sandboxHost + path;
  let status;
  let validatedData;
  let isValid = false;
  const content = { 'receipt-data': receipt };

  if (options.secret) {
    content.password = purchaseConfig.secret;
  }

  if (options.excludeOldTransactions) {
    content['exclude-old-transactions'] = true;
  }

  if (options.secret) {
    content.password = options.secret;
  }

  logDebug(
    '<Apple> Validation data:',
    _.mapValues(content, function (value, key) {
      if (key === 'password') {
        return '******';
      }
      return value;
    })
  );

  function detectBool(s) {
    if (typeof s === 'boolean') {
      return s;
    }
    else if (typeof s === 'string') {
      s = s.toLowerCase();
      if (s === 'true') {
        return true;
      }
      const n = parseInt(s);
      return !isNaN(n) && (n !== 0);
    }
    else if (typeof s === 'number') {
      return !isNaN(s) && (s !== 0);
    }
    return false;
  }

  const isRetryable = (data) => {
    return detectBool(_.at(data, 'is-retryable')[0]);
  };

  const tryProd = function (next) {
    if (isValid) {
      return next();
    }
    logDebug('<Apple> Try validate against production:', prodPath);
    sendRequest(prodPath, content, function (error, data) {
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
        error.appleStatus = status;
        error.isRetryable = isRetryable(data);
        return next(error);
      }
      // apple responded with error
      if (data.status > 0 && data.status !== 21007 && data.status !== 21002 && (!options.ignoreExpiredError || data.status !== 21006)) {
        logDebug(prodPath, 'failed:', data);
        status = data.status;
        const emsg = errorMap[status] || ('Receipt validation status = ' + status);
        const err = new Error(emsg);
        err.data = data;
        validatedData = {
          status: status,
          message: emsg
        };
        err.appleStatus = status;
        err.isRetryable = isRetryable(data);
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

  const trySandbox = function (next) {
    if (isValid) {
      return next();
    }
    logDebug('<Apple> Try validate against sandbox:', sandboxPath);
    sendRequest(sandboxPath, content, function (error, data) {
      logDebug('<Apple>', sandboxPath, 'validation response:', data);
      if (error) {
        error.data = data;
        logDebug('<Apple>', sandboxPath, 'failed:', error, data);
        // 1 is unknown
        status = data ? data.status : 1;
        validatedData = {
          status: status,
          message: errorMap[status] || ('Receipt validation status = ' + status)
        };
        error.appleStatus = status;
        error.isRetryable = isRetryable(data);
        return next(error);
      }
      if (data.status > 0 && (!options.ignoreExpiredError || data.status !== 21006)) {
        logDebug('<Apple>', sandboxPath, 'failed:', data);
        status = data.status;
        const emsg = errorMap[status] || 'Unknown';
        const err = new Error(emsg);
        err.data = data;
        validatedData = {
          status: status,
          message: emsg
        };
        err.appleStatus = status;
        err.isRetryable = isRetryable(data);
        return next(err);
      }
      logDebug('<Apple> Sandbox validation successful:', data);
      // sandbox validated
      data.environment = data.environment || 'sandbox';
      validatedData = data;
      next();
    });
  };

  const done = function (error) {
    if (error) {
      return cb(error, validatedData);
    }
    handleResponse(options, receipt, validatedData, cb);
  };

  const tasks = _.reduce(options.environment, function (t, e) {
    if (e === 'production'){
      t.push(tryProd);
    }
    else {
      t.push(trySandbox);
    }
    return t;
  },[]);

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

  const data = [];
  let pendingRenewalInfo;

  if (purchase.pending_renewal_info) {
    pendingRenewalInfo = purchase.pending_renewal_info;
  }

  if (purchase.receipt[REC_KEYS.IN_APP]) {
    // iOS 6+
    const tids = {};
    let list = purchase.receipt[REC_KEYS.IN_APP];
    const lri = purchase[REC_KEYS.LRI];
    if (lri && Array.isArray(lri)) {
      list = list.concat(lri);
    }

    for (let i = 0, len = list.length; i < len; i++) {
      const item = list[i];

      const tid = item[REC_KEYS.TRANSACTION_ID];
      const pdate = parseInt(item[REC_KEYS.PURCHASE_DATE_MS], 10);
      const exp = getSubscriptionExpireDate(item);
      const pur = getSubscriptionPurchaseDate(item);
      let index = data.length;

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
        quantity: parseInt(item.quantity, 10),
        web_order_line_item_id: item.web_order_line_item_id,
        webOrderLineItemId: item.web_order_line_item_id,
      };

      const preorderDate = getPreorderDate(purchase.receipt);
      if (preorderDate) {
        data[index].preorderDate = preorderDate;
      }

      if (options.extended) {

        if (typeof item.promotional_offer_id === 'string') {
          data[index].promotionalOfferId = item.promotional_offer_id;
        }

        data[index].isTrialPeriod = item.is_trial_period === 'true';
        data[index].isInIntroOfferPeriod = item.is_in_intro_offer_period === 'true';

        data[index].environment = getEnvironment(purchase.environment);
        data[index].originalPurchaseDate = getDate(item, 'original_purchase_date_ms', 'original_purchase_date');
        data[index].applicationVersion = purchase.receipt.application_version;
        data[index].originalApplicationVersion = purchase.receipt.original_application_version;
        data[index].appAccountToken = purchase.receipt.app_account_token || item.app_account_token;        

        if (typeof item.cancellation_date_ms === 'string' || typeof item.cancellation_date === 'string') {
          data[index].cancellationDate = getDate(item, 'cancellation_date_ms', 'cancellation_date');
          if (typeof item.cancellation_reason === 'string') {
            data[index].cancellationReason = item.cancellation_reason;
          }
        }

        if (pendingRenewalInfo) {
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
    expirationDate: getSubscriptionExpireDate(purchase.receipt),
    web_order_line_item_id: purchase.receipt.web_order_line_item_id,
    webOrderLineItemId: purchase.receipt.web_order_line_item_id,
  };

  const preorderDate = getPreorderDate(purchase.receipt);
  if (preorderDate) {
    r.preorderDate = preorderDate;
  }

  if (!(options && options.ignoreExpired && r.expirationDate && Date.now() >= r.expirationDate)) {

    if (options.extended) {

      const item = purchase.receipt;

      r.isTrialPeriod = item.is_trial_period === 'true';
      r.isInIntroOfferPeriod = item.is_in_intro_offer_period === 'true';

      r.environment = getEnvironment(purchase.environment);
      r.originalPurchaseDate = getDate(item, 'original_purchase_date_ms', 'original_purchase_date');
      r.applicationVersion = item.application_version || item.bvrs;
      r.originalApplicationVersion = item.original_application_version || '1.0';
      r.appAccountToken = item.app_account_token;

      if (typeof item.cancellation_date === 'string') {
        r.cancellationDate = getDate(item, 'cancellation_date_ms', 'cancellation_date');
        if (typeof item.cancellation_reason === 'string') {
          r.cancellationReason = item.cancellation_reason;
        }
        else if (typeof purchase.cancellation_reason === 'string') {
          r.cancellationReason = purchase.cancellation_reason;
        }
      }

      if (pendingRenewalInfo) {
        r.pendingRenewalInfo = pendingRenewalInfo;
      }
      else {
        if (typeof purchase.auto_renew_status !== 'undefined') {
          r.pendingRenewalInfo = [{
            auto_renew_status: purchase.auto_renew_status.toString(),
            autoRenewStatus: purchase.auto_renew_status.toString(),
            product_id: purchase.auto_renew_product_id,
            productId: purchase.auto_renew_product_id
          }];
        }
      }
    }

    data.push(r);
  }

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

function getPreorderDate(data) {
  return getDate(data, REC_KEYS.PREORDER_DATE_MS, REC_KEYS.PREORDER_DATE);
}

function getSubscriptionPurchaseDate(data) {
  return getDate(data, REC_KEYS.PURCHASE_DATE_MS, REC_KEYS.PURCHASE_DATE);
}

function handleResponse(options, receipt, data, cb) {
  if (!data){
    return cb(new Error('invalid server response'), data);
  }
  if (data.status === 21006 && options.ignoreExpiredError) {
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
      var error = new EmptyError('failed to validate for empty purchased list');
      try {
        error.applicationVersion = data.receipt.application_version;
        error.originalApplicationVersion = data.receipt.original_application_version;
        error.application_version = data.receipt.application_version;
        error.original_application_version = data.receipt.original_application_version;        
      }
      // eslint-disable-next-line no-unused-vars
      catch (e) {
        // ignore
      }
      return cb(error, data);
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

function sendRequest(url, content, cb) {

  // fix: 'Error: Callback was already called.'
  var completed = false;
  const complete = function (err, result) {
    
    if (completed) {
      return;
    }

    completed = true;
    cb(err, result);
  };

  const urlParts = parseUrl(url);
  const data = JSON.stringify(content);

  const options = {
    hostname: urlParts.hostname,
    port: urlParts.port || 443,
    path: urlParts.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const proxy = process.env.http_proxy || process.env.HTTP_PROXY;
  if (proxy) {
    if (proxy.startsWith('https://')) {
      const agent = new HttpsProxyAgent(proxy);
      options.agent = agent;
    }
    else {
      const agent = new HttpProxyAgent(proxy);
      options.agent = agent;
    }
  }

  let response = '';
  const req = https.request(options, (res) => {

    res.on('data', (d) => {
      response += d.toString('utf8');
    });

    res.on('error', (error) => {
      complete(error);
    });

    res.on('end', () => {
      try {
        const json = JSON.parse(response);
        complete(null, json);
      }
      catch (e) {

        logError('Apple Receipt Validation statusCode=', res.statusCode, 'response=', response);

        if (res.statusCode >= 500 && res.statusCode < 600) {
          const text = response
            .replace(/<.+?>/gi,'')
            .replace(/http\/[0-9.]+/i,'')
            .trim();
            // eslint-disable-next-line no-ex-assign
          e = new ServiceUnavailableError(text || response)
        }

        complete(e);
      }
    });

  });

  req.on('error', (error) => {
    complete(error);
  });

  req.write(data);
  req.end();
}

function isValidated(response) {
  if (response && response.status === VALIDATION.SUCCESS) {
    return true;
  }
  return false;
}

module.exports = {

  ERROR_CODES: ERROR_CODES,

  EmptyError: EmptyError,
  ServiceUnavailableError: ServiceUnavailableError,

  resetConfig: function () {
    purchaseConfig = _.cloneDeep(defaultPurchaseConfig);
  },

  config: function (options) {

    if (arguments.length === 0) {
      return _.cloneDeep(purchaseConfig);
    }

    options = options || {};

    const schema = Joi.object().keys({
      verbose: Joi.boolean().optional(),
      extended: Joi.boolean().optional(),
      secret: Joi.string().optional(),
      ignoreExpiredError: Joi.boolean().optional(),
      ignoreExpired: Joi.boolean().optional(),
      environment: Joi.alternatives().try(
        Joi.array().items(Joi.string().lowercase().valid('production', 'sandbox')).min(1).max(2).unique(),
        Joi.string().lowercase().valid('production', 'sandbox')).optional(),
      excludeOldTransactions: Joi.boolean().optional(),
      requestDefaults: Joi.object().keys({
        timeout: Joi.number().min(1).optional()
      }).optional()
    });

    const result = schema.validate(options, { allowUnknown: true, convert: true });
    if (result.error) {
      throw result.error;
    }

    options = result.value;

    if (typeof options.environment === 'string') {
      options.environment = [options.environment];
    }

    options = _.assign({}, defaultPurchaseConfig, purchaseConfig, options );

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

    let promise;
    let fResolve;
    let fReject;

    if (!cb) {
      promise = new Promise((resolve, reject) => {
        fResolve = resolve;
        fReject = reject;
      });
    }

    function done(err, result) {
      if (err) {
        logError(err);
      }
      if (cb) {
        cb(err, result);
      }
      else {
        if (err) {
          fReject(err);
        }
        else {
          fResolve(result);
        }
      }
    }

    const schema = Joi.object().keys({
      verbose: Joi.boolean().optional(),
      receipt: Joi.string().base64().required(),
      device: Joi.string().regex(/^[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}$/).optional(),
      secret: Joi.string().optional(),
      environment: Joi.alternatives().try(
        Joi.array().items(Joi.string().lowercase().valid('production', 'sandbox')).min(1).max(2).unique(),
        Joi.string().lowercase().valid('production', 'sandbox')).optional(),
      extended: Joi.boolean().optional(),
      ignoreExpiredError: Joi.boolean().optional(),
      ignoreExpired: Joi.boolean().optional(),
      excludeOldTransactions: Joi.boolean().optional(),
      requestDefaults: Joi.object().keys({
        timeout: Joi.number().min(1).optional()
      }).optional()
    });

    const result = schema.validate(options,{ allowUnknown: true, convert: true });
    if (result.error) {
      let error = result.error;
      if (_.isString(result.error.message)) {
        const match = /\[(.+)]/.exec(result.error.message);
        if (match) {
          error = new Error(match[1]);
        }
      }
      process.nextTick(function () {
        return done(error);
      });
      return promise;
    }

    if (typeof options.environment === 'string') {
      options.environment = [options.environment];
    }

    options = result.value;
    options = _.defaults({}, _.cloneDeep(options), purchaseConfig);

    // Fix order of environments (https://github.com/ladeiko/node-apple-receipt-verify/issues/8)
    // ['sandbox', 'production'] -> ['production', 'sandbox']
    if (options.environment.length === 2
        && options.environment[0] === 'sandbox'
        && options.environment[1] === 'production'
      ){
      options.environment = ['production', 'sandbox'];
    }

    if (!initialized) {
      process.nextTick(function () {
        done(new Error('Module not initialized'));
      });
      return promise;
    }

    const tasks = [];

    tasks.push(function (taskCallback) {
      validatePurchase(options.receipt, options, function (err, response) {
        if (err) {
          taskCallback(err);
        }
        else {
          try {
            if (isValidated(response)) {
              taskCallback(null, getPurchaseData(response, options));
            }
            else if (response.status === 21006 && options.ignoreExpiredError) {
              taskCallback(null, getPurchaseData(response, options));
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
    });

    async.waterfall(tasks, function (err, purchasedProducts) {
      // remove duplicates
      const dirtySubscriptions = _.filter(purchasedProducts, function (p) { return !!options.doNotRemoveNonSubscriptions || !_.isNil(p.expirationDate); });
      const filtered = _.uniqBy(dirtySubscriptions, 'transactionId');
      done(err, filtered);
    });

    return promise;
  }

};
