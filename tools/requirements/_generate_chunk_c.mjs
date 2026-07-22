#!/usr/bin/env node
// Generates chunk-c.json with computed sha256 hashes
// Usage: run via node --test (no test runner needed; just side-effect writes the file)
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const QH = (s) => `sha256:${sha(s)}`;

// ==================== REQUIREMENTS ====================
// Each entry: [id, title, statement, norm, category, sourceChapter, section, locator, excerpt, ownerPhases, verification, numericConstraints]
// section can be null or e.g. "59.1 Datenformat"
// ownerPhases: phase IDs (without "PHASE-" prefix validator requires, e.g. PHASE-09)
// verification: array of {type, plannedPhase, testIds}
const R = [];

// Helper to push a record
function pushReq(id, title, statement, norm, category, chapter, section, locator, excerpt, ownerPhases, verification, numericConstraints) {
  R.push({
    id, title, statement, norm, category,
    source: {
      sourceId: 'gdd-v5',
      chapter,
      section: section ?? null,
      locator,
      quoteHash: QH(excerpt),
      originalExcerpt: excerpt
    },
    ownerPhases,
    verification,
    numericConstraints: numericConstraints ?? [],
    status: 'planned'
  });
}

// ==================== Chapter 59 – Content-Pipeline, Schemas und Buildvalidierung ====================
pushReq('REQ-TEMP-C-0001','UTF-8 JSON Content-Layout','Alle Gameplayinhalte liegen als UTF-8 JSON ohne Kommentare unter src/game/content/data. Eine Datei pro Entitätskategorie, große Pools nach Region geteilt.','MUST','Content',59,'59.1','block:1779','Alle Gameplayinhalte liegen als UTF-8 JSON ohne Kommentare unter src/game/content/data. Eine Datei pro Entitätskategorie, große Pools nach Region geteilt.',['PHASE-01'], [{type:'static', plannedPhase:'PHASE-01', testIds:['UT-SCHEMA-CONTENT-001']}]);

pushReq('REQ-TEMP-C-0002','Zod-Schemas als Single Source of Truth','Zod-Schemas sind SSOT. Aus ihnen werden TypeScript-Typen, JSON Schemas und Dokumentationsreports generiert.','MUST','Content',59,'59.1','block:1780','Zod-Schemas sind SSOT. Aus ihnen werden TypeScript-Typen, JSON Schemas und Dokumentationsreports generiert.',['PHASE-01'], [{type:'static', plannedPhase:'PHASE-01', testIds:['UT-SCHEMA-ZOD-001']}]);

pushReq('REQ-TEMP-C-0003','Verbot der Runtime-Namen-Suche','Der Build erzeugt immutable ContentIndex-Maps nach ID. Runtime-Suche über frei formulierte Namen ist verboten.','MUST_NOT','Content',59,'59.1','block:1781','Der Build erzeugt immutable ContentIndex-Maps nach ID. Runtime-Suche über frei formulierte Namen ist verboten.',['PHASE-01'], [{type:'unit', plannedPhase:'PHASE-01', testIds:['UT-CONTENT-LOOKUP-001']}]);

pushReq('REQ-TEMP-C-0004','Sekundenwerte in Ticks konvertieren','Alle Sekundenwerte in Autorendaten dürfen Dezimalzahlen sein; Loader wandelt sie einmal in ganze Ticks und protokolliert Rundung > 0,01 s als Warnung.','SHOULD','Content',59,'59.1','block:1782','Alle Sekundenwerte in Autorendaten dürfen Dezimalzahlen sein; Loader wandelt sie einmal in ganze Ticks und protokolliert Rundung > 0,01 s als Warnung.',['PHASE-02'], [{type:'unit', plannedPhase:'PHASE-02', testIds:['UT-LOADER-TICKS-001']}], [{unit:'s', min:0.01, op:'>'}]);

