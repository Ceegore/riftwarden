# Entwicklungsplan V2 – Phase 11

- Quelle: `Riftwarden_Entwicklungsplan_Production_Ready_V2_0(1).docx`
- SHA-256: `69bcb6aab1d82a319331e3ec446ec3918502bee5f1ff19d74598ed40c107c4e6`
- Extraktionsumfang: vollständige Phase-11-Sektion für den Phase-10→11-Handoff

Phase 11: Kanonische Regeln, Units, Enums und ID-Verträge
Phase 11 materialisiert globale Konstanten, Kern-Enums, branded Units und ID-Verträge als einzige Codequelle, sodass kein späteres Modul Magic Numbers oder alternative Interpretationen einführt.
Feld | Verbindliche Festlegung
GDD-Autorität | Kapitel 6, Kapitel 7, Kapitel 8, Kapitel 9, Kapitel 10, Kapitel 42, Kapitel 48, Kapitel 51, Kapitel 73, Kapitel 75
Branch | feat/11-kanonische-regeln-units-enums-und-id-vertr
Eingangsgate | Gate G10; extrahierter Content kompiliert; NORM-Ledger aktiv.
Primäre Outputs | gameRules, technicalRules, Unit-/ID-Typen, Enums, Conversion APIs und Magic-Number-Scanner.
Nicht-Ziele | Keine Kampflogik oder Balanceanpassung.
Exit | Gate G11; Phase-Report docs/reports/phase-11.md; Main nach Merge vollständig grün.
11.1 Zwingender Preflight
• Aktuelles main aus clean checkout verwenden; SourceRevision, Lockfilehash und uncommittierte Änderungen protokollieren.
• Vorgängergate Gate G10; extrahierter Content kompiliert; NORM-Ledger aktiv. anhand realer CI-/Evidence-Artefakte prüfen. Ein Handbuch oder früherer Plan gilt nicht als Ausführungsnachweis.
• GDD Kapitel 6, Kapitel 7, Kapitel 8, Kapitel 9, Kapitel 10, Kapitel 42, Kapitel 48, Kapitel 51, Kapitel 73, Kapitel 75 vollständig lesen; zugeordnete REQ- und TEST-IDs im Traceability-Register filtern.
• Bestehende Dateien, Zeilenzahlen, offene P0-P2-Defekte, ADRs und Abhängigkeitsverletzungen erfassen.
• PR als Draft mit Scope, Stopbedingungen, Dateiplan, Testplan und Rollback öffnen, bevor Produktionslogik geschrieben wird.
11.2 Stopbedingungen vor Implementierung
• Vorgängergate fehlt, CI ist rot oder benötigte Source-/Contentdaten sind nicht lesbar.
• Die Aufgabe erfordert neue Designentscheidung, Stack-Major, Runtime-Dependency, Permission, Entitlement oder Netzwerkzugriff.
• Ein bestehender veröffentlichter Save-/Content-/Simulationvertrag müsste ohne Migration umgedeutet werden.
• Der geplante Schnitt würde eine menschlich gepflegte Datei >500 Zeilen erzeugen oder eine 301-500-Zeilen-Warnung ohne sinnvolle Splitanalyse belassen.
11.3 Arbeitspakete und Ticketdefinitionen
11.3.1 P11-T01 - GAME_RULES materialisieren
Implementierungsfolge
1. Ticks/s, Formation 3x3, MaxUnits7, MaxHeroes3, MaxCopies3, Summons6, Relics6/8, HeroLevel1-3, EquipmentSlots2, Presets4, Zeitlimits, SaveRotation3 und Locales de/en exakt definieren
2. Objekt deep readonly
3. Werte nach Domäne gruppieren, nicht duplizieren.
Erzeugtes Artefakt
src/game/rules/game-rules.ts.
Abnahme
• Snapshot entspricht Kapitel73
• Mutation/override unmöglich
• jeder Wert hat REQ-ID-Test.
11.3.2 P11-T02 - Technik-/UI-/Save-Regeln trennen
Implementierungsfolge
1. Performance-/Bundle-/File-/Text-/Screen-/Save-Grenzen in autorisierten rule modules mit Einheiten und Quellen
2. Gameplay und Plattform nicht in ein Megaobjekt mischen
3. keine GDD-Zahl in Tests kopieren, sondern Fixture oder Rule importieren, außer Vertragssnapshot.
Erzeugtes Artefakt
technical-rules.ts, ui-rules.ts, save-rules.ts.
Abnahme
• Keine Datei >300
• jede globale Zahl exakt einmal autoritativ
• crossmodule dependency bleibt gerichtet.
11.3.3 P11-T03 - Branded Units und sichere Konstruktoren
Implementierungsfolge
1. Tick, PositionX100, MilliValue, BasisPoints, Currency, CommitId, Sequence als branded numbers
2. Konstruktoren validieren integer/range
3. Serialisierungsboundary entfernt Brand nur formal
4. keine Runtimeclass nötig.
Erzeugtes Artefakt
src/game/rules/units.ts.
Abnahme
• Float/NaN/Infinity/-0/out-of-range negativ
• korrekte Arithmetic APIs
• Type-level misuse fixtures.
11.3.4 P11-T04 - Kern-Enums schließen
Implementierungsfolge
1. Side, Lane, Depth, UnitCategory, RoleTag, DamageType, TargetKind, AbilityKind, StatusKind, StackPolicy, Difficulty, RunMode, QualityTier, SaveCommitReason, RecoveryReason als const arrays + union
2. Parsefunktion unknown→typed
3. assertNever.
Erzeugtes Artefakt
src/game/rules/enums/*.ts.
Abnahme
• Unbekannter Wert Fehler
• stable order
• exhaustive switch compile fixture.
11.3.5 P11-T05 - Content-/Entity-ID-Verträge
Implementierungsfolge
1. ContentId nach Namespacepräfix, EntityId runtime separat, ScreenId geschlossen
2. Parse/format/compare ohne lokalisierte Namen
3. Replacement/deprecated policies
4. stableEntityId-Zuweisung wird später über factory.
Erzeugtes Artefakt
src/game/rules/ids.ts.
Abnahme
• Falsches Präfix/Unicode/Uppercase/Collision
• published ID cannot disappear validator.
11.3.6 P11-T06 - Magic-Number-/Duplicate-Rule-Gate
Implementierungsfolge
1. AST-/Regex-basierten Lintreport für bekannte harte Konstanten außerhalb Rule-/Testfixture-Pfade
2. UI-CSS nur Tokens
3. allowlist mit REQ-ID und Ablauf
4. Content darf datensatzspezifische Werte, aber nicht globale Limits duplizieren.
Erzeugtes Artefakt
tools/rules/audit-magic-values.mjs.
Abnahme
• Absichtliche 30 TPS/7 Units/6 Summons-Duplikate werden gemeldet
• legitimer datensatzspezifischer Wert nicht fälschlich blockiert.
11.4 Vorgesehene Dateien und Zeilenbudgets
Pfad/Modul | Verantwortung | Budget
src/game/rules/game-rules.ts | Globale Gameplaylimits | <=240
src/game/rules/technical-rules.ts | Perf/Build/Platform | <=260
src/game/rules/ui-rules.ts | Layout/Copy/Input | <=260
src/game/rules/save-rules.ts | Save/Import/Logs | <=220
src/game/rules/units.ts | Branded Units | <=300
src/game/rules/enums/ | Kernenums | <=180 je Datei
src/game/rules/ids.ts | IDparser/compare | <=280
tools/rules/audit-magic-values.mjs | Duplikataudit | <=280
Pfadnamen sind verbindliche Defaults. Ein gleichwertiger Split innerhalb derselben Modulgrenze ist erlaubt, wenn Imports, Tests, IDs und Zeilenlimits unverändert erfüllt bleiben.
11.5 Pflichtprüfungen
Contract Snapshots
• Alle Kapitel73-Werte und Enums.
Type/Runtime
• Float/Range/unknown enum/ID prefix.
Audit
• Magic-number positives/negatives.
Content Integration
• Generated Content nutzt branded conversion boundary.
Querschnittsmatrix
Dimension | Phasenpflicht
Localization | Alle neuen sichtbaren Texte besitzen DE/EN/Pseudo-Keys; keine ID oder Exceptionmessage direkt im UI.
Accessibility | Touch-/Keyboard-/Gamepad-/Screenreader-Auswirkung prüfen; keine Information nur über Farbe/Audio/Canvas.
Save/Recovery | Persistenz- und Resumeauswirkung explizit als „keine“ oder mit Commit-/Migrationstest dokumentieren.
Security/Privacy | Keine neue Dependency, Permission, Endpoint, Identifier- oder unsichere Datenverarbeitung.
Performance | Neue Hotpaths, Assets, Renderobjekte oder Long Tasks messen; Budgetauswirkung im PR.
Store | Manifest-, Entitlement-, Binary- oder Deklarationsauswirkung dokumentieren.
11.6 Git-, PR- und Rollbackplan
• feat(rules): materialize canonical limits units and enums
• feat(rules): add stable ID parsing and namespaces
• test(rules): prevent magic-number and contract drift
• Empfohlener Squash-Titel: feat(core): complete phase 11 gate.
• Rollbackziel ist der letzte grüne Main-Commit vor dem Branch. Neue Persistenz-/Versionswerte dürfen nur mit dokumentiertem Forward-/Backward-Plan gemergt werden.
• Nach Merge vollständige Main-Pipeline beobachten; bei Regression sofort Revert oder Fixbranch, keine stille Nacharbeit auf main.
11.7 Exit-Gate G11
✓ Jede globale Regel besitzt genau eine typisierte Codequelle.
✓ Kernwerte/Enums stimmen mit GDD73 und NORM-Ledger.
✓ Float-/Range-/ID-Fehler werden an der Boundary abgefangen.
✓ Audit verhindert stille Duplikation harter Regeln.
NO-GO: Ein Pflichtnachweis fehlt, ein relevanter Test ist rot, ein P0/P1 ist offen oder der Phase-Report behauptet nicht reproduzierte Ergebnisse.
11.8 Copy-and-Paste-Ausführungsauftrag für M3
Du implementierst ausschließlich Phase 11: „Kanonische Regeln, Units, Enums und ID-Verträge“ des Riftwarden Production-Ready Entwicklungsplans V2.0.
AUTORITÄT
- Lies GDD Kapitel 6, Kapitel 7, Kapitel 8, Kapitel 9, Kapitel 10, Kapitel 42, Kapitel 48, Kapitel 51, Kapitel 73, Kapitel 75 vollständig.
- Prüfe Gate G10; extrahierter Content kompiliert; NORM-Ledger aktiv. im echten Repository. Nichts als bereits ausgeführt annehmen.
- Halte Null-Unklarheits-Ledger, Dependency-Allowlist, Dateigrenze und Gitvertrag ein.
VOR CODE
1. Nenne SourceRevision, Branch, betroffene REQ-/TEST-IDs und bestehende Blocker.
2. Liste geplante Dateien mit erwarteter Zeilenzahl und Splitpunkten.
3. Lege zuerst die erforderlichen Vertragstests/Validatoren an.
4. Stoppe bei Designfrage, neuer Dependency/Permission, Versionsumdeutung oder fehlendem Vorgängergate.
UMSETZUNG
- P11-T01: GAME_RULES materialisieren
- P11-T02: Technik-/UI-/Save-Regeln trennen
- P11-T03: Branded Units und sichere Konstruktoren
- P11-T04: Kern-Enums schließen
- P11-T05: Content-/Entity-ID-Verträge
- P11-T06: Magic-Number-/Duplicate-Rule-Gate
QUALITÄT
- Keine sichtbaren Hardcodes; DE/EN/Pseudo.
- Keine menschlich gepflegte Datei >500 Zeilen; Warnungen ab 301 auflösen oder begründen.
- Tests niemals abschwächen. Jeder Bugfix erhält Regressionstest.
- Führe alle Prüfungen aus Abschnitt 11.5 sowie Format, File-Length, Lint und Typecheck aus.
ABSCHLUSSANTWORT
A. Geprüfte Eingänge und SourceRevision
B. Umgesetzte Ticket-IDs
C. Geänderte Dateien mit Zeilenzahlen
D. Neue/aktualisierte Verträge und ADRs
E. Ausgeführte Befehle mit Ergebnis und Artefaktpfad
F. Manuelle Tests mit Gerät/OS
G. Offene Defekte/Risiken
H. Gate G11: PASS oder BLOCKED, niemals unbewiesenes PASS
