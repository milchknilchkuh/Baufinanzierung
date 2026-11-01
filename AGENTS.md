# AGENTS.md

## Projektziel

Entwickle eine einfache, lokal laufende Baufinanzierungs-Web-App. Sie dient dazu, verschiedene Finanzierungsszenarien schnell zu berechnen und miteinander zu vergleichen.

Die App ist ein persönliches Planungswerkzeug und keine Bank-, Steuer- oder Finanzberatung.

## Sprache

- **Benutzeroberfläche und alle sichtbaren Inhalte:** Deutsch.
- **Code:** Englisch. Das gilt für Variablen, Funktionen, Klassen, Dateinamen, Kommentare und technische Dokumentation.
- Verwende deutsche Fachbegriffe in der Oberfläche, zum Beispiel „Darlehensbetrag“, „Sollzinssatz“, „Anfangstilgung“ und „Restschuld“.

## Technische Leitlinien

- Die Anwendung läuft vollständig lokal und offline.
- Keine Cloud-Dienste, Benutzerkonten, externen APIs oder Netzwerkzugriffe.
- Keine extern geladenen Bibliotheken, Fonts, Bilder oder sonstigen Ressourcen.
- Bevorzuge eine einfache Lösung mit HTML, CSS und JavaScript ohne Framework und ohne Build-Prozess.
- Verwende nur dann zusätzliche Abhängigkeiten, wenn sie einen klaren Mehrwert bieten. Standardmäßig sind keine Abhängigkeiten erforderlich.
- Die App muss lokal durch Öffnen der `index.html` funktionieren. Falls für eine Funktion ein lokaler Server nötig wird, dokumentiere den Grund und den einfachen Startbefehl.
- Speichere Szenarien bei Bedarf im Browser mit `localStorage`. Die App darf dafür keine Verbindung zum Internet benötigen.
- Halte die Projektstruktur klein und nachvollziehbar.

## Funktionaler Umfang

Implementiere einen Baufinanzierungsrechner mit folgenden Eingaben:

### Kauf- und Baukosten

- Kaufpreis der Immobilie
- Grundstückskosten, falls separat zu erfassen
- Bau- oder Sanierungskosten
- Kaufnebenkosten (wahlweise als Betrag oder Prozentwert)
- Weitere Kosten
- Alternativ können aber auch Gesamtkosten angegeben werden, die alle Kosten beinhalten
- Eigenkapital

### Finanzierung

- Darlehensbetrag, standardmäßig aus Gesamtkosten abzüglich Eigenkapital berechnet
- Sollzinssatz pro Jahr in Prozent
- Anfangstilgung pro Jahr in Prozent
- Monatliche Rate als alternative Eingabe
- Optionaler zusätzlicher monatlicher Tilgungsbetrag
- Optionaler jährlicher Sondertilgungsbetrag

Der Nutzer soll zwischen der Berechnung über Anfangstilgung und der Eingabe einer festen Monatsrate wechseln können. Die jeweils andere Größe wird daraus berechnet, soweit mathematisch sinnvoll.

### Ergebnisse

Zeige mindestens:

- Gesamtkosten
- Eingesetztes Eigenkapital
- Benötigtes Darlehen
- Monatliche Rate
- Zinsanteil und Tilgungsanteil der ersten Rate
- Restschuld nach 5, 10, 15 und 20 Jahren
- Voraussichtliche vollständige Rückzahlungsdauer
- Insgesamt gezahlte Zinsen
- Gesamte Rückzahlung

Stelle den Tilgungsverlauf zusätzlich in einer einfachen Grafik oder Tabelle dar. Wenn eine externe Chart-Bibliothek benötigt wird, dann speichere sie lokal im Projektverzeichnis ab.

### Szenarien vergleichen

- Mehrere Finanzierungsszenarien anlegen und benennen können.
- Szenarien nebeneinander vergleichen.
- Mindestens Zinssatz, Monatsrate, Darlehensbetrag, Restschuld und Gesamtzinsen gegenüberstellen.
- Szenarien lokal speichern und wieder laden können.
- Ein Szenario duplizieren können, damit einzelne Parameter leicht variiert werden können.

## Berechnungsregeln

- Rechne intern mit JavaScript-Zahlen und ausreichender Genauigkeit. Runde erst bei der Anzeige auf zwei Nachkommastellen.
- Verwende für Geldbeträge Euro und für Zinssätze Prozent pro Jahr.
- Verwende für monatliche Annuitäten zunächst die vereinfachte monatliche Berechnung mit `monthlyInterestRate = annualInterestRate / 12 / 100`.
- Bei Annuitätendarlehen gilt für die anfängliche Monatsrate:
  `monthlyPayment = loanAmount * (annualInterestRate / 100 + initialAmortizationRate / 100) / 12`
