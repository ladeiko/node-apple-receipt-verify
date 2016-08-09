# node-apple-receipt-verify

© Siarhei Ladzeika < <sergey.ladeiko@gmail.com> >

A Node.js module for In-App-Purchase receipt validation for iOS.

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
    *expirationDate: <number>
},
...
]
```

### How To Use It

Example:

```javascript
var appleReceiptVerify = require('node-apple-receipt-verify');
appleReceiptVerify.config({
    secret: "1234567890abcdef1234567890abcdef",
    environment: ['sandbox']
});
appleReceiptVerify.validate({ receipt: appleReceipt, device: '438498A7-4850-41DB-BCBE-4E1756378E39' }, function (err, products) {
    if (err) {
        return console.error(err);
    }
    // ok!
});
```

### Contact

If you have any questions, bugs, etc... - contact me.
