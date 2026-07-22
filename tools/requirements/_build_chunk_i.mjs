#!/usr/bin/env node
// Build chunk-i.json (chapters 48-58) staging file.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function sha(s) { return 'sha256:' + createHash('sha256').update(s, 'utf8').digest('hex'); }

const requirements = [];

// helper
function add(req) {
  requirements.push({
    id: req.id,
    title: req.title,
    statement: req.statement,
    norm: req.norm,
    category: req.category,
    source: {
      sourceId: 'gdd-v5',
      chapter: req.chapter,
      section: req.section ?? null,
      locator: req.locator,
      quoteHash: sha(req.excerpt),
      originalExcerpt: req.excerpt,
    },
    ownerPhases: req.ownerPhases,
    verification: req.verification,
    numericConstraints: req.numericConstraints ?? [],
    relatedNormIds: [],
    relatedScreenIds: [],
    status: 'planned',
    notes: null,
  });
}

// =============== CHAPTER 48 ===============
// 48. Priority rules: explicit V4 clarification > older V3; concrete unit/boss rule > global; safety/save/store > comfort; hard upper limit > bonus; deterministic tie-break > random.
add({
  id: 'REQ-TEMP-I-0001', chapter: 48, locator: 'block:1547',
  title: 'Konflikt-Prioritätsreihenfolge: V4-Klarstellung > V3; konkrete Einheiten/Bossregel > global; Sicherheit/Save/Store > Komfort; harte Obergrenze > Bonus; deterministischer Tie-Break > Zufall.',
  statement: 'Bei Widersprüchen gilt die folgende Prioritätsreihenfolge: explizite V4-Klarstellung vor älterer V3-Formulierung; konkrete Einheiten- oder Bossregel vor globaler Standardregel; Sicherheits-, Save- und Store-Regel vor Komfortregel; feste Obergrenze vor Bonus; deterministischer Tie-Break vor zufälliger Auswahl.',
  excerpt: 'Bei Widersprüchen gilt die folgende Prioritätsreihenfolge: explizite V4-Klarstellung vor älterer V3-Formulierung; konkrete Einheiten- oder Bossregel vor globaler Standardregel; Sicherheits-, Save- und Store-Regel vor Komfortregel; feste Obergrenze vor Bonus; deterministischer Tie-Break vor zufälliger Auswahl.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-PRIORITY-ORDER-048'] }],
});

// 48. No implementing agent may derive new content, currencies, slots, or live systems from unclear wording.
add({
  id: 'REQ-TEMP-I-0002', chapter: 48, locator: 'block:1547',
  title: 'Kein Implementierungsagent darf aus unklaren Formulierungen neue Inhalte, Währungen, Slots oder Live-Systeme ableiten.',
  statement: 'Kein Implementierungsagent darf aus einer unklaren Formulierung neue Inhalte, neue Währungen, weitere Slots oder zusätzliche Live-Systeme ableiten.',
  excerpt: 'Kein Implementierungsagent darf aus einer unklaren Formulierung neue Inhalte, neue Währungen, weitere Slots oder zusätzliche Live-Systeme ableiten.',
  norm: 'MUST_NOT', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-NO-NEW-CONTENT-048'] }],
});

// 48.2.1 Tick collects inputs without state change
add({
  id: 'REQ-TEMP-I-0003', chapter: 48, locator: 'block:1550',
  title: 'Simulations-Tick sammelt Eingaben und geplante Ereignisse zuerst und verändert den Zustand noch nicht.',
  statement: 'Ein Simulations-Tick sammelt zunächst Eingaben und bereits geplante Ereignisse, verändert aber noch keinen Zustand.',
  excerpt: 'Ein Simulations-Tick sammelt zunächst Eingaben und bereits geplante Ereignisse, verändert aber noch keinen Zustand.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-TICK-PHASE-048'] }],
});

// 48.2.2 Battle end/phase transitions first; boss phase change prevents damage across phase boundary only with explicit transition lock.
add({
  id: 'REQ-TEMP-I-0004', chapter: 48, locator: 'block:1551',
  title: 'Zuerst werden Kampfende- und Phasenübergangsbedingungen geprüft; Bossphasenwechsel sperrt Schaden über Phasengrenze nur bei ausdrücklicher Übergangssperre.',
  statement: 'Zuerst werden Kampfende- und Phasenübergangsbedingungen geprüft. Ein Bossphasenwechsel verhindert Schaden über die Phasengrenze nur, wenn die Bossdefinition ausdrücklich eine Übergangssperre besitzt.',
  excerpt: 'Zuerst werden Kampfende- und Phasenübergangsbedingungen geprüft. Ein Bossphasenwechsel verhindert Schaden über die Phasengrenze nur, wenn die Bossdefinition ausdrücklich eine Übergangssperre besitzt.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-PHASE-PRIO-048'] }],
});

// 48.2.3 Then revives, death-prevention, shield-before-HP rules
add({
  id: 'REQ-TEMP-I-0005', chapter: 48, locator: 'block:1552',
  title: 'Nach Phasenprüfung werden Wiederbelebungen, Todesverhinderungen und Schild-vor-LP-Regeln aufgelöst.',
  statement: 'Danach werden Wiederbelebungen, Todesverhinderungen und Schild-vor-LP-Regeln aufgelöst.',
  excerpt: 'Danach werden Wiederbelebungen, Todesverhinderungen und Schild-vor-LP-Regeln aufgelöst.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-REVIVE-PRIO-048'] }],
});

// 48.2.4 Then damage/heal/control/movement/summons in event priority
add({
  id: 'REQ-TEMP-I-0006', chapter: 48, locator: 'block:1553',
  title: 'Schaden, Heilung, Kontrolle, Bewegung und Beschwörungen werden in der Ereignispriorität ausgeführt.',
  statement: 'Danach werden Schaden, Heilung, Kontrolle, Bewegung und Beschwörungen in der Ereignispriorität ausgeführt.',
  excerpt: 'Danach werden Schaden, Heilung, Kontrolle, Bewegung und Beschwörungen in der Ereignispriorität ausgeführt.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-EVENT-PRIO-048'] }],
});

// 48.2.5 Equal-rank events sort by scheduledTick, priority, sourceEntityId, abilityId, eventSequence; array/render order is never a tie-break.
add({
  id: 'REQ-TEMP-I-0007', chapter: 48, locator: 'block:1554',
  title: 'Gleichrangige Ereignisse werden nach scheduledTick, priority, sourceEntityId, abilityId, eventSequence sortiert; Entity-IDs sind stabil, Array-/Renderreihenfolge ist niemals Tie-Break.',
  statement: 'Gleichrangige Ereignisse werden nach scheduledTick, priority, sourceEntityId, abilityId und eventSequence sortiert. Entity-IDs sind stabil; Array- oder Renderreihenfolge ist niemals ein Tie-Break.',
  excerpt: 'Gleichrangige Ereignisse werden nach scheduledTick, priority, sourceEntityId, abilityId und eventSequence sortiert. Entity-IDs sind stabil; Array- oder Renderreihenfolge ist niemals ein Tie-Break.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-TIEBREAK-048'] }],
});

// 48.2.6 If a side has no regular combat-capable unit on the same tick: boss/mission special rule, else double defeat. Double defeat counts as player defeat and yields no victory loot.
add({
  id: 'REQ-TEMP-I-0008', chapter: 48, locator: 'block:1555',
  title: 'Erreicht eine Seite im selben Tick den Zustand ohne reguläre kampffähige Einheit, gilt Boss-/Missionssonderregel, sonst Doppelniederlage; Doppelniederlage zählt als Niederlage des Spielers ohne Siegloot.',
  statement: 'Erreicht eine Seite im selben Tick den Zustand ohne reguläre kampffähige Einheit, gilt: Boss-/Missionssonderregel, sonst Doppelniederlage. Eine Doppelniederlage zählt als Niederlage des Spielers und erzeugt keinen Siegloot.',
  excerpt: 'Erreicht eine Seite im selben Tick den Zustand ohne reguläre kampffähige Einheit, gilt: Boss-/Missionssonderregel, sonst Doppelniederlage. Eine Doppelniederlage zählt als Niederlage des Spielers und erzeugt keinen Siegloot.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-DOUBLE-DEFEAT-048'] }],
});

// 48.3.1 Exactly six active summon slots per side
add({
  id: 'REQ-TEMP-I-0009', chapter: 48, locator: 'block:1557',
  title: 'Jede Seite besitzt exakt sechs aktive Beschwörungs-Slots.',
  statement: 'Jede Seite besitzt exakt sechs aktive Beschwörungs-Slots.',
  excerpt: 'Jede Seite besitzt exakt sechs aktive Beschwörungs-Slots.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-SUMMON-SLOTS-048'] }],
  numericConstraints: [{ kind: 'exact', name: 'summonSlotsPerSide', value: 6 }],
});

// 48.3.2 Stationary constructions count toward limit only if definition sets countsTowardSummonLimit=true
add({
  id: 'REQ-TEMP-I-0010', chapter: 48, locator: 'block:1557',
  title: 'Stationäre Konstruktionen zählen zum Beschwörungslimit nur, wenn ihre Definition countsTowardSummonLimit=true setzt.',
  statement: 'Stationäre Konstruktionen zählen mit, wenn ihre Definition countsTowardSummonLimit=true setzt.',
  excerpt: 'Stationäre Konstruktionen zählen mit, wenn ihre Definition countsTowardSummonLimit=true setzt.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-SUMMON-CONSTR-048'] }],
});

// 48.3.3 Multi-unit abilities fill free slots in defined spawn order; un-spawned units produce no explosion or OnSpawn effect
add({
  id: 'REQ-TEMP-I-0011', chapter: 48, locator: 'block:1558',
  title: 'Mehrfacheinheiten-Fähigkeiten belegen freie Slots in Spawn-Reihenfolge; nicht erzeugte Einheiten verursachen weder Explosion noch OnSpawn-Effekt.',
  statement: 'Kann eine Fähigkeit mehrere Einheiten erzeugen, werden freie Slots in der definierten Spawn-Reihenfolge belegt. Nicht erzeugte Einheiten verursachen weder Explosion noch OnSpawn-Effekt.',
  excerpt: 'Kann eine Fähigkeit mehrere Einheiten erzeugen, werden freie Slots in der definierten Spawn-Reihenfolge belegt. Nicht erzeugte Einheiten verursachen weder Explosion noch OnSpawn-Effekt.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-SUMMON-ORDER-048'] }],
});

// 48.3.4 Replacement only with replacementPolicy=replace_lower_priority; ties by remaining lifetime, then oldest spawn sequence
add({
  id: 'REQ-TEMP-I-0012', chapter: 48, locator: 'block:1559',
  title: 'Ersatz ist nur mit replacementPolicy=replace_lower_priority erlaubt; ersetzt wird die eigene aktive Beschwörung mit niedrigstem replacementPriority, Gleichstand: kürzeste Restlebenszeit, dann älteste Spawn-Sequenz.',
  statement: 'Ersatz ist nur erlaubt, wenn die Fähigkeit replacementPolicy=replace_lower_priority besitzt. Ersetzt wird die eigene aktive Beschwörung mit niedrigstem replacementPriority; Gleichstand: kürzeste Restlebenszeit, dann älteste Spawn-Sequenz.',
  excerpt: 'Ersatz ist nur erlaubt, wenn die Fähigkeit replacementPolicy=replace_lower_priority besitzt. Ersetzt wird die eigene aktive Beschwörung mit niedrigstem replacementPriority; Gleichstand: kürzeste Restlebenszeit, dann älteste Spawn-Sequenz.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-SUMMON-REPLACE-048'] }],
});

// 48.3.5 Replaced entity gets expirationReason=replaced and triggers no defeated-only effects
add({
  id: 'REQ-TEMP-I-0013', chapter: 48, locator: 'block:1560',
  title: 'Ersetzte Wesen erhalten expirationReason=replaced und lösen keine defeated-only Effekte aus; explizit auf expiration reagierende Effekte dürfen auslösen.',
  statement: 'Ein ersetztes Wesen erhält expirationReason=replaced und löst keine Effekte aus, die nur bei defeated gelten. Ausdrücklich auf expiration reagierende Effekte dürfen auslösen.',
  excerpt: 'Ein ersetztes Wesen erhält expirationReason=replaced und löst keine Effekte aus, die nur bei defeated gelten. Ausdrücklich auf expiration reagierende Effekte dürfen auslösen.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-EXP-REASON-048'] }],
});

// 48.3.6 Summons can defeat an enemy but battle ends immediately if their side has no regular unit; after end no trailing projectiles are resolved
add({
  id: 'REQ-TEMP-I-0014', chapter: 48, locator: 'block:1561',
  title: 'Beschwörungen können Gegner besiegen, aber Kampf endet sofort wenn ihre Seite keine reguläre Einheit mehr besitzt; nach Kampfende werden keine nachlaufenden Geschosse gewertet.',
  statement: 'Beschwörungen können einen Gegner besiegen, aber der Kampf endet sofort, wenn ihre Seite keine reguläre Einheit mehr besitzt; nach Kampfende werden keine nachlaufenden Geschosse gewertet.',
  excerpt: 'Beschwörungen können einen Gegner besiegen, aber der Kampf endet sofort, wenn ihre Seite keine reguläre Einheit mehr besitzt; nach Kampfende werden keine nachlaufenden Geschosse gewertet.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-SUMMON-END-048'] }],
});

