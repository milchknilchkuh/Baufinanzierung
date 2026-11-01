(function () {
  "use strict";

  const form = document.getElementById("calculator-form");
  const storageKey = "baufinanzierung-scenarios-v1";
  const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  const percent = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const field = (name) => form.elements.namedItem(name);
  let scenarios = loadScenarios();
  let currentResult = null;

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
      const value = input.value.trim() === "" ? NaN : Number(input.value);
      if (!Number.isFinite(value) || value < 0 || input.max && value > Number(input.max)) {
        showError(`„${input.closest("label").querySelector("span").textContent}“ muss eine gültige, nicht negative Zahl sein.`);
        input.focus();
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
      monthlyPayment: readNumber("monthlyPaymentInput"), paymentMode: selected("paymentMode"), monthlyExtra: readNumber("monthlyExtra"), annualExtra: readNumber("annualExtra")
    };
  }
  function render() {
    const mode = selected("costMode");
    document.getElementById("item-cost-fields").hidden = mode !== "items";
    document.getElementById("total-cost-field").hidden = mode !== "total";
    document.getElementById("ancillary-unit").textContent = field("ancillaryMode").value === "percent" ? "%" : "€";
    const paymentMode = selected("paymentMode");
    document.getElementById("amortization-field").hidden = paymentMode !== "amortization";
    document.getElementById("payment-field").hidden = paymentMode !== "payment";
    if (!inputsAreValid()) return;
    showError("");
    const totalCost = getTotalCost();
    document.getElementById("total-cost-display").textContent = money(totalCost);
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
  }
  function loadScenarios() {
    try { const stored = JSON.parse(localStorage.getItem(storageKey) || "[]"); return Array.isArray(stored) ? stored : []; }
    catch { return []; }
  }
  function persistScenarios() {
    try { localStorage.setItem(storageKey, JSON.stringify(scenarios)); return true; }
    catch { document.getElementById("scenario-status").textContent = "Speichern ist in diesem Browser nicht verfügbar."; return false; }
  }
  function scenarioResult(inputs) { return FinanceCalculations.calculateLoan(inputs); }
  function renderScenarios() {
    const comparedScenarios = scenarios.map((item) => ({ ...item, result: scenarioResult(item.inputs) }));
    document.getElementById("comparison-head").innerHTML = `<tr><th>Vergleich</th>${comparedScenarios.map((item) => `<th>${escapeHtml(item.name)}</th>`).join("")}</tr>`;
    const rows = [
      ["Sollzinssatz", (item) => percentText(item.inputs.annualInterestRate)],
      ["Anfangstilgung", (item) => percentText(item.inputs.initialAmortizationRate)],
      ["Monatliche Rate", (item) => item.result.error ? "Nicht tragfähig" : money(item.result.monthlyPayment)],
      ["Zusätzliche monatliche Tilgung", (item) => money(item.inputs.monthlyExtra)],
      ["Jährliche Sondertilgung", (item) => money(item.inputs.annualExtra)],
      ["Darlehensbetrag", (item) => money(item.inputs.loanAmount)],
      ["Restschuld nach 10 Jahren", (item) => item.result.error ? "–" : money(item.result.milestones[10])],
      ["Gezahlte Zinsen nach 10 Jahren", (item) => item.result.error ? "–" : money(item.result.interestMilestones[10])],
      ["Gesamte Laufzeit", (item) => item.result.error ? "Nicht berechenbar" : formatDuration(item.result.months)],
      ["Gesamtzinsen nach N Jahren (N = Laufzeit)", (item) => item.result.error ? "–" : money(item.result.totalInterest)],
      ["Gesamte Rückzahlung nach N Jahren (N = Laufzeit)", (item) => item.result.error ? "–" : money(item.result.totalPaid)]
    ];
    document.getElementById("comparison-body").innerHTML = rows.map(([label, value]) => `<tr><td>${label}</td>${comparedScenarios.map((item) => `<td>${value(item)}</td>`).join("")}</tr>`).join("");
    document.getElementById("scenario-list").innerHTML = scenarios.map((item, index) => `<div class="scenario-item"><strong>${escapeHtml(item.name)}</strong><div class="scenario-buttons"><button type="button" class="button button-small" data-action="load" data-index="${index}">Laden</button><button type="button" class="button button-small" data-action="duplicate" data-index="${index}">Duplizieren</button><button type="button" class="button button-small" data-action="delete" data-index="${index}">Löschen</button></div></div>`).join("");
  }
  function formatDuration(months) {
    if (!months) return "Sofort";
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    return [years ? `${years} Jahr${years === 1 ? "" : "e"}` : "", remainingMonths ? `${remainingMonths} Monat${remainingMonths === 1 ? "" : "e"}` : ""].filter(Boolean).join(" ");
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
  function applyInputs(inputs) {
    ["purchasePrice", "landCost", "constructionCost", "ancillaryValue", "otherCost", "totalCostInput", "equity", "loanAmount", "annualInterestRate", "initialAmortizationRate", "monthlyPaymentInput", "monthlyExtra", "annualExtra"].forEach((name) => setValue(name, inputs[name]));
    field("ancillaryMode").value = inputs.ancillaryMode;
    form.querySelector(`input[name="costMode"][value="${inputs.costMode}"]`).checked = true;
    form.querySelector(`input[name="paymentMode"][value="${inputs.paymentMode}"]`).checked = true;
    render();
  }

  form.addEventListener("input", (event) => {
    if (["purchasePrice", "landCost", "constructionCost", "ancillaryValue", "otherCost", "totalCostInput", "equity"].includes(event.target.name)) updateLoanFromCosts();
    render();
  });
  form.addEventListener("change", (event) => {
    if (["costMode", "ancillaryMode", "equity"].includes(event.target.name)) updateLoanFromCosts();
    render();
  });
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
    if (action === "load") { applyInputs(scenarios[index].inputs); document.getElementById("scenario-name").value = scenarios[index].name; }
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
        const inputs = item.inputs;
        return { name: item.name.slice(0, 60), inputs, result: FinanceCalculations.calculateLoan(inputs) };
      });
      applyInputs(project.inputs);
      scenarios = importedScenarios;
      persistScenarios();
      renderScenarios();
      document.getElementById("scenario-name").value = typeof project.name === "string" ? project.name.slice(0, 60) : "Baufinanzierung";
      document.getElementById("scenario-status").textContent = `Projekt „${document.getElementById("scenario-name").value}“ wurde geladen.`;
    } catch (error) {
      document.getElementById("scenario-status").textContent = `Projekt konnte nicht geladen werden: ${error.message}`;
    } finally {
      projectFile.value = "";
    }
  });

  function isValidProjectInputs(inputs) {
    if (!inputs || !["items", "total"].includes(inputs.costMode) || !["amortization", "payment"].includes(inputs.paymentMode) || !["percent", "amount"].includes(inputs.ancillaryMode)) return false;
    const numberNames = ["purchasePrice", "landCost", "constructionCost", "ancillaryValue", "otherCost", "totalCostInput", "equity", "loanAmount", "annualInterestRate", "initialAmortizationRate", "monthlyPayment", "monthlyExtra", "annualExtra"];
    return numberNames.every((name) => Number.isFinite(inputs[name]) && inputs[name] >= 0) && inputs.annualInterestRate <= 100 && inputs.initialAmortizationRate <= 100;
  }

  render();
  renderScenarios();
})();
