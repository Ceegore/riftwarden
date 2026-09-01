# Riftwarden Threat Model v1.0

Generated: August 2026 | Source Revision: fbc473b | Status: PRELIMINARY (real binary audit pending)

## Assets

| Asset | Sensitivity | Location | Persistence |
|---|---|---|---|
| Profile (gold, heroes, troops, relics) | High — player progress | localStorage | Permanent |
| Expedition save (run state, seed, map) | Medium — temporary run | localStorage | Until run end |
| Settings (a11y, audio, graphics) | Low — user preferences | localStorage | Permanent |
| Mission progress | Medium — unlock state | localStorage | Permanent |
| Codex entries | Low — discovery log | localStorage | Permanent |
| Source code | Public — but integrity matters | Static bundle | Ephemeral |
| No PII, no accounts, no telemetry | — | — | — |

## Trust Boundaries

```
┌─────────────────────────────────────────────┐
│ Browser / WebView                            │
│  ┌───────────────┐  ┌──────────────────────┐ │
│  │ React App     │  │ localStorage (trusted)│ │
│  │ (untrusted)   │──│ only store            │ │
│  └───────────────┘  └──────────────────────┘ │
│         │                                     │
│         ▼ (no network — CSP blocks all)       │
│  ┌───────────────┐                            │
│  │ PixiJS canvas │ (internal rendering only)  │
│  └───────────────┘                            │
└─────────────────────────────────────────────┘
```

## Entry Points

1. **index.html** — SPA bootstrap; CSP restricts script-src to 'self'
2. **localStorage** — all persistence; no server-side data exists
3. **Import diagnostic** — user-initiated JSON export/import; validated via `decodeExpeditionSave`
4. **Capacitor native bridges** (Android/iOS) — audio session, haptics, filesystem; no network permission

## Threats & Mitigations

| Threat | Severity | Mitigation |
|---|---|---|
| Corrupted localStorage | Medium | All reads use try/catch with safe defaults |
| Malformed import JSON | Medium | Schema validation rejects extra keys, negative values |
| XSS via user content | Low | No user-generated content; CSP blocks inline scripts |
| Data exfiltration | None | Zero network code; CSP prevents fetch/WebSocket |
| Save tampering via console | Low | All values are validated on decode; run state is seed-deterministic |
| WebView deep link abuse | Low | No deep link handlers; app is self-contained |
| Dependency supply chain | Medium | Lockfile frozen; no install-time scripts allowed |
| Native bridge abuse | Low | Bridges are declarative; no eval or dynamic invocation |

## Residual Risks (requiring real binary audit)

- Capacitor plugin permissions on Android/iOS — must be verified against merged manifest
- CSP on production web build — must be verified against deployed `index.html`
- Dependency license audit — must be regenerated from final lockfile
- Bundle integrity — SHA-256 must match CI artifact

## Conclusion

Riftwarden has no network access, no accounts, no telemetry, no user-generated content, no analytics, and no server backend. All data is stored in localStorage and validated on decode. The highest residual risks are supply-chain integrity (requiring a production lockfile audit) and native permission verification (requiring real Android/iOS builds).
