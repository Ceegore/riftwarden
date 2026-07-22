# Generated Normalization Report

> Generated from Phase 00 SSOT. Do not edit manually.

| ID | Topic | Status | Priority | Affected REQs | Review | Canonical rule |
| --- | --- | --- | --- | --- | --- | --- |
| NORM-001 | Repository | active | 1 |  | requires_review | Ein einzelnes pnpm-Repository ohne Workspace-Packages und ohne Monorepo-Tooling. /src/game/sim bleibt ein normales internes Modul. |
| NORM-002 | Screenzustand | active | 1 |  | requires_review | Kanonischer technischer Enum: loading, ready, empty, recoverable_error, fatal_error. blocked wird als ready plus typed BlockReason modelliert. |
| NORM-003 | First Boot | active | 1 |  | requires_review | Screen-IDs folgen dem konkreten Kapitel-54-Katalog: S00 Splash, S01 Bootstrap/Recovery, S02 Erststart, S03 Titel, S04 Neues Spiel. Flows verwenden semantische ScreenIds. |
| NORM-004 | Renderer | active | 1 |  | requires_review | PixiJS 8 WebGL/WebGL2. WebGPU in V1 aus. Kein CanvasRenderer. Ohne WebGL: Compatibility/Recovery-Screen; Menüs und Saveexport bleiben bedienbar. |
| NORM-005 | Atlas | active | 1 |  | requires_review | 4096x4096 ist harter Maximalwert, 2048 bevorzugt auf Minimumgeräten, 2 px Extrude/Padding. |
| NORM-006 | Audioformate | active | 1 |  | requires_review | OGG Vorbis für Web/Android; AAC-LC/M4A für iOS; gleiche Cue-ID und Loopmarker. |
| NORM-007 | Audiobusse | active | 1 |  | requires_review | master, music, sfx, voice, ui, ambient. |
| NORM-008 | Saveexport | active | 1 |  | requires_review | .riftwarden-save; separater .riftwarden-diagnostic. Keine ältere .rwsave-Endung in V1. |
| NORM-009 | Textscale | active | 1 |  | requires_review | 100/125/150/175/200 Prozent. |
| NORM-010 | Contentpfad | active | 1 |  | requires_review | /content/source, /content/schemas, /content/generated. Runtime-Index unter src/game/content; keine manuellen Datenobjekte im UI-Code. |
| NORM-011 | Installationsbudget | active | 1 |  | requires_review | 250 MiB Ziel, 350 MiB harter Releaseblocker ohne ADR. |
| NORM-012 | Coverage | active | 1 |  | requires_review | >=95% Branch-Coverage in game/sim und storage/migrations; kritische Regeln vollständig abgedeckt. |
| NORM-013 | Massensimulation | active | 1 |  | requires_review | Mindestens 100.000 Kämpfe pro RC. Zusätzlich mindestens 1.000 generierte Fälle pro definierter Property-Invariante. |
| NORM-014 | Dungeon-QA | active | 1 |  | requires_review | 100.000 Karten über Missions-/Modusprofile; null Sackgassen, Pflichtknoten- oder Längenverletzungen. |
| NORM-015 | Settings | active | 1 |  | requires_review | settings.json ist autoritativ. Capacitor Preferences enthält nur nichtautoritative Boot-Hinweise, etwa zuletzt bekannte Sprache. |
| NORM-016 | Zeitlimit | active | 1 |  | requires_review | 90 s normal/elite, 120 s Boss, 15 s Kollaps, 180 s absoluter Failsafe; spätere Tie-Break-Reihenfolge. |
| NORM-017 | Low-End | active | 1 |  | requires_review | Simulation bleibt immer 30 TPS. Low/Minimum darf 30 Render-FPS und kosmetisch reduzierte Qualität nutzen, niemals Tickskip oder Telegraphieverlust. |
| NORM-018 | Voice | active | 1 |  | requires_review | DE- und EN-Sprachausgabe ist für den in Kapitel 82.4 beschriebenen Pflichtscope Releaseinhalt, kein optionales Nice-to-have. |
| NORM-019 | Dependency | active | 1 |  | requires_review | Nur die V5-Allowlist. Neues Runtime-Paket benötigt Security-/Lizenz-/Bundleprüfung und ADR; Designfunktion zusätzlich neue GDD-Version. |
| NORM-020 | Contentreihenfolge | active | 1 |  | requires_review | Vollständige GDD-Inhalte werden früh strukturell extrahiert und validiert. Produktionsassets, vollständige Balance und Politur werden erst nach bestandenem Vertical Slice skaliert. |
| NORM-021 | Externe Restwerte | active | 1 |  | requires_review | Legal Name, Support/Privacy URLs, Preisstufe und finale IDs blockieren Entwicklung nicht, aber Closed Test/TestFlight beziehungsweise Submission über Buildvalidatoren. |