// 48.4.1 Stun/silence/knockback/forced lane change = hard control; slow/weaken/mark/burn/poison = soft
add({
  id: 'REQ-TEMP-I-0015', chapter: 48, locator: 'block:1563',
  title: 'Betäubung, Stille, Rückstoß und erzwungener Bahnwechsel sind harte Kontrolle; Verlangsamung, Schwächung, Markierung, Brennen und Gift sind weiche Effekte.',
  statement: 'Betäubung, Stille, Rückstoß und erzwungener Bahnwechsel sind harte Kontrolle. Verlangsamung, Schwächung, Markierung, Brennen und Gift sind weiche Effekte.',
  excerpt: 'Betäubung, Stille, Rückstoß und erzwungener Bahnwechsel sind harte Kontrolle. Verlangsamung, Schwächung, Markierung, Brennen und Gift sind weiche Effekte.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-CONTROL-CLASS-048'] }],
});

// 48.4.2 Control resistance reduces only duration, never the visible trigger; hard control reduced to <=0.15s becomes a 0.15s interrupt pulse
add({
  id: 'REQ-TEMP-I-0016', chapter: 48, locator: 'block:1564',
  title: 'Kontrollresistenz reduziert nur Dauer, nie die sichtbare Auslösung; auf <=0,15 s reduzierte harte Kontrolle wird als 0,15-s-Unterbrechungsimpuls dargestellt.',
  statement: 'Kontrollresistenz reduziert nur Dauer, nie die sichtbare Auslösung. Eine auf 0,15 s oder weniger reduzierte harte Kontrolle wird als 0,15-s-Unterbrechungsimpuls dargestellt.',
  excerpt: 'Kontrollresistenz reduziert nur Dauer, nie die sichtbare Auslösung. Eine auf 0,15 s oder weniger reduzierte harte Kontrolle wird als 0,15-s-Unterbrechungsimpuls dargestellt.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-RESIST-INTERRUPT-048'] }],
  numericConstraints: [{ kind: 'max', name: 'hardControlReducedToSeconds', value: 0.15, unit: 's' }],
});

// 48.4.3 Phase transitions clean hard control but do not interrupt enemy projectiles; already fired projectiles may hit unless phase is explicitly invulnerable
add({
  id: 'REQ-TEMP-I-0017', chapter: 48, locator: 'block:1565',
  title: 'Phasenübergänge reinigen harte Kontrolle, unterbrechen gegnerische Projektile jedoch nicht; bereits abgeschossene Geschosse dürfen treffen sofern die Phase nicht ausdrücklich unverwundbar ist.',
  statement: 'Phasenübergänge reinigen harte Kontrolle, unterbrechen gegnerische Projektile jedoch nicht. Bereits abgeschossene Geschosse dürfen treffen, sofern die Phase nicht ausdrücklich unverwundbar ist.',
  excerpt: 'Phasenübergänge reinigen harte Kontrolle, unterbrechen gegnerische Projektile jedoch nicht. Bereits abgeschossene Geschosse dürfen treffen, sofern die Phase nicht ausdrücklich unverwundbar ist.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-PHASE-PROJECTILE-048'] }],
});

// 48.4.4 Bosses cannot be lane-changed by normal effects; knockback becomes 0.25s interrupt unless boss ability is uninterruptible
add({
  id: 'REQ-TEMP-I-0018', chapter: 48, locator: 'block:1566',
  title: 'Bosse können nicht von normalen Effekten die Bahn wechseln; Rückstoß wird in 0,25 s Unterbrechung umgewandelt, sofern keine Bossfähigkeit uninterruptible markiert ist.',
  statement: 'Bosse können nicht von normalen Effekten die Bahn wechseln. Rückstoß wird in 0,25 s Unterbrechung umgewandelt, sofern keine Bossfähigkeit gerade als uninterruptible markiert ist.',
  excerpt: 'Bosse können nicht von normalen Effekten die Bahn wechseln. Rückstoß wird in 0,25 s Unterbrechung umgewandelt, sofern keine Bossfähigkeit gerade als uninterruptible markiert ist.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-BOSS-KNOCKBACK-048'] }],
  numericConstraints: [{ kind: 'exact', name: 'knockbackInterruptSeconds', value: 0.25, unit: 's' }],
});

// 48.4.5 Multiple cleanses in same tick remove effect only once; first sorted cleanse gets stat credit
add({
  id: 'REQ-TEMP-I-0019', chapter: 48, locator: 'block:1567',
  title: 'Mehrere Reinigungen im selben Tick entfernen einen Effekt nur einmal; die Quelle der zuerst sortierten Reinigung erhält die Statistikgutschrift.',
  statement: 'Mehrere Reinigungen im selben Tick entfernen einen Effekt nur einmal. Die Quelle der zuerst sortierten Reinigung erhält die Statistikgutschrift.',
  excerpt: 'Mehrere Reinigungen im selben Tick entfernen einen Effekt nur einmal. Die Quelle der zuerst sortierten Reinigung erhält die Statistikgutschrift.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-CLEANSE-ONCE-048'] }],
});

// 48.5.1 Permanent inventory has no total slot limit; duplicate converts to defined gold value
add({
  id: 'REQ-TEMP-I-0020', chapter: 48, locator: 'block:1569',
  title: 'Permanentes Inventar hat keine Gesamtplatzgrenze; ein dauerhafter Gegenstand wird nur einmal besessen, ein Duplikat wird unmittelbar in den im Gegenstandsdatensatz definierten Goldwert umgewandelt.',
  statement: 'Das permanente Inventar besitzt keine Gesamtplatzgrenze. Ein Gegenstand kann nur einmal dauerhaft besessen werden; ein Duplikat wird unmittelbar in den im Gegenstandsdatensatz definierten Goldwert umgewandelt.',
  excerpt: 'Das permanente Inventar besitzt keine Gesamtplatzgrenze. Ein Gegenstand kann nur einmal dauerhaft besessen werden; ein Duplikat wird unmittelbar in den im Gegenstandsdatensatz definierten Goldwert umgewandelt.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-03'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-03', testIds: ['UT-INVENTORY-NO-LIMIT-048'] }],
});

// 48.5.2 Polish is a boolean permanent state per item ID; polished duplicate yields no more gold
add({
  id: 'REQ-TEMP-I-0021', chapter: 48, locator: 'block:1570',
  title: 'Politur ist ein boolescher permanenter Zustand je Gegenstands-ID; ein poliertes Duplikat erzeugt nicht mehr Gold als ein unpoliertes Duplikat.',
  statement: 'Politur ist ein boolescher permanenter Zustand je Gegenstands-ID. Ein poliertes Duplikat erzeugt nicht mehr Gold als ein unpoliertes Duplikat.',
  excerpt: 'Politur ist ein boolescher permanenter Zustand je Gegenstands-ID. Ein poliertes Duplikat erzeugt nicht mehr Gold als ein unpoliertes Duplikat.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-03'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-03', testIds: ['UT-POLISH-BOOL-048'] }],
});

// 48.5.3 Max 8 different active relics; 9th forces replace/refuse; refuse yields 20% of relic vendor value in cycle/dungeon currency
add({
  id: 'REQ-TEMP-I-0022', chapter: 48, locator: 'block:1571',
  title: 'Temporäre Relikte: maximal acht unterschiedliche aktive Karten; ein neuntes Relikt öffnet Ersetzen oder Ablehnen; Ablehnen gibt 20 % des Relikt-Händlerwerts in Zyklus-/Dungeonwährung.',
  statement: 'Temporäre Relikte dürfen bis zu acht unterschiedliche aktive Karten besitzen. Ein neuntes Relikt öffnet zwingend Ersetzen oder Ablehnen; Ablehnen gibt 20% des Relikt-Händlerwerts in Zyklus-/Dungeonwährung.',
  excerpt: 'Temporäre Relikte dürfen bis zu acht unterschiedliche aktive Karten besitzen. Ein neuntes Relikt öffnet zwingend Ersetzen oder Ablehnen; Ablehnen gibt 20% des Relikt-Händlerwerts in Zyklus-/Dungeonwährung.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-03'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-03', testIds: ['UT-RELIC-CAP-048'] }],
  numericConstraints: [
    { kind: 'max', name: 'activeRelics', value: 8 },
    { kind: 'exact', name: 'refusePctOfVendorValue', value: 20, unit: '%' },
  ],
});

// 48.5.4 Rewards are persistent committed before next navigation; process abort between choice and animation loads already committed state and only replays finish animation
add({
  id: 'REQ-TEMP-I-0023', chapter: 48, locator: 'block:1572',
  title: 'Belohnungen werden vor der nächsten Navigation persistent committed; Prozessabbruch zwischen Wahl und Animation lädt den bereits committed Zustand und zeigt nur die Abschlussanimation erneut.',
  statement: 'Belohnungen werden vor der nächsten Navigation persistent committed. Ein Prozessabbruch zwischen Wahl und Animation lädt den bereits committed Zustand und zeigt nur die Abschlussanimation erneut.',
  excerpt: 'Belohnungen werden vor der nächsten Navigation persistent committed. Ein Prozessabbruch zwischen Wahl und Animation lädt den bereits committed Zustand und zeigt nur die Abschlussanimation erneut.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-03'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-03', testIds: ['IT-REWARD-COMMIT-048'] }],
});

// 48.5.5 First reward blocked by already unlocked content uses documented replacement reward; never random permanent content
add({
  id: 'REQ-TEMP-I-0024', chapter: 48, locator: 'block:1573',
  title: 'Erstbelohnung wegen bereits freigeschaltetem Inhalt wird durch exakt dokumentierte Ersatzbelohnung ersetzt; niemals zufälliger anderer permanenter Inhalt.',
  statement: 'Kann eine Erstbelohnung wegen bereits freigeschaltetem Inhalt nicht erneut vergeben werden, wird exakt die dokumentierte Ersatzbelohnung genutzt; niemals wird zufällig ein anderer permanenter Inhalt vergeben.',
  excerpt: 'Kann eine Erstbelohnung wegen bereits freigeschaltetem Inhalt nicht erneut vergeben werden, wird exakt die dokumentierte Ersatzbelohnung genutzt; niemals wird zufällig ein anderer permanenter Inhalt vergeben.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-03'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-03', testIds: ['UT-FIRSTREWARD-REPLACE-048'] }],
});

// 48.6.1 Explorer/Normal/Veteran apply only to campaign and campaign replay; Ascension uses its own baseline and ignores campaign difficulty
add({
  id: 'REQ-TEMP-I-0025', chapter: 48, locator: 'block:1575',
  title: 'Entdecker/Normal/Veteran gelten nur für Kampagne und Kampagnenwiederholung; Ascension verwendet eigene Baseline und ignoriert Kampagnenschwierigkeit.',
  statement: 'Entdecker, Normal und Veteran gelten nur für Kampagne und Kampagnenwiederholung. Ascension verwendet seine eigene Baseline und ignoriert die Kampagnenschwierigkeit.',
  excerpt: 'Entdecker, Normal und Veteran gelten nur für Kampagne und Kampagnenwiederholung. Ascension verwendet seine eigene Baseline und ignoriert die Kampagnenschwierigkeit.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-04'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-04', testIds: ['IT-DIFF-SCOPE-048'] }],
});

// 48.6.2 Endless Rift uses Normal baseline + depth scaling and optionally already unlocked Ascension rule set; Jenseits must not stack on Endless Rift
add({
  id: 'REQ-TEMP-I-0026', chapter: 48, locator: 'block:1576',
  title: 'Endlose Rift nutzt Normal-Baseline plus Tiefenskalierung und optional gewählten bereits freigeschalteten Ascension-Regelsatz; Jenseitsgrad darf nicht zusätzlich auf Endlose Rift angewendet werden.',
  statement: 'Endlose Rift nutzt Normal-Baseline plus Tiefenskalierung und optional gewählten bereits freigeschalteten Ascension-Regelsatz. Jenseitsgrad darf nicht zusätzlich auf Endlose Rift angewendet werden.',
  excerpt: 'Endlose Rift nutzt Normal-Baseline plus Tiefenskalierung und optional gewählten bereits freigeschalteten Ascension-Regelsatz. Jenseitsgrad darf nicht zusätzlich auf Endlose Rift angewendet werden.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-04'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-04', testIds: ['IT-RIFT-BASELINE-048'] }],
});