pushReq('REQ-TEMP-C-0005','Lokalisierungs-Keys in DE und EN','Localization Keys müssen in de und en existieren. Pseudo-Localization muss jedes Layout ohne unersetzte Schlüssel rendern.','MUST','Content',59,'59.1','block:1783','Localization Keys müssen in de und en existieren. Pseudo-Localization muss jedes Layout ohne unersetzte Schlüssel rendern.',['PHASE-01'], [{type:'static', plannedPhase:'PHASE-01', testIds:['UT-LOCALE-KEYS-001']}]);

pushReq('REQ-TEMP-C-0006','Build-Validator Referenzen: harter Fehler','Build-Validator „Referenzen“: harter Fehler bei unbekanntem Held, Effekt, Fähigkeit, Lootpool, Mission oder Localization Key.','MUST','QA',59,'59.2','block:1785','Referenzen: Unbekannter Held, Effekt, Fähigkeit, Lootpool, Mission oder Localization Key.',['PHASE-01'], [{type:'static', plannedPhase:'PHASE-01', testIds:['UT-VALID-REF-001']}]);

pushReq('REQ-TEMP-C-0007','Build-Validator IDs: harter Fehler','Build-Validator „IDs“: harter Fehler bei Duplikat, Großbuchstabe, Leerzeichen, nachträglich entfernter veröffentlichter ID ohne Migration.','MUST','QA',59,'59.2','block:1785','IDs: Duplikat, Großbuchstabe, Leerzeichen, nachträglich entfernte veröffentlichte ID ohne Migration.',['PHASE-01'], [{type:'static', plannedPhase:'PHASE-01', testIds:['UT-VALID-IDS-001']}]);

pushReq('REQ-TEMP-C-0008','Build-Validator Kampf: harter Fehler','Build-Validator „Kampf“: harter Fehler bei negativer LP, Cooldown < 0,45 s ohne Ausnahme, ungültiger Phase, unendlicher Triggerkette.','MUST','QA',59,'59.2','block:1785','Kampf: Negative LP, Cooldown < 0,45 s ohne Ausnahme, ungültige Phase, unendliche Triggerkette.',['PHASE-02'], [{type:'static', plannedPhase:'PHASE-02', testIds:['UT-VALID-COMBAT-001']}], [{unit:'s', max:0.45, op:'<', when:'ohne Ausnahme'}]);

pushReq('REQ-TEMP-C-0009','Build-Validator Formation: harter Fehler','Build-Validator „Formation“: harter Fehler bei Überschreitung Plätze/Kopien/Helden, identische Startfelder, nicht erreichbare Pflichtbahn.','MUST','QA',59,'59.2','block:1785','Formation: Mehr als Plätze/Kopien/Helden, identische Startfelder, nicht erreichbare Pflichtbahn.',['PHASE-02'], [{type:'static', plannedPhase:'PHASE-02', testIds:['UT-VALID-FORMATION-001']}]);

pushReq('REQ-TEMP-C-0010','Build-Validator Beschwörung: harter Fehler','Build-Validator „Beschwörung“: harter Fehler bei mehr als sechs ohne Ersatzregel, Rekursion ohne Safety Cap.','MUST','QA',59,'59.2','block:1785','Beschwörung: Mehr als sechs ohne Ersatzregel, Rekursion ohne Safety Cap.',['PHASE-02'], [{type:'static', plannedPhase:'PHASE-02', testIds:['UT-VALID-SUMMON-001']}], [{unit:'summons', max:6, op:'>'}]);

pushReq('REQ-TEMP-C-0011','Build-Validator Dungeon: harter Fehler','Build-Validator „Dungeon“: harter Fehler bei nicht erreichbarem Boss, fehlendem Anker, fehlender Vorbereitung, >13 sichtbare oder >8 besuchte Knoten ohne Modusausnahme.','MUST','QA',59,'59.2','block:1785','Dungeon: Nicht erreichbarer Boss, kein Anker, keine Vorbereitung, >13 sichtbare oder >8 besuchte Knoten ohne Modusausnahme.',['PHASE-04'], [{type:'static', plannedPhase:'PHASE-04', testIds:['UT-VALID-DUNGEON-001']}], [{unit:'visible_nodes', max:13, op:'>'}, {unit:'visited_nodes', max:8, op:'>', when:'ohne Modusausnahme'}]);

