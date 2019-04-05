'use strict';

const verify = require('./../index');
const should = require('should');

describe('Config', function() {

  beforeEach(function () {
    verify.resetConfig();
  });

  it('options:environment', function () {
    should(verify.config()).have.property('environment').and.be.eql(['production']);

    verify.config({ environment: ['production'] });
    should(verify.config()).have.property('environment').and.be.eql(['production']);

    verify.config({ environment: ['Production'] });
    should(verify.config()).have.property('environment').and.be.eql(['production']);

    should.throws(() => {
      verify.config({environment: ['production', 'production']});
    });

    verify.config({ environment: 'production' });
    should(verify.config()).have.property('environment').and.be.eql(['production']);

    verify.config({ environment: ['sandbox'] });
    should(verify.config()).have.property('environment').and.be.eql(['sandbox']);

    should.throws(() => {
      verify.config({environment: ['sandbox', 'sandbox']});
    });

    should.throws(() => {
      verify.config({ environment: ['sandbox1'] });
    });

    verify.config({ environment: 'sandbox' });
    should(verify.config()).have.property('environment').and.be.eql(['sandbox']);

    verify.config({ environment: ['sandbox', 'production'] });
    should(verify.config()).have.property('environment').and.be.eql(['sandbox', 'production']);

    verify.config({ environment: ['production','sandbox'] });
    should(verify.config()).have.property('environment').and.be.eql(['production','sandbox']);
  });

  it('options:extended', function () {
    should.throws(() => {
      verify.config({ extended: 'hello' });
    });
    should(verify.config()).have.property('extended').and.be.exactly(false);
    verify.config({ extended: true });
    should(verify.config()).have.property('extended').and.be.exactly(true);
    verify.config({ extended: false });
    should(verify.config()).have.property('extended').and.be.exactly(false);
  });

  it('options:ignoreExpiredError', function () {
    should.throws(() => {
      verify.config({ ignoreExpiredError: 'hello' });
    });
    should(verify.config()).have.property('ignoreExpiredError').and.be.exactly(false);
    verify.config({ ignoreExpiredError: true });
    should(verify.config()).have.property('ignoreExpiredError').and.be.exactly(true);
    verify.config({ ignoreExpiredError: false });
    should(verify.config()).have.property('ignoreExpiredError').and.be.exactly(false);
  });

  it('options:ignoreExpired', function () {
    should.throws(() => {
      verify.config({ ignoreExpired: 'hello' });
    });
    should(verify.config()).have.property('ignoreExpired').and.be.exactly(true);
    verify.config({ ignoreExpired: false });
    should(verify.config()).have.property('ignoreExpired').and.be.exactly(false);
    verify.config({ ignoreExpired: true });
    should(verify.config()).have.property('ignoreExpired').and.be.exactly(true);
  });

  it('options:verbose', function () {
    should.throws(() => {
      verify.config({ verbose: 'hello' });
    });
    should(verify.config()).have.property('verbose').and.be.exactly(false);
    verify.config({ verbose: true });
    should(verify.config()).have.property('verbose').and.be.exactly(true);
    verify.config({ verbose: false });
    should(verify.config()).have.property('verbose').and.be.exactly(false);
  });

});
