'use strict';

const _ = require('lodash');
const assert = require('assert');
const nock = require('nock');
const verify = require('./../index');

function errorWithData(msg, data) {
  const err = new Error(msg);
  if (data) {
    err.data = data;
    if (typeof data.status === 'number') {
      err.appleStatus = data.status;
    }
    err.isRetryable = false;
  }

  return err;
}

function expiredReceiptResponse() {
  return {
    "auto_renew_status": 0,
    "latest_expired_receipt_info": {
      "original_purchase_date_pst": "2018-05-18 06:11:12 America/Los_Angeles",
      "quantity": "1",
      "unique_vendor_identifier": "A112340D-26DD-4FEA-BE40-F0B8E168EB1C",
      "bvrs": "1.18.100",
      "expires_date_formatted": "2018-05-28 13:11:11 Etc/GMT",
      "is_in_intro_offer_period": "false",
      "purchase_date_ms": "1526908271000",
      "expires_date_formatted_pst": "2018-05-28 06:11:11 America/Los_Angeles",
      "is_trial_period": "false",
      "item_id": "3540212492",
      "unique_identifier": "e13580ab6223217d302770b670723ac430e12345",
      "original_transaction_id": "250000287737863",
      "expires_date": "1527513071000",
      "app_item_id": "1200776424",
      "transaction_id": "250003338696952",
      "web_order_line_item_id": "250000091943118",
      "bid": "com.myapp",
      "app_account_token": '1',
      "product_id": "com.myapp.product",
      "purchase_date": "2018-05-21 13:11:11 Etc/GMT",
      "original_purchase_date": "2018-05-18 13:11:12 Etc/GMT",
      "purchase_date_pst": "2018-05-21 06:11:11 America/Los_Angeles",
      "original_purchase_date_ms": "1526649072000"
    }, "status": 21006, "auto_renew_product_id": "com.myapp.product",
    "receipt": {
      "original_purchase_date_pst": "2018-05-18 06:11:12 America/Los_Angeles",
      "quantity": "1",
      "unique_vendor_identifier": "A112340D-26DD-4FEA-BE40-F0B8E168EB1C",
      "bvrs": "1.18.100",
      "expires_date_formatted": "2018-05-21 13:11:11 Etc/GMT",
      "is_in_intro_offer_period": "false",
      "purchase_date_ms": "1526649071000",
      "expires_date_formatted_pst": "2018-05-21 06:11:11 America/Los_Angeles",
      "is_trial_period": "true",
      "item_id": "3540212492",
      "unique_identifier": "e13580ab6223217d302770b670723ac430e12345",
      "original_transaction_id": "250000287737863",
      "expires_date": "1526908271000",
      "app_item_id": "1200776424",
      "transaction_id": "250000287737863",
      "web_order_line_item_id": "251200091943117",
      "app_account_token": '1',
      "version_external_identifier": "826299857",
      "product_id": "com.myapp.product",
      "purchase_date": "2018-05-18 13:11:11 Etc/GMT",
      "original_purchase_date": "2018-05-18 13:11:12 Etc/GMT",
      "purchase_date_pst": "2018-05-18 06:11:11 America/Los_Angeles",
      "bid": "com.myapp",
      "original_purchase_date_ms": "1526649072000"
    }, "expiration_intent": "1", "is_in_billing_retry_period": "0"
  }
}

function expiredReceiptData(extended = false) {
  let info = [
    {
      bundleId: 'com.myapp',
      transactionId: '250000287737863',
      originalTransactionId: '250000287737863',
      productId: 'com.myapp.product',
      purchaseDate: 1526649071000,
      quantity: 1,
      expirationDate: 1526908271000,
      webOrderLineItemId: '251200091943117',
      web_order_line_item_id: '251200091943117',
    }
  ];
  if (extended) {
    info[0] = _.assign(info[0], {
      applicationVersion: '1.18.100',
      bundleId: 'com.myapp',
      environment: 'production',
      isTrialPeriod: true,
      isInIntroOfferPeriod: false,
      originalApplicationVersion: '1.0',
      originalPurchaseDate: 1526649072000,
      originalTransactionId: '250000287737863',
      appAccountToken: '1',
      pendingRenewalInfo: [
        {
          auto_renew_status: '0',
          autoRenewStatus: '0',
          product_id: 'com.myapp.product',
          productId: 'com.myapp.product',
        }
      ]
    });
  }
  return info;
}

