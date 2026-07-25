# Phase-05 Failure Injection Record

| Fall | Injektion | Erwartete Route/Reaktion | Tatsächlich | Evidence | Status |
|---|---|---|---|---|---|
| FI-BOOT-01 | Native Bridge fehlt | Recovery, retryfähig | | | BLOCKED |
| FI-BOOT-02 | Web-Boot wirft | Fatal shell | | | BLOCKED |
| FI-BOOT-03 | Settings timeout | Recovery, Safe Defaults capability | | | BLOCKED |
| FI-BOOT-04 | Content invalid | Fatal/Recovery, kein Teilstart | | | BLOCKED |
| FI-BOOT-05 | Save invalid | Recovery, Save unverändert | | | BLOCKED |
| FI-LIFE-01 | Duplicate background event | idempotent | | | BLOCKED |
| FI-LIFE-02 | Out-of-order active event | keine Doppelinitialisierung | | | BLOCKED |
| FI-LIFE-03 | Snapshot >250 ms | Diagnose + letzter Save bleibt gültig | | | BLOCKED |
| FI-DIAG-01 | Logstore wirft | App läuft weiter | | | BLOCKED |
| FI-DIAG-02 | PII-Key | Feld verworfen | | | BLOCKED |
| FI-GL-01 | WebGL2 fehlt/WebGL1 da | validierter WebGL1-Pfad | | | BLOCKED |
| FI-GL-02 | WebGL ganz fehlt | Compatibility-Shell | | | BLOCKED |
| FI-GL-03 | Context restore zweimal fehlschlägt | Compatibility-Shell | | | BLOCKED |