// 48.6.3 A battlefield modifier must never fully neutralize a boss core mechanic or make its counter-strategy impossible; encounter validator rejects such combinations
add({
  id: 'REQ-TEMP-I-0027', chapter: 48, locator: 'block:1577',
  title: 'Ein Schlachtfeldmodifikator darf nie eine Bosskernmechanik vollständig neutralisieren oder deren Gegenstrategie unmöglich machen; der Encounter-Validator lehnt solche Kombinationen ab.',
  statement: 'Ein Schlachtfeldmodifikator darf nie eine Bosskernmechanik vollständig neutralisieren oder deren angekündigte Gegenstrategie unmöglich machen. Der Encounter-Validator lehnt solche Kombinationen ab.',
  excerpt: 'Ein Schlachtfeldmodifikator darf nie eine Bosskernmechanik vollständig neutralisieren oder deren angekündigte Gegenstrategie unmöglich machen. Der Encounter-Validator lehnt solche Kombinationen ab.',
  norm: 'MUST_NOT', category: 'Content',
  ownerPhases: ['PHASE-04'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-04', testIds: ['ST-ENCOUNTER-VALID-048'] }],
});

// 48.7.1 Generator keeps history: last 3 map profiles, last 8 events, last 6 normal formations, last 4 modifiers per mode
add({
  id: 'REQ-TEMP-I-0028', chapter: 48, locator: 'block:1579',
  title: 'Generator führt pro Modus Verlauf: letzte drei Kartenprofile, letzte acht Ereignisse, letzte sechs normale Formationen, letzte vier Modifikatoren.',
  statement: 'Der Generator führt pro Modus einen Verlauf der letzten drei Kartenprofile, letzten acht Ereignisse, letzten sechs normalen Formationen und letzten vier Modifikatoren.',
  excerpt: 'Der Generator führt pro Modus einen Verlauf der letzten drei Kartenprofile, letzten acht Ereignisse, letzten sechs normalen Formationen und letzten vier Modifikatoren.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-04'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-04', testIds: ['UT-GEN-HISTORY-048'] }],
  numericConstraints: [
    { kind: 'exact', name: 'mapHistorySize', value: 3 },
    { kind: 'exact', name: 'eventHistorySize', value: 8 },
    { kind: 'exact', name: 'formationHistorySize', value: 6 },
    { kind: 'exact', name: 'modifierHistorySize', value: 4 },
  ],
});

// 48.7.2 Identical event ID prohibited within expedition; outside only after 4 other events, if pool >= 5
add({
  id: 'REQ-TEMP-I-0029', chapter: 48, locator: 'block:1580',
  title: 'Identische Ereignis-ID ist innerhalb einer Expedition verboten; außerhalb erst nach vier anderen Ereignissen, sofern der Pool mindestens fünf gültige Einträge besitzt.',
  statement: 'Identische Ereignis-ID ist innerhalb einer Expedition verboten. Außerhalb darf sie erst nach vier anderen Ereignissen erneut erscheinen, sofern der Pool mindestens fünf gültige Einträge besitzt.',
  excerpt: 'Identische Ereignis-ID ist innerhalb einer Expedition verboten. Außerhalb darf sie erst nach vier anderen Ereignissen erneut erscheinen, sofern der Pool mindestens fünf gültige Einträge besitzt.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-04'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-04', testIds: ['UT-EVENT-COOLDOWN-048'] }],
  numericConstraints: [
    { kind: 'min', name: 'eventsBetweenRepeats', value: 4 },
    { kind: 'min', name: 'validPoolSize', value: 5 },
  ],
});

// 48.7.3 If pool cannot satisfy the rule, choose the least repetition penalty; never roll infinitely; max 50 attempts then deterministic fallback profile
add({
  id: 'REQ-TEMP-I-0030', chapter: 48, locator: 'block:1581',
  title: 'Kann ein Pool die Regel nicht erfüllen, wird die geringste Wiederholungsstrafe gewählt; Karte darf nicht unendlich neu würfeln; maximal 50 Generierungsversuche, danach deterministisches Fallback-Profil.',
  statement: 'Kann ein Pool wegen Freischaltungen oder Ausschlüssen die Regel nicht erfüllen, wird die geringste Wiederholungsstrafe gewählt; die Karte darf niemals unendlich neu würfeln. Maximal 50 Generierungsversuche, danach deterministisches Fallback-Profil.',
  excerpt: 'Kann ein Pool wegen Freischaltungen oder Ausschlüssen die Regel nicht erfüllen, wird die geringste Wiederholungsstrafe gewählt; die Karte darf niemals unendlich neu würfeln. Maximal 50 Generierungsversuche, danach deterministisches Fallback-Profil.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-04'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-04', testIds: ['UT-GEN-MAX-ATTEMPTS-048'] }],
  numericConstraints: [{ kind: 'exact', name: 'maxGenerationAttempts', value: 50 }],
});

// 48.7.4 Fallback profile: 6 levels, 1 normal combat, 1 merchant/recruit, 1 elite, 1 anchor, 1 final prep, target; always reachable; no double modifiers
add({
  id: 'REQ-TEMP-I-0031', chapter: 48, locator: 'block:1582',
  title: 'Fallback-Profil enthält genau sechs Ebenen, einen normalen Kampf, einen Händler oder Rekrutierungsknoten, einen Elitekampf, einen Anker, eine letzte Vorbereitung und das Ziel; immer erreichbar; keine Doppelmodifikatoren.',
  statement: 'Das Fallback-Profil enthält genau sechs Ebenen, einen normalen Kampf, einen Händler oder Rekrutierungsknoten, einen Elitekampf, einen Anker, eine letzte Vorbereitung und das Ziel. Es ist immer erreichbar und verwendet keine Doppelmodifikatoren.',
  excerpt: 'Das Fallback-Profil enthält genau sechs Ebenen, einen normalen Kampf, einen Händler oder Rekrutierungsknoten, einen Elitekampf, einen Anker, eine letzte Vorbereitung und das Ziel. Es ist immer erreichbar und verwendet keine Doppelmodifikatoren.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-04'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-04', testIds: ['UT-FALLBACK-PROFILE-048'] }],
  numericConstraints: [{ kind: 'exact', name: 'fallbackLevelCount', value: 6 }],
});

// 48.7.5 Generator errors logged locally; player only sees "Die Rift wurde stabilisiert"; progress and seed retained
add({
  id: 'REQ-TEMP-I-0032', chapter: 48, locator: 'block:1583',
  title: 'Generatorfehler werden lokal protokolliert; der Spieler sieht nur "Die Rift wurde stabilisiert"; Fortschritt und Seed bleiben erhalten.',
  statement: 'Generatorfehler werden lokal protokolliert, aber der Spieler sieht nur „Die Rift wurde stabilisiert“; Fortschritt und Seed bleiben erhalten.',
  excerpt: 'Generatorfehler werden lokal protokolliert, aber der Spieler sieht nur „Die Rift wurde stabilisiert“; Fortschritt und Seed bleiben erhalten.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-04'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-04', testIds: ['IT-GEN-ERROR-UI-048'] }],
});

// =============== CHAPTER 49 ===============
// 49. App built as locally bundled web app in Capacitor 8; React renders all menus/overlays; PixiJS renders only battle and decorative HQ scenes; simulation is pure TS lib
add({
  id: 'REQ-TEMP-I-0033', chapter: 49, locator: 'block:1593',
  title: 'Release-App wird als lokal gebündelte Web-App in Capacitor 8 gebaut; React rendert Menüs/Overlays; PixiJS rendert ausschließlich Kampffeld und dekorative HQ-Szenen; Simulation ist eine pure TypeScript-Bibliothek ohne React-, DOM-, Pixi- oder Native-Abhängigkeit.',
  statement: 'Die Release-App wird als lokal gebündelte Web-App in Capacitor 8 gebaut. React rendert sämtliche Menüs und Overlays; PixiJS rendert ausschließlich das Kampffeld und dekorative HQ-Szenen. Die Simulation ist eine pure TypeScript-Bibliothek ohne React-, DOM-, Pixi- oder Native-Abhängigkeit.',
  excerpt: 'Die Release-App wird als lokal gebündelte Web-App in Capacitor 8 gebaut. React rendert sämtliche Menüs und Overlays; PixiJS rendert ausschließlich das Kampffeld und dekorative HQ-Szenen. Die Simulation ist eine pure TypeScript-Bibliothek ohne React-, DOM-, Pixi- oder Native-Abhängigkeit.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-01', testIds: ['ST-STACK-SEP-049'] }],
});

// 49.1 Patch/minor versions frozen at bootstrap; agent must not swap major version without ADR, full test, and store build
add({
  id: 'REQ-TEMP-I-0034', chapter: 49, locator: 'block:1595',
  title: 'Patch- und Minor-Versionen werden beim Repository-Bootstrap auf die neuesten kompatiblen stabilen Releases festgesetzt und im Lockfile eingefroren; kein Major-Version-Swap ohne ADR, vollständigen Testlauf und Store-Build.',
  statement: 'Versionsregel: Patch- und Minor-Versionen werden beim Repository-Bootstrap auf die neuesten kompatiblen stabilen Releases festgesetzt und anschließend im Lockfile eingefroren. Ein Agent darf keine Major-Version austauschen, ohne ADR, vollständigen Testlauf und Store-Build.',
  excerpt: 'Versionsregel: Patch- und Minor-Versionen werden beim Repository-Bootstrap auf die neuesten kompatiblen stabilen Releases festgesetzt und anschließend im Lockfile eingefroren. Ein Agent darf keine Major-Version austauschen, ohne ADR, vollständigen Testlauf und Store-Build.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-01', testIds: ['ST-VERSION-PIN-049'] }],
});

// 49.2 Publisher must confirm identifiers before first store upload; after upload must not change them
add({
  id: 'REQ-TEMP-I-0035', chapter: 49, locator: 'block:1597',
  title: 'Publisher bestätigt Produktionskennungen vor dem ersten Store-Upload einmal; danach verbindliche Entwicklungskennungen, nach Upload unveränderlich.',
  statement: 'Der Publisher muss die Kennungen vor dem ersten Store-Upload einmal bestätigen. Bis dahin sind sie verbindliche Entwicklungskennungen; nach erstem Upload dürfen sie nicht geändert werden.',
  excerpt: 'Der Publisher muss die Kennungen vor dem ersten Store-Upload einmal bestätigen. Bis dahin sind sie verbindliche Entwicklungskennungen; nach erstem Upload dürfen sie nicht geändert werden.',
  norm: 'MUST', category: 'Store',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-01', testIds: ['REV-PUB-IDS-049'] }],
});

// =============== CHAPTER 50 ===============
// 50.2 game/sim may only import standard TS and shared pure types; no window, Date.now, Math.random, DOM, React, Pixi, Capacitor
add({
  id: 'REQ-TEMP-I-0036', chapter: 50, locator: 'block:1608',
  title: 'game/sim darf nur Standard-TypeScript und gemeinsame reine Typen importieren; kein Zugriff auf window, Date.now, Math.random, DOM, React, Pixi oder Capacitor.',
  statement: 'game/sim darf nur Standard-TypeScript und gemeinsame reine Typen importieren. Kein Zugriff auf window, Date.now, Math.random, DOM, React, Pixi oder Capacitor.',
  excerpt: 'game/sim darf nur Standard-TypeScript und gemeinsame reine Typen importieren. Kein Zugriff auf window, Date.now, Math.random, DOM, React, Pixi oder Capacitor.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-SIM-IMPORTS-050'] }],
});

// 50.2 game/render reads sim snapshots/events but never writes sim state; animation callbacks must not trigger hits
add({
  id: 'REQ-TEMP-I-0037', chapter: 50, locator: 'block:1609',
  title: 'game/render liest Simulationssnapshots und Events, schreibt aber niemals Simulationszustand; Animation-Callbacks dürfen keine Treffer auslösen.',
  statement: 'game/render liest Simulationssnapshots und Events, schreibt aber niemals Simulationszustand. Animation callbacks dürfen keine Treffer auslösen.',
  excerpt: 'game/render liest Simulationssnapshots und Events, schreibt aber niemals Simulationszustand. Animation callbacks dürfen keine Treffer auslösen.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-RENDER-READONLY-050'] }],
});

// 50.2 screens use feature services/stores; direct FS/Preferences/Native-Plugin access outside platform/storage forbidden
add({
  id: 'REQ-TEMP-I-0038', chapter: 50, locator: 'block:1610',
  title: 'Screens verwenden Feature-Services und Stores; direkter Zugriff auf Filesystem, Preferences oder Native-Plugins außerhalb platform/storage ist verboten.',
  statement: 'screens verwenden feature services und Stores. Direkter Zugriff auf Filesystem, Preferences oder Native-Plugins außerhalb platform/storage ist verboten.',
  excerpt: 'screens verwenden feature services und Stores. Direkter Zugriff auf Filesystem, Preferences oder Native-Plugins außerhalb platform/storage ist verboten.',
  norm: 'MUST_NOT', category: 'Product',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-SCREEN-BOUNDARY-050'] }],
});

// 50.2 content loads only validated data; missing reference is hard error in dev/CI; release with corrupted bundle starts in Recovery screen, never silent replacement
add({
  id: 'REQ-TEMP-I-0039', chapter: 50, locator: 'block:1611',
  title: 'content lädt nur validierte Daten; fehlende Referenz ist im Dev/CI harter Fehler; Release startet bei korruptem Bundle in einen Recovery-Screen statt still zu ersetzen.',
  statement: 'content lädt nur validierte Daten. Fehlende Referenz ist im Development/CI ein harter Fehler; Release startet bei korruptem Bundle in einen Recovery-Screen statt still zu ersetzen.',
  excerpt: 'content lädt nur validierte Daten. Fehlende Referenz ist im Development/CI ein harter Fehler; Release startet bei korruptem Bundle in einen Recovery-Screen statt still zu ersetzen.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-CONTENT-VALID-050'] }],
});

