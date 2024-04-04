# CHANGELOG

## 1.13.0
### Fixed
* https://github.com/ladeiko/node-apple-receipt-verify/issues/43

## 1.12.1
### Fixed
* https://github.com/ladeiko/node-apple-receipt-verify/issues/35

## 1.12.0
### Added
* Add web_order_line_item_id support

## 1.11.0
### Added
* Add HTTP_PROXY support

## 1.10.0
### Added
* Add  originalApplicationVersion/applicationVersion/original_application_version/application_version to EmptyError

## 1.9.4
### Fixed
* Remove logging of password

## 1.9.3
### Fixed
* Internal logic

## 1.9.2
### Added
* promotionalOfferId

## 1.9.1
### Fixed
* Fix preorder_date (if found) 
* Fix: 'Error: Callback was already called.'

## 1.9.0
### Added
* Add preorder_date (if found) 

### Fixed
* Now dates without values will removed from purchase.

## 1.8.0

### Fixed
* Windows support (https://github.com/ladeiko/node-apple-receipt-verify/issues/13)

### Changed
* Removed code to verify vendor identifier
* Update node_modules dependencies

## 1.7.4

### Changed
* Replace console.error for 503 with logError

## 1.7.2

### Changed
* Update isRetryable detection

## 1.7.1

### Fixed
* Fixed crash when setting isRetryable field to error

## 1.7.0

### Added
* isRetryable field to error

## 1.6.1
### Changed

* Change text of unknown error

## 1.6.0
### Added

* Added ServiceUnavailableError

## 1.5.6
### Changed

* Add logging when failed to parse apple response

## 1.5.5
### Changed

* Fix error code name typo

## 1.5.4
### Added

* Add 21010 error code description.
* Exported ERROR_CODES

## 1.5.3
###  Changed
* HTTP requests made now using 'https' module, because 'request' is deprecated and have some ugly issues.

## 1.5.2
### Added
* Error now has 'appleStatus'

## 1.5.1
### Added
* isInIntroOfferPeriod to extended info

## 1.4.1
### Fixed
* [Error: Failed to validate purchase if ['sandbox', 'production']](https://github.com/ladeiko/node-apple-receipt-verify/issues/8)

## 1.4.0
### Added
* Support for ```excludeOldTransactions``` option
* tests

### Fixed
* ignoreExpired behavior for single purchase in response

## 1.3.8
* Update Makefile from pull request. Also fix compilation under mac os with some versions of openssl installed with brew.

## 1.3.7
### Fixed
* EmptyError inheritance

## 1.3.6
### Added
* More accurate apple environment detection

## 1.3.5
### Added
* Support of 'ignoreExpiredError' for sandbox receipts
* Workaround for issue: https://github.com/ladeiko/node-apple-receipt-verify/issues/1

## 1.3.4
### Fixed
* Return Promise from validate

## 1.3.3
### Added
* `ignoreExpiredError` options to ignore error 21006 (subscription expired)
### Changed
* Update 'extended' information (cancellationDate and cancellationReason fields)
### Fixed
* Bugfixes

## 1.2.1
### Added
* `pendingRenewalInfo`

## 1.1.8
### Fixed
* Bugfix

## 1.1.7
### Fixed
* Bugfix

## 1.1.6
### Fixed
* Bugfix

## 1.1.1
### Added
* Special EmptyError class
* Filter to remove duplicates from response (based on transaction id)
* Now validate also returns Promise, callback is optional
* 'extended' option key, if passed, then extra info will be added to every purchase description:
  * isTrialPeriod (presents only for subscriptions)
  * environment (is the same for all purchases in response)
  * originalPurchaseDate
  * applicationVersion (is the same for all purchases in response)
  * originalApplicationVersion (is the same for all purchases in response)

## 1.0.19
### Fixed
* Compilation on Mac OS when there is no openssl in standard paths and openssl was installed with brew.

## 1.0.13
### Fixed
* Validation error if UUID specified and running inside console.

## 1.0.12
### Added
* 'originalTransactionId' to purchase description.
