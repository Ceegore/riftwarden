# GDD V5 – Globale Autoritäts-, Konstanten-, Bootstrap- und Handoffregeln

- Quelle: `Riftwarden_Auto_RPG_Roguelite_GDD_V5(2).docx`
- SHA-256: `f550bdf33f3c23787156c0b138f42d29958c84e1dcda562010fbb0874f9d6ed9`
- Extraktionsumfang: nur die unten genannten autoritativen Kapitel; das vollständige Großdokument wurde bewusst nicht dupliziert.

## 72. V5-Autorität, Null-Unklarheits-Protokoll und externe Restwerte

Version 5 ist die letzte Designspezifikation vor der Erstellung eines getrennten Entwicklungsplans. Sie ist keine Ideensammlung und kein unverbindliches Briefing. Ein Implementierungsagent verwendet sie als Source of Truth für Produkt, Inhalt, Simulation, UX, Daten, Native-Container, Qualität und Release. Der spätere Entwicklungsplan darf Reihenfolge, Arbeitspakete, Verantwortliche und Schätzungen festlegen, aber keine hier definierte Produktentscheidung neu treffen.

### 72.1 Verbindliche Konflikt- und Auslegungsreihenfolge

| Priorität | Regel | Konsequenz |
| --- | --- | --- |
| 1 | Kapitel 72-87 der V5 | Schließen oder korrigieren ältere technische und auslegungsbezogene Aussagen. |
| 2 | Konkreter Inhaltsdatensatz | Ein benannter Held, Boss, Gegenstand, Encounter oder Screen schlägt eine allgemeinere Standardregel. |
| 3 | Explizite harte Grenze | Maxima, Minima, Sicherheits-, Save-, Datenschutz- und Store-Gates schlagen Komfort und visuelle Präferenz. |
| 4 | Numerische Baseline | Wird implementiert, sofern kein engerer datensatzspezifischer Wert existiert. |
| 5 | Deterministischer V5-Default | Wird verwendet, wenn eine erlaubte Variante nicht aktiv konfiguriert wurde. |
| 6 | Fehler statt Erfindung | Fehlt ein Pflichtwert trotz Schema, schlägt Build/Content-Load fehl; der Agent erfindet keinen Inhalt. |

### 72.2 Bedeutung normativer Begriffe

| Begriff | Exakte Bedeutung |
| --- | --- |
| MUSS / MUSS NICHT | Harte Implementierungs- oder Releasebedingung. Abweichung ist ein Defekt oder benötigt eine neue Dokumentversion. |
| SOLL | Verbindlicher Zielzustand. Abweichung nur bei nachgewiesenem Plattform- oder Performancekonflikt; V5-Fallback anwenden und ADR schreiben. |
| DARF | Erlaubte Option, niemals zusätzliche Pflicht. Ohne explizite Aktivierung gilt der genannte Default. |
| Baseline | Erster produktionsfähiger Wert. Er wird implementiert und nur innerhalb des angegebenen Korridors getunt. |
| Tuning-Korridor | Numerischer Bereich, der ohne Designänderung nach Simulation/Playtest angepasst werden darf. |
| Release-Blocker | Verhindert RC- oder Storefreigabe unabhängig von Zeitdruck. |
| Implementierungsfrage | Frage nach Codeausführung innerhalb festgelegter Regeln; der Agent darf eine fachlich übliche Lösung wählen. |
| Designfrage | Ändert Spielverhalten, Umfang, Datenpraxis, UX-Grundsatz oder Plattformvertrag; darf nicht vom Agenten entschieden werden. |

### 72.3 Erlaubte technische Eigenentscheidungen des Agents

Der Agent darf lokale Funktionsnamen, private Hilfsfunktionen, interne Dateiaufteilung innerhalb der festgelegten Module und äquivalente reine Algorithmen wählen.

Der Agent darf keine Dependency hinzufügen, kein Schemafeld umdeuten, keine Währung/Einheit/Fähigkeit ergänzen und keine UI-Funktion verstecken, um Aufwand zu sparen.