// 50.2 UI components must not contain concrete hero/boss logic; names/values/descriptions come from data and localization keys
add({
  id: 'REQ-TEMP-I-0040', chapter: 50, locator: 'block:1612',
  title: 'UI-Komponenten enthalten keine konkrete Helden-/Bosslogik; Inhaltsnamen, Werte und Beschreibungen kommen aus Daten und Localization Keys.',
  statement: 'UI-Komponenten enthalten keine konkrete Helden-/Bosslogik. Inhaltsnamen, Werte und Beschreibungen kommen aus Daten und Localization Keys.',
  excerpt: 'UI-Komponenten enthalten keine konkrete Helden-/Bosslogik. Inhaltsnamen, Werte und Beschreibungen kommen aus Daten und Localization Keys.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-UI-NO-LOGIC-050'] }],
});

// 50.3 no any outside narrow adapter with comment + immediate validation; unknown required for external data
add({
  id: 'REQ-TEMP-I-0041', chapter: 50, locator: 'block:1614',
  title: 'Kein any außer eng begrenztem Adapter mit Kommentar und unmittelbar anschließender Validierung; unknown ist für externe Daten Pflicht.',
  statement: 'Kein any außer eng begrenztem Adapter mit Kommentar und unmittelbar anschließender Validierung. unknown ist für externe Daten Pflicht.',
  excerpt: 'Kein any außer eng begrenztem Adapter mit Kommentar und unmittelbar anschließender Validierung. unknown ist für externe Daten Pflicht.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-NO-ANY-050'] }],
});

// 50.3 no non-null assertions in save/content/reward/combat code; exhaustive switch with assertNever
add({
  id: 'REQ-TEMP-I-0042', chapter: 50, locator: 'block:1615',
  title: 'Keine non-null Assertions in Save-, Content-, Reward- oder Combat-Code; exhaustive switch mit assertNever für Zustandsautomaten.',
  statement: 'Keine nicht-null Assertions in Save-, Content-, Reward- oder Combat-Code. Exhaustive switch mit assertNever für Zustandsautomaten.',
  excerpt: 'Keine nicht-null Assertions in Save-, Content-, Reward- oder Combat-Code. Exhaustive switch mit assertNever für Zustandsautomaten.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-NO-NONNULL-050'] }],
});

// 50.3 all money, stats, ticks, IDs are integers; UI formatting separate from internal unit
add({
  id: 'REQ-TEMP-I-0043', chapter: 50, locator: 'block:1616',
  title: 'Alle Geld-, Statistik-, Tick- und ID-Werte sind Integer; UI-Formatierung ist von interner Einheit getrennt.',
  statement: 'Alle Geld-, Statistik-, Tick- und ID-Werte sind Integer. UI-Formatierung ist von interner Einheit getrennt.',
  excerpt: 'Alle Geld-, Statistik-, Tick- und ID-Werte sind Integer. UI-Formatierung ist von interner Einheit getrennt.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-INTEGER-UNITS-050'] }],
});

// 50.3 side-effect functions name the effect or live in service/adapter modules; pure sim functions do not mutate externals
add({
  id: 'REQ-TEMP-I-0044', chapter: 50, locator: 'block:1617',
  title: 'Funktionen mit Seiteneffekt tragen dies im Namen oder liegen in Service-/Adaptermodulen; pure Simulationsfunktionen verändern keine externen Objekte.',
  statement: 'Funktionen mit Seiteneffekt tragen dies im Namen oder liegen in Service-/Adaptermodulen. Pure Simulationsfunktionen verändern keine externen Objekte.',
  excerpt: 'Funktionen mit Seiteneffekt tragen dies im Namen oder liegen in Service-/Adaptermodulen. Pure Simulationsfunktionen verändern keine externen Objekte.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-SIDE-EFFECT-NAMING-050'] }],
});

// 50.3 ESLint treats floating promises, unhandled switch cases, direct Math.random/Date.now in sim, unsafe HTML injection as errors
add({
  id: 'REQ-TEMP-I-0045', chapter: 50, locator: 'block:1618',
  title: 'ESLint behandelt floating promises, unhandled switch cases, direkte Math.random-/Date.now-Nutzung in Simulation und unsichere HTML-Injektion als Fehler.',
  statement: 'ESLint behandelt floating promises, unhandled switch cases, direkte Math.random-/Date.now-Nutzung in Simulation und unsichere HTML-Injektion als Fehler.',
  excerpt: 'ESLint behandelt floating promises, unhandled switch cases, direkte Math.random-/Date.now-Nutzung in Simulation und unsichere HTML-Injektion als Fehler.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-ESLINT-RULES-050'] }],
});

// 50.3 no dangerouslySetInnerHTML for localized or content data; formatted texts use tokenized RichText components with whitelist
add({
  id: 'REQ-TEMP-I-0046', chapter: 50, locator: 'block:1619',
  title: 'Keine dangerouslySetInnerHTML für lokalisierte oder Inhaltsdaten; formatierte Texte nutzen tokenisierte RichText-Komponenten mit Whitelist.',
  statement: 'Keine dangerouslySetInnerHTML für lokalisierte oder Inhaltsdaten. Formatierte Texte nutzen tokenisierte RichText-Komponenten mit Whitelist.',
  excerpt: 'Keine dangerouslySetInnerHTML für lokalisierte oder Inhaltsdaten. Formatierte Texte nutzen tokenisierte RichText-Komponenten mit Whitelist.',
  norm: 'MUST_NOT', category: 'Security',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-NO-DANGEROUS-HTML-050'] }],
});

// 50.4 main is always buildable; feature branches integrated via PR with green mandatory checks
add({
  id: 'REQ-TEMP-I-0047', chapter: 50, locator: 'block:1621',
  title: 'Main ist jederzeit baubar; Featurebranches werden über Pull Request mit grünen Pflichtchecks integriert.',
  statement: 'Main ist jederzeit baubar. Featurebranches werden über Pull Request mit grünen Pflichtchecks integriert.',
  excerpt: 'Main ist jederzeit baubar. Featurebranches werden über Pull Request mit grünen Pflichtchecks integriert.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-01', testIds: ['REV-MAIN-BUILD-050'] }],
});

// 50.4 architecture changes, new native plugins, new permissions, save schema changes, content upper limits need ADR
add({
  id: 'REQ-TEMP-I-0048', chapter: 50, locator: 'block:1622',
  title: 'Architekturänderungen, neue Native-Plugins, neue Permissions, Save-Schemaänderungen und Inhaltsobergrenzen benötigen eine ADR-Datei.',
  statement: 'Architekturänderungen, neue Native-Plugins, neue Permissions, Save-Schemaänderungen und Inhaltsobergrenzen benötigen eine ADR-Datei.',
  excerpt: 'Architekturänderungen, neue Native-Plugins, neue Permissions, Save-Schemaänderungen und Inhaltsobergrenzen benötigen eine ADR-Datei.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-01', testIds: ['REV-ADR-REQUIRED-050'] }],
});

// 50.4 generated atlases, store-signed artifacts, keystores, provisioning profiles, secrets must not be committed
add({
  id: 'REQ-TEMP-I-0049', chapter: 50, locator: 'block:1623',
  title: 'Generierte Atlanten, store-signierte Artefakte, Keystores, Provisioning Profiles und Secrets werden nicht committet.',
  statement: 'Generierte Atlanten, store-signierte Artefakte, Keystores, Provisioning Profiles und Secrets werden nicht committet.',
  excerpt: 'Generierte Atlanten, store-signierte Artefakte, Keystores, Provisioning Profiles und Secrets werden nicht committet.',
  norm: 'MUST_NOT', category: 'Security',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-01', testIds: ['ST-NO-SECRETS-050'] }],
});

// 50.4 package-lock.json is forbidden; pnpm-lock.yaml is SSOT; native lockfiles and Package.resolved are committed
add({
  id: 'REQ-TEMP-I-0050', chapter: 50, locator: 'block:1624',
  title: 'package-lock.json ist verboten; pnpm-lock.yaml ist SSOT; native Lockfiles und Package.resolved werden committet.',
  statement: 'package-lock.json ist verboten; pnpm-lock.yaml ist SSOT. Native Lockfiles und Package.resolved werden committet.',
  excerpt: 'package-lock.json ist verboten; pnpm-lock.yaml ist SSOT. Native Lockfiles und Package.resolved werden committet.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-01', testIds: ['ST-LOCKFILE-SSOT-050'] }],
});

// 50.4 release tags vMAJOR.MINOR.PATCH point to exact store source state
add({
  id: 'REQ-TEMP-I-0051', chapter: 50, locator: 'block:1625',
  title: 'Release-Tags lauten vMAJOR.MINOR.PATCH und verweisen auf exakt den Store-Quellstand.',
  statement: 'Release-Tags lauten vMAJOR.MINOR.PATCH und verweisen auf exakt den Store-Quellstand.',
  excerpt: 'Release-Tags lauten vMAJOR.MINOR.PATCH und verweisen auf exakt den Store-Quellstand.',
  norm: 'MUST', category: 'Store',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-01', testIds: ['REV-RELEASE-TAG-050'] }],
});

// =============== CHAPTER 51 ===============
// 51.2 PRNG = xoshiro128** with 4 u32 state values; seeding via SplitMix32 from 128-bit run-seed stored as 4 hex u32
add({
  id: 'REQ-TEMP-I-0052', chapter: 51, locator: 'block:1630',
  title: 'PRNG ist xoshiro128** mit vier unsigned 32-bit Zustandswerten; Seeding erfolgt über SplitMix32 aus einem 128-bit Run-Seed, gespeichert als vier Hex-UInt32.',
  statement: 'PRNG ist xoshiro128** mit vier unsigned 32-bit Zustandswerten. Seeding erfolgt über SplitMix32 aus einem 128-bit Run-Seed, der als vier Hex-UInt32 gespeichert wird.',
  excerpt: 'PRNG ist xoshiro128** mit vier unsigned 32-bit Zustandswerten. Seeding erfolgt über SplitMix32 aus einem 128-bit Run-Seed, der als vier Hex-UInt32 gespeichert wird.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-PRNG-ALGO-051'] }],
});

// 51.2 separate streams: map, encounter, rewards, eventChoices, combatCosmetic; cosmetic stream must not affect gameplay
add({
  id: 'REQ-TEMP-I-0053', chapter: 51, locator: 'block:1631',
  title: 'PRNG-Streams: map, encounter, rewards, eventChoices, combatCosmetic; combatCosmetic darf keinen Gameplayzustand beeinflussen.',
  statement: 'Getrennte Streams: map, encounter, rewards, eventChoices, combatCosmetic. Der combatCosmetic-Stream darf keinen Gameplayzustand beeinflussen.',
  excerpt: 'Getrennte Streams: map, encounter, rewards, eventChoices, combatCosmetic. Der combatCosmetic-Stream darf keinen Gameplayzustand beeinflussen.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-PRNG-STREAMS-051'] }],
});

// 51.2 each deterministic roll slot has stable string key; new rolls not inserted between existing; new slot or simulationVersion bump
add({
  id: 'REQ-TEMP-I-0054', chapter: 51, locator: 'block:1632',
  title: 'Jeder deterministische Rollslot besitzt einen stabilen String-Key; neue Rolls nicht zwischen bestehende einfügen; neuer Slot oder simulationVersion-Erhöhung.',
  statement: 'Jeder deterministische Rollslot besitzt einen stabilen String-Key. Neue Rolls dürfen nicht zwischen bestehende Rolls eingefügt werden; sie erhalten einen neuen Slot oder erhöhen simulationVersion.',
  excerpt: 'Jeder deterministische Rollslot besitzt einen stabilen String-Key. Neue Rolls dürfen nicht zwischen bestehende Rolls eingefügt werden; sie erhalten einen neuen Slot oder erhöhen simulationVersion.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-ROLL-STABLE-051'] }],
});

// 51.2 Math.random banned everywhere via ESLint; UI confetti may use cosmetic stream or crypto.getRandomValues but never alter replay data
add({
  id: 'REQ-TEMP-I-0055', chapter: 51, locator: 'block:1633',
  title: 'Math.random ist im gesamten Quelltext per ESLint verboten; UI-Konfetti darf Cosmetic-Stream oder crypto.getRandomValues nutzen, aber nie Replaydaten verändern.',
  statement: 'Math.random ist im gesamten Quelltext per ESLint verboten. UI-Konfetti darf den Cosmetic-Stream oder crypto.getRandomValues nutzen, aber nie Replaydaten verändern.',
  excerpt: 'Math.random ist im gesamten Quelltext per ESLint verboten. UI-Konfetti darf den Cosmetic-Stream oder crypto.getRandomValues nutzen, aber nie Replaydaten verändern.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-NO-MATH-RANDOM-051'] }],
});

// 51.2 replay file stores seed, contentVersion, simulationVersion, start snapshot, player decisions; must reconstruct bit-identical result
add({
  id: 'REQ-TEMP-I-0056', chapter: 51, locator: 'block:1634',
  title: 'Replaydatei speichert Seed, contentVersion, simulationVersion, Startsnapshot und Spielerentscheidungen; daraus muss das Ergebnis bit-identisch rekonstruierbar sein.',
  statement: 'Replaydatei speichert Seed, contentVersion, simulationVersion, Startsnapshot und Spielerentscheidungen. Aus ihr muss das Ergebnis bit-identisch rekonstruierbar sein.',
  excerpt: 'Replaydatei speichert Seed, contentVersion, simulationVersion, Startsnapshot und Spielerentscheidungen. Aus ihr muss das Ergebnis bit-identisch rekonstruierbar sein.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-REPLAY-BIT-IDENT-051'] }],
});