pushReq('REQ-TEMP-C-0012','Build-Validator Loot: harter Fehler','Build-Validator „Loot“: harter Fehler bei leerem Pool, Erstbelohnung ohne Ersatz, nicht besitzbarem Item.','MUST','QA',59,'59.2','block:1785','Loot: Leerer Pool, Erstbelohnung ohne Ersatz, nicht besitzbares Item.',['PHASE-04'], [{type:'static', plannedPhase:'PHASE-04', testIds:['UT-VALID-LOOT-001']}]);

pushReq('REQ-TEMP-C-0013','Build-Validator Text: harter Fehler','Build-Validator „Text“: harter Fehler bei fehlender Sprache, Kurztooltip >220 Zeichen, Buttonlabel >30 Zeichen ohne approved compact variant.','MUST','Content',59,'59.2','block:1785','Text: Fehlende Sprache, Kurztooltip >220 Zeichen, Buttonlabel >30 Zeichen ohne approved compact variant.',['PHASE-01'], [{type:'static', plannedPhase:'PHASE-01', testIds:['UT-VALID-TEXT-001']}], [{unit:'chars_tooltip', max:220, op:'>'}, {unit:'chars_button', max:30, op:'>', when:'ohne approved compact variant'}]);

pushReq('REQ-TEMP-C-0014','Build-Validator Assets: harter Fehler','Build-Validator „Assets“: harter Fehler bei fehlendem Manifest, Atlas >2048, unbekanntem Audio Cue, nicht lizenziertem Asset.','MUST','Content',59,'59.2','block:1785','Assets: Fehlendes Manifest, Atlas >2048, unbekannter Audio Cue, nicht lizenziertes Asset.',['PHASE-10'], [{type:'static', plannedPhase:'PHASE-10', testIds:['UT-VALID-ASSETS-001']}], [{unit:'px_atlas', max:2048, op:'>'}]);

pushReq('REQ-TEMP-C-0015','Build-Validator Store: harter Fehler','Build-Validator „Store“: harter Fehler, wenn Produktionsbuild server.url, INTERNET-Permission, Debuggable, Remote Script oder verbotenen SDK-Identifier enthält.','MUST_NOT','Store',59,'59.2','block:1785','Store: Produktionsbuild enthält server.url, INTERNET-Permission, Debuggable, Remote Script oder verbotenen SDK-Identifier.',['PHASE-10'], [{type:'static', plannedPhase:'PHASE-10', testIds:['UT-VALID-STORE-001']}]);

// ==================== Chapter 60 – Lokalisierung, Copy und Textproduktion ====================
pushReq('REQ-TEMP-C-0016','Release-Sprachen DE und EN','Release-Sprachen sind Deutsch und Englisch. Deutsch ist narrative Autorensprache; Englisch ist vollständig geprüfte Parität, keine maschinelle Rohübersetzung im Release.','MUST','Content',60,'60','block:1790','Release-Sprachen sind Deutsch und Englisch. Deutsch ist narrative Autorensprache; Englisch ist vollständig geprüfte Parität, keine maschinelle Rohübersetzung im Release.',['PHASE-01'], [{type:'review', plannedPhase:'PHASE-01', testIds:['UT-LOCALE-PARITY-001']}]);

pushReq('REQ-TEMP-C-0017','Strings außerhalb des Codes','Alle sichtbaren Strings liegen außerhalb des Codes. ICU MessageFormat wird für Plural, Zahl und grammatische Varianten verwendet.','MUST','Content',60,'60','block:1791','Alle sichtbaren Strings liegen außerhalb des Codes. ICU MessageFormat wird für Plural, Zahl und grammatische Varianten verwendet.',['PHASE-01'], [{type:'static', plannedPhase:'PHASE-01', testIds:['UT-LOCALE-ICU-001']}]);