Bei mehreren technisch gleichwertigen Lösungen gilt in dieser Reihenfolge: deterministisch, testbar, ohne Native-Zusatzpermission, ohne Netzwerk, kleineres Bundle, einfacher zu warten.

Ein Fallback darf niemals Progression verlieren, Gameplay verändern oder still eine schlechtere Datenquelle verwenden. Jeder Recovery-Pfad ist sichtbar und testbar.

### 72.4 Externe Restwerte, die Entwicklung nicht blockieren

| Schlüssel | Entwicklungswert | Release-Gate |
| --- | --- | --- |
| PUBLISHER_LEGAL_NAME | [PUBLISHER] | Muss vor Store-Metadaten, Datenschutzseite und Copyright ersetzt sein. |
| SUPPORT_EMAIL | support@example.invalid | Muss vor Closed Test/TestFlight durch erreichbare Adresse ersetzt und getestet sein. |
| SUPPORT_URL | https://example.invalid/riftwarden/support | Muss öffentlich per HTTPS erreichbar sein; App öffnet im Systembrowser. |
| PRIVACY_URL | https://example.invalid/riftwarden/privacy | Muss öffentlich sein und exakt No-Data/Offline-Binary widerspiegeln. |
| COPYRIGHT_YEAR | 2026 | Beim Release auf korrektes Jahr/Publisher prüfen. |
| STORE_PRICE | ca. 2,99 EUR | Publisher wählt regionale Preisstufe; Spielbalance ist unabhängig. |
| PACKAGE_IDS | com.ceegore.riftwarden | Vor erstem Storeeintrag einmalig bestätigen; danach unveränderlich. |

Die Platzhalter oben sind keine offenen Produktfragen. Sie sind Publisher-/Storekonfiguration und müssen im Buildsystem als klar sichtbare Release-Blocker validiert werden.

## 73. Kanonische Konstanten, Einheiten, Enums und ID-Regeln

### 73.1 Einzige Quelle globaler Regeln

Alle globalen Gameplay-, Save-, UI- und technischen Konstanten liegen in versionierten, typisierten Konfigurationsmodulen. Kein Magic Number darf außerhalb der jeweils autorisierten Datei dupliziert werden.

// src/game/rules/gameRules.ts export const GAME_RULES = { simulationTicksPerSecond: 30, formationLanes: 3, formationDepths: 3, maxRegularUnitsPerSide: 7, maxHeroesPerPlayerGroup: 3, maxCopiesPerTroopType: 3, maxActiveSummonsPerSide: 6, baseActiveRelics: 6, deepEndlessActiveRelics: 8, absoluteMaxActiveRelics: 8, heroLevelMin: 1, heroLevelMax: 3, permanentEquipmentSlotsPerHero: 2, formationPresetCount: 4, normalRiftCollapseStartTicks: 90 * 30, eliteRiftCollapseStartTicks: 90 * 30, bossRiftCollapseStartTicks: 120 * 30, riftCollapseDurationTicks: 15 * 30, absoluteBattleAbortTicks: 180 * 30, autosaveRotationSlots: 3, supportedLocales: ['de', 'en'] as const, } as const;

### 73.2 Autoritative Einheiten und Rundung

| Domäne | Interne Einheit | Regel |
| --- | --- | --- |
| Zeit | ganze Simulationsticks | 1 Sekunde = 30 Ticks. UI-Sekunden sind Anzeige; kein Floattimer im Simulationszustand. |
| Position | 1/100 X-Einheit als Integer | 0..10000. Bahnen sind Enum 0..2; keine Y-Physik in der Simulation. |
| Werte | Milliwerte | 1000 intern = 1 sichtbarer Punkt. LP/Schaden/Schilde bleiben Integer. |
| Prozent | Basispunkte | 10000 = 100%; zulässiger Normalbereich 0..50000, datensatzspezifisch enger. |
| Währung | ganze Einheiten | Keine Dezimalwährung und keine negative Bilanz. |
| IDs | lower_snake_case ASCII | Unveränderlich nach Release; Anzeige kommt ausschließlich über Localization Key. |
| Sortierung | Unicode-freie stabile Schlüssel | Gameplay nutzt ID/Index, nicht lokalisierte Namen. |
| Rundung | half-away-from-zero | Nur an ausdrücklich markierten Formelschritten; UI rundet separat. |