// 51.3 INTRO has no authoritative attacks; starting passives committed on first ACTIVE tick in stable priority
add({
  id: 'REQ-TEMP-I-0057', chapter: 51, locator: 'block:1638',
  title: 'INTRO besitzt keine autoritativen Angriffe; Startpassiven werden am ersten ACTIVE-Tick in stabiler Priorität committed.',
  statement: 'INTRO besitzt keine autoritativen Angriffe. Startpassiven werden am ersten ACTIVE-Tick in stabiler Priorität committed.',
  excerpt: 'INTRO besitzt keine autoritativen Angriffe. Startpassiven werden am ersten ACTIVE-Tick in stabiler Priorität committed.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-INTRO-NO-ATTACK-051'] }],
});

// 51.3 PHASE_TRANSITION pauses boss actions and ability charge only if phase defines it; global default duration = 45 ticks
add({
  id: 'REQ-TEMP-I-0058', chapter: 51, locator: 'block:1639',
  title: 'PHASE_TRANSITION pausiert Bossaktionen und Fähigkeitladung nur wenn Phase es definiert; globale Standarddauer beträgt 45 Ticks.',
  statement: 'PHASE_TRANSITION pausiert Bossaktionen und Fähigkeitladung nur, wenn die Phase es definiert; die globale Standarddauer beträgt 45 Ticks.',
  excerpt: 'PHASE_TRANSITION pausiert Bossaktionen und Fähigkeitladung nur, wenn die Phase es definiert; die globale Standarddauer beträgt 45 Ticks.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-PHASE-DURATION-051'] }],
  numericConstraints: [{ kind: 'exact', name: 'defaultPhaseTransitionTicks', value: 45 }],
});

// 51.3 RESOLVING_END lasts at most 3 ticks authoritatively and processes already committed revive/death-prevention; cosmetic outro outside sim
add({
  id: 'REQ-TEMP-I-0059', chapter: 51, locator: 'block:1640',
  title: 'RESOLVING_END dauert autoritativ höchstens 3 Ticks und verarbeitet bereits committed Wiederbelebung/Todesverhinderung; kosmetische Outrozeit liegt außerhalb der Simulation.',
  statement: 'RESOLVING_END dauert autoritativ höchstens 3 Ticks und verarbeitet bereits committed Wiederbelebung/Todesverhinderung. Kosmetische Outrozeit liegt außerhalb der Simulation.',
  excerpt: 'RESOLVING_END dauert autoritativ höchstens 3 Ticks und verarbeitet bereits committed Wiederbelebung/Todesverhinderung. Kosmetische Outrozeit liegt außerhalb der Simulation.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-RESOLVING-END-051'] }],
  numericConstraints: [{ kind: 'max', name: 'resolvingEndTicks', value: 3 }],
});

// 51.3 battle hard simulation limit = 5400 ticks = 180 seconds; after that Rift collapse scoring from V3, never infinite
add({
  id: 'REQ-TEMP-I-0060', chapter: 51, locator: 'block:1641',
  title: 'Kampf erhält hartes Simulationslimit von 5400 Ticks = 180 Sekunden; danach greift die in V3 definierte Riftkollapswertung; kein unendlicher Kampf.',
  statement: 'Ein Kampf erhält ein hartes Simulationslimit von 5400 Ticks = 180 Sekunden. Danach greift die in V3 definierte Riftkollapswertung; kein unendlicher Kampf.',
  excerpt: 'Ein Kampf erhält ein hartes Simulationslimit von 5400 Ticks = 180 Sekunden. Danach greift die in V3 definierte Riftkollapswertung; kein unendlicher Kampf.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-BATTLE-TICK-LIMIT-051'] }],
  numericConstraints: [
    { kind: 'exact', name: 'battleTickLimit', value: 5400, unit: 'ticks' },
    { kind: 'exact', name: 'battleTimeLimit', value: 180, unit: 's' },
  ],
});

// 51.4 each event contains tick, sequence, type, sourceId, targetIds, ability/effect ID, integer payload, localization-safe logTags
add({
  id: 'REQ-TEMP-I-0061', chapter: 51, locator: 'block:1643',
  title: 'Jedes Event enthält tick, sequence, type, sourceId, targetIds, ability/effect ID, integer payload und localization-safe logTags.',
  statement: 'Jedes Event enthält tick, sequence, type, sourceId, targetIds, ability/effect ID, integer payload und localization-safe logTags.',
  excerpt: 'Jedes Event enthält tick, sequence, type, sourceId, targetIds, ability/effect ID, integer payload und localization-safe logTags.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-EVENT-SCHEMA-051'] }],
});

// 51.4 result screen reads only aggregated events; must not estimate values from render animations
add({
  id: 'REQ-TEMP-I-0062', chapter: 51, locator: 'block:1644',
  title: 'Ergebnisbildschirm liest ausschließlich aggregierte Events und schätzt keine Werte aus Renderanimationen.',
  statement: 'Der Ergebnisbildschirm liest ausschließlich aggregierte Events. Er schätzt keine Werte aus Renderanimationen.',
  excerpt: 'Der Ergebnisbildschirm liest ausschließlich aggregierte Events. Er schätzt keine Werte aus Renderanimationen.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'static', plannedPhase: 'PHASE-02', testIds: ['ST-RESULT-AGG-051'] }],
});

// 51.4 debug replays may save full event log; normal saves store snapshot plus decisions only
add({
  id: 'REQ-TEMP-I-0063', chapter: 51, locator: 'block:1645',
  title: 'Debug-Replays können vollständiges Eventlog speichern; normale Saves speichern nur Snapshot plus Entscheidungen zur Dateigrößenbegrenzung.',
  statement: 'Debug-Replays können das vollständige Eventlog speichern; normale Saves speichern nur Snapshot plus Entscheidungen, um Dateigröße zu begrenzen.',
  excerpt: 'Debug-Replays können das vollständige Eventlog speichern; normale Saves speichern nur Snapshot plus Entscheidungen, um Dateigröße zu begrenzen.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-02'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-02', testIds: ['UT-SAVE-COMPACT-051'] }],
});

// =============== CHAPTER 52 ===============
// 52.1-52.5 are headings only; the actual constraints are in subsections which the file shows no compact paragraphs beyond headings.
// Per handbook, only extract normative statements from explicit text. So skip — only heading text present, no MUST/SHOULD/etc. NOTE: zero normative statements in 52.

// =============== CHAPTER 53 ===============
// 53.1 on appStateChange to inactive/background: pause sim at last completed tick, fade audio, request snapshot, stop UI animations
add({
  id: 'REQ-TEMP-I-0064', chapter: 53, locator: 'block:1668',
  title: 'Bei appStateChange zu inactive/background: Simulation am letzten vollständigen Tick pausieren, Audio ausgeblendet, Snapshot angefordert, UI-Animationen stoppen.',
  statement: 'Bei appStateChange zu inactive/background wird die Simulation am letzten vollständigen Tick pausiert, Audio ausgeblendet und ein Snapshot angefordert. UI-Animationen stoppen.',
  excerpt: 'Bei appStateChange zu inactive/background wird die Simulation am letzten vollständigen Tick pausiert, Audio ausgeblendet und ein Snapshot angefordert. UI-Animationen stoppen.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-01', testIds: ['IT-LIFECYCLE-PAUSE-053'] }],
});

// 53.1 snapshot must be created in memory within 250 ms; persistence may continue async; existing last safe save remains valid
add({
  id: 'REQ-TEMP-I-0065', chapter: 53, locator: 'block:1669',
  title: 'Snapshot muss innerhalb 250 ms in Memory erzeugt werden; Persistenz darf asynchron fortgesetzt werden; letzter Safe-Save bleibt gültig.',
  statement: 'Der Snapshot muss innerhalb 250 ms in Memory erzeugt werden. Persistenz darf anschließend asynchron fortgesetzt werden; ein bereits existierender letzter Safe-Save bleibt gültig.',
  excerpt: 'Der Snapshot muss innerhalb 250 ms in Memory erzeugt werden. Persistenz darf anschließend asynchron fortgesetzt werden; ein bereits existierender letzter Safe-Save bleibt gültig.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-01', testIds: ['IT-SNAPSHOT-250MS-053'] }],
  numericConstraints: [{ kind: 'max', name: 'snapshotMemoryMs', value: 250, unit: 'ms' }],
});

// 53.1 on resume, never auto-continue a battle before renderer/audio/input ready; battle appears paused with "Fortsetzen"
add({
  id: 'REQ-TEMP-I-0066', chapter: 53, locator: 'block:1670',
  title: 'Beim Resume wird niemals automatisch ein Kampf fortgesetzt, bevor Renderer, Audio und Input bereit sind; Kampf erscheint pausiert mit "Fortsetzen".',
  statement: 'Beim Resume wird niemals automatisch ein Kampf fortgesetzt, bevor Renderer, Audio und Input bereit sind. Der Kampf erscheint pausiert mit „Fortsetzen“.',
  excerpt: 'Beim Resume wird niemals automatisch ein Kampf fortgesetzt, bevor Renderer, Audio und Input bereit sind. Der Kampf erscheint pausiert mit „Fortsetzen“.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-01', testIds: ['IT-RESUME-NO-AUTO-053'] }],
});

// 53.1 OS-kill without pause callback may lose at most progress since last defined commit, never an entire expedition
add({
  id: 'REQ-TEMP-I-0067', chapter: 53, locator: 'block:1671',
  title: 'OS-Kill ohne Pause-Callback darf höchstens Fortschritt seit dem letzten definierten Commit verlieren, niemals eine gesamte Expedition.',
  statement: 'Ein OS-Kill ohne Pause-Callback darf höchstens Fortschritt seit dem letzten definierten Commit verlieren, niemals eine gesamte Expedition.',
  excerpt: 'Ein OS-Kill ohne Pause-Callback darf höchstens Fortschritt seit dem letzten definierten Commit verlieren, niemals eine gesamte Expedition.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-01', testIds: ['IT-OSKILL-LOSS-053'] }],
});

// 53.1 native splash disappears only after first stable React frame and after a recovery error can be presented as UI
add({
  id: 'REQ-TEMP-I-0068', chapter: 53, locator: 'block:1672',
  title: 'Native Splash verschwindet erst nach erstem stabilen React-Frame und nachdem ein Recoveryfehler als UI dargestellt werden kann.',
  statement: 'Native Splash verschwindet erst nach erstem stabilen React-Frame und nachdem ein Recoveryfehler als UI dargestellt werden kann.',
  excerpt: 'Native Splash verschwindet erst nach erstem stabilen React-Frame und nachdem ein Recoveryfehler als UI dargestellt werden kann.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-01', testIds: ['IT-SPLASH-DISMISS-053'] }],
});

// =============== CHAPTER 54 ===============
// 54 Each screen implements 6 common states (loading, ready, empty if applicable, blocked, recoverableError, fatalError); each screen has stable screenId, unique primary purpose, fixed back-target, at least 1 automated screenshot test per supported layout class
add({
  id: 'REQ-TEMP-I-0069', chapter: 54, locator: 'block:1680',
  title: 'Jeder Screen implementiert sechs Zustände: loading, ready, empty (nur wenn sachlich möglich), blocked, recoverableError, fatalError; jeder Screen besitzt stabile screenId, eindeutigen primären Zweck, festgelegten Back-Target und mindestens einen automatisierten Screenshot-Test pro unterstützter Layoutklasse.',
  statement: 'Jeder Screen implementiert sechs gemeinsame Zustände: loading, ready, empty (nur wenn sachlich möglich), blocked, recoverableError und fatalError. Jeder Screen besitzt einen stabilen screenId, einen eindeutigen primären Zweck, einen festgelegten Back-Target und mindestens einen automatisierten Screenshot-Test pro unterstützter Layoutklasse.',
  excerpt: 'Jeder Screen implementiert sechs gemeinsame Zustände: loading, ready, empty (nur wenn sachlich möglich), blocked, recoverableError und fatalError. Jeder Screen besitzt einen stabilen screenId, einen eindeutigen primären Zweck, einen festgelegten Back-Target und mindestens einen automatisierten Screenshot-Test pro unterstützter Layoutklasse.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-SCREEN-STATES-054'] }],
});

// 54.5 primary flow reachable in at most 3 navigation levels; no mandatory function only via long-press or hidden gesture
add({
  id: 'REQ-TEMP-I-0070', chapter: 54, locator: 'block:1685',
  title: 'Primärer Flow ist mit höchstens drei Navigationsebenen erreichbar; keine Pflichtfunktion nur über Long-Press oder versteckte Geste.',
  statement: 'Jeder primäre Flow ist mit höchstens drei Navigationsebenen erreichbar; keine Pflichtfunktion nur über Long-Press oder versteckte Geste.',
  excerpt: 'Jeder primäre Flow ist mit höchstens drei Navigationsebenen erreichbar; keine Pflichtfunktion nur über Long-Press oder versteckte Geste.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-NAV-DEPTH-054'] }],
  numericConstraints: [{ kind: 'max', name: 'navigationDepth', value: 3 }],
});