pushReq('REQ-TEMP-C-0018','Richtungsangaben vermeiden','Richtungsbegriffe links/rechts werden in Gameplaytexten vermieden; Spieler/Gegner, oben/Mitte/unten bleiben eindeutig bei Spiegelung.','SHOULD','Content',60,'60','block:1792','Richtungsbegriffe links/rechts werden in Gameplaytexten vermieden; Spieler/Gegner, oben/Mitte/unten bleiben eindeutig bei Spiegelung.',['PHASE-01'], [{type:'review', plannedPhase:'PHASE-01', testIds:['UT-LOCALE-DIRECTION-001']}]);

pushReq('REQ-TEMP-C-0019','UI-Labels mit Compact-Variante','UI-Labels besitzen eine kurze und optional compact Variante. Kein Agent darf Text durch kleinere Schrift passend machen, solange eine Reflow-/Compact-Lösung möglich ist.','MUST','UX',60,'60','block:1793','UI-Labels besitzen eine kurze und optional compact Variante. Kein Agent darf Text durch kleinere Schrift passend machen, solange eine Reflow-/Compact-Lösung möglich ist.',['PHASE-09'], [{type:'visual', plannedPhase:'PHASE-09', testIds:['UT-LOCALE-COMPACT-001']}]);

pushReq('REQ-TEMP-C-0020','Fehlende Übersetzung als Buildfehler','Fehlende Übersetzung zeigt im Development den Key in Magenta und ist im Release ein Buildfehler.','MUST','Content',60,'60','block:1794','Fehlende Übersetzung zeigt im Development den Key in Magenta und ist im Release ein Buildfehler.',['PHASE-01'], [{type:'static', plannedPhase:'PHASE-01', testIds:['UT-LOCALE-MISSING-001']}]);

pushReq('REQ-TEMP-C-0021','Pseudo-Locale für visuelle Tests','Pseudo-Locale erweitert Texte um 35%, setzt Akzente und markiert Start/Ende. Alle Screens werden damit im visuellen Test gerendert.','MUST','Content',60,'60','block:1795','Pseudo-Locale erweitert Texte um 35%, setzt Akzente und markiert Start/Ende. Alle Screens werden damit im visuellen Test gerendert.',['PHASE-09'], [{type:'visual', plannedPhase:'PHASE-09', testIds:['UT-LOCALE-PSEUDO-001']}], [{unit:'pct_text_expansion', min:35, op:'>='}]);

pushReq('REQ-TEMP-C-0022','Textlängen Primärbutton','Texttyp „Primärbutton“: maximal 30 Zeichen DE; 24 EN oder Compact Key.','MUST','UX',60,'60','block:1796','Primärbutton: 30 Zeichen DE; 24 EN oder Compact Key.',['PHASE-09'], [{type:'visual', plannedPhase:'PHASE-09', testIds:['UT-LOCALE-BUTTON-001']}], [{unit:'chars_button_de', max:30}, {unit:'chars_button_en', max:24}]);

pushReq('REQ-TEMP-C-0023','Textlänge Kurztooltip','Texttyp „Kurztooltip“: maximal 220 Zeichen inklusive Leerzeichen.','MUST','UX',60,'60','block:1796','Kurztooltip: 220 Zeichen inklusive Leerzeichen.',['PHASE-09'], [{type:'visual', plannedPhase:'PHASE-09', testIds:['UT-LOCALE-TOOLTIP-001']}], [{unit:'chars_tooltip', max:220}]);

pushReq('REQ-TEMP-C-0024','Textlänge Kartentext','Texttyp „Kartentext“: Titel 34; Unterzeile 60; Effekt 180 Zeichen.','MUST','UX',60,'60','block:1796','Kartentext: Titel 34; Unterzeile 60; Effekt 180 Zeichen.',['PHASE-09'], [{type:'visual', plannedPhase:'PHASE-09', testIds:['UT-LOCALE-CARD-001']}], [{unit:'chars_card_title', max:34}, {unit:'chars_card_subline', max:60}, {unit:'chars_card_effect', max:180}]);