describe('Queries', function() {

  const liveHost = 'https://buy.itunes.apple.com';
  const sandboxHost = 'https://sandbox.itunes.apple.com';

  const setupStatusTest = (environment, code, message) => {

    it(`Should fail for status ${code} in ${JSON.stringify(environment)}`, async function () {

      let liveScope = nock(liveHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: code });
      let sandboxScope = nock(sandboxHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: code });

      await verify.validate({ environment: environment, receipt: 'YWJjMTIzIT8kKiYoKSctPUB+' }).should.be.rejectedWith(errorWithData(message || 'failed to validate purchase', message ? { status: code } : undefined ));

      assert.ok(environment.indexOf('production') >= 0 ? liveScope.isDone() : !liveScope.isDone());
      assert.ok(environment.indexOf('sandbox') >= 0 ? sandboxScope.isDone() : !sandboxScope.isDone());

    });

  };

  before(function () {
    nock.disableNetConnect();
    //nock.recorder.rec({ output_objects: true });
  });

  after(function () {
    //console.log(nock.recorder.play());
    //nock.restore();
    nock.enableNetConnect();
  });

  beforeEach(function () {
    verify.resetConfig();
  });

  afterEach(function () {
    nock.cleanAll();
  });

  it(`Should fail if invalid receipt`, async function () {
    await verify.validate({ receipt: '---+' }).should.be.rejectedWith('"receipt" must be a valid base64 string');
  });

  // it(`Should fail if invalid device`, async function () {
  //   await verify.validate({ receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', device: 'DASDA' }).should.be.rejectedWith(/"device" with value "DASDA" fails to match the required pattern:/);
  // });

  it(`Should fail if invalid excludeOldTransactions`, async function () {
    await verify.validate({ receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', excludeOldTransactions: 1 }).should.be.rejectedWith('"excludeOldTransactions" must be a boolean');
  });

  it(`Should fail if invalid ignoreExpired`, async function () {
    await verify.validate({ receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', ignoreExpired: 1 }).should.be.rejectedWith('"ignoreExpired" must be a boolean');
  });

  it(`Should fail if invalid ignoreExpiredError`, async function () {
    await verify.validate({ receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', ignoreExpiredError: 1 }).should.be.rejectedWith('"ignoreExpiredError" must be a boolean');
  });

  it(`Should fail if invalid extended`, async function () {
    await verify.validate({ receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', extended: 1 }).should.be.rejectedWith('"extended" must be a boolean');
  });

  it(`Should fail if invalid secret`, async function () {
    await verify.validate({ receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', secret: 1 }).should.be.rejectedWith('"secret" must be a string');
  });

  setupStatusTest(['production'], 21000, 'The App Store could not read the JSON object you provided.');
  setupStatusTest(['sandbox'], 21000, 'The App Store could not read the JSON object you provided.');
  setupStatusTest(['production'], 21002);
  setupStatusTest(['sandbox'], 21002, 'The data in the receipt-data property was malformed.');
  setupStatusTest(['production'], 21003, 'The receipt could not be authenticated.');
  setupStatusTest(['sandbox'], 21003, 'The receipt could not be authenticated.');
  setupStatusTest(['production'], 21004, 'The shared secret you provided does not match the shared secret on file for your account.');
  setupStatusTest(['sandbox'], 21004, 'The shared secret you provided does not match the shared secret on file for your account.');
  setupStatusTest(['production'], 21005, 'The receipt server is not currently available.');
  setupStatusTest(['sandbox'], 21005, 'The receipt server is not currently available.');
  setupStatusTest(['production'], 21006, 'This receipt is valid but the subscription has expired. When this status code is returned to your server, the receipt data is also decoded and returned as part of the response.');
  setupStatusTest(['sandbox'], 21006, 'This receipt is valid but the subscription has expired. When this status code is returned to your server, the receipt data is also decoded and returned as part of the response.');
  setupStatusTest(['production'], 21007);
  setupStatusTest(['sandbox'], 21007, 'This receipt is a sandbox receipt, but it was sent to the production service for verification.');
  setupStatusTest(['production'], 21008, 'This receipt is a production receipt, but it was sent to the sandbox service for verification.');
  setupStatusTest(['sandbox'], 21008, 'This receipt is a production receipt, but it was sent to the sandbox service for verification.');
  setupStatusTest(['production'], 2, 'The receipt is valid, but purchased nothing.');
  setupStatusTest(['sandbox'], 2, 'The receipt is valid, but purchased nothing.');

  it('Should fail on expired receipt if ignoreExpiredError is false', async function () {

    let liveScope = nock(liveHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, expiredReceiptResponse());

    let sandboxScope = nock(sandboxHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: -1 });

    await verify.validate({ environment: ['production'], receipt: 'YWJjMTIzIT8kKiYoKSctPUB+' }).should.be.rejectedWith(errorWithData('This receipt is valid but the subscription has expired. When this status code is returned to your server, the receipt data is also decoded and returned as part of the response.', {
      auto_renew_status: 0,
      latest_expired_receipt_info: {
        original_purchase_date_pst: '2018-05-18 06:11:12 America/Los_Angeles',
        quantity: '1',
        unique_vendor_identifier: 'A112340D-26DD-4FEA-BE40-F0B8E168EB1C',
        bvrs: '1.18.100',
        expires_date_formatted: '2018-05-28 13:11:11 Etc/GMT',
        is_in_intro_offer_period: 'false',
        purchase_date_ms: '1526908271000',
        expires_date_formatted_pst: '2018-05-28 06:11:11 America/Los_Angeles',
        is_trial_period: 'false',
        item_id: '3540212492',
        unique_identifier: 'e13580ab6223217d302770b670723ac430e12345',
        original_transaction_id: '250000287737863',
        expires_date: '1527513071000',
        app_item_id: '1200776424',
        transaction_id: '250003338696952',
        web_order_line_item_id: '250000091943118',
        app_account_token: '1',
        bid: 'com.myapp',
        product_id: 'com.myapp.product',
        purchase_date: '2018-05-21 13:11:11 Etc/GMT',
        original_purchase_date: '2018-05-18 13:11:12 Etc/GMT',
        purchase_date_pst: '2018-05-21 06:11:11 America/Los_Angeles',
        original_purchase_date_ms: '1526649072000'
      },
      status: 21006,
      auto_renew_product_id: 'com.myapp.product',
      receipt: {
        original_purchase_date_pst: '2018-05-18 06:11:12 America/Los_Angeles',
        quantity: '1',
        unique_vendor_identifier: 'A112340D-26DD-4FEA-BE40-F0B8E168EB1C',
        bvrs: '1.18.100',
        expires_date_formatted: '2018-05-21 13:11:11 Etc/GMT',
        is_in_intro_offer_period: 'false',
        purchase_date_ms: '1526649071000',
        expires_date_formatted_pst: '2018-05-21 06:11:11 America/Los_Angeles',
        is_trial_period: 'true',
        item_id: '3540212492',
        unique_identifier: 'e13580ab6223217d302770b670723ac430e12345',
        original_transaction_id: '250000287737863',
        expires_date: '1526908271000',
        app_item_id: '1200776424',
        transaction_id: '250000287737863',
        web_order_line_item_id: '251200091943117',
        app_account_token: '1',
        version_external_identifier: '826299857',
        product_id: 'com.myapp.product',
        purchase_date: '2018-05-18 13:11:11 Etc/GMT',
        original_purchase_date: '2018-05-18 13:11:12 Etc/GMT',
        purchase_date_pst: '2018-05-18 06:11:11 America/Los_Angeles',
        bid: 'com.myapp',
        original_purchase_date_ms: '1526649072000'
      },
      expiration_intent: '1',
      is_in_billing_retry_period: '0'
    }));

    assert.ok(liveScope.isDone());
    assert.ok(!sandboxScope.isDone());

  });

  it('Should fail on expired receipt if ignoreExpiredError is false (callback version)', async function () {

    let liveScope = nock(liveHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, expiredReceiptResponse());

    let sandboxScope = nock(sandboxHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: -1 });

    await (new Promise((resolve, reject) => {
      verify.validate({environment: ['production'], receipt: 'YWJjMTIzIT8kKiYoKSctPUB+'}, (err, data) => {
        if (err) {
          return reject(err);
        }
        else {
          return resolve(data);
        }
      });
    })).should.be.rejectedWith(errorWithData('This receipt is valid but the subscription has expired. When this status code is returned to your server, the receipt data is also decoded and returned as part of the response.', {
      auto_renew_status: 0,
      latest_expired_receipt_info: {
        original_purchase_date_pst: '2018-05-18 06:11:12 America/Los_Angeles',
        quantity: '1',
        unique_vendor_identifier: 'A112340D-26DD-4FEA-BE40-F0B8E168EB1C',
        bvrs: '1.18.100',
        expires_date_formatted: '2018-05-28 13:11:11 Etc/GMT',
        is_in_intro_offer_period: 'false',
        purchase_date_ms: '1526908271000',
        expires_date_formatted_pst: '2018-05-28 06:11:11 America/Los_Angeles',
        is_trial_period: 'false',
        item_id: '3540212492',
        unique_identifier: 'e13580ab6223217d302770b670723ac430e12345',
        original_transaction_id: '250000287737863',
        expires_date: '1527513071000',
        app_item_id: '1200776424',
        transaction_id: '250003338696952',
        web_order_line_item_id: '250000091943118',
        app_account_token: '1',
        bid: 'com.myapp',
        product_id: 'com.myapp.product',
        purchase_date: '2018-05-21 13:11:11 Etc/GMT',
        original_purchase_date: '2018-05-18 13:11:12 Etc/GMT',
        purchase_date_pst: '2018-05-21 06:11:11 America/Los_Angeles',
        original_purchase_date_ms: '1526649072000'
      },
      status: 21006,
      auto_renew_product_id: 'com.myapp.product',
      receipt: {
        original_purchase_date_pst: '2018-05-18 06:11:12 America/Los_Angeles',
        quantity: '1',
        unique_vendor_identifier: 'A112340D-26DD-4FEA-BE40-F0B8E168EB1C',
        bvrs: '1.18.100',
        expires_date_formatted: '2018-05-21 13:11:11 Etc/GMT',
        is_in_intro_offer_period: 'false',
        purchase_date_ms: '1526649071000',
        expires_date_formatted_pst: '2018-05-21 06:11:11 America/Los_Angeles',
        is_trial_period: 'true',
        item_id: '3540212492',
        unique_identifier: 'e13580ab6223217d302770b670723ac430e12345',
        original_transaction_id: '250000287737863',
        expires_date: '1526908271000',
        app_item_id: '1200776424',
        transaction_id: '250000287737863',
        web_order_line_item_id: '251200091943117',
        app_account_token: '1',
        version_external_identifier: '826299857',
        product_id: 'com.myapp.product',
        purchase_date: '2018-05-18 13:11:11 Etc/GMT',
        original_purchase_date: '2018-05-18 13:11:12 Etc/GMT',
        purchase_date_pst: '2018-05-18 06:11:11 America/Los_Angeles',
        bid: 'com.myapp',
        original_purchase_date_ms: '1526649072000'
      },
      expiration_intent: '1',
      is_in_billing_retry_period: '0'
    }));

    assert.ok(liveScope.isDone());
    assert.ok(!sandboxScope.isDone());

  });

  it('Should succeed on expired receipt if ignoreExpiredError is true', async function () {

    let liveScope = nock(liveHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, expiredReceiptResponse());

    let sandboxScope = nock(sandboxHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: -1 });

    await verify.validate({ environment: ['production'], receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', ignoreExpiredError: true }).should.be.resolvedWith([]);

    assert.ok(liveScope.isDone());
    assert.ok(!sandboxScope.isDone());

  });

  it('Should succeed on expired receipt if ignoreExpiredError is true (callback version)', async function () {

    let liveScope = nock(liveHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, expiredReceiptResponse());

    let sandboxScope = nock(sandboxHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: -1 });

    await (new Promise((resolve, reject) => {
      verify.validate({ environment: ['production'], receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', ignoreExpiredError: true }, (err, data) => {
        if (err) {
          return reject(err);
        }
        else {
          return resolve(data);
        }
      });
    })).should.be.resolvedWith([]);

    assert.ok(liveScope.isDone());
    assert.ok(!sandboxScope.isDone());

  });

  it('Should succeed on expired receipt if ignoreExpiredError is true, extended is true', async function () {

    let liveScope = nock(liveHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, expiredReceiptResponse());

    let sandboxScope = nock(sandboxHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: -1 });

    await verify.validate({ environment: ['production'], receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', ignoreExpiredError: true, ignoreExpired: false, extended: true }).should.be.resolvedWith(expiredReceiptData(true));

    assert.ok(liveScope.isDone());
    assert.ok(!sandboxScope.isDone());

  });

  it('Should succeed on expired receipt if ignoreExpiredError is true, ignoreExpired is false', async function () {

    let liveScope = nock(liveHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, expiredReceiptResponse());

    let sandboxScope = nock(sandboxHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: -1 });

    await verify.validate({ environment: ['production'], receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', ignoreExpiredError: true, ignoreExpired: false }).should.be.resolvedWith(expiredReceiptData());

    assert.ok(liveScope.isDone());
    assert.ok(!sandboxScope.isDone());

  });

  it('Should succeed on expired receipt if ignoreExpiredError is true, ignoreExpired is false, excludeOldTransactions is true', async function () {

    let liveScope = nock(liveHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+', 'exclude-old-transactions': true }).reply(200, expiredReceiptResponse());

    let sandboxScope = nock(sandboxHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: -1 });

    await verify.validate({ environment: ['production'], receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', ignoreExpiredError: true, ignoreExpired: false, excludeOldTransactions: true }).should.be.resolvedWith(expiredReceiptData());

    assert.ok(liveScope.isDone());
    assert.ok(!sandboxScope.isDone());

  });

  it('Should succeed and return simple purchases (extended = false)', async function () {

    let liveScope = nock(liveHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+', 'exclude-old-transactions': true }).reply(200, expiredReceiptResponse());

    let sandboxScope = nock(sandboxHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: -1 });

    await verify.validate({ environment: ['production'], receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', ignoreExpiredError: true, ignoreExpired: false, excludeOldTransactions: true }).should.be.resolvedWith(expiredReceiptData());

    assert.ok(liveScope.isDone());
    assert.ok(!sandboxScope.isDone());

  });

  it('Should succeed and return extended purchases (extended = true)', async function () {

    let liveScope = nock(liveHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+', 'exclude-old-transactions': true }).reply(200, expiredReceiptResponse());

    let sandboxScope = nock(sandboxHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: -1 });

    await verify.validate({ environment: ['production'], receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', ignoreExpiredError: true, ignoreExpired: false, excludeOldTransactions: true, extended: true }).should.be.resolvedWith(expiredReceiptData(true));

    assert.ok(liveScope.isDone());
    assert.ok(!sandboxScope.isDone());

  });

  it('Should succeed and return empty purchases (extended = false, ignoreExpired: true)', async function () {

    let liveScope = nock(liveHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, expiredReceiptResponse());

    let sandboxScope = nock(sandboxHost).post('/verifyReceipt', { 'receipt-data': 'YWJjMTIzIT8kKiYoKSctPUB+' }).reply(200, { status: -1 });

    await verify.validate({ environment: ['production'], receipt: 'YWJjMTIzIT8kKiYoKSctPUB+', ignoreExpiredError: true, ignoreExpired: true }).should.be.resolvedWith([]);

    assert.ok(liveScope.isDone());
    assert.ok(!sandboxScope.isDone());

  });

});