// 54.5 every purchase shows cost, new stock, exact effect before confirmation; buttons atomically locked during commit; double-tap creates no duplicate transaction
add({
  id: 'REQ-TEMP-I-0071', chapter: 54, locator: 'block:1686',
  title: 'Jeder Kauf zeigt Kosten, neuen Bestand und exakte Wirkung vor Bestätigung; Buttons während Commit atomar gesperrt; Doppeltap erzeugt keine Doppeltransaktion.',
  statement: 'Jeder Kauf zeigt Kosten, neuen Bestand und exakte Wirkung vor Bestätigung. Buttons werden während Commit atomar gesperrt, Doppeltap erzeugt keine Doppeltransaktion.',
  excerpt: 'Jeder Kauf zeigt Kosten, neuen Bestand und exakte Wirkung vor Bestätigung. Buttons werden während Commit atomar gesperrt, Doppeltap erzeugt keine Doppeltransaktion.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'e2e', plannedPhase: 'PHASE-08', testIds: ['E2E-PURCHASE-LOCK-054'] }],
});

// 54.5 every list gets deterministic default sorting, filter reset, empty state; scroll position persists on back navigation
add({
  id: 'REQ-TEMP-I-0072', chapter: 54, locator: 'block:1687',
  title: 'Jede Liste erhält deterministische Standardsortierung, Filter-Reset und leeren Zustand; Scrollposition bleibt beim Zurückkehren erhalten.',
  statement: 'Jede Liste erhält deterministische Standardsortierung, Filter-Reset und leeren Zustand. Scrollposition bleibt beim Zurückkehren erhalten.',
  excerpt: 'Jede Liste erhält deterministische Standardsortierung, Filter-Reset und leeren Zustand. Scrollposition bleibt beim Zurückkehren erhalten.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-LIST-STATE-054'] }],
});

// 54.5 no screen loses state on app switch, lock/unlock, window resize, or OS font change
add({
  id: 'REQ-TEMP-I-0073', chapter: 54, locator: 'block:1688',
  title: 'Kein Screen verliert Zustand bei App-Wechsel, Sperren/Entsperren, Fensterresize oder OS-Schriftänderung.',
  statement: 'Kein Screen verliert Zustand bei App-Wechsel, Sperren/Entsperren, Fensterresize oder OS-Schriftänderung.',
  excerpt: 'Kein Screen verliert Zustand bei App-Wechsel, Sperren/Entsperren, Fensterresize oder OS-Schriftänderung.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-08', testIds: ['IT-SCREEN-PERSIST-054'] }],
});

// 54.5 pre-battle shows every strategically relevant info without external document; detail texts may live in tooltips
add({
  id: 'REQ-TEMP-I-0074', chapter: 54, locator: 'block:1689',
  title: 'Kampfvorbereitung zeigt jede strategisch relevante Information ohne Öffnen eines externen Dokuments; Detailtexte dürfen in Tooltips liegen.',
  statement: 'Die Kampfvorbereitung zeigt jede strategisch relevante Information ohne Öffnen eines externen Dokuments; Detailtexte dürfen in Tooltips liegen.',
  excerpt: 'Die Kampfvorbereitung zeigt jede strategisch relevante Information ohne Öffnen eines externen Dokuments; Detailtexte dürfen in Tooltips liegen.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-PREBATTLE-INFO-054'] }],
});

// =============== CHAPTER 55 ===============
// 55.2 system text scaling and internal scaling combined; total scale checked at 200%; no text truncated; cards grow or switch to detail mode
add({
  id: 'REQ-TEMP-I-0075', chapter: 55, locator: 'block:1702',
  title: 'Systemtextskalierung und interne Skalierung werden kombiniert; Gesamtskala ist auf 200 % geprüft; kein Text abgeschnitten; Karten wachsen oder wechseln in Detailmodus.',
  statement: 'Systemtextskalierung und interne Skalierung werden kombiniert, aber Gesamtskala ist auf 200% geprüft. Kein Text wird abgeschnitten; Karten wachsen oder wechseln in Detailmodus.',
  excerpt: 'Systemtextskalierung und interne Skalierung werden kombiniert, aber Gesamtskala ist auf 200% geprüft. Kein Text wird abgeschnitten; Karten wachsen oder wechseln in Detailmodus.',
  norm: 'MUST', category: 'A11y',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-TEXT-200-055'] }],
  numericConstraints: [{ kind: 'exact', name: 'totalScaleCheckPct', value: 200, unit: '%' }],
});

// 55.2 max line length 75 chars; phone prefers 45-60; all caps only for short labels <=18 chars
add({
  id: 'REQ-TEMP-I-0076', chapter: 55, locator: 'block:1703',
  title: 'Maximale Zeilenlänge 75 Zeichen; auf Telefon bevorzugt 45-60; All Caps nur für kurze Labels bis 18 Zeichen.',
  statement: 'Maximale Zeilenlänge 75 Zeichen; auf Telefon bevorzugt 45-60. All Caps nur für kurze Labels bis 18 Zeichen.',
  excerpt: 'Maximale Zeilenlänge 75 Zeichen; auf Telefon bevorzugt 45-60. All Caps nur für kurze Labels bis 18 Zeichen.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-LINE-LENGTH-055'] }],
  numericConstraints: [
    { kind: 'max', name: 'maxLineLengthChars', value: 75 },
    { kind: 'range', name: 'phoneLineLengthChars', min: 45, max: 60 },
    { kind: 'max', name: 'allCapsLabelChars', value: 18 },
  ],
});

// 55.2 display font must never be sole font for longer German/English texts
add({
  id: 'REQ-TEMP-I-0077', chapter: 55, locator: 'block:1704',
  title: 'Displayfont darf niemals einzige Schrift für längere deutsche oder englische Texte sein.',
  statement: 'Displayfont darf niemals einzige Schrift für längere deutsche oder englische Texte sein.',
  excerpt: 'Displayfont darf niemals einzige Schrift für längere deutsche oder englische Texte sein.',
  norm: 'MUST_NOT', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-DISPLAY-FONT-055'] }],
});

// 55.3 logical design canvas for combat scenes = 1920x1080; scaled proportionally; HUD uses CSS layout outside Pixi coords
add({
  id: 'REQ-TEMP-I-0078', chapter: 55, locator: 'block:1706',
  title: 'Logische Designfläche für Kampfszenen ist 1920x1080, proportional skaliert; HUD nutzt CSS-Layout außerhalb der Pixi-Koordinaten.',
  statement: 'Die logische Designfläche für Kampfszenen ist 1920x1080. Sie wird proportional skaliert; HUD nutzt CSS-Layout außerhalb der Pixi-Koordinaten.',
  excerpt: 'Die logische Designfläche für Kampfszenen ist 1920x1080. Sie wird proportional skaliert; HUD nutzt CSS-Layout außerhalb der Pixi-Koordinaten.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-DESIGN-CANVAS-055'] }],
  numericConstraints: [
    { kind: 'exact', name: 'designCanvasWidth', value: 1920, unit: 'px' },
    { kind: 'exact', name: 'designCanvasHeight', value: 1080, unit: 'px' },
  ],
});

// 55.3 supported aspect ratios 4:3 to 21:9 without clipped interaction; extra width shows decoration only, never new game-relevant info
add({
  id: 'REQ-TEMP-I-0079', chapter: 55, locator: 'block:1707',
  title: 'Unterstützte Seitenverhältnisse 4:3 bis 21:9 ohne abgeschnittene Interaktion; zusätzliche Breite zeigt Dekoration, nie neue spielrelevante Information.',
  statement: 'Unterstützte Seitenverhältnisse 4:3 bis 21:9 ohne abgeschnittene Interaktion. Zusätzliche Breite zeigt Dekoration, nie neue spielrelevante Information.',
  excerpt: 'Unterstützte Seitenverhältnisse 4:3 bis 21:9 ohne abgeschnittene Interaktion. Zusätzliche Breite zeigt Dekoration, nie neue spielrelevante Information.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-ASPECT-055'] }],
  numericConstraints: [
    { kind: 'exact', name: 'minAspectRatio', value: '4:3' },
    { kind: 'exact', name: 'maxAspectRatio', value: '21:9' },
  ],
});

// 55.3 safe-area-inset applied on all 4 sides via env(safe-area-inset-*) plus SystemBars adapter; primary buttons keep additional 8 px gap
add({
  id: 'REQ-TEMP-I-0080', chapter: 55, locator: 'block:1708',
  title: 'Safe-Area-Inset wird auf allen vier Seiten über env(safe-area-inset-*) plus SystemBars-Adapter angewandt; primäre Buttons halten zusätzlich 8 px Abstand.',
  statement: 'Safe-Area-Inset wird auf allen vier Seiten über env(safe-area-inset-*) plus SystemBars-Adapter angewandt. Primäre Buttons halten zusätzlich 8 px Abstand.',
  excerpt: 'Safe-Area-Inset wird auf allen vier Seiten über env(safe-area-inset-*) plus SystemBars-Adapter angewandt. Primäre Buttons halten zusätzlich 8 px Abstand.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-SAFE-AREA-055'] }],
  numericConstraints: [{ kind: 'min', name: 'primaryButtonSafeGapPx', value: 8 }],
});

// 55.3 Android 16+ large windows may override orientation/resizable; portrait/narrow fallback must remain fully operable
add({
  id: 'REQ-TEMP-I-0081', chapter: 55, locator: 'block:1709',
  title: 'Android 16+ große Fenster dürfen Orientierung/Resizable-Einstellungen überschreiben; deshalb bleibt der Portrait/Narrow-Fallback vollständig bedienbar.',
  statement: 'Android 16+ große Fenster dürfen Orientierung/Resizable-Einstellungen überschreiben; deshalb bleibt der Portrait/Narrow-Fallback vollständig bedienbar.',
  excerpt: 'Android 16+ große Fenster dürfen Orientierung/Resizable-Einstellungen überschreiben; deshalb bleibt der Portrait/Narrow-Fallback vollständig bedienbar.',
  norm: 'MUST', category: 'Android',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'native', plannedPhase: 'PHASE-08', testIds: ['NAT-A-RESIZABLE-055'] }],
});

// =============== CHAPTER 56 ===============
// 56.1 min hitbox 48x48 CSS px; primary actions 56 px high; gap between dangerous and primary actions >= 12 px
add({
  id: 'REQ-TEMP-I-0082', chapter: 56, locator: 'block:1724',
  title: 'Mindesthitbox 48x48 CSS px; Hauptaktionen 56 px hoch; Abstand zwischen gefährlichen und primären Aktionen mindestens 12 px.',
  statement: 'Mindesthitbox 48x48 CSS px; Hauptaktionen 56 px Höhe. Abstand zwischen gefährlichen und primären Aktionen mindestens 12 px.',
  excerpt: 'Mindesthitbox 48x48 CSS px; Hauptaktionen 56 px Höhe. Abstand zwischen gefährlichen und primären Aktionen mindestens 12 px.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-HITBOX-056'] }],
  numericConstraints: [
    { kind: 'min', name: 'minHitboxCssPx', value: 48 },
    { kind: 'min', name: 'primaryActionHeightCssPx', value: 56 },
    { kind: 'min', name: 'dangerousPrimaryGapCssPx', value: 12 },
  ],
});

// 56.1 drag-and-drop always replaceable by tap-select/tap-place; during drag each cell shows valid/invalid plus reason
add({
  id: 'REQ-TEMP-I-0083', chapter: 56, locator: 'block:1725',
  title: 'Drag-and-drop ist immer durch Tap-Auswählen/Tap-Platzieren ersetzbar; während Drag zeigt jedes Feld gültig/ungültig plus Grund.',
  statement: 'Drag-and-drop ist immer durch Tap-Auswählen/Tap-Platzieren ersetzbar. Während Drag zeigt jedes Feld gültig/ungültig plus Grund.',
  excerpt: 'Drag-and-drop ist immer durch Tap-Auswählen/Tap-Platzieren ersetzbar. Während Drag zeigt jedes Feld gültig/ungültig plus Grund.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'e2e', plannedPhase: 'PHASE-08', testIds: ['E2E-DRAG-REPLACE-056'] }],
});

// 56.1 long-press only opens extra info; no progress/purchase/battle-start requires long-press
add({
  id: 'REQ-TEMP-I-0084', chapter: 56, locator: 'block:1726',
  title: 'Long-Press öffnet nur Zusatzinfo; kein Fortschritt, Kauf oder Kampfstart erfordert Long-Press.',
  statement: 'Long-Press darf nur Zusatzinfo öffnen. Kein Fortschritt, Kauf oder Kampfstart erfordert Long-Press.',
  excerpt: 'Long-Press darf nur Zusatzinfo öffnen. Kein Fortschritt, Kauf oder Kampfstart erfordert Long-Press.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-LONGPRESS-056'] }],
});