pushReq('REQ-TEMP-C-0025','Textlänge Ereignisintro','Texttyp „Ereignisintro“: maximal 480 Zeichen, max. zwei Absätze.','MUST','UX',60,'60','block:1796','Ereignisintro: 480 Zeichen, max. zwei Absätze.',['PHASE-09'], [{type:'visual', plannedPhase:'PHASE-09', testIds:['UT-LOCALE-EVENT-001']}], [{unit:'chars_event_intro', max:480}, {unit:'paragraphs', max:2}]);

pushReq('REQ-TEMP-C-0026','Textlänge Ereignisoption','Texttyp „Ereignisoption“: Titel 46; Folge 180 Zeichen.','MUST','UX',60,'60','block:1796','Ereignisoption: Titel 46; Folge 180 Zeichen.',['PHASE-09'], [{type:'visual', plannedPhase:'PHASE-09', testIds:['UT-LOCALE-EVENTOPT-001']}], [{unit:'chars_option_title', max:46}, {unit:'chars_option_outcome', max:180}]);

pushReq('REQ-TEMP-C-0027','Textlänge Pip-Hinweis','Texttyp „Pip-Hinweis“: zwei Sätze, zusammen <= 180 Zeichen.','MUST','UX',60,'60','block:1796','Pip-Hinweis: Zwei Sätze, zusammen <= 180 Zeichen.',['PHASE-09'], [{type:'visual', plannedPhase:'PHASE-09', testIds:['UT-LOCALE-PIP-001']}], [{unit:'chars_pip', max:180}]);

pushReq('REQ-TEMP-C-0028','Textlänge Bossvorschau','Texttyp „Bossvorschau“: vier Kernbullets je <= 120 Zeichen plus Details.','MUST','UX',60,'60','block:1796','Bossvorschau: Vier Kernbullets je <= 120 Zeichen plus Details.',['PHASE-09'], [{type:'visual', plannedPhase:'PHASE-09', testIds:['UT-LOCALE-BOSS-001']}], [{unit:'chars_boss_bullet', max:120}, {unit:'bullets_boss', min:4}]);

pushReq('REQ-TEMP-C-0029','Textlänge Untertitel','Texttyp „Untertitel“: max. 42 Zeichen pro Zeile, zwei Zeilen; Lesedauer min. 1,2 s.','MUST','UX',60,'60','block:1796','Untertitel: Max. 42 Zeichen pro Zeile, zwei Zeilen; Lesedauer min. 1,2 s.',['PHASE-09'], [{type:'visual', plannedPhase:'PHASE-09', testIds:['UT-LOCALE-SUB-001']}], [{unit:'chars_subtitle_line', max:42}, {unit:'lines_subtitle', max:2}, {unit:'s_read_time', min:1.2}]);

// ==================== Chapter 61 – Datenschutz, Sicherheit und Netzwerkfreiheit ====================
pushReq('REQ-TEMP-C-0030','Keine Nutzer-/Gerätedaten im Release','Die Release-App sammelt, überträgt oder teilt keine Nutzer-, Geräte-, Werbe-, Standort-, Nutzungs- oder Diagnosedaten. Es existiert kein Backend.','MUST_NOT','Security',61,'61.1','block:1800','Die Release-App sammelt, überträgt oder teilt keine Nutzer-, Geräte-, Werbe-, Standort-, Nutzungs- oder Diagnosedaten. Es existiert kein Backend.',['PHASE-10'], [{type:'native', plannedPhase:'PHASE-10', testIds:['NAT-A-PRIVACY-001','NAT-I-PRIVACY-001']}]);

pushReq('REQ-TEMP-C-0031','Diagnoseexport nur nach Nutzeraktion','Alle Statistiken, Replays und Logs bleiben lokal. Diagnoseexport erfolgt nur nach expliziter Nutzeraktion und zeigt vor dem Systemdialog den enthaltenen Umfang.','MUST','Security',61,'61.1','block:1801','Alle Statistiken, Replays und Logs bleiben lokal. Diagnoseexport erfolgt nur nach expliziter Nutzeraktion und zeigt vor dem Systemdialog den enthaltenen Umfang.',['PHASE-09'], [{type:'native', plannedPhase:'PHASE-09', testIds:['UT-DIAG-EXPORT-001']}]);

