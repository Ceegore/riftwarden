# Phase-05 Manual Smoke Record

- SourceRevision:
- Build channel:
- Plattform:
- Gerät/Browser:
- OS/Version:
- Tester:
- UTC:
- Screen capture / log artifact:

## Szenario

- [ ] Cold Start ohne weißen Frame
- [ ] Native Splash verschwindet erst nach stabilem Frame
- [ ] Langsamer Boot zeigt 150-ms-/2-s-Regeln
- [ ] Bootfehler bleibt bedienbar
- [ ] Back- und Fokuspfad geprüft
- [ ] Background stoppt Sim/Render/Input/Audio
- [ ] Resume zeigt bewusst pausierten Zustand
- [ ] No-WebGL zeigt Compatibility-Shell
- [ ] Context Loss erzeugt Pause/Snapshot
- [ ] Zwei Restorefehler führen zur Shell
- [ ] Menüs bleiben ohne WebGL bedienbar
- [ ] Kein Save wurde gelöscht oder repariert
- [ ] Kein App-Netzwerktraffic
- [ ] Keine personenbezogenen Logfelder

## Messergebnisse

| Messung | Ziel | Ergebnis | PASS/BLOCKED |
|---|---:|---:|---|
| Memory-Snapshot | <=250 ms | | |
| Background Simticks | 0 | | |
| Background Renderframes | 0 | | |
| Background Audiobewegung | 0 | | |
| Logsession | <=512 KiB | | |
| Gesamte Logs | <=2,5 MiB | | |

## Beobachtungen

## Defekte