- Für jeden Monat:
  - `interest = remainingDebt * monthlyInterestRate`
  - `principal = monthlyPayment - interest`
  - `remainingDebt = remainingDebt - principal`
- Begrenze die letzte Rate so, dass die Restschuld nicht negativ wird.
- Sondertilgungen reduzieren die Restschuld zusätzlich im jeweiligen Zahlungszeitraum.
- Bei einem Zinssatz von 0 % muss die Berechnung weiterhin funktionieren.
- Wenn die Monatsrate nicht ausreicht, um die laufenden Zinsen zu decken, zeige einen klaren Hinweis auf negative Tilgung beziehungsweise eine nicht tragfähige Rate.
- Verhindere ungültige Eingaben wie negative Darlehensbeträge, negative Kosten oder Zinssätze außerhalb sinnvoller Grenzen.
- Zeige bei jeder Berechnung die zugrunde liegenden Annahmen transparent an.
- Kennzeichne Ergebnisse als Modellrechnung. Gebühren, Zinsbindungsende, Anschlussfinanzierung, variable Zinsen und bankindividuelle Bedingungen sind nur zu berücksichtigen, wenn sie ausdrücklich implementiert werden.

## Benutzeroberfläche

- Schlichtes, übersichtliches und funktionales Design.
- Fokus auf schnelle Eingabe und gut lesbare Ergebnisse.
- Responsive Darstellung für Desktop und Tablet; mobile Nutzung soll ebenfalls möglich sein.
- Gruppiere Eingaben sinnvoll in „Immobilie und Kosten“, „Eigenkapital“, „Finanzierung“ und „Ergebnisse“.
- Aktualisiere Ergebnisse direkt nach Eingabeänderungen.
- Verwende deutsche Zahlen- und Währungsformate, zum Beispiel `1.234,56 €` und `3,50 %`.
- Beschrifte alle Eingabefelder eindeutig und zeige Einheiten direkt am Feld.
- Zeige Validierungsfehler verständlich in deutscher Sprache.
- Vermeide unnötige Animationen, dekorative Elemente und überladene Dashboards.

## Codequalität

- Schreibe klaren, gut lesbaren und modularen Code.
- Trenne Berechnungslogik, Zustandsverwaltung und Darstellung soweit sinnvoll.
- Verwende aussagekräftige englische Namen für Variablen und Funktionen.
- Vermeide unnötige Abstraktionen und vorzeitige Optimierung.
- Keine unnötigen Kommentare. Kommentare müssen auf Englisch sein.
- Behandle fehlende, ungültige und sehr große Eingabewerte robust.
- Verändere bestehende Funktionen nicht unnötig, wenn eine gezielte Anpassung genügt.

## Tests und Qualitätssicherung

- Teste die Berechnungslogik mit einfachen, nachvollziehbaren Beispielen.
- Prüfe insbesondere:
  - Zinssatz von 0 %
  - reguläre Annuitätentilgung
  - vollständige Rückzahlung und letzte Rate
  - Sondertilgungen
  - zu niedrige Monatsrate
  - leere und ungültige Eingaben
  - Speichern und Laden von Szenarien
- Prüfe nach Änderungen, dass die App weiterhin offline und ohne externe Ressourcen funktioniert.
- Führe vorhandene Tests aus. Wenn keine Tests eingerichtet sind, ergänze einfache Tests für die Finanzberechnung, ohne dafür ein großes Test-Framework einzuführen.

## Arbeitsweise für Codex

1. Prüfe zuerst die vorhandene Projektstruktur und den aktuellen Stand.
2. Halte die Umsetzung bewusst einfach. Füge keine Funktionen hinzu, die nicht zum beschriebenen Zweck gehören.
3. Implementiere Änderungen in kleinen, nachvollziehbaren Schritten.
4. Erkläre kurz, welche Dateien geändert wurden und wie die App lokal gestartet wird.
5. Triff bei kleinen Detailfragen pragmatische Entscheidungen und dokumentiere relevante Annahmen.
6. Frage nur dann nach, wenn eine fehlende Information die Architektur oder das fachliche Ergebnis wesentlich beeinflusst.
7. Behaupte nicht, etwas getestet zu haben, wenn die Tests nicht tatsächlich ausgeführt wurden.

## Nicht-Ziele

- Kein Hosting und keine Bereitstellung im Internet.
- Keine Cloud-Synchronisierung oder Zusammenarbeit mehrerer Nutzer.
- Keine Bankanbindung oder Kontodaten.
- Keine automatische Abfrage aktueller Bauzinsen.
- Keine Registrierung, Anmeldung oder Benutzerverwaltung.
- Keine unnötige Backend- oder Datenbank-Infrastruktur.