// 56.1 double-tap has no special function; pinch-zoom not needed; browser zoom not intentionally blocked; app offers own text scaling
add({
  id: 'REQ-TEMP-I-0085', chapter: 56, locator: 'block:1727',
  title: 'Doppeltap hat keine Sonderfunktion; Pinch-Zoom nicht benötigt; Browserzoom wird nicht absichtlich blockiert; App bietet eigene Textskalierung.',
  statement: 'Doppeltap besitzt keine Sonderfunktion. Pinch-Zoom wird nicht benötigt; Browserzoom wird nicht absichtlich blockiert, die App bietet eigene Textskalierung.',
  excerpt: 'Doppeltap besitzt keine Sonderfunktion. Pinch-Zoom wird nicht benötigt; Browserzoom wird nicht absichtlich blockiert, die App bietet eigene Textskalierung.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-NO-SPECIAL-DOUBLETAP-056'] }],
});

// 56.1 hover improves desktop but is never an information prerequisite
add({
  id: 'REQ-TEMP-I-0086', chapter: 56, locator: 'block:1728',
  title: 'Hover verbessert Desktop, ist aber keine Informationsvoraussetzung.',
  statement: 'Hover verbessert Desktop, ist aber keine Informationsvoraussetzung.',
  excerpt: 'Hover verbessert Desktop, ist aber keine Informationsvoraussetzung.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-HOVER-OPT-056'] }],
});

// 56.2 focus-visible clearly gold/violet with min 3:1 contrast; focus never remains behind modals
add({
  id: 'REQ-TEMP-I-0087', chapter: 56, locator: 'block:1730',
  title: 'Focus-visible ist deutlich gold/violett mit mindestens 3:1 Kontrast; Fokus darf nie hinter Modals verbleiben.',
  statement: 'Focus-visible ist deutlich gold/violett mit mindestens 3:1 Kontrast. Fokus darf nie hinter Modals verbleiben.',
  excerpt: 'Focus-visible ist deutlich gold/violett mit mindestens 3:1 Kontrast. Fokus darf nie hinter Modals verbleiben.',
  norm: 'MUST', category: 'A11y',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-FOCUS-VISIBLE-056'] }],
  numericConstraints: [{ kind: 'min', name: 'focusVisibleContrastRatio', value: '3:1' }],
});

// 56.2 gamepad reconnect places focus on last logical element, not screen start
add({
  id: 'REQ-TEMP-I-0088', chapter: 56, locator: 'block:1731',
  title: 'Gamepad-Reconnect stellt Fokus auf das letzte logische Element, nicht auf Screenanfang.',
  statement: 'Gamepad-Reconnect stellt Fokus auf das letzte logische Element, nicht auf Screenanfang.',
  excerpt: 'Gamepad-Reconnect stellt Fokus auf das letzte logische Element, nicht auf Screenanfang.',
  norm: 'MUST', category: 'A11y',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-08', testIds: ['IT-GAMEPAD-RECONNECT-056'] }],
});

// 56.2 all mappings shown in S63; free remap is V1 non-goal; reset defaults available
add({
  id: 'REQ-TEMP-I-0089', chapter: 56, locator: 'block:1732',
  title: 'Alle Mappings werden in S63 angezeigt; freie Neukonfiguration ist V1-Nichtziel; Reset Defaults ist vorhanden.',
  statement: 'Alle Mappings werden in S63 angezeigt; freie Neukonfiguration ist V1-Nichtziel, Reset Defaults ist vorhanden.',
  excerpt: 'Alle Mappings werden in S63 angezeigt; freie Neukonfiguration ist V1-Nichtziel, Reset Defaults ist vorhanden.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-MAPPING-SCREEN-056'] }],
});

// 56.3 all React UI uses semantic HTML, labels, groups, live regions; purely decorative images aria-hidden
add({
  id: 'REQ-TEMP-I-0090', chapter: 56, locator: 'block:1734',
  title: 'Alle React-UI nutzen semantische HTML-Elemente, Labels, Gruppen und Live-Regions; rein dekorative Bilder sind aria-hidden.',
  statement: 'Alle React-UI-Elemente nutzen semantische HTML-Elemente, Labels, Gruppen und Live-Regions. Rein dekorative Bilder sind aria-hidden.',
  excerpt: 'Alle React-UI-Elemente nutzen semantische HTML-Elemente, Labels, Gruppen und Live-Regions. Rein dekorative Bilder sind aria-hidden.',
  norm: 'MUST', category: 'A11y',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-SEMANTIC-HTML-056'] }],
});

// 56.3 Pixi canvas has parallel invisible but focusable accessibility structure with battle status, 3 lanes, units, warnings
add({
  id: 'REQ-TEMP-I-0091', chapter: 56, locator: 'block:1735',
  title: 'Pixi-Canvas besitzt parallel eine unsichtbare, aber fokussierbare Accessibility-Struktur mit Kampfstatus, drei Bahnen, Einheiten und Warnungen.',
  statement: 'Der Pixi-Canvas besitzt parallel eine unsichtbare, aber fokussierbare Accessibility-Struktur mit Kampfstatus, drei Bahnen, Einheiten und Warnungen.',
  excerpt: 'Der Pixi-Canvas besitzt parallel eine unsichtbare, aber fokussierbare Accessibility-Struktur mit Kampfstatus, drei Bahnen, Einheiten und Warnungen.',
  norm: 'MUST', category: 'A11y',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-PIXI-A11Y-056'] }],
});

// 56.3 optional tactical text view shows in paused battle per lane: order, HP/shield, target, next ability, effects, announced danger; does not alter sim
add({
  id: 'REQ-TEMP-I-0092', chapter: 56, locator: 'block:1736',
  title: 'Optionale taktische Textansicht zeigt im pausierten Kampf pro Bahn: Reihenfolge, LP/Schild, Ziel, nächste Fähigkeit, Effekte, angekündigte Gefahr; verändert keine Simulation.',
  statement: 'Die optionale taktische Textansicht zeigt im pausierten Kampf pro Bahn: Reihenfolge, LP/Schild, Ziel, nächste Fähigkeit, Effekte und angekündigte Gefahr. Sie verändert keine Simulation.',
  excerpt: 'Die optionale taktische Textansicht zeigt im pausierten Kampf pro Bahn: Reihenfolge, LP/Schild, Ziel, nächste Fähigkeit, Effekte und angekündigte Gefahr. Sie verändert keine Simulation.',
  norm: 'MUST', category: 'A11y',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-TACTICAL-TEXT-056'] }],
});

// 56.3 battle events not fully read; default: boss phase, own loss, big warning, victory/defeat; detail mode adds abilities and statuses
add({
  id: 'REQ-TEMP-I-0093', chapter: 56, locator: 'block:1737',
  title: 'Kampfereignisse werden nicht vollständig vorgelesen; Standard: Bossphase, eigener Verlust, große Warnung, Sieg/Niederlage; Detailmodus ergänzt Fähigkeiten und Status.',
  statement: 'Kampfereignisse werden nicht vollständig vorgelesen. Standard: Bossphase, eigener Verlust, große Warnung, Sieg/Niederlage. Detailmodus ergänzt Fähigkeiten und Status.',
  excerpt: 'Kampfereignisse werden nicht vollständig vorgelesen. Standard: Bossphase, eigener Verlust, große Warnung, Sieg/Niederlage. Detailmodus ergänzt Fähigkeiten und Status.',
  norm: 'MUST', category: 'A11y',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-EVENT-SUMMARY-056'] }],
});

// 56.3 all spoken content has subtitles; all audio cues have form/icon/animation as visual equivalent
add({
  id: 'REQ-TEMP-I-0094', chapter: 56, locator: 'block:1738',
  title: 'Alle gesprochenen Inhalte besitzen Untertitel; alle Audiohinweise besitzen Form/Icon/Animation als visuelles Äquivalent.',
  statement: 'Alle gesprochenen Inhalte besitzen Untertitel; alle Audiohinweise besitzen Form/Icon/Animation als visuelles Äquivalent.',
  excerpt: 'Alle gesprochenen Inhalte besitzen Untertitel; alle Audiohinweise besitzen Form/Icon/Animation als visuelles Äquivalent.',
  norm: 'MUST', category: 'A11y',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-08', testIds: ['VIS-CAPTIONS-A11Y-056'] }],
});

// =============== CHAPTER 57 ===============
// 57.1 game plays audio only in foreground; background, phone call, Siri/Assistant, headphone removal, audio focus loss => soft pause; battle also paused
add({
  id: 'REQ-TEMP-I-0095', chapter: 57, locator: 'block:1746',
  title: 'Spiel spielt Audio ausschließlich im Vordergrund; bei Background, Telefonanruf, Siri/Assistant, Kopfhörerabzug oder Audiofokusverlust wird sofort weich pausiert; der Kampf wird ebenfalls pausiert.',
  statement: 'Das Spiel spielt Audio ausschließlich im Vordergrund. Bei Background, Telefonanruf, Siri/Assistant, Kopfhörerabzug oder Audiofokusverlust wird sofort weich pausiert; der Kampf wird ebenfalls pausiert.',
  excerpt: 'Das Spiel spielt Audio ausschließlich im Vordergrund. Bei Background, Telefonanruf, Siri/Assistant, Kopfhörerabzug oder Audiofokusverlust wird sofort weich pausiert; der Kampf wird ebenfalls pausiert.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-08', testIds: ['IT-AUDIO-FOREGROUND-057'] }],
});

// 57.1 iOS uses AVAudioSession category ambient baseline; respects silent switch and existing user music; on interrupt pause battle; no V1 mix option
add({
  id: 'REQ-TEMP-I-0096', chapter: 57, locator: 'block:1747',
  title: 'iOS nutzt AVAudioSession category ambient als Baseline: Silent Switch respektiert, Nutzermusik darf weiterlaufen; bei Unterbrechung Kampf pausiert; eigene Mischoption nicht in V1.',
  statement: 'iOS verwendet AVAudioSession category ambient als Baseline: Der Silent Switch wird respektiert und bereits laufende Nutzermusik darf weiterlaufen. Bei Unterbrechung wird der Kampf pausiert; eine eigene Mischoption ist in V1 nicht erforderlich.',
  excerpt: 'iOS verwendet AVAudioSession category ambient als Baseline: Der Silent Switch wird respektiert und bereits laufende Nutzermusik darf weiterlaufen. Bei Unterbrechung wird der Kampf pausiert; eine eigene Mischoption ist in V1 nicht erforderlich.',
  norm: 'MUST', category: 'iOS',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'native', plannedPhase: 'PHASE-08', testIds: ['NAT-I-AVAUDIO-AMBIENT-057'] }],
});

// 57.1 Android requests AUDIOFOCUS_GAIN for active session, releases focus on background or finished audio context; transient loss => pause/fade; permanent loss => audio stays muted until explicit resume
add({
  id: 'REQ-TEMP-I-0097', chapter: 57, locator: 'block:1748',
  title: 'Android fordert AUDIOFOCUS_GAIN für die aktive Spielsitzung an und gibt den Fokus bei Background oder beendetem Audiokontext frei; bei transientem Verlust wird pausiert bzw. weich ausgeblendet; bei dauerhaftem Verlust bleibt Audio bis zum bewussten Resume stumm.',
  statement: 'Android fordert AUDIOFOCUS_GAIN für die aktive Spielsitzung an und gibt den Fokus bei Background oder beendetem Audiokontext frei. Bei transientem Verlust wird pausiert beziehungsweise weich ausgeblendet; bei dauerhaftem Verlust bleibt Audio bis zum bewussten Resume stumm.',
  excerpt: 'Android fordert AUDIOFOCUS_GAIN für die aktive Spielsitzung an und gibt den Fokus bei Background oder beendetem Audiokontext frei. Bei transientem Verlust wird pausiert beziehungsweise weich ausgeblendet; bei dauerhaftem Verlust bleibt Audio bis zum bewussten Resume stumm.',
  norm: 'MUST', category: 'Android',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'native', plannedPhase: 'PHASE-08', testIds: ['NAT-A-AUDIOFOCUS-057'] }],
});

// 57.1 audio mixed in 4 buses: master, music, sfx, voice; gameplay warnings on sfx bus, +3 dB priority for important warnings
add({
  id: 'REQ-TEMP-I-0098', chapter: 57, locator: 'block:1749',
  title: 'Audio wird in vier Bussen gemischt: master, music, sfx, voice; Gameplay-Warnungen liegen im SFX-Bus und werden bei wichtigen Warnungen gegenüber Musik um 3 dB priorisiert.',
  statement: 'Audio wird in vier Bussen gemischt: master, music, sfx, voice. Gameplay-Warnungen liegen im SFX-Bus und werden bei wichtigen Warnungen gegenüber Musik um 3 dB priorisiert.',
  excerpt: 'Audio wird in vier Bussen gemischt: master, music, sfx, voice. Gameplay-Warnungen liegen im SFX-Bus und werden bei wichtigen Warnungen gegenüber Musik um 3 dB priorisiert.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-08', testIds: ['IT-AUDIO-BUSES-057'] }],
});

// 57.1 similar SFX use at least 4 variants and 80 ms cooldown per cue; summon waves must not clip
add({
  id: 'REQ-TEMP-I-0099', chapter: 57, locator: 'block:1750',
  title: 'Gleichartige SFX verwenden mindestens vier Varianten und einen 80-ms-Cooldown pro Cue; Beschwörungswellen dürfen nicht clippen.',
  statement: 'Gleichartige SFX verwenden mindestens vier Varianten und einen 80-ms-Cooldown pro Cue, damit Beschwörungswellen nicht clippen.',
  excerpt: 'Gleichartige SFX verwenden mindestens vier Varianten und einen 80-ms-Cooldown pro Cue, damit Beschwörungswellen nicht clippen.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-08', testIds: ['IT-SFX-VARIANTS-057'] }],
  numericConstraints: [
    { kind: 'min', name: 'sfxVariants', value: 4 },
    { kind: 'min', name: 'sfxCooldownMs', value: 80 },
  ],
});

