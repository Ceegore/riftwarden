# Entwicklungsplan V2 – Phase 10

- Quelle: `Riftwarden_Entwicklungsplan_Production_Ready_V2_0(1).docx`
- SHA-256: `69bcb6aab1d82a319331e3ec446ec3918502bee5f1ff19d74598ed40c107c4e6`
- Extraktionsumfang: vollständige Phase-10-Sektion für den Phase-09→10-Handoff

Phase 10: Vollständige GDD-Contentextraktion und Strukturaudit
Phase 10 überträgt den gesamten Releaseinhalt aus GDD V5 in reviewbare Source-JSON und Localization-Keys. Ziel ist strukturelle Vollständigkeit, nicht vorgezogenes Tuning oder Assetpolish.
Feld | Verbindliche Festlegung
GDD-Autorität | Kapitel 2, Kapitel 4, Kapitel 6, Kapitel 7, Kapitel 8, Kapitel 9, Kapitel 10, Kapitel 11, Kapitel 12, Kapitel 13, Kapitel 14, Kapitel 15, Kapitel 16, Kapitel 17, Kapitel 18, Kapitel 19, Kapitel 20, Kapitel 21, Kapitel 22, Kapitel 23, Kapitel 24, Kapitel 25, Kapitel 27, Kapitel 28, Kapitel 29, Kapitel 30, Kapitel 31, Kapitel 32, Kapitel 33, Kapitel 34, Kapitel 41, Kapitel 43, Kapitel 47, Kapitel 48, Kapitel 59, Kapitel 70, Kapitel 75, Kapitel 86
Branch | feat/10-vollst-ndige-gdd-contentextraktion-und-str
Eingangsgate | Gate G09; Contentcompiler und Schemas grün; GDD-Hauptquelle unverändert verfügbar.
Primäre Outputs | Maschinenlesbarer Vollbestand aller Contentfamilien, Content-Ledger, Extract-/Reviewprotokolle, Releasecount- und Crossreference-Gates.
Nicht-Ziele | Keine Balanceänderung, keine erfundenen Defaultwerte, keine finalen Assets/Voice-Aufnahmen.
Exit | Gate G10; Phase-Report docs/reports/phase-10.md; Main nach Merge vollständig grün.
10.1 Zwingender Preflight
• Aktuelles main aus clean checkout verwenden; SourceRevision, Lockfilehash und uncommittierte Änderungen protokollieren.
• Vorgängergate Gate G09; Contentcompiler und Schemas grün; GDD-Hauptquelle unverändert verfügbar. anhand realer CI-/Evidence-Artefakte prüfen. Ein Handbuch oder früherer Plan gilt nicht als Ausführungsnachweis.
• GDD Kapitel 2, Kapitel 4, Kapitel 6, Kapitel 7, Kapitel 8, Kapitel 9, Kapitel 10, Kapitel 11, Kapitel 12, Kapitel 13, Kapitel 14, Kapitel 15, Kapitel 16, Kapitel 17, Kapitel 18, Kapitel 19, Kapitel 20, Kapitel 21, Kapitel 22, Kapitel 23, Kapitel 24, Kapitel 25, Kapitel 27, Kapitel 28, Kapitel 29, Kapitel 30, Kapitel 31, Kapitel 32, Kapitel 33, Kapitel 34, Kapitel 41, Kapitel 43, Kapitel 47, Kapitel 48, Kapitel 59, Kapitel 70, Kapitel 75, Kapitel 86 vollständig lesen; zugeordnete REQ- und TEST-IDs im Traceability-Register filtern.
• Bestehende Dateien, Zeilenzahlen, offene P0-P2-Defekte, ADRs und Abhängigkeitsverletzungen erfassen.
• PR als Draft mit Scope, Stopbedingungen, Dateiplan, Testplan und Rollback öffnen, bevor Produktionslogik geschrieben wird.
10.2 Stopbedingungen vor Implementierung
• Vorgängergate fehlt, CI ist rot oder benötigte Source-/Contentdaten sind nicht lesbar.
• Die Aufgabe erfordert neue Designentscheidung, Stack-Major, Runtime-Dependency, Permission, Entitlement oder Netzwerkzugriff.
• Ein bestehender veröffentlichter Save-/Content-/Simulationvertrag müsste ohne Migration umgedeutet werden.
• Der geplante Schnitt würde eine menschlich gepflegte Datei >500 Zeilen erzeugen oder eine 301-500-Zeilen-Warnung ohne sinnvolle Splitanalyse belassen.
10.3 Arbeitspakete und Ticketdefinitionen
10.3.1 P10-T01 - Content-Ledger und Extraktionsplan
Implementierungsfolge
1. Alle erwarteten Contentfamilien und exakten Releasecounts erfassen: 10 Helden, 18 Truppen, 14 Summons, 28 Grundgegner, 4 Zwischenbosse, 4 Hauptbosse, 18 Modifier, 30 Events, 42 permanente Gegenstände, 36 Relikte, 20 Missionen, 28 Konstellationsknoten, 36 Erfolge
2. jede Entität mit GDD-Seite/Abschnitt, Reviewer und Status.
Erzeugtes Artefakt
content-ledger.json und Extraktionsreihenfolge.
Abnahme
• Counts exakt
• jede Entität besitzt Sourcefundstelle
• kein „misc/unknown“-Bucket.
10.3.2 P10-T02 - Units, Abilities, Status und Synergien extrahieren
Implementierungsfolge
1. Helden, Truppen, Summons, Gegner, Elites/Champions/Bosse mit Stats, Rollen, Traits, Angriffe, Passives, Trigger, Targetprofile, Timings, Caps, Telegraphie, Counterplay und Acceptance
2. Status-/Synergiedefinitionen separat referenzieren
3. Sekundenwerte nicht manuell in Ticks rechnen.
Erzeugtes Artefakt
Source-JSON für Combat Content.
Abnahme
• Jede reguläre Unit hat exakt einen Basic Attack, Targetprofile, Visual/Audio/Codex-Ref
• keine fehlende Timing-/InvalidTargetPolicy.
10.3.3 P10-T03 - World, Encounters und Missionscontent
Implementierungsfolge
1. Regionen, Modifiers, Riftinstabilität, Dungeonprofile, Encounterpools, Wellen, Objectives, Events, Händler/Recruitment/Anchor-Regeln und 20 Missionen übertragen
2. Pflichtknoten und PreviewDisclosure explizit
3. keine prozedurale Regel im Fließtext verstecken.
Erzeugtes Artefakt
World-/Mission-/Event-Source.
Abnahme
• Boss erreichbar
• 5-8 besuchte Knoten
• Events 2-3 Optionen
• jede Randomspanne besitzt Rollslot.
10.3.4 P10-T04 - Progression und Endgamecontent
Implementierungsfolge
1. Items, Talismane, Kits, Banner, Relikte, Economy/Rewards, Ruhm/Level, Unlocks, Ascensionränge, 28 Konstellationsknoten, Beyond, Endless, Mastery, Achievements und Kodexmetadaten übertragen
2. Besitz-/Kompatibilitätsregeln explizit.
Erzeugtes Artefakt
Progression-/Endgame-Source.
Abnahme
• Keine leeren Lootpools
• keine negative/decimal currency
• Graph vollständig/erreichbar
• Counts exakt.
10.3.5 P10-T05 - Localization- und Assetreferenzen erzeugen
Implementierungsfolge
1. Für jedes Contentfeld semantische DE-/EN-Keys anlegen
2. GDD-Originaltext in DE übernehmen, EN als draft markieren
3. Visual-/Audio-/Codex-/Telegraphie-IDs als manifestpflichtige Referenzen anlegen, aber fehlende Produktionsdateien als tracked planned asset statt Fakefile.
Erzeugtes Artefakt
Messages und Asset/Audio requirement manifest.
Abnahme
• Keine Anzeigenamen im Source
• jede Referenz hat Ownerphase
• Releasevalidator unterscheidet planned vs required-present.
10.3.6 P10-T06 - Vier-Augen-Strukturaudit und Freeze
Implementierungsfolge
1. Automatischer Count/Crossref/Semantic Report
2. zweiter Review vergleicht jede Sourceentität mit konkreter GDD-Fundstelle
3. Abweichungen als DEFECT, niemals still korrigieren
4. ContentSourceBaseline-Hash/tag erzeugen.
Erzeugtes Artefakt
Content Extraction Report und baseline hash.
Abnahme
• 100% Ledger reviewed
• null offene missing fields/refs
• keine nicht genehmigte Zahlenabweichung
• Compiler grün.
10.4 Vorgesehene Dateien und Zeilenbudgets
Pfad/Modul | Verantwortung | Budget
content/source/units/heroes/ | 10 Heldendateien | <=300 je Datei
content/source/units/troops/ | 18 Truppendateien | <=300 je Datei
content/source/units/enemies/<region>/ | Regionale Gegner/Bosse | <=300 je Datei
content/source/world/ | Missionen/Events/Encounters | <=300 je Datei
content/source/progression/ | Items/Relikte/Rewards | <=300 je Datei
content/source/endgame/ | Ascension/Endless/Mastery | <=300 je Datei
docs/reports/content-ledger.json | Completeness/Source refs | <=300 je Split
tools/content/release-counts.mjs | Exakte Zielzählungen | <=220
Pfadnamen sind verbindliche Defaults. Ein gleichwertiger Split innerhalb derselben Modulgrenze ist erlaubt, wenn Imports, Tests, IDs und Zeilenlimits unverändert erfüllt bleiben.
10.5 Pflichtprüfungen
Completeness
• Exakte Releasecounts; alle Ledgerzeilen reviewed.
• Alle GDD-Abschnitte mit Contentdefinition sind zugeordnet.
Semantic
• Basic attack/target/timing/telegraph/counterplay/preview.
• Mission/Event/Graph/Pool-Constraints.
Diff Review
• Sourcezahlen gegen GDD; kein Tuning.
Localization/Assets
• Jede Anzeige/Telegraphie/Voice/Visualreferenz vorhanden.
Querschnittsmatrix
Dimension | Phasenpflicht
Localization | Alle neuen sichtbaren Texte besitzen DE/EN/Pseudo-Keys; keine ID oder Exceptionmessage direkt im UI.
Accessibility | Touch-/Keyboard-/Gamepad-/Screenreader-Auswirkung prüfen; keine Information nur über Farbe/Audio/Canvas.
Save/Recovery | Persistenz- und Resumeauswirkung explizit als „keine“ oder mit Commit-/Migrationstest dokumentieren.
Security/Privacy | Keine neue Dependency, Permission, Endpoint, Identifier- oder unsichere Datenverarbeitung.
Performance | Neue Hotpaths, Assets, Renderobjekte oder Long Tasks messen; Budgetauswirkung im PR.
Store | Manifest-, Entitlement-, Binary- oder Deklarationsauswirkung dokumentieren.
10.6 Git-, PR- und Rollbackplan
• feat(content): extract complete combat roster from GDD V5
• feat(content): extract world progression and endgame data
• test(content): enforce release counts and GDD source traceability
• Empfohlener Squash-Titel: feat(core): complete phase 10 gate.
• Rollbackziel ist der letzte grüne Main-Commit vor dem Branch. Neue Persistenz-/Versionswerte dürfen nur mit dokumentiertem Forward-/Backward-Plan gemergt werden.
• Nach Merge vollständige Main-Pipeline beobachten; bei Regression sofort Revert oder Fixbranch, keine stille Nacharbeit auf main.
10.7 Exit-Gate G10
✓ Alle Releasecontentfamilien liegen maschinenlesbar und kompiliert vor.
✓ Exakte Counts und Crossreferences sind grün.
✓ Jede Entität ist auf eine GDD-Fundstelle zurückführbar und zweitgeprüft.
✓ Keine Zahlen-/Mechanikänderung wurde als Extraktion versteckt.
NO-GO: Ein Pflichtnachweis fehlt, ein relevanter Test ist rot, ein P0/P1 ist offen oder der Phase-Report behauptet nicht reproduzierte Ergebnisse.
10.8 Copy-and-Paste-Ausführungsauftrag für M3
Du implementierst ausschließlich Phase 10: „Vollständige GDD-Contentextraktion und Strukturaudit“ des Riftwarden Production-Ready Entwicklungsplans V2.0.
AUTORITÄT
- Lies GDD Kapitel 2, Kapitel 4, Kapitel 6, Kapitel 7, Kapitel 8, Kapitel 9, Kapitel 10, Kapitel 11, Kapitel 12, Kapitel 13, Kapitel 14, Kapitel 15, Kapitel 16, Kapitel 17, Kapitel 18, Kapitel 19, Kapitel 20, Kapitel 21, Kapitel 22, Kapitel 23, Kapitel 24, Kapitel 25, Kapitel 27, Kapitel 28, Kapitel 29, Kapitel 30, Kapitel 31, Kapitel 32, Kapitel 33, Kapitel 34, Kapitel 41, Kapitel 43, Kapitel 47, Kapitel 48, Kapitel 59, Kapitel 70, Kapitel 75, Kapitel 86 vollständig.
- Prüfe Gate G09; Contentcompiler und Schemas grün; GDD-Hauptquelle unverändert verfügbar. im echten Repository. Nichts als bereits ausgeführt annehmen.
- Halte Null-Unklarheits-Ledger, Dependency-Allowlist, Dateigrenze und Gitvertrag ein.
VOR CODE
1. Nenne SourceRevision, Branch, betroffene REQ-/TEST-IDs und bestehende Blocker.
2. Liste geplante Dateien mit erwarteter Zeilenzahl und Splitpunkten.
3. Lege zuerst die erforderlichen Vertragstests/Validatoren an.
4. Stoppe bei Designfrage, neuer Dependency/Permission, Versionsumdeutung oder fehlendem Vorgängergate.
UMSETZUNG
- P10-T01: Content-Ledger und Extraktionsplan
- P10-T02: Units, Abilities, Status und Synergien extrahieren
- P10-T03: World, Encounters und Missionscontent
- P10-T04: Progression und Endgamecontent
- P10-T05: Localization- und Assetreferenzen erzeugen
- P10-T06: Vier-Augen-Strukturaudit und Freeze
QUALITÄT
- Keine sichtbaren Hardcodes; DE/EN/Pseudo.
- Keine menschlich gepflegte Datei >500 Zeilen; Warnungen ab 301 auflösen oder begründen.
- Tests niemals abschwächen. Jeder Bugfix erhält Regressionstest.
- Führe alle Prüfungen aus Abschnitt 10.5 sowie Format, File-Length, Lint und Typecheck aus.
ABSCHLUSSANTWORT
A. Geprüfte Eingänge und SourceRevision
B. Umgesetzte Ticket-IDs
C. Geänderte Dateien mit Zeilenzahlen
D. Neue/aktualisierte Verträge und ADRs
E. Ausgeführte Befehle mit Ergebnis und Artefaktpfad
F. Manuelle Tests mit Gerät/OS
G. Offene Defekte/Risiken
H. Gate G10: PASS oder BLOCKED, niemals unbewiesenes PASS
