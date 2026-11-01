"use strict";

const assert = require("node:assert/strict");
const { calculateLoan } = require("../js/calculations.js");

const zeroRate = calculateLoan({ loanAmount: 12000, annualInterestRate: 0, initialAmortizationRate: 100, monthlyExtra: 0, annualExtra: 0 });
assert.equal(zeroRate.months, 12);
assert.equal(zeroRate.totalInterest, 0);
assert.equal(zeroRate.totalPaid, 12000);

const annuity = calculateLoan({ loanAmount: 100000, annualInterestRate: 3, initialAmortizationRate: 2, monthlyExtra: 0, annualExtra: 0 });
assert.equal(annuity.monthlyPayment, 100000 * 0.05 / 12);
assert.ok(annuity.totalInterest > 0);
assert.equal(annuity.milestones[5] < 100000, true);

const finalPayment = calculateLoan({ loanAmount: 1000, annualInterestRate: 0, paymentMode: "payment", monthlyPayment: 600, monthlyExtra: 0, annualExtra: 0 });
assert.equal(finalPayment.months, 2);
assert.equal(finalPayment.totalPaid, 1000);

const extraPayment = calculateLoan({ loanAmount: 12000, annualInterestRate: 0, paymentMode: "payment", monthlyPayment: 500, monthlyExtra: 0, annualExtra: 6000 });
assert.equal(extraPayment.months, 12);
assert.equal(extraPayment.totalPaid, 12000);

const tooLow = calculateLoan({ loanAmount: 100000, annualInterestRate: 5, paymentMode: "payment", monthlyPayment: 300, monthlyExtra: 0, annualExtra: 0 });
assert.equal(tooLow.negativeAmortization, true);
assert.ok(tooLow.error);

const invalid = calculateLoan({ loanAmount: -1, annualInterestRate: 3, initialAmortizationRate: 2 });
assert.ok(invalid.error);

console.log("Berechnungsprüfungen erfolgreich.");