### 73.3 Vollständige Kern-Enums

| Enum | Erlaubte Werte |
| --- | --- |
| Side | player, enemy |
| Lane | top, middle, bottom |
| Depth | front, middle, back |
| UnitCategory | hero, troop, summon, enemy, boss, boss_object |
| RoleTag | defender, fighter, breaker, duelist, marksman, mage, healer, support, summoner, controller, constructor |
| DamageType | physical, magical, true |
| TargetKind | enemy_unit, allied_unit, self, ground_position, summon_slot, boss_object |
| AbilityKind | passive, basic_attack, signature, level3_once, boss, modifier, item |
| StatusKind | shield, attack_up, attack_speed_up, move_speed_up, resistance_up, regeneration, burn, poison, slow, weaken, silence, stun, mark, confusion |
| StackPolicy | replace_if_stronger, refresh_duration, extend_duration_capped, independent_by_source, no_reapply |
| Difficulty | explorer, normal, veteran |
| RunMode | campaign, campaign_replay, ascension, beyond, endless |
| QualityTier | auto, high, medium, low |
| SaveCommitReason | profile_change, node_entered, decision_committed, battle_started, battle_snapshot, battle_finished, reward_committed, run_finished, settings_changed, manual_backup |
| RecoveryReason | none, newest_slot_invalid, run_invalid, content_mismatch, migration_failed, renderer_unavailable, insufficient_storage |

### 73.4 ID-Namensräume und Referenzregeln

Präfixe: hero_, troop_, summon_, enemy_, boss_, ability_, attack_, status_, trait_, synergy_, item_, talisman_, kit_, banner_, relic_, mission_, encounter_, event_, modifier_, achievement_, mastery_, screen_, audio_, visual_.

Eine ID darf nur einem Inhaltstyp gehören. Buildvalidierung verwirft doppelte IDs auch über unterschiedliche Dateien.

Referenzen werden niemals über Arrayposition oder Anzeigenamen gespeichert. Savegames speichern ausschließlich stabile IDs und schemaVersion/contentVersion.

Entfernen oder Umdeuten einer veröffentlichten ID ist verboten. Nicht mehr genutzte Inhalte werden deprecated und durch Migration/Replacement-ID behandelt.

Lokalisierungskeys folgen content.<type>.<id>.<field> beziehungsweise ui.<screen>.<element>. Fehlende Keys sind Release-Buildfehler.

## 74. Exakter Repository-Bootstrap, Befehle und Konfigurationsbaseline

### 74.1 Verbindliche Paket- und Workspace-Struktur

Das Projekt ist verbindlich ein einzelnes pnpm-Repository ohne Workspace-Packages und ohne Monorepo-Tooling. Die reine Simulation liegt unter /src/game/sim, wird über normale TypeScript-Pfadaliase importiert und niemals als separates Package veröffentlicht.

/ package.json pnpm-lock.yaml tsconfig.json tsconfig.node.json vite.config.ts capacitor.config.ts eslint.config.js playwright.config.ts vitest.config.ts /src ... (Kapitel 50) /content/source /content/schemas /content/generated /public/assets/generated /android /ios /tools /tests /docs/adr /docs/reports /store/android /store/ios

### 74.2 Pflichtbefehle

