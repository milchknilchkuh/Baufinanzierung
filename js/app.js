(function () {
  "use strict";

  const form = document.getElementById("calculator-form");
  const storageKey = "baufinanzierung-scenarios-v1";
  const currentStateCookie = "baufinanzierung-current-v1";
  const currentStateFallback = "baufinanzierung-current-fallback-v1";
  const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  const percent = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const field = (name) => form.elements.namedItem(name);
  let scenarios = loadScenarios();
  let currentResult = null;
  let resultView = "chart";

  function money(value) { return euro.format(Number.isFinite(value) ? value : 0); }
  function percentText(value) { return `${percent.format(value)} %`; }
  function readNumber(name) { return Number(field(name).value); }
  function setValue(name, value) { field(name).value = String(Math.max(0, value)); }
  function selected(name) { return form.querySelector(`input[name="${name}"]:checked`).value; }
  function getTotalCost() {
    if (selected("costMode") === "total") return readNumber("totalCostInput");
    const purchase = readNumber("purchasePrice");
    const land = readNumber("landCost");
    const construction = readNumber("constructionCost");
    const ancillary = readNumber("ancillaryValue") * (field("ancillaryMode").value === "percent" ? purchase / 100 : 1);
    return purchase + land + construction + ancillary + readNumber("otherCost");
  }
  function inputsAreValid() {
    const numeric = Array.from(form.querySelectorAll('input[type="number"]'));
    for (const input of numeric) {
      if (input.closest("[hidden]") || input.name === "monthlyPaymentInput" && selected("paymentMode") !== "payment" || input.name === "initialAmortizationRate" && selected("paymentMode") !== "amortization") continue;
      if (input.dataset.optional === "true" && input.value.trim() === "") continue;
      const value = input.value.trim() === "" ? NaN : Number(input.value);
      if (!Number.isFinite(value) || value < 0 || input.max && value > Number(input.max)) {
        showError(`„${input.closest("label").querySelector("span").textContent}“ muss eine gültige, nicht negative Zahl sein.`);
        input.focus();
        return false;
      }
    }
    const usedMonths = new Set();
    for (const index of [1, 2]) {
      if (!field(`adjustment${index}Enabled`).checked) continue;
      const period = Number(field(`adjustment${index}After`).value);
      const unit = field(`adjustment${index}Unit`).value;
      const afterMonths = period * (unit === "years" ? 12 : 1);
      const rateValue = field(`adjustment${index}AnnualRate`).value.trim();
      const paymentValue = field(`adjustment${index}Payment`).value.trim();
      const extraValue = field(`adjustment${index}AnnualExtra`).value.trim();
      if (!Number.isInteger(period) || period < 1 || !["months", "years"].includes(unit) || !Number.isInteger(afterMonths) || afterMonths > 1199) {
        showError(`Bitte gib für Anpassung ${index} eine gültige Dauer von mindestens einem Monat und höchstens 99 Jahren an.`);
        field(`adjustment${index}After`).focus();
        return false;
      }
      if (usedMonths.has(afterMonths)) {
        showError("Die beiden Anpassungen müssen zu unterschiedlichen Zeitpunkten erfolgen.");
        field(`adjustment${index}After`).focus();
        return false;
      }
      usedMonths.add(afterMonths);
      if (!extraValue) {
        showError(`Die jährliche Sondertilgung für Anpassung ${index} ist ein Pflichtfeld. Gib 0 ein, wenn sie entfallen soll.`);
        field(`adjustment${index}AnnualExtra`).focus();
        return false;
      }
    }
    return true;
  }
  function showError(message) {
    const target = document.getElementById("validation-message");
    target.textContent = message;
    target.hidden = !message;
  }
  function updateLoanFromCosts() {
    const total = getTotalCost();
    const equity = readNumber("equity") || 0;
    setValue("loanAmount", Math.max(0, total - equity));
  }
  function collectInputs() {
    return {
      costMode: selected("costMode"), purchasePrice: readNumber("purchasePrice"), landCost: readNumber("landCost"),
      constructionCost: readNumber("constructionCost"), ancillaryMode: field("ancillaryMode").value, ancillaryValue: readNumber("ancillaryValue"),
      otherCost: readNumber("otherCost"), totalCostInput: readNumber("totalCostInput"), equity: readNumber("equity"), loanAmount: readNumber("loanAmount"),
      annualInterestRate: readNumber("annualInterestRate"), initialAmortizationRate: readNumber("initialAmortizationRate"),
      monthlyPayment: readNumber("monthlyPaymentInput"), paymentMode: selected("paymentMode"), annualExtra: readNumber("annualExtra"), rateChanges: collectRateChanges()
    };
  }
  function collectRateChanges() {
    return [1, 2].filter((index) => field(`adjustment${index}Enabled`).checked).map((index) => ({
      afterMonths: Number(field(`adjustment${index}After`).value) * (field(`adjustment${index}Unit`).value === "years" ? 12 : 1),
      annualInterestRate: field(`adjustment${index}AnnualRate`).value.trim() === "" ? null : Number(field(`adjustment${index}AnnualRate`).value),
      monthlyPayment: field(`adjustment${index}Payment`).value.trim() === "" ? null : Number(field(`adjustment${index}Payment`).value),
      annualExtra: field(`adjustment${index}AnnualExtra`).value.trim() === "" ? null : Number(field(`adjustment${index}AnnualExtra`).value)
    }));
  }
  function render() {
    const mode = selected("costMode");
    document.getElementById("item-cost-fields").hidden = mode !== "items";
    document.getElementById("total-cost-field").hidden = mode !== "total";
    document.getElementById("ancillary-unit").textContent = field("ancillaryMode").value === "percent" ? "%" : "€";
    const paymentMode = selected("paymentMode");
    document.getElementById("amortization-field").hidden = paymentMode !== "amortization";
    document.getElementById("payment-field").hidden = paymentMode !== "payment";
    [1, 2].forEach((index) => {
      document.getElementById(`adjustment${index}-fields`).hidden = !field(`adjustment${index}Enabled`).checked;
      const unitField = field(`adjustment${index}Unit`);
      if (!unitField.dataset.previousUnit) unitField.dataset.previousUnit = unitField.value;
      field(`adjustment${index}After`).max = unitField.value === "years" ? "99" : "1199";
    });
    if (!inputsAreValid()) return;
    showError("");
    const totalCost = getTotalCost();
    document.getElementById("total-cost-display").textContent = money(totalCost);
    document.getElementById("loan-amount-display").textContent = money(readNumber("loanAmount"));
    const values = collectInputs();
    const result = FinanceCalculations.calculateLoan(values);
    currentResult = result;
    if (result.error) {
      const validation = document.getElementById("validation-message");
      validation.textContent = result.error;
      validation.hidden = false;
      document.getElementById("summary-cards").innerHTML = "";
      document.getElementById("milestone-rows").innerHTML = "";
      document.getElementById("schedule-rows").innerHTML = "";
      document.getElementById("balance-chart").innerHTML = "";
      document.getElementById("repayment-chart").innerHTML = "";
      document.getElementById("negative-amortization").hidden = !result.negativeAmortization;
      document.getElementById("negative-amortization").textContent = result.negativeAmortization ? result.error : "";
      return;
    }
    document.getElementById("negative-amortization").hidden = true;
    const actualPayment = result.monthlyPayment;
    if (paymentMode === "payment") {
      const impliedRate = values.loanAmount > 0 ? Math.max(0, (result.basePayment * 12 / values.loanAmount * 100) - values.annualInterestRate) : 0;
      field("initialAmortizationRate").value = impliedRate.toFixed(2);
    } else if (values.loanAmount > 0) {
      field("monthlyPaymentInput").value = result.basePayment.toFixed(2);
    }
    const cards = [
      ["Gesamtkosten", money(totalCost)], ["Eingesetztes Eigenkapital", money(values.equity)], ["Benötigtes Darlehen", money(values.loanAmount)],
      ["Monatliche Rate", money(actualPayment), true], ["Zinsanteil der ersten Rate", money(result.firstInterest)], ["Tilgungsanteil der ersten Rate", money(result.firstPrincipal)],
      ["Vollständige Rückzahlung nach", result.months ? `${Math.floor(result.months / 12)} J. ${result.months % 12} Mon.` : "Sofort"],
      ["Insgesamt gezahlte Zinsen", money(result.totalInterest)], ["Gesamte Rückzahlung", money(result.totalPaid)]
    ];
    document.getElementById("summary-cards").innerHTML = cards.map(([label, value, primary]) => `<div class="metric${primary ? " primary" : ""}"><span>${label}</span><strong>${value}</strong></div>`).join("");
    document.getElementById("milestone-rows").innerHTML = [5, 10, 15, 20].map((year) => `<tr><td>Nach ${year} Jahren</td><td>${money(result.milestones[year])}</td></tr>`).join("");
    document.getElementById("schedule-rows").innerHTML = result.schedule.map((row) => `<tr><td>${row.year}</td><td>${money(row.remainingDebt)}</td><td>${money(row.principalPaid)}</td></tr>`).join("") || '<tr><td colspan="3">Kein Darlehen</td></tr>';
    renderCharts(result, values.loanAmount);
  }
  function renderCharts(result, loanAmount) {
    if (!loanAmount || !result.schedule.length) {
      document.getElementById("balance-chart").innerHTML = '<p class="chart-empty">Kein Darlehensverlauf vorhanden.</p>';
      document.getElementById("repayment-chart").innerHTML = '<p class="chart-empty">Kein Tilgungsverlauf vorhanden.</p>';
      return;
    }
    const history = [{ month: 0, remainingDebt: loanAmount, principalPaid: 0 }, ...result.schedule];
    renderLineChart("balance-chart", history, loanAmount, "remainingDebt", "Restschuld", "#16796f");
    renderLineChart("repayment-chart", history, loanAmount, "principalPaid", "Getilgter Betrag", "#3979a8");
  }
  function renderLineChart(containerId, history, maxValue, valueKey, seriesName, color) {
    const width = 640;
    const height = 250;
    const left = 68;
    const right = 14;
    const top = 14;
    const bottom = 42;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maxMonth = Math.max(1, history[history.length - 1].month);
    const x = (month) => left + month / maxMonth * plotWidth;
    const y = (value) => top + (1 - value / maxValue) * plotHeight;
    const points = history.map((item) => `${x(item.month).toFixed(1)},${y(item[valueKey]).toFixed(1)}`).join(" ");
    const ticks = [maxValue, maxValue / 2, 0];
    const yearLabels = [0, maxMonth / 2, maxMonth];
    const yGrid = ticks.map((value) => `<g><line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" class="chart-gridline"/><text x="${left - 8}" y="${y(value) + 4}" text-anchor="end" class="chart-axis-label">${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value)} €</text></g>`).join("");
    const xGrid = yearLabels.map((month, index) => {
      const label = index === 0 ? "0" : index === yearLabels.length - 1 ? formatDuration(maxMonth) : `${Math.round(month / 12)} J.`;
      return `<g><line x1="${x(month)}" y1="${top}" x2="${x(month)}" y2="${height - bottom}" class="chart-gridline chart-gridline-vertical"/><text x="${x(month)}" y="${height - 12}" text-anchor="${index === 0 ? "start" : index === yearLabels.length - 1 ? "end" : "middle"}" class="chart-axis-label">${label}</text></g>`;
    }).join("");
    const dots = history.map((item) => `<circle class="chart-point" cx="${x(item.month)}" cy="${y(item[valueKey])}" r="5" fill="${color}" tabindex="0" aria-label="${seriesName}, ${formatDuration(item.month)}: ${money(item[valueKey])}" data-month="${item.month}" data-value="${item[valueKey]}"/>`).join("");
    const container = document.getElementById(containerId);
    container.innerHTML = `<svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${seriesName} im Zeitverlauf">${yGrid}${xGrid}<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg><div class="chart-tooltip" role="tooltip" hidden></div><div class="chart-legend"><span style="--legend-color:${color}"></span>${seriesName}</div>`;
    const tooltip = container.querySelector(".chart-tooltip");
    const showTooltip = (point) => {
      tooltip.textContent = `${seriesName} · ${formatDuration(Number(point.dataset.month))} · ${money(Number(point.dataset.value))}`;
      tooltip.hidden = false;
      const pointRect = point.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const xPosition = Math.min(Math.max(tooltip.offsetWidth / 2 + 6, pointRect.left + pointRect.width / 2 - containerRect.left), containerRect.width - tooltip.offsetWidth / 2 - 6);
      tooltip.style.left = `${xPosition}px`;
      tooltip.style.top = `${Math.max(4, pointRect.top - containerRect.top - 8)}px`;
    };
    container.querySelectorAll(".chart-point").forEach((point) => {
      point.addEventListener("pointerenter", () => showTooltip(point));
      point.addEventListener("pointerleave", () => { tooltip.hidden = true; });
      point.addEventListener("focus", () => showTooltip(point));
      point.addEventListener("blur", () => { tooltip.hidden = true; });
    });
  }
  function collectFormState() {
    const fields = {};
    Array.from(form.elements).forEach((element) => {
      if (!element.name) return;
      if (element.type === "radio") {
        if (element.checked) fields[element.name] = element.value;
      } else if (element.type === "checkbox") fields[element.name] = element.checked;
      else fields[element.name] = element.value;
    });
    return { fields, scenarioName: document.getElementById("scenario-name").value };
  }
  function saveCurrentState() {
    const state = JSON.stringify(collectFormState());
    const encoded = encodeURIComponent(state);
    try { document.cookie = `${currentStateCookie}=${encoded}; max-age=31536000; path=/; SameSite=Lax`; }
    catch {}
    try { localStorage.setItem(currentStateFallback, state); }
    catch { document.getElementById("scenario-status").textContent = "Der aktuelle Stand kann in diesem Browser nicht automatisch gespeichert werden."; }
  }
  function restoreCurrentState() {
    let savedState = null;
    try {
      const savedCookie = document.cookie.split("; ").find((part) => part.startsWith(`${currentStateCookie}=`));
      if (savedCookie) savedState = decodeURIComponent(savedCookie.slice(currentStateCookie.length + 1));
    } catch {}
    if (!savedState) {
      try { savedState = localStorage.getItem(currentStateFallback); }
      catch {}
    }
    if (!savedState) return;
    try {
      const state = JSON.parse(savedState);
      if (!state.fields || typeof state.fields !== "object") return;
      const radioOptions = { costMode: ["items", "total"], paymentMode: ["amortization", "payment"] };
      Array.from(form.elements).forEach((element) => {
        if (!element.name) return;
        const savedValue = state.fields[element.name];
        if (element.type === "checkbox") {
          if (typeof savedValue === "boolean") element.checked = savedValue;
          return;
        }
        if (typeof savedValue !== "string") return;
        if (element.type === "radio") {
          if (radioOptions[element.name]?.includes(savedValue)) element.checked = element.value === savedValue;
        } else element.value = savedValue;
      });
      [1, 2].forEach((index) => {
        const legacyMonths = state.fields[`adjustment${index}AfterMonths`];
        if (state.fields[`adjustment${index}After`] === undefined && typeof legacyMonths === "string") {
          field(`adjustment${index}After`).value = legacyMonths;
          field(`adjustment${index}Unit`).value = "months";
        }
        if (field(`adjustment${index}Enabled`).checked && field(`adjustment${index}AnnualExtra`).value.trim() === "") {
          field(`adjustment${index}AnnualExtra`).value = "0";
        }
      });
      if (typeof state.scenarioName === "string") document.getElementById("scenario-name").value = state.scenarioName.slice(0, 60);
    } catch {}
  }
  function loadScenarios() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(stored) ? stored.map((item) => ({ ...item, inputs: normalizeSavedInputs(item.inputs) })) : [];
    }
    catch { return []; }
  }
  function normalizeSavedInputs(inputs) {
    if (!inputs || typeof inputs !== "object") return inputs;
    const normalized = { ...inputs };
    delete normalized.monthlyExtra;
    if (Array.isArray(normalized.rateChanges)) {
      normalized.rateChanges = normalized.rateChanges.map((change) => ({ ...change, annualExtra: change.annualExtra ?? 0 }));
    }
    return normalized;
  }
  function persistScenarios() {
    try { localStorage.setItem(storageKey, JSON.stringify(scenarios)); return true; }
    catch { document.getElementById("scenario-status").textContent = "Speichern ist in diesem Browser nicht verfügbar."; return false; }
  }
  function scenarioResult(inputs) { return FinanceCalculations.calculateLoan(inputs); }
  function renderScenarios() {
    const comparedScenarios = scenarios.map((item) => ({ ...item, result: scenarioResult(item.inputs) }));
    document.getElementById("comparison-head").innerHTML = `<tr><th>Vergleich</th>${comparedScenarios.map((item) => `<th>${escapeHtml(item.name)}</th>`).join("")}</tr>`;
    const inputRows = [
      ["Darlehensbetrag", (item) => money(item.inputs.loanAmount)],
      ["Sollzinssatz", (item) => percentText(item.inputs.annualInterestRate)],
      ["Anfangstilgung", (item) => item.inputs.paymentMode === "amortization" ? `${percentText(item.inputs.initialAmortizationRate)} <span class="mode-tag">Vorgabe</span>` : `${percentText(item.inputs.initialAmortizationRate)} <span class="mode-tag mode-tag-derived">Berechnet</span>`],
      ["Monatliche Rate", (item) => item.inputs.paymentMode === "payment" ? `${money(item.inputs.monthlyPayment)} <span class="mode-tag">Vorgabe</span>` : `${money(item.inputs.loanAmount * (item.inputs.annualInterestRate + item.inputs.initialAmortizationRate) / 1200)} <span class="mode-tag mode-tag-derived">Berechnet</span>`],
      ["Jährliche Sondertilgung", (item) => money(item.inputs.annualExtra)],
      ["Finanzierungsanpassungen", (item) => formatRateChanges(item.inputs.rateChanges), "adjustments-cell"]
    ];
    const outputRows = [
      ["Restschuld nach 10 Jahren", (item) => item.result.error ? "–" : money(item.result.milestones[10])],
      ["Gezahlte Zinsen nach 10 Jahren", (item) => item.result.error ? "–" : money(item.result.interestMilestones[10])],
      ["Gesamte Laufzeit", (item) => item.result.error ? "Nicht berechenbar" : formatDuration(item.result.months)],
      ["Gesamtzinsen", (item) => item.result.error ? "–" : `${money(item.result.totalInterest)} <span class="duration-note">nach ${formatDuration(item.result.months)}</span>`],
      ["Gesamte Rückzahlung", (item) => item.result.error ? "–" : `${money(item.result.totalPaid)} <span class="duration-note">nach ${formatDuration(item.result.months)}</span>`]
    ];
    const renderRows = (rows) => rows.map(([label, value, cellClass = ""]) => `<tr><td>${label}</td>${comparedScenarios.map((item) => `<td class="${cellClass}">${value(item)}</td>`).join("")}</tr>`).join("");
    document.getElementById("comparison-body").innerHTML = `<tr class="comparison-section-row"><th colspan="${comparedScenarios.length + 1}">Eingaben</th></tr>${renderRows(inputRows)}<tr class="comparison-section-row"><th colspan="${comparedScenarios.length + 1}">Ergebnisse</th></tr>${renderRows(outputRows)}`;
    document.getElementById("scenario-list").innerHTML = scenarios.map((item, index) => `<div class="scenario-item"><strong>${escapeHtml(item.name)}</strong><div class="scenario-buttons"><button type="button" class="button button-small" data-action="load" data-index="${index}">Laden</button><button type="button" class="button button-small" data-action="duplicate" data-index="${index}">Duplizieren</button><button type="button" class="button button-small" data-action="delete" data-index="${index}">Löschen</button></div></div>`).join("");
  }
  function formatDuration(months) {
    if (!months) return "Sofort";
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return [years ? `${years} Jahr${years === 1 ? "" : "e"}` : "", remainingMonths ? `${remainingMonths} Monat${remainingMonths === 1 ? "" : "e"}` : ""].filter(Boolean).join(" ");
  }
  function formatRateChanges(changes) {
    if (!Array.isArray(changes) || changes.length === 0) return "Keine";
    const summaries = changes.map((change) => {
      const values = [];
      if (change.annualInterestRate !== null) values.push(`<span class="adjustment-chip">Sollzins ${percentText(change.annualInterestRate)}</span>`);
      if (change.monthlyPayment !== null) values.push(`<span class="adjustment-chip">Rate ${money(change.monthlyPayment)}</span>`);
      if (change.annualExtra != null) values.push(`<span class="adjustment-chip">Sondertilgung ${money(change.annualExtra)}/Jahr</span>`);
      const period = change.afterMonths % 12 === 0 ? `${change.afterMonths / 12} Jahr${change.afterMonths / 12 === 1 ? "" : "e"}` : `${change.afterMonths} Monate`;
      return `<div class="adjustment-summary"><strong>Nach ${period}</strong><div class="adjustment-values">${values.join("")}</div></div>`;
    });
    return `<div class="scenario-adjustments">${summaries.join("")}</div>`;
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
  function applyInputs(inputs) {
    ["purchasePrice", "landCost", "constructionCost", "ancillaryValue", "otherCost", "totalCostInput", "equity", "loanAmount", "annualInterestRate", "initialAmortizationRate", "monthlyPaymentInput", "annualExtra"].forEach((name) => setValue(name, inputs[name]));
    field("ancillaryMode").value = inputs.ancillaryMode;
    form.querySelector(`input[name="costMode"][value="${inputs.costMode}"]`).checked = true;
    form.querySelector(`input[name="paymentMode"][value="${inputs.paymentMode}"]`).checked = true;
    [1, 2].forEach((index) => {
      const change = Array.isArray(inputs.rateChanges) ? inputs.rateChanges[index - 1] : null;
      field(`adjustment${index}Enabled`).checked = Boolean(change);
      const useYears = change ? change.afterMonths % 12 === 0 && change.afterMonths / 12 <= 99 : true;
      field(`adjustment${index}Unit`).value = useYears ? "years" : "months";
      field(`adjustment${index}Unit`).dataset.previousUnit = field(`adjustment${index}Unit`).value;
      field(`adjustment${index}After`).value = change ? String(useYears ? change.afterMonths / 12 : change.afterMonths) : String(index * 10);
      field(`adjustment${index}AnnualRate`).value = change && change.annualInterestRate !== null ? String(change.annualInterestRate) : "";
      field(`adjustment${index}Payment`).value = change && change.monthlyPayment !== null ? String(change.monthlyPayment) : "";
      field(`adjustment${index}AnnualExtra`).value = change ? String(change.annualExtra ?? 0) : "";
    });
    render();
    saveCurrentState();
  }

  form.addEventListener("input", (event) => {
    if (["purchasePrice", "landCost", "constructionCost", "ancillaryValue", "otherCost", "totalCostInput", "equity"].includes(event.target.name)) updateLoanFromCosts();
    render();
    saveCurrentState();
  });
  form.addEventListener("change", (event) => {
    const unitMatch = /^adjustment([12])Unit$/.exec(event.target.name);
    if (unitMatch) {
      const index = Number(unitMatch[1]);
      const periodField = field(`adjustment${index}After`);
      const previousUnit = event.target.dataset.previousUnit || event.target.value;
      const period = Number(periodField.value);
      if (Number.isFinite(period) && previousUnit !== event.target.value) {
        const converted = previousUnit === "years" ? period * 12 : Math.max(1, Math.min(99, Math.round(period / 12)));
        periodField.value = String(converted);
      }
      event.target.dataset.previousUnit = event.target.value;
    }
    if (["costMode", "ancillaryMode", "equity"].includes(event.target.name)) updateLoanFromCosts();
    render();
    saveCurrentState();
  });
  document.querySelector(".view-switch").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-result-view]");
    if (!button) return;
    resultView = button.dataset.resultView;
    document.getElementById("chart-view").hidden = resultView !== "chart";
    document.getElementById("table-view").hidden = resultView !== "table";
    document.querySelectorAll(".view-switch button").forEach((viewButton) => {
      const isActive = viewButton.dataset.resultView === resultView;
      viewButton.classList.toggle("active", isActive);
      viewButton.setAttribute("aria-pressed", String(isActive));
    });
  });
  document.getElementById("scenario-name").addEventListener("input", saveCurrentState);
  document.getElementById("save-scenario").addEventListener("click", () => {
    if (!currentResult || currentResult.error || !inputsAreValid()) return;
    const name = document.getElementById("scenario-name").value.trim() || `Szenario ${scenarios.length + 1}`;
    scenarios.push({ name, inputs: collectInputs(), result: currentResult });
    if (persistScenarios()) document.getElementById("scenario-status").textContent = `„${name}“ wurde lokal gespeichert.`;
    renderScenarios();
  });
  document.getElementById("scenario-list").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const index = Number(button.dataset.index);
    const action = button.dataset.action;
    if (action === "load") { applyInputs(scenarios[index].inputs); document.getElementById("scenario-name").value = scenarios[index].name; saveCurrentState(); }
    if (action === "duplicate") { const copy = JSON.parse(JSON.stringify(scenarios[index])); copy.name = `${copy.name} (Kopie)`; scenarios.splice(index + 1, 0, copy); persistScenarios(); renderScenarios(); }
    if (action === "delete") { scenarios.splice(index, 1); persistScenarios(); renderScenarios(); }
  });

  document.getElementById("save-project").addEventListener("click", async () => {
    if (!inputsAreValid()) return;
    const project = {
      format: "baufinanzierung-project",
      version: 1,
      savedAt: new Date().toISOString(),
      name: document.getElementById("scenario-name").value.trim() || "Baufinanzierung",
      inputs: collectInputs(),
      scenarios: scenarios.map(({ name, inputs }) => ({ name, inputs }))
    };
    const projectText = JSON.stringify(project, null, 2);
    const filename = `${project.name.replace(/[^a-z0-9-_äöüß ]/gi, "").trim().replace(/\s+/g, "-") || "baufinanzierung"}.json`;
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "JSON-Projektdatei", accept: { "application/json": [".json"] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(new Blob([projectText], { type: "application/json" }));
        await writable.close();
      } else {
        const requestedName = window.prompt("Dateiname für das Projekt:", filename);
        if (!requestedName) return;
        const blob = new Blob([projectText], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = requestedName.toLowerCase().endsWith(".json") ? requestedName : `${requestedName}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      document.getElementById("scenario-status").textContent = "Projekt wurde als JSON-Datei gespeichert.";
    } catch (error) {
      if (error.name !== "AbortError") document.getElementById("scenario-status").textContent = `Projekt konnte nicht gespeichert werden: ${error.message}`;
    }
  });

  const projectFile = document.getElementById("project-file");
  document.getElementById("load-project").addEventListener("click", () => projectFile.click());
  projectFile.addEventListener("change", async () => {
    const file = projectFile.files[0];
    if (!file) return;
    try {
      const project = JSON.parse(await file.text());
      if (project.format !== "baufinanzierung-project" || project.version !== 1 || !isValidProjectInputs(project.inputs) || !Array.isArray(project.scenarios)) {
        throw new Error("Die Datei hat nicht das erwartete Projektformat.");
      }
      const importedScenarios = project.scenarios.map((item) => {
        if (!item || typeof item.name !== "string" || !isValidProjectInputs(item.inputs)) throw new Error("Mindestens ein gespeichertes Szenario ist ungültig.");
        const inputs = normalizeSavedInputs(item.inputs);
        return { name: item.name.slice(0, 60), inputs, result: FinanceCalculations.calculateLoan(inputs) };
      });
      applyInputs(normalizeSavedInputs(project.inputs));
      scenarios = importedScenarios;
      persistScenarios();
      renderScenarios();
      document.getElementById("scenario-name").value = typeof project.name === "string" ? project.name.slice(0, 60) : "Baufinanzierung";
      saveCurrentState();
      document.getElementById("scenario-status").textContent = `Projekt „${document.getElementById("scenario-name").value}“ wurde geladen.`;
    } catch (error) {
      document.getElementById("scenario-status").textContent = `Projekt konnte nicht geladen werden: ${error.message}`;
    } finally {
      projectFile.value = "";
    }
  });

  function isValidProjectInputs(inputs) {
    if (!inputs || !["items", "total"].includes(inputs.costMode) || !["amortization", "payment"].includes(inputs.paymentMode) || !["percent", "amount"].includes(inputs.ancillaryMode)) return false;
    const numberNames = ["purchasePrice", "landCost", "constructionCost", "ancillaryValue", "otherCost", "totalCostInput", "equity", "loanAmount", "annualInterestRate", "initialAmortizationRate", "monthlyPayment", "annualExtra"];
    if (!numberNames.every((name) => Number.isFinite(inputs[name]) && inputs[name] >= 0) || inputs.annualInterestRate > 100 || inputs.initialAmortizationRate > 100) return false;
    const changes = inputs.rateChanges || [];
    if (!Array.isArray(changes) || changes.length > 2) return false;
    const usedMonths = new Set();
    return changes.every((change) => {
      if (!change || !Number.isInteger(change.afterMonths) || change.afterMonths < 1 || change.afterMonths > 1199 || usedMonths.has(change.afterMonths)) return false;
      usedMonths.add(change.afterMonths);
      const validRate = change.annualInterestRate === null || Number.isFinite(change.annualInterestRate) && change.annualInterestRate >= 0 && change.annualInterestRate <= 100;
      const validPayment = change.monthlyPayment === null || Number.isFinite(change.monthlyPayment) && change.monthlyPayment >= 0;
      const validExtra = change.annualExtra == null || Number.isFinite(change.annualExtra) && change.annualExtra >= 0;
      return validRate && validPayment && validExtra && (change.annualInterestRate !== null || change.monthlyPayment !== null || change.annualExtra != null);
    });
  }

  restoreCurrentState();
  render();
  renderScenarios();
})();
