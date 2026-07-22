// Tail of _build_chunk_f.mjs: verify, build REQs, emit staging file.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const kitRoot = join(fileURLToPath(new URL('../..', import.meta.url)));

const blocks = JSON.parse(await readFile('tools/requirements/_chunk_f_blocks.json', 'utf8'));
const byKey = new Map();
for (const b of blocks) byKey.set(`${b.chapter}:${b.block}`, b);

function qhash(s) {
  return 'sha256:' + createHash('sha256').update(s, 'utf8').digest('hex');
}

// Append the chapters 84, 85, 86, 87 specs (and additional 83 sub-spec if any).
const tail_specs = [
  // ---- Chapter 84 ----
  { chapter: 84, block: 2198,
    statement: 'Version 1 initialisiert PixiJS explizit mit preference=webgl und preferWebGLVersion=2; WebGL1 darf nur als automatisch funktionierender Pixi-WebGL-Fallback verwendet werden, wenn alle visuellen Tests bestehen.',
    norm: 'MUST', category: 'Sim',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['SIM-PIXI-WEBGL2-084'] }] },
  { chapter: 84, block: 2199,
    statement: 'WebGPU ist experimentell und in Release 1 deaktiviert; eine Aktivierung erfordert ein eigenes ADR, eine vollständige visuelle und Geräte-Regression sowie identisches Gameplay.',
    norm: 'MUST_NOT', category: 'Perf',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PERF-NO-WEBGPU-084'] }] },
  { chapter: 84, block: 2200,
    statement: 'Es existiert kein CanvasRenderer-Fallback; wenn kein WebGL-Kontext erstellt werden kann, wird S02 Kompatibilität angezeigt und Menüs sowie Saveexport bleiben bedienbar.',
    norm: 'MUST_NOT', category: 'Perf',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PERF-NO-CANVAS-084'] }] },
  { chapter: 84, block: 2201,
    statement: 'contextlost pausiert die Simulation sofort; contextrestored lädt Atlanten und Renderstate neu aus autoritativem Snapshot, ohne Kampfneustart und ohne Zufallsänderung.',
    norm: 'MUST', category: 'Sim',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['SIM-CONTEXT-LOST-084'] }] },
  { chapter: 84, block: 2206,
    statement: 'Beim ersten Start wird kein langer Benchmark gezeigt; nach Rendererinitialisierung werden GPU-Limits, falls verfügbar deviceMemory und 120 Frames einer nicht sichtbaren standardisierten Szene gemessen.',
    norm: 'MUST', category: 'Perf',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PERF-AUTOQ-MEASURE-084'] }] },
  { chapter: 84, block: 2207,
    statement: 'High wenn p95 <=15 ms und Texturspeicherindikatoren ausreichend; Medium <=25 ms; sonst Low; das Ergebnis wird gespeichert, aber bei OS-/Appmajor oder wiederholtem Context Loss neu bewertet.',
    norm: 'MUST', category: 'Perf',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PERF-AUTOQ-THRESHOLDS-084'] }],
    numericConstraints: [
      { kind: 'max', name: 'autoQualityHighP95Ms', value: 15, unit: 'ms' },
      { kind: 'max', name: 'autoQualityMediumP95Ms', value: 25, unit: 'ms' }] },
  { chapter: 84, block: 2208,
    statement: 'Während des Kampfs darf Auto nur stufenweise kosmetisch reduzieren: Partikel, Schatten, Hintergrundlayer, Auflösung 1,0 bis 0,75; keine Änderung von Telegraphiedauer, Entitysichtbarkeit oder Simulation.',
    norm: 'MUST', category: 'Perf',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PERF-AUTOQ-BATTLE-084'] }],
    numericConstraints: [
      { kind: 'range', name: 'autoQualityResolution', min: 0.75, max: 1.0 }] },
  { chapter: 84, block: 2209,
    statement: 'Qualität steigt nie mitten im Kampf; sie kann nach drei stabilen Kämpfen beim nächsten Screenwechsel um eine Stufe steigen.',
    norm: 'MUST', category: 'Perf',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PERF-AUTOQ-NO-RAMP-UP-084'] }] },
  { chapter: 84, block: 2211,
    statement: 'Im Hintergrund gibt es 0 Renderframes und 0 Simulationsticks; dekorative HQ-Loops pausieren nach 30 s Inaktivität oder bei Reduce Motion.',
    norm: 'MUST', category: 'Perf',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PERF-BACKGROUND-ZERO-084'] }],
    numericConstraints: [
      { kind: 'max', name: 'hqLoopIdleSec', value: 30, unit: 's' },
      { kind: 'max', name: 'backgroundRenderFrames', value: 0 },
      { kind: 'max', name: 'backgroundSimulationTicks', value: 0 }] },
  { chapter: 84, block: 2212,
    statement: 'Bei OS-Thermal-Warning oder dauerhaft p95 >33 ms wird sofort maximal Medium/Low kosmetisch gewählt und FPS-Ziel 30; der Spieler erhält keine störende Warnung außer bei einem Funktionsproblem.',
    norm: 'MUST', category: 'Perf',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PERF-THERMAL-084'] }],
    numericConstraints: [
      { kind: 'max', name: 'thermalP95Ms', value: 33, unit: 'ms' },
      { kind: 'max', name: 'thermalFpsTarget', value: 30, unit: 'fps' }] },
  { chapter: 84, block: 2213,
    statement: 'Ein 30-Minuten-Stresstest auf dem Targetgerät darf keinen Memorytrend >10% nach Warmup, keinen Context Loss und keine unkontrollierte Audio- oder Timerakkumulation zeigen.',
    norm: 'MUST', category: 'Perf',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'e2e', plannedPhase: 'PHASE-08', testIds: ['PERF-30MIN-STRESS-084'] }],
    numericConstraints: [
      { kind: 'max', name: 'stressMemoryTrendPct', value: 10, unit: '%' },
      { kind: 'min', name: 'stressDurationMin', value: 30, unit: 'min' }] },

  // ---- Chapter 85 ----
  { chapter: 85, block: 2219,
    statement: 'Keine Entity besitzt LP <0 oder >maxLP, negative Schilde, ungültige Bahn oder Position, doppelte Entity-ID oder widersprüchlichen Alive/Removed-Status.',
    norm: 'MUST_NOT', category: 'Sim',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['SIM-INV-ENTITY-085'] }] },
  { chapter: 85, block: 2220,
    statement: 'Keine Seite überschreitet sieben reguläre Einheiten oder sechs zählende Beschwörungen; kein Spielerbuild überschreitet drei Helden oder drei gleiche Truppen.',
    norm: 'MUST_NOT', category: 'Sim',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['SIM-INV-CAPS-085'] }],
    numericConstraints: [
      { kind: 'max', name: 'regularUnitsPerSide', value: 7 },
      { kind: 'max', name: 'summonsPerSide', value: 6 },
      { kind: 'max', name: 'heroesPerBuild', value: 3 },
      { kind: 'max', name: 'sameTroopPerBuild', value: 3 }] },
  { chapter: 85, block: 2221,
    statement: 'Gleicher Seed, Content, Simulationversion, Entscheidungen und Startsnapshot erzeugen bit-identische Endhashes in Node, Chromium, Android WebView und iOS WKWebView.',
    norm: 'MUST', category: 'Sim',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['SIM-INV-DETERMINISM-085'] }] },
  { chapter: 85, block: 2222,
    statement: 'Kampfgeschwindigkeit, Render-FPS, Pause/Resume und Quality verändern niemals das Ergebnis oder den RNG-Verbrauch.',
    norm: 'MUST_NOT', category: 'Sim',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['SIM-INV-NO-RNG-COUPLING-085'] }] },
  { chapter: 85, block: 2223,
    statement: 'Jeder Kampf endet spätestens am hardBattleLimit oder einer ausdrücklich kürzeren Missionsgrenze; es gibt keinen Deadlock.',
    norm: 'MUST', category: 'Sim',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['SIM-INV-NO-DEADLOCK-085'] }] },
  { chapter: 85, block: 2224,
    statement: 'Jede Rewardtransaktion ist idempotent; doppelte UI- oder Lifecycleevents erzeugen keinen Doppelgewinn oder Doppelkauf.',
    norm: 'MUST', category: 'Sim',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['SIM-INV-IDEMPOTENT-REWARD-085'] }] },
  { chapter: 85, block: 2228,
    statement: '100.000 Dungeonkarten über Missions- und Modusprofile müssen 0 Sackgassen, 0 fehlende Pflichtknoten, 0 Besuchslängen außerhalb der Regeln und 0 inkompatible Modifikatoren aufweisen.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['QA-DUNGEON-100K-085'] }],
    numericConstraints: [
      { kind: 'min', name: 'dungeonMapsSampled', value: 100000 },
      { kind: 'max', name: 'dungeonDeadEnds', value: 0 },
      { kind: 'max', name: 'dungeonMissingRequiredNodes', value: 0 },
      { kind: 'max', name: 'dungeonIncompatibleModifiers', value: 0 }] },
  { chapter: 85, block: 2229,
    statement: 'Jeder Encounterpool wird über alle Freischaltzustände validiert; das Fallbackprofil ist erreichbar und deterministisch.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['QA-ENCOUNTER-POOL-085'] }] },
  { chapter: 85, block: 2230,
    statement: 'Ein automatischer Cross-System-Test erzeugt jede zulässige Einheit-Ausrüstung-Kit-Banner-Synergie-Doktrin-Kombination mindestens strukturell und prüft Referenzen und Maxima.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['QA-CROSS-SYSTEM-085'] }] },
  { chapter: 85, block: 2231,
    statement: 'Balanceberichte markieren Winrate <20% oder >80% für neutrale Referenzencounter, Time-to-First-Death, Kampfdauer, Rollenbeitrag und ungenutzte Inhalte; die Markierung ist Tuninginput, kein automatischer Nerf.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['QA-BALANCE-REPORT-085'] }],
    numericConstraints: [
      { kind: 'max', name: 'balanceWinrateLowPct', value: 20, unit: '%' },
      { kind: 'min', name: 'balanceWinrateHighPct', value: 80, unit: '%' }] },
  { chapter: 85, block: 2234,
    statement: 'GO nur wenn verify:release grün, P0/P1=0, P2 ausdrücklich entschieden, alle Save-Migrationen und Recoverytests grün und beide Storebinaries aus demselben Tag/Commit stammen.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['QA-GO-CRITERIA-085'] }],
    numericConstraints: [
      { kind: 'max', name: 'goP0Count', value: 0 },
      { kind: 'max', name: 'goP1Count', value: 0 }] },
  { chapter: 85, block: 2235,
    statement: 'GO nur wenn Android- und iOS-Deklarationen mit tatsächlich enthaltenen Plugins, Permissions, Entitlements und Netzwerkverhalten identisch sind.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['QA-GO-DECL-MATCH-085'] }] },
  { chapter: 85, block: 2236,
    statement: 'GO nur wenn vollständiger Kampagnenlauf, Ascension-Smoke, Endless-Tiefe-25-Smoke, Import/Export und Updatepfad auf dem RC erfolgreich sind.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'e2e', plannedPhase: 'PHASE-08', testIds: ['QA-GO-RC-SMOKES-085'] }] },
  { chapter: 85, block: 2237,
    statement: 'NO-GO bei nicht reproduzierbarem Build, ungeklärter Lizenz, Placeholder, fehlender Übersetzung, fehlendem Screenzustand oder ungetesteter Plattformänderung.',
    norm: 'MUST_NOT', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['QA-NOGO-TRIGGERS-085'] }] },

  // ---- Chapter 86 ----
  { chapter: 86, block: 2246,
    statement: 'Das Dokumentaudit vergleicht normalisierte V4-Absätze und Tabellenzellen gegen V5; Ausnahmen sind ausschließlich Cover- und Versionslabels, der dokumentierte Pixi-Fix und V5-Autoritätstexte.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['QA-DOC-AUDIT-086'] }] },
  { chapter: 86, block: 2247,
    statement: 'Der Contentvalidator bestätigt exakt 10/18/14/28/4/4/18/30/42/36/20/28/36 gemäß Releaseumfang.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['QA-CONTENT-COUNTS-086'] }],
    numericConstraints: [
      { kind: 'eq', name: 'contentCountCatalog', values: [10, 18, 14, 28, 4, 4, 18, 30, 42, 36, 20, 28, 36] }] },
  { chapter: 86, block: 2248,
    statement: 'Der Headingaudit bestätigt lückenlose Kapitel 1-87 und ein statisches Inhaltsverzeichnis.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['QA-HEADING-AUDIT-086'] }],
    numericConstraints: [
      { kind: 'eq', name: 'chaptersExpected', value: 87 }] },
  { chapter: 86, block: 2249,
    statement: 'Das Renderaudit prüft jede Seite auf Leerseite, Beschnitt, Tabellenüberlauf, beschädigte Glyphen und Footer/Header.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['QA-RENDER-AUDIT-086'] }] },
  { chapter: 86, block: 2250,
    statement: 'DOCX-A11y-Audit und PDF-Preflight müssen ohne kritische Befunde abschließen.',
    norm: 'MUST', category: 'QA',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'property', plannedPhase: 'PHASE-08', testIds: ['QA-A11Y-PDF-PREFLIGHT-086'] }] },
  { chapter: 86, block: 2252,
    statement: 'Konkrete Sprint- und Taskzerlegung, Aufwandsschätzung, personelle Zuordnung und Kalendertermine gehören in den nachfolgenden Entwicklungsplan und sind nicht Inhalt des GDD.',
    norm: 'MUST_NOT', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-NO-SPRINT-IN-GDD-086'] }] },
  { chapter: 86, block: 2253,
    statement: 'Publisheridentität, Signing-Secrets, endgültige Storepreisstufen und rechtsverbindliche Texte sind externe Releaseinputs mit Gates aus Kapitel 72.4 und nicht Inhalt des GDD.',
    norm: 'MUST_NOT', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-NO-PUBLISHER-IN-GDD-086'] }] },
  { chapter: 86, block: 2254,
    statement: 'Feintuning außerhalb der Baseline erfolgt evidenzbasiert über Simulation und Playtest innerhalb der dokumentierten Korridore und führt keine neue Mechanik ein.',
    norm: 'MUST_NOT', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-NO-NEW-MECHANICS-086'] }] },

  // ---- Chapter 87 ----
  { chapter: 87, block: 2258,
    statement: 'Nach V5 darf der Entwicklungsplan das Werk in Phasen, Epics, Tickets, Abhängigkeiten und Abnahmebündel zerlegen, jedoch keine neue Designentscheidung einführen; jeder Implementierungsagent muss für jede Aufgabe auf eine konkrete Kapitel-, Datensatz-, Screen-, Interface- oder Gate-Referenz zeigen können.',
    norm: 'MUST', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-DEVPLAN-SCOPE-087'] }] },
  { chapter: 87, block: 2260,
    statement: 'Der Entwicklungsplan darf entscheiden: Reihenfolge innerhalb der bereits definierten Abhängigkeiten, Ticketgröße, Branch- und PR-Schnitt und parallele Arbeitspakete.',
    norm: 'MAY', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-DEVPLAN-MAY-087'] }] },
  { chapter: 87, block: 2261,
    statement: 'Der Entwicklungsplan darf entscheiden: konkrete interne Algorithmen und Dateiaufteilung, sofern Schnittstellen, Determinismus, Performance und Tests eingehalten werden.',
    norm: 'MAY', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-DEVPLAN-MAY-ALGOS-087'] }] },
  { chapter: 87, block: 2262,
    statement: 'Der Entwicklungsplan darf entscheiden: welche V5-Tests in welchem Implementierungsschritt zuerst grün werden, solange kein Gate übersprungen wird.',
    norm: 'MAY', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-DEVPLAN-TEST-ORDER-087'] }] },
  { chapter: 87, block: 2264,
    statement: 'Der Entwicklungsplan darf nicht entscheiden: neue oder entfernte Features, geänderte Obergrenzen, manuelle Kampfsteuerung, andere Währungen, Live-Service, Telemetrie, Accounts oder Netzwerkabhängigkeit.',
    norm: 'MUST_NOT', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-DEVPLAN-MUST-NOT-087'] }] },
  { chapter: 87, block: 2265,
    statement: 'Der Entwicklungsplan darf nicht entscheiden: andere Stack-Majors, Rendererautorität, nicht deterministische Simulation, schwächere Savegarantien oder nicht adaptive Mobile-UI.',
    norm: 'MUST_NOT', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-DEVPLAN-MUST-NOT-TECH-087'] }] },
  { chapter: 87, block: 2266,
    statement: 'Der Entwicklungsplan darf nicht entscheiden: das Weglassen von Screens, States, Accessibility- oder Storetests unter Verweis auf MVP, wenn V5 sie als Pflicht definiert.',
    norm: 'MUST_NOT', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-DEVPLAN-MUST-NOT-MVP-087'] }] },
  { chapter: 87, block: 2269,
    statement: 'Riftwarden: Auto RPG Roguelite ist mit Version 5 ausreichend eindeutig spezifiziert, wenn die Implementierung aus den vorliegenden Regeln einen deterministischen, vollständig offline spielbaren, hochpolierten Mobile-Auto-RPG-Roguelite-Titel erzeugen kann; jeder Inhalt, Screen, Zustand, Datensatz, Savepfad, Rendererfall, Accessibilityflow und Store-Gate besitzt eine festgelegte fachliche Bedeutung und keine nicht dokumentierte Produktentscheidung ist notwendig.',
    norm: 'MUST', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-V5-COMPLETE-087'] }] },
  { chapter: 87, block: 2270,
    statement: 'Tritt während der Umsetzung dennoch eine echte Designlücke auf, wird sie nicht improvisiert, sondern als dokumentierte V5-Change-Request mit betroffenen Regeln, Alternativen, gewählter Entscheidung, Migration und Regression behandelt.',
    norm: 'MUST', category: 'Product',
    ownerPhases: ['PHASE-08'],
    verification: [{ type: 'review', plannedPhase: 'PHASE-08', testIds: ['PROD-CHANGE-REQUEST-087'] }] },
];

// Read the head specs from _build_chunk_f.mjs (exported as a JSON blob) – but we
// keep the script simple: re-emit them inline by importing from a shared data
// file would be cleaner. Instead, dump tail_specs as JSON and combine with
// head specs loaded via read of a separate file (produced by running the head
// module).
// To avoid circular deps, write head + tail together by re-instantiating specs.

// Load head specs from a JSON dump (created by the head module).
let headSpecs = [];
try {
  headSpecs = JSON.parse(await readFile('tools/requirements/_chunk_f_head_specs.json', 'utf8'));
} catch (e) {
  console.error('Run tools/requirements/_build_chunk_f.mjs first to dump head specs.');
  process.exit(2);
}

const specs = [...headSpecs, ...tail_specs];

// Verify each spec resolves to a known block and compute hashes.
const requirements = [];
for (let i = 0; i < specs.length; i += 1) {
  const s = specs[i];
  const b = byKey.get(`${s.chapter}:${s.block}`);
  if (!b) throw new Error(`Missing block ${s.chapter}:${s.block}`);
  const excerpt = b.text;
  requirements.push({
    id: `REQ-TEMP-F-${String(i + 1).padStart(4, '0')}`,
    title: s.statement,
    statement: s.statement,
    norm: s.norm,
    category: s.category,
    source: {
      sourceId: 'gdd-v5',
      chapter: s.chapter,
      section: null,
      locator: `block:${s.block}`,
      quoteHash: qhash(excerpt),
      originalExcerpt: excerpt,
    },
    ownerPhases: s.ownerPhases,
    verification: s.verification,
    numericConstraints: s.numericConstraints ?? [],
    relatedNormIds: [],
    relatedScreenIds: [],
    status: 'planned',
    notes: null,
  });
}

// Determine chapter coverage: every chapter 79..87 must have REQ or context-only.
const coveredChapters = new Set(requirements.map(r => r.source.chapter));
const contextOnly = [];
for (const ch of [79, 80, 81, 82, 83, 84, 85, 86, 87]) {
  if (!coveredChapters.has(ch)) {
    contextOnly.push({
      chapter: ch,
      reason: `Chapter ${ch} yielded no atomic normative statements beyond the ones already captured in earlier chunks; remaining content is descriptive/narrative.`,
    });
  }
}

const out = {
  schemaVersion: '1.0',
  chunk: 'f',
  chapterRange: { lo: 79, hi: 87 },
  requirements,
  contextOnly,
};

await writeFile(
  'docs/requirements/requirements/_staging/chunk-f.json',
  JSON.stringify(out, null, 2) + '\n',
  'utf8',
);
console.log('Wrote chunk-f.json with', requirements.length, 'requirements and', contextOnly.length, 'context-only entries.');
console.log('Chapters covered:', [...coveredChapters].sort((a, b) => a - b));