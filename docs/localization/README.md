# Localization Authoring

## Sourceformat

Jede Namespace-Datei ist striktes JSON. Duplicate Keys und verbotene Steuerzeichen werden vor `JSON.parse` erkannt. Jeder Messageeintrag besitzt Copy, Beschreibung, Budget, optionalen Compactkey, Parameterbudgets und Reviewmetadaten.

## Keyschema

- UI: `ui.<semantischer_bereich>.<semantisches_element>`
- Content: `content.<type>.<lower_snake_case_id>.<field>`
- Accessibility: `a11y.<semantischer_bereich>.<element>`
- Untertitel: `subtitle.<cue_id>.<field>`
- Logs/Diagnostik: sichtbare Labels lokalisiert; technische Codes niemals übersetzen.

Verboten: Sätze als Keys, Hashes als Keys, numerische Screenaliasse als Copykey, zufällige IDs und Keygenerierung aus der Sourcecopy.

## Workflow

1. Key und DE-Autorencopy anlegen.
2. Beschreibung und Parameterbudget ergänzen.
3. EN fachlich übersetzen; Branch-/Tokenstruktur beibehalten.
4. `locale:validate` ausführen.
5. Pseudo neu generieren; niemals manuell bearbeiten.
6. Golden Fixtures in DE/EN/Pseudo prüfen.
7. Linguistikreview dokumentieren.
8. Erst danach `approved` mit Reviewer und Datum setzen.
9. Releasevalidator und gesamte CI ausführen.

## Compact Copy

Überschreitet ein Primary Button das Budget, darf die UI nicht pauschal schrumpfen. Eine fachlich genehmigte kompakte Alternative erhält einen eigenen semantischen Key; der lange Eintrag referenziert ihn über `compactKey`. Beide Sprachen brauchen denselben Compactvertrag.

## Add-Locale-Flow

1. neue Locale-ID im Regel-/Manifest-SSOT genehmigen;
2. Registryloader hinzufügen, ohne Screenlogik zu ändern;
3. alle Namespaces aus DE kopieren und Copy als `draft` markieren;
4. Paritäts-, Plural-, Token-, Budget- und Glossarvalidator ausführen;
5. Testlocale-Smoke mit mindestens einer echten zusätzlichen Locale durchführen;
6. Visualmatrix und 200%-Text prüfen;
7. linguistisch freigeben;
8. Releasepicker und Manifest erst nach Gatefreigabe erweitern.
