# Riftwarden

Auto-RPG / roguelite game (TypeScript / React / Vite / Capacitor; target Android + iOS).

This repository is built under a **GLM-5.2 + MiniMax-M3 orchestration** model:
GLM-5.2 is the orchestrator and acceptance authority; MiniMax-M3 is the primary
implementation executor, driven through an API-to-API supervisor adapter.

## Authoritative sources

| Source | Path | Role |
|---|---|---|
| GDD V5.0 | `docs/source/Riftwarden_GDD_V5_0.docx` | Product-design authority (sha256 `f550bdf3…6ed9`) |
| Dev Plan V2.0 | `docs/source/Riftwarden_Entwicklungsplan_V2_0.docx` | Supporting (sequence, ticket sizing, file/git/test policy) — **not** design authority |

The detailed phase handbooks and planning archives live on disk but outside git
(see `.gitignore`). Orchestration state lives under `.orchestrator/`.

## Status

Greenfield. Initialization + Phase 00 in progress. See `.orchestrator/PROJECT_STATE.json`.
