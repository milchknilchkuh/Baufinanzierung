(function (root) {
  "use strict";

  function calculateLoan(input) {
    const loanAmount = Number(input.loanAmount);
    const annualInterestRate = Number(input.annualInterestRate);
    const monthlyInterestRate = annualInterestRate / 12 / 100;
    const annualExtra = Number(input.annualExtra || 0);
    const paymentMode = input.paymentMode || "amortization";
    const basePayment = paymentMode === "payment"
      ? Number(input.monthlyPayment)
      : loanAmount * (annualInterestRate / 100 + Number(input.initialAmortizationRate) / 100) / 12;
    const monthlyPayment = basePayment;

    if (![loanAmount, annualInterestRate, monthlyPayment, annualExtra].every(Number.isFinite) || loanAmount < 0 || annualInterestRate < 0 || annualInterestRate > 100 || monthlyPayment < 0 || annualExtra < 0) {
      return { error: "Bitte prüfe die Finanzierungswerte. Negative Beträge und Zinssätze über 100 % sind nicht zulässig." };
    }
    if (loanAmount === 0) return emptyResult(monthlyPayment);

    const firstInterest = loanAmount * monthlyInterestRate;
    if (monthlyPayment <= firstInterest) {
      return { error: "Die Monatsrate deckt die laufenden Zinsen nicht. Es entsteht eine negative Tilgung; erhöhe die Rate." , negativeAmortization: true, firstInterest, monthlyPayment };
    }

    let remainingDebt = loanAmount;
    let totalInterest = 0;
    let totalPaid = 0;
    let months = 0;
    const schedule = [];
    const milestones = {};
    const interestMilestones = {};
    const maxMonths = 1200;
    while (remainingDebt > 0.005 && months < maxMonths) {
      const interest = remainingDebt * monthlyInterestRate;
      const regularPayment = Math.min(monthlyPayment, remainingDebt + interest);
      let principal = regularPayment - interest;
      if (principal < 0) principal = 0;
      remainingDebt -= principal;
      let paid = regularPayment;
      if ((months + 1) % 12 === 0 && remainingDebt > 0) {
        const extra = Math.min(annualExtra, remainingDebt);
        remainingDebt -= extra;
        paid += extra;
      }
      if (remainingDebt < 0.005) remainingDebt = 0;
      totalInterest += interest;
      totalPaid += paid;
      months += 1;
      if (months % 12 === 0 || remainingDebt === 0) schedule.push({ year: Math.ceil(months / 12), remainingDebt, principalPaid: loanAmount - remainingDebt });
      if ([60, 120, 180, 240].includes(months)) milestones[months / 12] = remainingDebt;
      if (months % 12 === 0) interestMilestones[months / 12] = totalInterest;
    }
    if (remainingDebt > 0) return { error: "Mit diesen Zahlungswerten ist die vollständige Rückzahlung innerhalb von 100 Jahren nicht erreichbar." };
    [5, 10, 15, 20].forEach((year) => { if (milestones[year] === undefined) milestones[year] = 0; });
    [5, 10, 15, 20].forEach((year) => { if (interestMilestones[year] === undefined) interestMilestones[year] = totalInterest; });
    return { loanAmount, monthlyPayment, basePayment, firstInterest, firstPrincipal: Math.max(0, Math.min(loanAmount, monthlyPayment - firstInterest)), totalInterest, totalPaid, months, years: months / 12, schedule, milestones, interestMilestones, negativeAmortization: false };
  }

  function emptyResult(monthlyPayment) {
    return { loanAmount: 0, monthlyPayment, basePayment: monthlyPayment, firstInterest: 0, firstPrincipal: 0, totalInterest: 0, totalPaid: 0, months: 0, years: 0, schedule: [], milestones: { 5: 0, 10: 0, 15: 0, 20: 0 }, interestMilestones: { 5: 0, 10: 0, 15: 0, 20: 0 }, negativeAmortization: false };
  }

  const api = { calculateLoan };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FinanceCalculations = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
