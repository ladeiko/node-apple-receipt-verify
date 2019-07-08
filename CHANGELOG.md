# CHANGELOG

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