| Befehl | Wirkung | Exit-Code-Gate |
| --- | --- | --- |
| pnpm dev | Vite Development Server mit Web-Mocks und Developer Overlay. | 0 nur wenn Content geladen und Schema gültig. |
| pnpm build | Production-Webbundle ohne Sourcemaps im ausgelieferten Paket. | 0 nur bei Bundle-, CSP-, Localization- und Content-Gates. |
| pnpm typecheck | tsc --noEmit für App, Tools und Tests. | Keine Fehler/Warnungsunterdrückung. |
| pnpm lint | ESLint plus verbotene APIs, Imports, Netzwerk- und Random-Regeln. | Keine Fehler. |
| pnpm content:validate | Schemas, Referenzen, Counts, Balancinggrenzen, Textbudgets. | Jeder Befund ist Fehler oder explizit allowlisted. |
| pnpm content:build | Kompiliert Source-JSON in deterministische Indizes/Manifest. | Byte-identisch bei gleichem Input. |
| pnpm assets:build | Atlanten, Kompression, Hashmanifest, Lizenzreport. | Budgets und Referenzen eingehalten. |
| pnpm test:unit | Vitest Unit-/Schema-/Service-Tests. | 100% grün. |
| pnpm test:sim | Property-, Golden-Replay- und Massensimulationen. | Alle Invarianten/Hashes grün. |
| pnpm test:e2e | Playwright primäre Flows DE/EN/Pseudo. | Keine Flakes nach einem Retry; Retry wird berichtet. |
| pnpm test:visual | Referenzscreens mit festen Seeds/Viewports. | Nur genehmigte Diffs. |
| pnpm cap:sync | Productionbuild plus npx cap sync. | Native-Diff enthält keine unerlaubte Permission/URL. |
| pnpm android:release | Signierbares AAB aus clean state. | AAB, SBOM, Checksums, 16-KB-Prüfung. |
| pnpm ios:archive | Release Archive/xcarchive. | Entitlements/Privacy/SDK-Gates. |
| pnpm verify:release | Gesamter gemeinsamer Preflight. | Einziger zulässiger Eingang in RC-Build. |

### 74.3 Konfigurationsregeln

capacitor.config.ts verwendet webDir=dist, bundledWebRuntime=false, kein server.url und keine allowNavigation-Einträge im Release.

Vite base ist ./ für den Capacitor-Build. Asset-URLs werden ausschließlich über den generierten Manifestresolver aufgebaut.

Production definiert process.env/Import-Meta nur zur Buildzeit. Es existieren keine geheimen Clientwerte; unbekannte Umgebungsvariablen brechen die Validierung.

Debugtools, Seedpicker, Replayinspektor und FPS-HUD sind compile-time aus Release entfernt, nicht nur per verstecktem Schalter deaktiviert.

Native Projekte bleiben committed. npx cap sync darf keine handgeschriebenen Native-Dateien überschreiben; Custom Plugins besitzen eigene Tests.

### 74.4 Zulässige Buildvariablen

| Variable | dev/qa | release |
| --- | --- | --- |
| VITE_BUILD_CHANNEL | dev oder qa | release |
| VITE_CONTENT_VERSION | generierter Hash | generierter Hash, Pflicht |
| VITE_ENABLE_DEVTOOLS | true erlaubt | muss false sein |
| VITE_FIXED_TEST_SEED | optional | muss fehlen |
| VITE_SUPPORT_URL | Placeholder erlaubt | gültige HTTPS-URL Pflicht |
| VITE_PRIVACY_URL | Placeholder erlaubt | gültige HTTPS-URL Pflicht |

### 74.5 Verbindliche Dependency-Allowlist und Versionsfreeze

| Gruppe | Erlaubte produktive Pakete | Regel |
| --- | --- | --- |
| UI/Runtime | react, react-dom, zustand, motion, pixi.js, zod | Nur die in Kapitel 49.1 festgelegten Major-Linien; Installation mit --save-exact, pnpm-lock.yaml ist danach autoritativ. |
| Capacitor | @capacitor/core, android, ios, app, filesystem, preferences, haptics, screen-orientation, splash-screen, browser sowie der für Capacitor 8 offizielle System-Bars-Adapter | Alle offiziellen Capacitor-Pakete besitzen exakt dieselbe Major-Version. Browser ist Pflicht; keine Release-Netzwerkfunktion entsteht daraus. |
| Native Custom | NativeSaveStore, SaveTransfer, GameAudioSession | Eigener Android-/iOS-Code mit Web-Mock, Unit-, Instrumentation-/XCTest- und Lifecycle-Tests. |
| Development | typescript, vite, eslint, vitest, playwright, tailwindcss und notwendige offizielle Adapter/Typen | Nur Build-, Test- und Typwerkzeuge. Keine Runtime-Telemetrie, kein Remote-Code, kein CDN. |
| Verbot | Jedes nicht in dieser Allowlist oder Kapitel 49.2 genannte Runtime-Paket | Hinzufügen benötigt Security-/Bundle-/Lizenzprüfung und ADR; eine Designfunktion benötigt zusätzlich neue Dokumentversion. |

