# Repository map and authority boundaries

| Path | Responsibility | Must never own |
|---|---|---|
| `src/app` | bootstrap, router, error boundaries, lifecycle | combat rules |
| `src/screens` | screen containers and orchestration | simulation logic or native access |
| `src/features` | feature services, stores, selectors | direct filesystem/native plugin access |
| `src/game/rules` | named global rules and pure shared types | React, DOM, native APIs |
| `src/game/sim` | pure deterministic simulation | React, DOM, Pixi, Zustand, Capacitor, `Date.now`, `Math.random` |
| `src/game/content` | validated generated content and indexes | screen logic, localized-name IDs |
| `src/game/render` | immutable snapshots/events to Pixi presentation | mutation of simulation state |
| `src/game/replay` | canonical snapshots, event log, playback | renderer/UI authority |
| `src/ui` | generic components and tokens | hero, boss or mission special cases |
| `src/audio` | buses, cues and audio-session adapter | gameplay outcomes |
| `src/storage` | saves, migrations, checksum, import/export | concrete screen presentation |
| `src/platform` | Capacitor/native adapters and web mocks | feature-specific UI logic |
| `src/locales` | locale registry and messages | gameplay identifiers |

Generated content and processed assets live only in the designated generated directories. Native projects are committed later and remain subordinate to the same product, privacy and permission contracts.
