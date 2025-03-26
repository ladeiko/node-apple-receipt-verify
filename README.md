# node-apple-receipt-verify

A Node.js module for Apple In-App-Purchase receipt validation for iOS.
### Note: Storekit Versions:
This works module with the (older) Storekit API, the newer [Storekit 2](https://developer.apple.com/storekit/) uses JWT tokens which can be verified without an API call to Apple


### Changes

See [CHANGELOG](CHANGELOG.md)

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
- `secret` \[string\] \[optional\] - Apple shared secret (See it in iTunes Connect: Go to My Apps > (select your app) > In-App Purchases > View or generate a shared secret) [required]
- `verbose` \[boolean\] \[optional\] - verbose logging switch, `false` by default. [optional]
- `environment` \[array of strings\] \[optional\] - defines environments used for receipt validation on Apple servers. Supported environments: 'sandbox', 'production'. The sequence is important. Defaults to `['production']`.
- `ignoreExpiredError` \[boolean\] \[optional\] - if true, then does not return error if receipt is expired. Default is false.
- `ignoreExpired` \[boolean\] \[optional\] - if `true`, then expired purchases are skipped. Defaults to `true`.
- `extended` \[boolean\] \[optional\] - if `true`, then purchases contains extended information. Defaults to `false`. (since v1.1.1)
- `excludeOldTransactions` \[boolean\] \[optional\] -  If value is true, response includes only the latest renewal transaction for any subscriptions ([Apple Documentation](https://developer.apple.com/library/archive/releasenotes/General/ValidateAppStoreReceipt/Chapters/ValidateRemotely.html#//apple_ref/doc/uid/TP40010573-CH104-SW3)).
- `doNotRemoveNonSubscriptions` \[boolean\] \[optional\] -  If true, then lifetime purchases also will be returned.

#### .config()

Returns current global config.

#### .validate(options [object], callback [function (err, purchasedProducts [array of objects ])])

Validates an in-app-purchase receipt.

**options**: supports keys:
- `receipt` \[required\] - base64 encoded receipt.
- `device` \[optional\] - iOS vendor identifier. NOTE: [deprecated]

You can also add options passed to ```config()```, they override default options.

**callback** \[optional\]:  receives error or list of purchased products embedded in receipt.

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
    *isInIntroOfferPeriod: <boolean>,       // only for subscriptions and if extented = true, since v1.5.1
    *environment: <string>,                 // only if extented = true
    *originalPurchaseDate: <number>,        // only if extented = true
    *applicationVersion: <string>,          // only if extented = true
    *originalApplicationVersion: <string>   // only if extented = true
},
...
]
```

### Usage

```javascript
const appleReceiptVerify = require('node-apple-receipt-verify');

// Common initialization, later you can pass options for every request in options
appleReceiptVerify.config({
    secret: "1234567890abcdef1234567890abcdef",
    environment: ['sandbox']
});

// Callback version
appleReceiptVerify.validate({
    receipt: appleReceipt,
    device: '438498A7-4850-41DB-BCBE-4E1756378E39'
 }, (err, products) => {
    if (err) {
        return console.error(err);
    }
    // ok!
});

// Callback version without device
appleReceiptVerify.validate({
    receipt: appleReceipt
  }, (err, products) => {
    if (err) {
        return console.error(err);
    }
    // ok!
});

// Promise version
try {
  
  const products = await appleReceiptVerify.validate({
    receipt: appleReceipt,
    device: '438498A7-4850-41DB-BCBE-4E1756378E39'
  });
  
  // todo
}
catch (e) {
  if (e instanceof appleReceiptVerify.EmptyError) {
    // todo
  }
  else if (e instanceof appleReceiptVerify.ServiceUnavailableError) {
    // todo 
  }
}

// Override environment
appleReceiptVerify.validate({
    receipt: appleReceipt,
    device: '438498A7-4850-41DB-BCBE-4E1756378E39',
    environment: ['sandbox' ]
  },  (err, products) => {
    if (err) {
        return console.error(err);
    }
    // ok!
});

```

### Errors

Errors can have additional optional properties:

* isRetryable (bool) - true if Apple service recommends to retry request a bit more later.
* appleStatus (number) - status returned by Apple validation service.

#### Special errors

##### EmptyError - returned in case of receipt without purchase

```
const appleReceiptVerify = require('node-apple-receipt-verify');
const EmptyError = appleReceiptVerify.EmptyError;
```

##### ServiceUnavailableError - returned when Apple validation service returned, e.g: 503, etc.

You can retry request later.

### Author
* Siarhei Ladzeika < <sergey.ladeiko@gmail.com> >

## LICENSE
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
