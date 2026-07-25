# Designsystem-Betriebsregeln

- Tokenänderung nur in `tokens.source.json`; Generatorausgaben nie manuell ändern.
- Neue Komponente benötigt Propsvertrag, Zustandsmatrix, semantische Markupprüfung, 48x48-/56px-Prüfung, DE/EN/Pseudo-Fixtures und Releaseauswirkungsnotiz.
- Keine Komponente darf Screen-, Save-, Economy-, Held-, Boss- oder Navigationsregeln besitzen.
- Auswahl und Aktivierung sind getrennt; Loading behält das Verb; Tooltip ist per Tap/Fokus zugänglich; Modal restauriert Fokus.
- Goldenupdates sind Reviewentscheidungen, keine automatische Fehlerbehebung.