pushReq('REQ-TEMP-C-0032','Keine Identifier/Fingerprinting','Keine Advertising ID, IDFV, Android ID, Install Referrer, IP-Logging, Fingerprinting oder Geräteidentifier werden gelesen.','MUST_NOT','Security',61,'61.1','block:1802','Keine Advertising ID, IDFV, Android ID, Install Referrer, IP-Logging, Fingerprinting oder Geräteidentifier werden gelesen.',['PHASE-10'], [{type:'review', plannedPhase:'PHASE-10', testIds:['SEC-AUDIT-ID-001']}]);

pushReq('REQ-TEMP-C-0033','Datenschutzseite und Drittbibliothek-Prüfung','Die Datenschutzseite und die Store-Deklarationen müssen „keine Datenerhebung/-weitergabe“ widerspruchsfrei abbilden. Drittbibliotheken werden vor Release auf Netzwerk- und Identifierzugriff geprüft.','MUST','Security',61,'61.1','block:1803','Die Datenschutzseite und die Store-Deklarationen müssen „keine Datenerhebung/-weitergabe“ widerspruchsfrei abbilden. Drittbibliotheken werden vor Release auf Netzwerk- und Identifierzugriff geprüft.',['PHASE-10'], [{type:'review', plannedPhase:'PHASE-10', testIds:['SEC-DPA-001']}]);

pushReq('REQ-TEMP-C-0034','Externe Links im Systembrowser','Externe Datenschutz-, Support- und Lizenzlinks öffnen im Systembrowser. Die App lädt deren Inhalte nicht in einen kontrollierten WebView.','MUST','Security',61,'61.1','block:1804','Externe Datenschutz-, Support- und Lizenzlinks öffnen im Systembrowser. Die App lädt deren Inhalte nicht in einen kontrollierten WebView.',['PHASE-09'], [{type:'native', plannedPhase:'PHASE-09', testIds:['UT-EXT-LINKS-001']}]);

pushReq('REQ-TEMP-C-0035','Produktions-CSP WebView-Härtung','default-src \'self\'; img-src \'self\' data: blob:; media-src \'self\' blob:; font-src \'self\'; style-src \'self\' \'unsafe-inline\'; script-src \'self\'; connect-src \'none\'; object-src \'none\'; frame-src \'none\'; base-uri \'none\'; form-action \'none\'','MUST','Security',61,'61.2','block:1806',"default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",['PHASE-10'], [{type:'static', plannedPhase:'PHASE-10', testIds:['SEC-CSP-001']}]);

pushReq('REQ-TEMP-C-0036','connect-src none in Produktion','connect-src none ist im Produktionsbuild Pflicht. Jeder unbeabsichtigte fetch/WebSocket/EventSource schlägt sichtbar im Test fehl.','MUST','Security',61,'61.2','block:1807','connect-src none ist im Produktionsbuild Pflicht. Jeder unbeabsichtigte fetch/WebSocket/EventSource schlägt sichtbar im Test fehl.',['PHASE-10'], [{type:'static', plannedPhase:'PHASE-10', testIds:['SEC-CSP-CONNECT-001']}]);

pushReq('REQ-TEMP-C-0037','capacitor.config Release-Härtung','capacitor.config enthält im Release keine server.url, cleartext, allowNavigation oder mixed content. WebView-Debugging ist deaktiviert.','MUST','Security',61,'61.2','block:1808','capacitor.config enthält im Release keine server.url, cleartext, allowNavigation oder mixed content. WebView-Debugging ist deaktiviert.',['PHASE-10'], [{type:'static', plannedPhase:'PHASE-10', testIds:['SEC-CAPACITOR-001']}]);

pushReq('REQ-TEMP-C-0038','Android Permissions-Beschränkung','Android INTERNET-Permission wird im finalen Manifest entfernt. VIBRATE ist die einzige optionale normale Permission; keine Runtime-Permissions.','MUST','Android',61,'61.2','block:1809','Android INTERNET-Permission wird im finalen Manifest entfernt. VIBRATE ist die einzige optionale normale Permission; keine Runtime-Permissions.',['PHASE-10'], [{type:'static', plannedPhase:'PHASE-10', testIds:['NAT-A-PERMS-001']}]);