Bootstrap löst einmalig die neueste stabile Patchversion innerhalb der freigegebenen Major-Linie am Implementierungsstart auf und schreibt jede Dependency exakt ohne Caret/Tilde in package.json sowie ins Lockfile.

Danach erfolgen Upgrades ausschließlich als eigene PR mit Changelog-, Native-Build-, Bundle-, Determinismus- und Regressionprüfung. Automatische Major-/Minor-Upgrades sind deaktiviert.

Lizenzreport muss für jede direkte und transitive Dependency Name, Version, Lizenz und Quell-URL enthalten; unbekannte, copyleft-inkompatible oder nicht redistributierbare Lizenz blockiert den Build.

## 87. Finaler Handoff-Vertrag vor Entwicklungsplan und Implementierung

Nach V5 darf der Entwicklungsplan das Werk in Phasen, Epics, Tickets, Abhängigkeiten und Abnahmebündel zerlegen. Er darf keine neue Designentscheidung einführen. Ein mittlerer Implementierungsagent muss für jede Aufgabe auf eine konkrete Kapitel-, Datensatz-, Screen-, Interface- oder Gate-Referenz zeigen können.

### 87.1 Der Entwicklungsplan darf entscheiden

Reihenfolge innerhalb der bereits definierten Abhängigkeiten, Ticketgröße, Branch-/PR-Schnitt und parallele Arbeitspakete.

Konkrete interne Algorithmen/Dateiaufteilung, sofern Schnittstellen, Determinismus, Performance und Tests eingehalten werden.

Welche V5-Tests in welchem Implementierungsschritt zuerst grün werden, solange kein Gate übersprungen wird.

### 87.2 Der Entwicklungsplan darf nicht entscheiden

Neue oder entfernte Features, geänderte Obergrenzen, manuelle Kampfsteuerung, andere Währungen, Live-Service, Telemetrie, Accounts oder Netzwerkabhängigkeit.

Andere Stack-Majors, Rendererautorität, nicht deterministische Simulation, schwächere Savegarantien oder nicht adaptive Mobile-UI.

Weglassen von Screens/States/Accessibility/Storetests unter Verweis auf MVP, wenn V5 sie als Pflicht definiert.

### 87.3 Implementierungsstart-Gate

| Gate | Erforderlicher Nachweis |
| --- | --- |
| Dokument | V5 DOCX/PDF freigegeben; keine offenen Design-TODOs. |
| Bootstrapwerte | Package IDs/Publisherplaceholder bestätigt, Toolchains installierbar, Lockfile kann erzeugt werden. |
| Content | V5-Inhalte in übertragbarer Quelle verfügbar oder Extraktionsplan als erstes Arbeitspaket. |
| Entwicklungsplan | Jedes Paket besitzt Inputs, Outputs, Tests, Abhängigkeiten und Done-Kriterien aus V5. |
| Änderungsprozess | ADR-/Change-Control festgelegt; V5-Abweichungen werden nicht still implementiert. |

### 87.4 Finale Definition

Riftwarden: Auto RPG Roguelite ist mit Version 5 ausreichend eindeutig spezifiziert, wenn die Implementierung aus den vorliegenden Regeln einen deterministischen, vollständig offline spielbaren, hochpolierten Mobile-Auto-RPG-Roguelite-Titel erzeugen kann; jeder Inhalt, Screen, Zustand, Datensatz, Savepfad, Rendererfall, Accessibilityflow und Store-Gate besitzt eine festgelegte fachliche Bedeutung; und keine nicht dokumentierte Produktentscheidung notwendig ist. Tritt während der Umsetzung dennoch eine echte Designlücke auf, wird sie nicht improvisiert, sondern als dokumentierte V5-Change-Request mit betroffenen Regeln, Alternativen, gewählter Entscheidung, Migration und Regression behandelt.

Ende der finalen Pre-Implementation-Spezifikation. Nächster separater Artefaktschritt: Entwicklungsplan und Implementierungsphasen auf Basis dieser V5.