// 57.1 haptics only on strong own hit, shield break, boss phase, unlock, risky altar confirmation; max 1 impulse per 120 ms
add({
  id: 'REQ-TEMP-I-0100', chapter: 57, locator: 'block:1751',
  title: 'Haptik wird nur bei starkem eigenen Treffer, Schildbruch, Bossphase, Unlock und Bestätigung eines riskanten Altars genutzt; maximal ein Impuls je 120 ms.',
  statement: 'Haptik wird nur bei starkem eigenen Treffer, Schildbruch, Bossphase, Unlock und Bestätigung eines riskanten Altars genutzt; maximal ein Impuls je 120 ms.',
  excerpt: 'Haptik wird nur bei starkem eigenen Treffer, Schildbruch, Bossphase, Unlock und Bestätigung eines riskanten Altars genutzt; maximal ein Impuls je 120 ms.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-08', testIds: ['IT-HAPTIC-COOLDOWN-057'] }],
  numericConstraints: [{ kind: 'min', name: 'hapticImpulseGapMs', value: 120 }],
});

// =============== CHAPTER 58 ===============
// 58.2 atomic commit: 1) in-memory state serialized to canonical JSON with stable sorted object keys
add({
  id: 'REQ-TEMP-I-0101', chapter: 58, locator: 'block:1755',
  title: 'Atomarer Commit Schritt 1: In-Memory-State wird in kanonisches JSON serialisiert; Object Keys werden stabil sortiert.',
  statement: '1. In-Memory-State wird in kanonisches JSON serialisiert; Object Keys werden stabil sortiert.',
  excerpt: '1. In-Memory-State wird in kanonisches JSON serialisiert; Object Keys werden stabil sortiert.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-09', testIds: ['UT-COMMIT-CANONICAL-058'] }],
});

// 58.2.2 payload receives schemaVersion, contentVersion, simulationVersion, createdAt (display only), monotonicCommitId, SHA-256 over canonicalPayload
add({
  id: 'REQ-TEMP-I-0102', chapter: 58, locator: 'block:1756',
  title: 'Atomarer Commit Schritt 2: Payload erhält schemaVersion, contentVersion, simulationVersion, createdAt (nur Anzeige), monotonicCommitId und SHA-256 über canonicalPayload.',
  statement: '2. Payload erhält schemaVersion, contentVersion, simulationVersion, createdAt nur zur Anzeige, monotonicCommitId und SHA-256 über canonicalPayload.',
  excerpt: '2. Payload erhält schemaVersion, contentVersion, simulationVersion, createdAt nur zur Anzeige, monotonicCommitId und SHA-256 über canonicalPayload.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-09', testIds: ['UT-COMMIT-PAYLOAD-058'] }],
});

// 58.2.3 write to next-slot.tmp, re-read file, verify hash
add({
  id: 'REQ-TEMP-I-0103', chapter: 58, locator: 'block:1757',
  title: 'Atomarer Commit Schritt 3: In next-slot.tmp schreiben, Datei erneut lesen, Hash prüfen.',
  statement: '3. In next-slot.tmp schreiben, Datei erneut lesen, Hash prüfen.',
  excerpt: '3. In next-slot.tmp schreiben, Datei erneut lesen, Hash prüfen.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-09', testIds: ['IT-COMMIT-TMP-058'] }],
});

// 58.2.4 rename .tmp to slot file; then write manifest.new and atomically rename to manifest.json
add({
  id: 'REQ-TEMP-I-0104', chapter: 58, locator: 'block:1758',
  title: 'Atomarer Commit Schritt 4: .tmp in Slotdatei umbenennen; danach manifest.new schreiben und atomar in manifest.json umbenennen.',
  statement: '4. .tmp in Slotdatei umbenennen. Danach manifest.new schreiben und atomar in manifest.json umbenennen.',
  excerpt: '4. .tmp in Slotdatei umbenennen. Danach manifest.new schreiben und atomar in manifest.json umbenennen.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-09', testIds: ['IT-COMMIT-RENAME-058'] }],
});

// 58.2.5 only then mark UI transaction completed; on error old slot stays active and recoverable error appears
add({
  id: 'REQ-TEMP-I-0105', chapter: 58, locator: 'block:1759',
  title: 'Atomarer Commit Schritt 5: Erst jetzt UI-Transaktion als abgeschlossen anzeigen; bei Fehler bleibt alter Slot aktiv und es erscheint ein recoverable Fehler.',
  statement: '5. Erst jetzt UI-Transaktion als abgeschlossen anzeigen. Bei Fehler bleibt alter Slot aktiv und es erscheint ein recoverable Fehler.',
  excerpt: '5. Erst jetzt UI-Transaktion als abgeschlossen anzeigen. Bei Fehler bleibt alter Slot aktiv und es erscheint ein recoverable Fehler.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-09', testIds: ['IT-COMMIT-UI-058'] }],
});

// 58.4 export uses Custom SaveTransfer and system file dialog; .rwsave; MIME application/vnd.riftwarden.save+json
add({
  id: 'REQ-TEMP-I-0106', chapter: 58, locator: 'block:1763',
  title: 'Export verwendet Custom SaveTransfer und System-Dateidialog; Dateiendung .rwsave, MIME application/vnd.riftwarden.save+json.',
  statement: 'Export verwendet Custom SaveTransfer und System-Dateidialog. Dateiendung .rwsave, MIME application/vnd.riftwarden.save+json.',
  excerpt: 'Export verwendet Custom SaveTransfer und System-Dateidialog. Dateiendung .rwsave, MIME application/vnd.riftwarden.save+json.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-09', testIds: ['IT-EXPORT-FORMAT-058'] }],
});

// 58.4 import read in quarantine, size <= 10 MB, ZIP/JSON bombs excluded, hash and schema validated; never directly written over active saves
add({
  id: 'REQ-TEMP-I-0107', chapter: 58, locator: 'block:1764',
  title: 'Import wird in Quarantäne gelesen, Größe <= 10 MB, ZIP/JSON-Bomben ausgeschlossen, Hash und Schema validiert; nie direkt über aktive Saves geschrieben.',
  statement: 'Import wird in Quarantäne gelesen, Größe <= 10 MB, ZIP/JSON-Bomben ausgeschlossen, Hash und Schema validiert. Es wird nie direkt über aktive Saves geschrieben.',
  excerpt: 'Import wird in Quarantäne gelesen, Größe <= 10 MB, ZIP/JSON-Bomben ausgeschlossen, Hash und Schema validiert. Es wird nie direkt über aktive Saves geschrieben.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-09', testIds: ['IT-IMPORT-QUARANTINE-058'] }],
  numericConstraints: [{ kind: 'max', name: 'importSizeMB', value: 10 }],
});

// 58.4 before import app shows source, version, progress, conflict options: export current backup, import, abort; merge forbidden; import replaces fully
add({
  id: 'REQ-TEMP-I-0108', chapter: 58, locator: 'block:1765',
  title: 'Vor Import zeigt App Quelle, Version, Fortschritt und Konfliktoptionen: aktuelles Backup exportieren, importieren, abbrechen; Merge verboten; Import ersetzt vollständig.',
  statement: 'Vor Import zeigt die App Quelle, Version, Fortschritt und Konfliktoptionen: aktuelles Backup exportieren, importieren, abbrechen. Merge ist verboten; Import ersetzt vollständig.',
  excerpt: 'Vor Import zeigt die App Quelle, Version, Fortschritt und Konfliktoptionen: aktuelles Backup exportieren, importieren, abbrechen. Merge ist verboten; Import ersetzt vollständig.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-09', testIds: ['VIS-IMPORT-CONFLICT-058'] }],
});

// 58.4 newer unknown schema rejected without modifying active save; older schema migrated on a copy then committed
add({
  id: 'REQ-TEMP-I-0109', chapter: 58, locator: 'block:1766',
  title: 'Neueres unbekanntes Schema wird abgelehnt ohne aktiven Save zu verändern; älteres Schema wird auf einer Kopie migriert und erst danach committed.',
  statement: 'Neueres unbekanntes Schema wird abgelehnt, ohne aktiven Save zu verändern. Älteres Schema wird auf einer Kopie migriert und erst danach committed.',
  excerpt: 'Neueres unbekanntes Schema wird abgelehnt, ohne aktiven Save zu verändern. Älteres Schema wird auf einer Kopie migriert und erst danach committed.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-09', testIds: ['IT-IMPORT-SCHEMA-058'] }],
});

// 58.4 Android uses ACTION_OPEN_DOCUMENT/ACTION_CREATE_DOCUMENT; iOS UIDocumentPicker; no storage or photo permission
add({
  id: 'REQ-TEMP-I-0110', chapter: 58, locator: 'block:1767',
  title: 'Android nutzt ACTION_OPEN_DOCUMENT/ACTION_CREATE_DOCUMENT, iOS UIDocumentPicker; keine Speicher- oder Fotoberechtigung.',
  statement: 'Android nutzt ACTION_OPEN_DOCUMENT/ACTION_CREATE_DOCUMENT, iOS UIDocumentPicker. Keine Speicher- oder Fotoberechtigung.',
  excerpt: 'Android nutzt ACTION_OPEN_DOCUMENT/ACTION_CREATE_DOCUMENT, iOS UIDocumentPicker. Keine Speicher- oder Fotoberechtigung.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'native', plannedPhase: 'PHASE-09', testIds: ['NAT-AI-DOCPICKER-058'] }],
});

// 58.5.1 check manifest and active slot
add({
  id: 'REQ-TEMP-I-0111', chapter: 58, locator: 'block:1769',
  title: 'Recovery Schritt 1: Manifest und aktiven Slot prüfen.',
  statement: '1. Manifest und aktiven Slot prüfen.',
  excerpt: '1. Manifest und aktiven Slot prüfen.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-09', testIds: ['UT-RECOVERY-1-058'] }],
});

// 58.5.2 on error check other slots by highest valid commitId
add({
  id: 'REQ-TEMP-I-0112', chapter: 58, locator: 'block:1770',
  title: 'Recovery Schritt 2: Bei Fehler andere Slots nach höchster gültiger commitId prüfen.',
  statement: '2. Bei Fehler die anderen Slots nach höchster gültiger commitId prüfen.',
  excerpt: '2. Bei Fehler die anderen Slots nach höchster gültiger commitId prüfen.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-09', testIds: ['UT-RECOVERY-2-058'] }],
});

// 58.5.3 on valid fallback load it, do not delete damaged slot, inform player once
add({
  id: 'REQ-TEMP-I-0113', chapter: 58, locator: 'block:1771',
  title: 'Recovery Schritt 3: Bei gültigem Fallback diesen laden, beschädigten Slot nicht löschen, Spieler einmal informieren.',
  statement: '3. Bei gültigem Fallback diesen laden, beschädigten Slot nicht löschen und Spieler einmal informieren.',
  excerpt: '3. Bei gültigem Fallback diesen laden, beschädigten Slot nicht löschen und Spieler einmal informieren.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-09', testIds: ['IT-RECOVERY-3-058'] }],
});

// 58.5.4 if profile valid and run damaged: load permanent progress, mark run safely ended; unsaved run loot expires only after explicit confirmation
add({
  id: 'REQ-TEMP-I-0114', chapter: 58, locator: 'block:1772',
  title: 'Recovery Schritt 4: Wenn Profil gültig und Run beschädigt, permanenten Fortschritt laden und Run als sicher beendet markieren; ungesicherter Runloot verfällt nur nach expliziter Bestätigung.',
  statement: '4. Wenn Profile gültig, Run beschädigt: permanenter Fortschritt laden und Run als sicher beendet markieren; ungesicherter Runloot verfällt nur nach expliziter Bestätigung.',
  excerpt: '4. Wenn Profile gültig, Run beschädigt: permanenter Fortschritt laden und Run als sicher beendet markieren; ungesicherter Runloot verfällt nur nach expliziter Bestätigung.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-09', testIds: ['IT-RECOVERY-4-058'] }],
});

// 58.5.5 if no slot valid: offer import/new profile; never auto-delete
add({
  id: 'REQ-TEMP-I-0115', chapter: 58, locator: 'block:1773',
  title: 'Recovery Schritt 5: Wenn kein Slot gültig, Import/Neues Profil anbieten; keine automatische Löschung.',
  statement: '5. Wenn kein Slot gültig: Import/Neues Profil anbieten. Keine automatische Löschung.',
  excerpt: '5. Wenn kein Slot gültig: Import/Neues Profil anbieten. Keine automatische Löschung.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-09'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-09', testIds: ['IT-RECOVERY-5-058'] }],
});

// Write output
const out = {
  schemaVersion: '1.0',
  chunk: 'i',
  chapterRange: { lo: 48, hi: 58 },
  requirements,
};

const outPath = resolve(process.cwd(), 'docs/requirements/requirements/_staging/chunk-i.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Wrote ${requirements.length} requirements to ${outPath}`);