pushReq('REQ-TEMP-C-0039','iOS Entitlements minimal','iOS besitzt keine unnötigen Entitlements. PrivacyInfo.xcprivacy nennt nur tatsächlich genutzte Required-Reason APIs aus Capacitor/Plugins.','MUST','iOS',61,'61.2','block:1810','iOS besitzt keine unnötigen Entitlements. PrivacyInfo.xcprivacy nennt nur tatsächlich genutzte Required-Reason APIs aus Capacitor/Plugins.',['PHASE-10'], [{type:'static', plannedPhase:'PHASE-10', testIds:['NAT-I-ENTITLE-001']}]);

pushReq('REQ-TEMP-C-0040','Keine dynamische Scriptinjektion','Keine eval/new Function/dynamische Scriptinjektion. Sourcemaps werden intern archiviert, nicht öffentlich mitgeliefert.','MUST_NOT','Security',61,'61.2','block:1811','Keine eval/new Function/dynamische Scriptinjektion. Sourcemaps werden intern archiviert, nicht öffentlich mitgeliefert.',['PHASE-10'], [{type:'static', plannedPhase:'PHASE-10', testIds:['SEC-NOEVAL-001']}]);

pushReq('REQ-TEMP-C-0041','Dependency-Allowlist mit Prüfung','Nur direkte Dependencies mit klarer Funktion. Neue Dependency benötigt Lizenz-, Größe-, Netzwerk-, Permission- und Maintenance-Prüfung.','MUST','QA',61,'61.3','block:1813','Nur direkte Dependencies mit klarer Funktion. Neue Dependency benötigt Lizenz-, Größe-, Netzwerk-, Permission- und Maintenance-Prüfung.',['PHASE-10'], [{type:'review', plannedPhase:'PHASE-10', testIds:['SEC-DEPS-001']}]);

pushReq('REQ-TEMP-C-0042','Advisory-Scan blockiert Release','CI führt pnpm audit oder gleichwertigen Advisory-Scan aus. Kritische/hohe ausnutzbare Findings blockieren Release.','MUST','Security',61,'61.3','block:1814','CI führt pnpm audit oder gleichwertigen Advisory-Scan aus. Kritische/hohe ausnutzbare Findings blockieren Release.',['PHASE-11'], [{type:'static', plannedPhase:'PHASE-11', testIds:['SEC-AUDIT-001']}]);

pushReq('REQ-TEMP-C-0043','Clean-Build mit frozen lockfile','Alle Store-Artefakte werden aus clean checkout mit frozen lockfile gebaut. Buildprovenienz, Commit und Dependencyliste werden archiviert.','MUST','Security',61,'61.3','block:1815','Alle Store-Artefakte werden aus clean checkout mit frozen lockfile gebaut. Buildprovenienz, Commit und Dependencyliste werden archiviert.',['PHASE-11'], [{type:'static', plannedPhase:'PHASE-11', testIds:['SEC-BUILD-001']}]);

pushReq('REQ-TEMP-C-0044','Drittanbieter-Assetlizenz im Assetmanifest','Drittanbieterassets benötigen Lizenzdatei, Quelle, Autor und kommerzielle Nutzungsfreigabe im Assetmanifest.','MUST','Content',61,'61.3','block:1816','Drittanbieterassets benötigen Lizenzdatei, Quelle, Autor und kommerzielle Nutzungsfreigabe im Assetmanifest.',['PHASE-10'], [{type:'static', plannedPhase:'PHASE-10', testIds:['UT-ASSET-LICENSE-001']}]);

// Save what we have so far to validate approach
const out = {
  schemaVersion: '1.0',
  chunk: 'c',
  chapterRange: { lo: 59, hi: 87 },
  requirements: R,
  contextOnly: []
};
const targetPath = 'docs/requirements/requirements/_staging/chunk-c.json';
await mkdir(dirname(targetPath), { recursive: true });
await writeFile(targetPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`Wrote ${R.length} requirements to ${targetPath}`);
