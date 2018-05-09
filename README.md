# node-apple-receipt-verify

© Siarhei Ladzeika < <sergey.ladeiko@gmail.com> >

A Node.js module for In-App-Purchase receipt validation for iOS.

### Changes

#### v.1.3.8
* Update Makefile from pull request. Also fix compilation under mac os with some versions of openssl installed with brew.

#### v.1.3.7
* Fix EmptyError inheritance

#### v.1.3.6
* Add more accurate apple environment detection

#### v.1.3.5
* Add support of 'ignoreExpiredError' for sandbox receipts
* Add workaround for issue: https://github.com/ladeiko/node-apple-receipt-verify/issues/1

#### v.1.3.4
* Fix return Promise from validate

#### v.1.3.3
* Add `ignoreExpiredError` options to ignore error 21006 (subscription expired)
* Update 'extened' information (cancellationDate and cancellationReason fields)
* Bugfixes

#### v.1.2.1
* Add `pendingRenewalInfo`

#### v.1.1.8
* Bugfix

#### v.1.1.7
* Bugfix

#### v.1.1.6
* Bugfix

#### v.1.1.1
* Add special EmptyError class
* Add filter to remove duplicates from response (based on transaction id)
* Now validate also returns Promise, callback is optional
* Add 'extended' option key, if passed, then extra info will be added to every purchase description:
  * isTrialPeriod (presents only for subscriptions)
  * environment (is the same for all purchases in response)
  * originalPurchaseDate
  * applicationVersion (is the same for all purchases in response)
  * originalApplicationVersion (is the same for all purchases in response)

#### v.1.0.19
* Fix compilation on Mac OS when there is no openssl in standard paths and openssl was installed with brew.

#### v.1.0.13
* Fix validation error if UUID specified and running inside console.

#### v.1.0.12
* Added 'originalTransactionId' to purchase description. 

### Debug Logging

The module can optionally turn on verbose debug log.

In order to enable the verbose logging, give the following to `.config()`:

```javascript
var appleReceiptVerify = require('node-apple-receipt-verify');
appleReceiptVerify.config({
  verbose: true
});
```

### Methods

#### .config(options [object])

Initializes module. Can be called more than once to reconfigure module.

**options**: supports following keys:
- `secret` [string] - Apple shared secret (See it in iTunes Connect: Go to My Apps > (select your app) > In-App Purchases > View or generate a shared secret) [optional]
- `verbose` [boolean] - verbose logging switch, `false` by default. [optional]
- `environment` [array of strings] - defines environments used for receipt validation on Apple servers. Supported environments: 'sandbox', 'production'. The sequence is important. Defaults to `['production']`. [optional]
- `ignoreExpired` - if `true`, then expired purchases are skipped. Defaults to `true`. [optional]
- `extended` - if `true`, then purchases contains extended information. Defaults to `false`. (since v1.1.1) [optional]


NOTE: Shared password is required for iTunes subscription purchases.

#### .validate(options [object], callback [function (err, purchasedProducts [array of objects ])])

Validates an in-app-purchase receipt.

**options**: supports keys:
- `receipt` [string] - base64 encoded receipt. [required]
- `device` - iOS vendor identifier. Example `438498A7-4850-41DB-BCBE-4E1756378E39`. If specified, then module will check if receipt belongs to vendor identifier. [optional]
- `ignoreExpired` - if `true`, then expired purchases are skipped. Overrides global `ignoreExpired` specified in `.config()`. [optional]

**callback**:  receives error or list of purchased products embedded in receipt

The purchased products list has structure:

```
[
{
    bundleId: <string>,
    transactionId: <string>,
    productId: <string>,
    purchaseDate: <number>,
    quantity: <number>,
    *expirationDate: <number>,
    *isTrialPeriod: <boolean>,              // only for subscriptions and if extented = true
    *environment: <string>,                 // only if extented = true
    *originalPurchaseDate: <number>,        // only if extented = true
    *applicationVersion: <string>,          // only if extented = true
    *originalApplicationVersion: <string>   // only if extented = true

},
...
]
```

### How To Use It

Example:

```javascript
var appleReceiptVerify = require('node-apple-receipt-verify');

// Common initialization, later you can pass options for every request in options
appleReceiptVerify.config({
    secret: "1234567890abcdef1234567890abcdef",
    environment: ['sandbox']
});

// Callback version
appleReceiptVerify.validate({ receipt: appleReceipt, device: '438498A7-4850-41DB-BCBE-4E1756378E39' }, function (err, products) {
    if (err) {
        return console.error(err);
    }
    // ok!
});

// Callback version without device
appleReceiptVerify.validate({ receipt: appleReceipt }, function (err, products) {
    if (err) {
        return console.error(err);
    }
    // ok!
});

// Promise version
appleReceiptVerify.validate({ receipt: appleReceipt, device: '438498A7-4850-41DB-BCBE-4E1756378E39' })
    .then(function (products) {
        //  do something
    })
    .catch(function (err) {
        if (err instanceof appleReceiptVerify.EmptyError) {
            ...
        }
        else {
            ...
        }
    });
```

### Contact

If you have any questions, bugs, etc... - contact me.
