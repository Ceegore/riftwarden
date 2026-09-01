# GDD V5 – Autoritative Kapitel für Phase 10

- Quelle: `Riftwarden_Auto_RPG_Roguelite_GDD_V5.docx`
- SHA-256: `f550bdf33f3c23787156c0b138f42d29958c84e1dcda562010fbb0874f9d6ed9`
- Extraktionsumfang: Kapitel 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31, 32, 33, 34, 41, 43, 47, 48, 59, 70, 75, 86

## 2. Verbindliche Produktdefinition
Riftwarden: Auto RPG Roguelite ist ein kompaktes Fantasy-Roguelite mit vollständig automatischen Gruppenkämpfen in stilisierter Seitenansicht. Der Spieler ist der anonyme Riftwarden und Kommandant einer kleinen Abenteurerkompanie. Er stellt Gruppen aus einzigartigen Helden und mehrfach einsetzbaren Truppentypen zusammen, rüstet sie aus, bestimmt ihre Formation und wählt eine taktische Doktrin. Während eines Kampfes werden keine Fähigkeiten manuell ausgelöst und keine Einheiten bewegt.
Die eigentliche Spielerleistung besteht aus Lesen, Vergleichen, Planen, Beobachten, Analysieren und Anpassen.
Ein regulärer Kampf dauert normalerweise 20-45 Sekunden, ein Elitekampf 35-60 Sekunden und ein Bosskampf 60-100 Sekunden auf normaler Geschwindigkeit.
Das Spiel erzeugt keinerlei Fortschritt ohne aktives Spielen. Es gibt keine Energie, Wartezeit, Offline-Erträge, Tagesaufgaben oder Live-Service-Abhängigkeit.
Eine verlorene Expedition kostet einen Teil der ungesicherten Beute, aber niemals Helden, Verträge oder bereits freigeschaltete permanente Systeme.
Die Kampagne ist abgeschlossen und rechtfertigt den Kauf allein. Ascension und Endlose Rift sind substanzielle Endgame-Modi, keine Ausrede für fehlenden Kampagneninhalt.
### 2.1 Release-Umfang
| Inhaltsgruppe | Release-Ziel |
| --- | --- |
| Kampagne | 4 Akte, je 5 Expeditionen, insgesamt 20 klar definierte Missionen |
| Helden | 10 einzigartige Helden, jeweils Level 1-3 und 5 Meisterschaftsziele |
| Truppen | 18 Verträge, jeweils bis zu 3 gleichzeitig einsetzbare Kopien |
| Beschwörungen | 14 fest definierte Beschwörungstypen; maximal 6 aktive pro Seite |
| Regionen | 4 Regionen mit je 7 Grundgegnern, regionalen Regeln und eigenem Hauptboss |
| Zwischenbosse | 4 feste Zwischenbosse plus Elite- und Championvarianten |
| Ausrüstung | 42 permanente Objekte: 12 Hauptausrüstungen, 12 Talismane, 12 Truppenkits, 6 Banner |
| Relikte | 36 temporäre Relikte für Expeditionen/Ascension |
| Ereignisse | 30 vollständige Ereignisse mit transparenten Optionen |
| Schlachtfeld | 7 Kampfvarianten und 18 sichtbare Modifikatoren |
| Endgame | 10 kuratierte Ascension-Ränge, 28 Konstellationsknoten, Jenseits-Modus und Endlose Rift |
| Meta | Kodex, 36 interne Erfolge, lokale Rekorde, kosmetische Freischaltungen |

## 4. Welt, Ton und Erzählrahmen
### 4.1 Weltregel: Rifts und Echos
Ein fehlgeschlagenes magisches Experiment zerriss die Übergänge zwischen vier verbundenen Regionen. Rifts enthalten verzerrte Kopien realer Orte, Erinnerungen und möglicher Zukünfte. Diese Kopien heißen Echos. Echos erklären prozedural variierende Dungeons, wiederkehrende Gegner und widersprüchlich wirkende, aber thematisch passende Szenen.
### 4.2 Der Riftanker
Der Riftanker bindet jede Expedition an das Hauptquartier.
Nach einem Sieg rekonstruiert er alle gefallenen regulären Einheiten, heilt die Gruppe vollständig, entfernt normale Statuswirkungen und löscht Kampf-Beschwörungen.
Wenn keine reguläre Einheit der Spielergruppe kampffähig bleibt, bricht die Verbindung zusammen und die Expedition endet.
Die Rückkehr nach einer Niederlage ist erzählerisch eine Notrekonstruktion und kein Tod.
Der Anker ist die zentrale visuelle Metapher für Speichern, Rückkehr, Ascension und Endlose Rift.
### 4.3 Der Riftwarden
Der Spielercharakter bleibt unsichtbar, unbenannt und ohne festgelegtes Geschlecht. Figuren sprechen den Spieler als Riftwarden oder Kommandant an. Entscheidungen werden durch Missions-, Routen- und Ereigniswahl getroffen. Es existiert kein Dialograd und keine moralische Statistik.
### 4.4 Pip
Pip ist ein schwebendes Kristall-Echo, Tutorialbegleiter und kurzer Kommentator. Pip spricht in maximal zwei kurzen Sätzen am Stück, erklärt nie bereits sichtbare Informationen doppelt und unterbricht keine wiederholten Kämpfe. Humor: selbstüberschätzend, neugierig, freundlich, nie zynisch.
### 4.5 Der Kurator
Der Kurator möchte jede Region in einer idealisierten, unveränderlichen Echo-Fassung konservieren. Er ist höflich, theatralisch und überzeugt, Chaos sei ein Fehler. Sein Plan reduziert Menschen und Kreaturen auf feste Rollen und vernichtet mögliche Zukunftsvarianten. Humor entsteht aus seiner übertriebenen Inszenierung, nicht aus der Verharmlosung seines Ziels.
### 4.6 Ton- und Altersregeln
Popcorn-Fantasy: leichte, charmante Figuren in einer echten, aber nicht deprimierenden Gefahr.
Kein Blut, keine Wunden, keine Zerstückelung, keine Leichen, keine realistischen Todesschreie.
Besiegte Figuren zerfallen in Echofunken, Rauch, Blätter, Metallteile oder humorvolle Knochenhaufen.
Keine harte Vulgärsprache, sexualisierten Inhalte, realen politischen/religiösen Konflikte oder diskriminierenden Aussagen.
Humor darf Bossauftritte, Ereignisse und Animationen auflockern, aber taktische Konsequenzen bleiben ernst und lesbar.

## 6. Verbindliches Kampfsimulationsmodell
### 6.1 Koordinaten, Bahnen und Startfelder
Das logische Schlachtfeld verwendet eine horizontale X-Achse von 0 bis 100 und drei diskrete Bahnen: oben, Mitte, unten.
Spielerseite bewegt sich grundsätzlich in positive X-Richtung; Gegnerseite in negative X-Richtung.
Eigene Startzonen: Hinten X=8, Mitte X=18, Front X=28. Gegnerische Spiegelwerte: 92, 82, 72.
Eine Einheit besitzt einen Kollisionsradius. Baseline: klein 1,2; normal 1,8; groß 2,8; Boss 4,0.
Verbündete dürfen sich innerhalb einer Bahn überholen, wenn die überholende Einheit mindestens 25% schneller ist oder eine Fähigkeit dies erlaubt. Gegnerische Körper können nicht durchlaufen werden.
Ein Bahnwechsel dauert baseline 1,2 Sekunden, unterbricht den aktuellen Standardangriff und ist nur durch Zielregel, Doktrin oder Fähigkeit erlaubt.
Bahnwechselpositionen werden visuell diagonal animiert, logisch bleibt eine Einheit während der ersten 50% auf der Ausgangsbahn und danach auf der Zielbahn.
### 6.2 Referenzwerte und Einheitenstatistiken
| Wert | Bedeutung | Typischer Bereich regulärer Einheiten |
| --- | --- | --- |
| LP | Maximale Lebenspunkte | 650-1.800 |
| Rüstung | Reduziert physischen Schaden | 0-60 |
| Widerstand | Reduziert magischen Schaden | 0-60 |
| Angriffskraft | Basis für Standardangriff und Fähigkeiten | 70-170 |
| Angriffsintervall | Zeit zwischen Angriffsbeginn und nächstem Angriffsbeginn | 0,75-2,4 s |
| Vorbereitung | Telegraphierte Zeit vor Treffer/Projektil | 0,15-0,9 s |
| Reichweite | Maximaler horizontaler Abstand auf gleicher Bahn | 2,5-35 |
| Bewegung | Logische X-Einheiten pro Sekunde | 4,0-9,0 |
| Fähigkeitsladung | Zeit bis zur wiederholbaren Signaturfähigkeit | 8-18 s |
| Kontrollresistenz | Reduziert Dauer harter Kontrolle | 0-50% regulär; 65-85% Boss |
### 6.3 Schadensformeln
Physischer Endschaden = Rohschaden x 100 / (100 + effektive Rüstung). Magischer Endschaden verwendet dieselbe Formel mit Widerstand. Reiner Schaden ignoriert Rüstung und Widerstand, darf aber nie mehr als 18% der maximalen LP eines Bosses durch einen einzelnen Treffer verursachen. Effektive Verteidigung kann nicht unter -40 und nicht über 200 liegen.
Standardangriff-Rohschaden = Angriffskraft x Angriffsmultiplikator.
Kritische Treffer existieren nicht als globaler Zufallswert. Nur ausdrücklich benannte Fähigkeiten dürfen einen festen kritischen Effekt besitzen.
Flächenschaden verwendet für jedes Ziel separat Verteidigung und Schild.
Schilde absorbieren Endschaden vor LP. Mehrere Schilde bilden einen gemeinsamen Schildpool, behalten aber ihre eigene Ablaufzeit; zuerst läuft/verbrauchte Quelle wird zuerst abgebaut.
Heilung kann LP nicht über das Maximum erhöhen. Überheilung verfällt, außer eine Fähigkeit wandelt sie ausdrücklich in Schild um.
Mindestschaden eines erfolgreichen Angriffs ist 1. Verfehlungen existieren nur durch ausdrücklich definierte Ausweich- oder Unverwundbarkeitsregeln.
Angriffsgeschwindigkeit verändert das gesamte Intervall, aber nie unter 0,45 Sekunden. Bewegungsgeschwindigkeit nie unter 2,0 und nie über 14,0.
### 6.4 Angriffszustandsmaschine
Ziel validieren oder nach Zielscore neu wählen.
In Reichweite bewegen. Das Ziel wird alle 0,25 Sekunden validiert, aber nicht wegen minimaler Positionsänderungen gewechselt.
Angriff vorbereiten. Während der Vorbereitung ist die Aktion sichtbar und kann durch Betäubung oder eine als Unterbrechung markierte Fähigkeit abgebrochen werden.
Treffer oder Projektil erzeugen. Projektiltreffer verwenden die Zielposition zum Abschusszeitpunkt plus definierte Verfolgung; normale Pfeile verfolgen nicht zwischen Bahnen.
Erholungsphase. Bewegung ist bei normalen Einheiten während der ersten Hälfte gesperrt; danach darf die Einheit nachrücken.
Nächstes Intervall planen und Ziel erneut validieren.
### 6.5 Fähigkeiten und Ladung
Wiederholbare Fähigkeiten besitzen eine Startladung und eine Wiederaufladung. Wenn nur ein Wert angegeben ist, sind beide identisch.
Ladung läuft ab Kampfbeginn, auch während Bewegung. Stille stoppt die Ladung nicht, verhindert aber den Start; die fertige Fähigkeit wartet.
Eine Fähigkeit startet nur mit gültigem Ziel und sinnvoller Wirkung. Eine Heilung wird beispielsweise erst ausgelöst, wenn das Ziel mindestens 12% LP vermisst, sofern nicht anders festgelegt.
Wird eine Fähigkeit während ihrer Vorbereitung unterbrochen, verliert sie 35% ihrer vollen Ladung und beginnt danach von diesem Stand neu. Einmal-pro-Kampf-Fähigkeiten gelten erst beim Effekt als verbraucht.
Phasenwechsel eines Bosses können laufende Aktionen abbrechen; dies wird in der Bossdefinition einzeln festgelegt.
Startbeschwörungen und Startkonstruktionen werden nach passiven Synergien, aber vor dem ersten Bewegungstick erzeugt.
### 6.6 Kampfende, Zeitlimit und Gleichstand
Ein Kampf endet, sobald eine Seite keine kampffähige reguläre Einheit mehr besitzt. Beschwörungen allein halten den Kampf nicht offen.
Reguläre Einheiten sind Helden, Truppen und als regulär markierte Gegner/Bosse; temporäre Kampf-Beschwörungen sind nicht regulär.
Normales weiches Zeitlimit: 90 Sekunden. Bosslimit: 120 Sekunden. Bei Erreichen beginnt der 15 Sekunden lange Riftkollaps.
Während des Riftkollapses erhalten alle regulären Einheiten alle 3 Sekunden reinen Schaden in Höhe von 8% ihrer maximalen LP; Heilung ist um 50% reduziert.
Sind nach weiteren 15 Sekunden beide Seiten noch regulär kampffähig, gewinnt die Seite mit höherer Summe aus verbleibenden LP-Prozenten plus halbem Schild-Prozent. Exakter Gleichstand gilt als Niederlage des Spielers, wird aber als Sondergrund ausgewiesen.
Zeitlimits sind Anti-Stall-Schutz und sollen in weniger als 2% balancierter Kämpfe greifen.
### 6.7 Determinismus und Zufall
Jeder Kampf erhält einen gespeicherten Seed. Gleiche Startdaten, Seed und Simulationsversion müssen dasselbe Ergebnis erzeugen.
Zufall wird nur für explizite Varianten genutzt: gleichwertige Ziel-Tiebreaks, angekündigte Ereignisspannen und bestimmte Relikte.
Tiebreak-Reihenfolge ohne Zufall: höchster Zielscore, geringste Distanz, niedrigste verbleibende LP in absoluten Punkten, niedrigste stabile Entity-ID.
Geschwindigkeitsstufe, Pause, Kamera und reduzierte Effekte dürfen das Ergebnis nie verändern.
Ein Kampfreplay speichert nicht jeden Frame, sondern Startsnapshot, Seed, Simulationsversion und Spieler-Geschwindigkeitsereignisse nur für Darstellung.
Implementierungs- und Abnahmekriterien
Ein Kampf liefert bei zehn identischen Wiederholungen byte-identische Ergebnisdaten.
Keine Einheit wechselt in fünf Sekunden mehr als zweimal ohne ausdrückliche Mobilitätsfähigkeit die Bahn.
Alle Fähigkeiten können aus Kampfprotokoll und UI-Icon auf Trigger, Ziel und Ergebnis zurückgeführt werden.
Kampfgeschwindigkeit 0,5x, 1x, 2x und 3x erzeugt dieselben Sieger, Schäden und Triggerzeitpunkte in Simulationszeit.
Ein Kampf kann nicht durch reine Beschwörungen nach Tod aller regulären Einheiten fortgesetzt werden.

## 7. Zielwahl, Bedrohung und Doktrinen
### 7.1 Zielscore
Jede offensive Einheit bewertet gültige Ziele. Basisscore = 100 - Distanz x 2. Dazu kommen Rollen-, Bahn-, Fähigkeits- und Doktrinwerte. Das höchste Ergebnis wird gewählt. Ein bestehendes Ziel erhält +18 Bindungsbonus, damit Einheiten nicht flackern. Ein Wechsel findet nur statt, wenn ein neues Ziel den aktuellen Score um mindestens 20 übertrifft oder das aktuelle Ziel ungültig wird.
| Scorekomponente | Wert |
| --- | --- |
| Gleiche Bahn | +45 |
| Benachbarte Bahn ohne Ziel auf eigener Bahn | +15 |
| Ziel bedroht diese Einheit | +12 |
| Ziel ist regulär statt Beschwörung | +8, außer Anti-Beschwörer |
| Ziel besitzt weniger als 30% LP | +10 für Duellanten |
| Ziel besitzt Schild oder Konstruktion | +30 für Brecher |
| Ziel ist Unterstützer/Magier/Beschwörer | +28 für Jäger |
| Ziel trägt aktive Verstärkung | +30 für Bannwirker |
| Ziel gehört zu Fokusfeuerziel | +25 |
| Ziel ist durch Blocker nicht erreichbar | -1000 |
| Bahnwechsel nötig | -18 |
| Ziel ist beschworen | -8 standardmäßig |
### 7.2 Rollenprioritäten
| Rolle | Primäre Regel | Sekundäre Regel |
| --- | --- | --- |
| Verteidiger | Nächstgelegenen Gegner binden, der die eigene Front bedroht | Wechselt nur zum Schutz eines bedrohten Hinterziels |
| Brecher | Schild-, Rüstungs- oder Konstruktionsziel | Danach robustestes erreichbares Ziel |
| Kämpfer | Nächstes erreichbares reguläres Ziel | Behält Ziel bis deutlicher Scorewechsel |
| Duellant | Verwundbares, schwach geschütztes Einzelziel | Darf mit Fähigkeit eine Bahn wechseln |
| Schütze | Freies Ziel auf eigener Bahn | Bevorzugt Fokusfeuer und geringe Deckung |
| Flächenmagier | Zielpunkt mit höchster Zahl gültiger Ziele | Bei Gleichstand gefährlichste Gruppe |
| Heiler | Verbündeter mit niedrigstem LP-Prozent, gewichtet nach drohendem Schaden | Heilt nicht bei weniger als 12% fehlenden LP |
| Unterstützer | Ziel mit größtem erwarteten Nutzen | Keine unnötige Selbstverstärkung |
| Beschwörer | Bleibt hinter nächstem Verbündeten; greift nächstes Ziel | Beschwörungen folgen eigener Regel |
| Kontrollmagier | Gruppe mehrerer Gegner oder Fähigkeitsträger kurz vor Auslösung | Bosse erhalten reduzierte Kontrolldauer |
### 7.3 Deckung und Schutzlinie
Eine reguläre Einheit bietet Deckung für Verbündete derselben Bahn, wenn sie zwischen Angreifer und Ziel steht und höchstens 9 X-Einheiten vor dem Ziel ist.
Deckung macht ein Ziel nicht ungültig, gibt aber -22 Zielscore für normale Fernkämpfer und reduziert eingehenden Projektilschaden um 12%.
Brecher, magische Flächenangriffe und als durchdringend markierte Angriffe ignorieren Deckungsreduktion.
Eine Einheit kann höchstens einen Verbündeten direkt hinter sich schützen. Bei mehreren zählt der nächstgelegene.
### 7.4 Die sechs Doktrinen
#### Ausgewogen
Mechanische Wirkung: Keine Scoreänderung. Bahnwechsel nur nach Grundregeln.
Taktische Funktion: Starterdoktrin; Referenz für alle Tests.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
#### Linie halten
Mechanische Wirkung: Verteidiger/Kämpfer: Zielbindungsbonus +15, Bahnwechselstrafe zusätzlich -20; maximale Vorwärtsdistanz vor nächstem Unterstützer 20.
Taktische Funktion: Schützt Hinterlinie und stabilisiert Bahnen, reduziert Jagddruck.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
#### Durchbruch
Mechanische Wirkung: Offensive Nahkämpfer: Bewegung +12%; Ziele unter 40% LP +22; Zielbindungsbonus -6. Verteidiger erhalten keine Änderung.
Taktische Funktion: Ermöglicht schnellen Abschluss, erhöht Überdehnung; kein direkter Schadensbonus.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
#### Schutzformation
Mechanische Wirkung: Gegner, die einen Heiler, Beschwörer oder Schützen angreifen, erhalten für mobile Verbündete +35 Score. Ein schützender Bahnwechsel darf alle 6 s erfolgen.
Taktische Funktion: Reaktive Eskorte, kann Frontdruck verteilen.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
#### Fokusfeuer
Mechanische Wirkung: Schützen und geeignete Magier geben ihrem aktuellen regulären Ziel einen Fokusmarker; weitere passende Einheiten erhalten +30 Score. Marker erlischt nach 1,5 s ohne Fernangriff.
Taktische Funktion: Konzentriert Schaden, kann gegen Köder ineffizient sein.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
#### Jagd auf Zauberer
Mechanische Wirkung: Mobile Nahkämpfer erhalten +38 gegen Unterstützer, Magier und Beschwörer; Bahnwechselstrafe halbiert. Nicht mobile Verteidiger unverändert.
Taktische Funktion: Starke Backline-Jagd, schwächt lokale Frontbindung.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
Implementierungs- und Abnahmekriterien
Doktrinwechsel ist vor jedem Kampf kostenlos und während des Kampfes unmöglich.
UI zeigt für jede Einheit eine kurze Vorschau, ob die gewählte Doktrin ihr Verhalten beeinflusst.
Eine Doktrin kann kein unerreichbares Ziel gültig machen und keine feste Bossregel überschreiben.
Zielwechsel im Replay sind anhand der Scorekomponenten debugbar; im normalen UI genügt ein kurzes Zielwechsel-Symbol bei wichtigen Sprüngen.

## 8. Statuswirkungen, Buffs und Kontrolle
Statuswirkungen besitzen immer Quelle, Ziel, Startzeit, Endzeit, Stärke und Stapelgruppe. Gleiche Stapelgruppe addiert sich nur, wenn die Definition dies ausdrücklich erlaubt. Standardmäßig ersetzt die stärkere Anwendung die schwächere und erneuert die Dauer bis zum längeren Endzeitpunkt.
| Effekt | Typ | Baseline | Dauer | Stapel-/Grenzregel |
| --- | --- | --- | --- | --- |
| Schild | Positiv | Absorbiert Schaden vor LP; gemeinsame Poollogik | Bis verbraucht oder 8 s; Quellen können abweichen | Max. 60% Max-LP regulär, 25% Boss |
| Verstärkter Angriff | Positiv | +20% Angriffskraft | 5 s | Nicht additiv; höchste Stärke |
| Eile | Positiv | +20% Angriffsgeschwindigkeit | 5 s | Intervallminimum 0,45 s |
| Hast | Positiv | +25% Bewegungsgeschwindigkeit | 5 s | Bewegungsmaximum 14 |
| Widerstandskraft | Positiv | +25 Rüstung und +25 Widerstand | 5 s | Verteidigungs-Cap gilt |
| Regeneration | Positiv | 2,5% Max-LP pro Sekunde | 6 s | Mehrere Quellen erneuern; max. 4%/s |
| Brennen | Negativ | 4% Angriffskraft der Quelle als magischer Schaden pro Sekunde | 5 s | Bis 3 Quellen; jede separat |
| Gift | Negativ | 1,5% Max-LP des Ziels pro Sekunde, max. 35 Rohschaden/s gegen Boss | 8 s | Eine Instanz; erneuert Dauer |
| Verlangsamung | Negativ | -25% Bewegung, -10% Angriffsgeschwindigkeit | 4 s | Nicht additiv |
| Schwächung | Negativ | -20% Angriffskraft und -15% erzeugte Heilung/Schilde | 5 s | Nicht additiv |
| Stille | Negativ | Fähigkeiten können nicht starten; Standardangriff bleibt | 2,5 s regulär | Bossdauer x Kontrollfaktor |
| Betäubung | Negativ | Bewegung und Aktionen gestoppt; Vorbereitung abgebrochen | 1,2 s regulär | Bossdauer stark reduziert |
| Markierung | Neutral/Negativ | Definierte Quellen priorisieren das Ziel; Icon zeigt Quelle | 6 s | Mehrere Markentypen möglich, je Typ eine |
| Verwirrung | Negativ | Zielscore neu berechnet ohne Rollenbonus; kein Friendly Fire | 1,5 s | Boss erhält nur Ladeverlust, keine Zieländerung |
| Unverwundbar | Positiv/Spezial | Kein Schaden, keine negative Wirkung | Max. 1,5 s | Nur Phasenübergang/Ausweichen; nicht verlängerbar |
### 8.1 Kontrollresistenz
Effektive Dauer harter Kontrolle = Basisdauer x (1 - Kontrollresistenz). Harte Kontrolle umfasst Betäubung, Stille und Verwirrung. Verlangsamung ist weich. Reguläre Bosse besitzen 70% Kontrollresistenz, Ascension-Bosse 80% und das Herz des Risses 85%. Kein harter Kontrolleffekt auf Bosse darf länger als 0,65 Sekunden dauern.
### 8.2 Reinigung und Bannung
Reinigung entfernt negative Wirkungen vom Verbündeten. Priorität: Betäubung/Stille, Schwächung, Gift/Brennen, Verlangsamung, Markierung.
Bannung entfernt positive Wirkungen vom Gegner. Priorität: Unverwundbar ist nicht bannbar; danach Schild, Eile/Verstärkung, Regeneration, Widerstandskraft.
Ein Effekt kann als nicht reinigbar oder nicht bannbar markiert sein, insbesondere Bossphasen und Schlachtfeldregeln. Dies muss im Tooltip stehen.
Entfernen eines Schildes durch Bannung vernichtet höchstens 35% der maximalen LP des Ziels als Schildmenge pro Bann; größere Pools werden auf diesen Betrag reduziert statt vollständig gelöscht.
Implementierungs- und Abnahmekriterien
Jeder aktive Effekt besitzt ein Icon mit eindeutiger Form, Fortschrittsring und gestapelter Quellenzahl, falls relevant.
Keine reguläre Einheit kann durch wiederholte Standardkontrolle dauerhaft aktionsunfähig gehalten werden.
Bosse zeigen bei reduzierter Kontrolle ein sichtbares Resistenzfeedback statt scheinbar den Effekt zu ignorieren.
Statuswerte im Kampflog stimmen mit den sichtbaren Dauern auf 0,1 Sekunden überein.

## 9. Formation, Gruppengröße und Plätze
Formationstableau: drei Bahnen x drei Tiefenzonen = neun Startfelder.
Maximal sieben reguläre Einheiten; maximal drei davon Helden; maximal drei Kopien desselben Truppentyps.
Spielbeginn vier Plätze; fünfter Platz nach Expedition 1.3; sechster nach Akt II; siebter nach Akt III.
Ein Startfeld kann nur eine reguläre Einheit enthalten. Startbeschwörungen werden in definierten freien Positionen derselben Bahn erzeugt und belegen keinen Startplatz.
Eine leere Bahn ist erlaubt und wird vor Kampfstart mit einer Warnung markiert, wenn der Gegner dort Frontdruck besitzt.
Vier Formationsvorlagen: Standard, Defensiv, Offensiv, frei benannte Spezialformation. Gespeichert werden Einheiten, exakte Kopien, Felder, Kits, Heldenausrüstung, Banner und Doktrin.
Beim unvollständigen Laden einer Vorlage werden fehlende Inhalte übersprungen; nichts wird automatisch durch eine andere Einheit ersetzt.
### 9.1 Formationsvalidierung
Mindestens eine reguläre Einheit muss eingesetzt werden.
Keine doppelte Heldeninstanz und keine Überschreitung des Vertragslevels.
Jede ausgerüstete Kopie darf genau ein Truppenkit tragen; ein physisches Kit-Objekt kann beliebig oft als Vorlage genutzt werden, wird also nicht zwischen Kopien verbraucht.
Jeder Held trägt maximal eine passende Hauptausrüstung und einen Talisman.
Eine Warnung ist nicht blockierend bei fehlendem Heiler, leerer Bahn oder fehlendem Nahkämpfer; harte Regelverstöße blockieren den Start.

## 10. Merkmale und Synergien
Jede reguläre Einheit besitzt höchstens zwei Merkmale. Eine Synergie zählt eingesetzte reguläre Einheiten, nicht Kopien von Beschwörungen. Schwellen liegen bei zwei und drei Einheiten. Mehr als drei erhöht den Effekt nicht. Einheiten mit zwei Merkmalen zählen für beide.
| Merkmal | 2er-Schwelle | 3er-Schwelle |
| --- | --- | --- |
| Königreich | Erste eigene Fronteinheit, die Schaden erhält, bekommt Schild = 12% Max-LP für 6 s. | Zusätzlich erhält die nächstgelegene eigene Einheit derselben oder benachbarten Bahn Schild = 8% Max-LP. |
| Wildnis | Tierbeschwörungen +18% Bewegung. | Nach Zielwechsel erhalten Tierbeschwörungen 4 s lang +20% Angriffskraft; intern 6 s Abklingzeit. |
| Arkan | Erster Fähigkeitseinsatz jeder Arkan-Einheit beginnt mit 20% Vorladung. | Nach ihrem ersten Einsatz erhält jede Arkan-Einheit 15% Vorladung für den nächsten Zyklus. |
| Glaube | Erzeugte Heilung und Schilde +10%. | Erster negative Effekt pro regulärem Verbündeten wird um 50% verkürzt; einmal pro Kampf je Einheit. |
| Unterwelt | Skelette und Dämonen +20% Max-LP. | Erste eigene Unterwelt-Beschwörung, die fällt, kehrt nach 1,5 s mit 45% LP zurück. |
| Konstruktion | Konstruktionen reparieren 1,5% Max-LP pro Sekunde, wenn 3 s kein Schaden. | Erste zerstörte eigene Konstruktion erzeugt 6 s Schutzfeld: Verbündete darin -15% eingehender Schaden. |
| Söldner | Söldner-Einheiten erhalten +8% Angriffskraft, solange keine zwei identischen Truppentypen eingesetzt sind. | Zusätzlich +8 Rüstung/Widerstand; Bonus entfällt nur für doppelte Typen, nicht für Helden. |
| Beschwörer | Alle eigenen Beschwörungen starten mit 10% Vorladung ihrer ersten Aktion und +10% Dauer. | Beschwörungsgrenze bleibt 6; beim Erreichen der Grenze erhält die älteste Beschwörung +20% Angriffskraft statt einer siebten Einheit. |
Implementierungs- und Abnahmekriterien
Aktive und beinahe aktive Synergien werden im Formationsscreen live berechnet.
Synergieeffekte werden im Kampflog als eigene Quelle ausgewiesen.
Keine Synergie ist Voraussetzung zum Gewinnen auf Normal; sie darf passende Gruppen spürbar verstärken, aber Rollenfehler nicht vollständig kompensieren.
Beschwörungen zählen niemals zur Schwelle, außer eine spätere explizite Inhaltserweiterung benennt dies.

## 11. Helden, Ruhm und vollständige Heldenkits
### 11.0 Gemeinsame Heldenregeln
Jeder Held ist einzigartig und darf höchstens einmal in der Gruppe vorkommen.
Jeder Held startet auf Level 1 mit vollständiger Kernrolle, Passiv und Signaturfähigkeit.
Ruhm ist kein Zahlungsmittel. Eine beendete Expedition mit mindestens drei besuchten Knoten gibt 1 Ruhm; ein gewonnener Hauptboss zusätzlich 1 Ruhm.
Level 2 bei 3 Ruhm: +8% Max-LP, +6% Angriffskraft und beschriebene Passivverbesserung.
Level 3 bei 8 Ruhm und mindestens einem gewonnenen Hauptboss mit diesem Helden: weitere +8% Max-LP, +6% Angriffskraft und Level-3-Sonderskill.
Werteboni sind multiplikativ auf Level-1-Basis und werden vor Ausrüstung angewendet.
Jeder Held besitzt einen Hauptausrüstungs- und einen Talismanplatz.
Einmal-pro-Kampf-Skills werden nach jedem Sieg vollständig zurückgesetzt und gehen bei Rückzug nicht dauerhaft verloren.
Verbindlicher Hinweis: Die Basiswerte unten gelten für Level 1 auf Normal ohne Ausrüstung, Synergie, Relikt oder Modifikator. Alle Schadensprozente beziehen sich auf die Angriffskraft der ausführenden Einheit, soweit nicht ausdrücklich Max-LP genannt sind.
### 11.1 Aurel, der Eidwächter
| Feld | Festlegung |
| --- | --- |
| Kampfrolle | Verteidiger / Frontanker |
| Merkmale | Königreich, Glaube |
| Empfohlene Startzone | Front; bevorzugt mittlere Bahn |
| Level-1-Basiswerte | LP 1.900; Rüstung 55; Widerstand 40; Angriff 105; Intervall 1,65 s; Reichweite 3,0; Bewegung 4,8; Kontrollresistenz 20%. |
| Standardangriff | Schwerer Schildhieb - 100% physischer Schaden; Vorbereitung 0,45 s; leichter Trefferstopp, kein Rückstoß gegen Bosse. |
| Passive Fähigkeit | Schildbruder - Der nächstgelegene reguläre Verbündete derselben Bahn, der 4-11 X-Einheiten hinter Aurel steht, erleidet 18% weniger Projektilschaden. Level 2: Wirkung 22% und zusätzlich 10% für den nächstgelegenen Verbündeten auf einer benachbarten Bahn innerhalb 8 X-Einheiten. |
| Signaturfähigkeit | Standhafte Kuppel - Startladung 8 s, Wiederaufladung 14 s. Trigger nur, wenn mindestens zwei reguläre Verbündete im Radius 13 jeweils unter 70% LP sind oder einer unter 40% LP ist. Gewährt allen regulären Verbündeten im Radius Schild in Höhe von 16% ihrer Max-LP für 7 s. Aurel selbst erhält 10%. Keine Verschwendung, wenn vorhandener Schild bereits über 30% Max-LP liegt. |
| Level-3-Sonderskill | Nicht an mir vorbei - einmal pro Kampf. Trigger: Ein regulärer Verbündeter in Hinterzone wird erstmals durch einen Gegner im Nahkampf getroffen. Aurel bricht seine Aktion ab, springt auf dessen Bahn bis 3 X-Einheiten vor den Angreifer, verspottet erreichbare Gegner im Radius 7 für 3 s (+100 Zielscore auf Aurel), erhält 35% Schadensreduktion für 4 s und Schild 18% Max-LP. Kein Trigger, wenn Aurel betäubt, gefallen oder bereits in 6 X-Einheiten Entfernung ist; dann wartet die Fähigkeit bis 2 s auf Gültigkeit. |
| KI-Verhalten | Hält Zielbindung besonders stark; verfolgt kein Hinterziel ohne Schutzformation oder Level-3-Trigger. Nutzt Kuppel erst bei sinnvoller Schildmenge. |
| Natürliche Gegenstrategien | Magischer Dauerschaden, Bannung, mehrere Bahnen gleichzeitig, Angriffe hinter Aurel nach Verbrauch seines Level-3-Skills. |
| Telegraphie / Präsentation | Breite gold-violette Schildsilhouette; klarer Bodenring für Schutzradius; kurzer Glockenton bei Rettungssprung. |
Implementierungs- und Abnahmekriterien
Schutz gilt nur für den exakt ermittelten Verbündeten und aktualisiert sich höchstens alle 0,25 s.
Rettungssprung darf keine Kollision oder unzulässige Position erzeugen.
Kuppel zählt in der Auswertung als von Aurel erzeugter Schild.
### 11.2 Mira, die Riftjägerin
| Feld | Festlegung |
| --- | --- |
| Kampfrolle | Präzisionsschützin / Bossfokus |
| Merkmale | Wildnis, Söldner |
| Empfohlene Startzone | Hinten |
| Level-1-Basiswerte | LP 920; Rüstung 12; Widerstand 20; Angriff 145; Intervall 1,35 s; Reichweite 34; Bewegung 5,6. |
| Standardangriff | Präziser Pfeilschuss - 100% physischer Schaden; Projektilgeschwindigkeit 45; Vorbereitung 0,35 s. |
| Passive Fähigkeit | Eingeschossen - Jeder aufeinanderfolgende Standardtreffer gegen dasselbe reguläre Ziel erzeugt 1 Fokus, maximal 5. Jeder Fokus erhöht Miras Standardangriff gegen dieses Ziel um 6%. Fokus verfällt bei Zielwechsel oder nach 3 s ohne Treffer. Level 2: Beim Tod eines markierten Ziels werden bis zu 3 Fokusstapel auf das nächste gültige Ziel übertragen. |
| Signaturfähigkeit | Jagdmarke - Startladung 7 s, Wiederaufladung 13 s. Wählt den gefährlichsten sichtbaren regulären Gegner anhand Gefahrwert (Boss > Heiler/Beschwörer > Elite > höchster Angriff). Markiert 7 s, setzt Miras Zielscore auf dieses Ziel +120 und feuert nach 0,4 s drei Schüsse im Abstand 0,25 s zu je 70% physischem Schaden. Zielwechsel nur, wenn Ziel fällt; Restschüsse gehen auf neuen gefährlichsten Gegner. |
| Level-3-Sonderskill | Der eine perfekte Schuss - einmal pro Kampf. Trigger: markiertes reguläres Ziel unter 28% LP oder Boss unter 18% LP. Nach 0,8 s sichtbarer Vorbereitung 320% physischer Schaden; ignoriert Schilde bis zu 20% Ziel-Max-LP und 50% Rüstung. Kein automatischer Kill; gegen Boss maximal 12% Max-LP Endschaden. |
| KI-Verhalten | Bleibt auf maximaler Reichweite und weicht horizontal bis 6 X-Einheiten zurück, wenn ein Nahkämpfer innerhalb 5 kommt und Rückweg frei ist; nur einmal je 5 s. |
| Natürliche Gegenstrategien | Beschwörungsköder, Bahnwechsel, Projektilschutz, schneller Backline-Druck, häufige Zielverluste. |
| Telegraphie / Präsentation | Markierung als kontrastreiches Fadenkreuz; Fokus als fünf kleine Kerben unter Ziel; perfekter Schuss mit deutlich längerem Bogenklang. |
Implementierungs- und Abnahmekriterien
Fokusstapel entstehen nur nach bestätigtem Treffer.
Gefahrwert und Markenziel sind vor Kampf im Tooltip erklärt.
Perfekter Schuss wird bei Tod des Ziels nicht verbraucht, wenn der Treffer noch nicht erzeugt wurde.
### 11.3 Veyra, die Glutweise
| Feld | Festlegung |
| --- | --- |
| Kampfrolle | Flächenmagierin / Beschwörungsräumerin |
| Merkmale | Arkan, Glaube |
| Empfohlene Startzone | Hinten |
| Level-1-Basiswerte | LP 880; Rüstung 10; Widerstand 34; Angriff 132; Intervall 1,55 s; Reichweite 27; Bewegung 5,2. |
| Standardangriff | Feuerfunke - 90% magischer Schaden und Brennen für 4 s mit 35% normaler Stärke. |
| Passive Fähigkeit | Nachglut - Stirbt ein brennender Gegner, explodiert er in Radius 5 für 55% magischen Schaden. Eine Einheit kann nur eine Nachglut auslösen. Level 2: Getroffene Gegner erhalten Brennen 3 s mit 50% normaler Stärke. Kettenreaktionen dürfen maximal drei Generationen tief laufen. |
| Signaturfähigkeit | Glutwelle - Startladung 8 s, Wiederaufladung 12 s. Wählt die Bahn mit höchster Summe gegnerischer Einheiten; bei Gleichstand eigene Bahn. Welle läuft 38 X-Einheiten, trifft jedes Ziel einmal für 135% magischen Schaden und Brennen 5 s. Vorbereitung 0,65 s. |
| Level-3-Sonderskill | Popcorninferno - einmal pro Kampf. Trigger: mindestens vier gegnerische Einheiten inklusive Beschwörungen gleichzeitig aktiv und mindestens zwei innerhalb eines Radius-9-Clusters. Erzeugt fünf Explosionen im Abstand 0,22 s auf wechselnden Clustern; je 65% magischer Flächenschaden, dasselbe Ziel maximal dreimal. Boss erhält pro Explosion höchstens 2,5% Max-LP. |
| KI-Verhalten | Priorisiert Cluster; wartet mit Glutwelle höchstens 2,5 s auf bessere Bahn, danach gültige aktuelle Bahn. Keine Explosion auf leeres Feld. |
| Natürliche Gegenstrategien | Verteilte Formation, hohe Magieresistenz, Bannung von Brennen nicht möglich aber Reinigung, schneller Zugriff auf Veyra. |
| Telegraphie / Präsentation | Orange-violette, nicht realistische Flammen; Nachglut klein und kurz; Popcorninferno humorvoll mit rhythmischen Puffs, ohne Bildschirm zu verdecken. |
Implementierungs- und Abnahmekriterien
Nachglut kann nicht rekursiv endlos triggern.
Jedes Ziel wird pro Glutwelle exakt einmal getroffen.
Reduzierte-Effekte-Modus ersetzt Explosionen durch klare Kreise und kurze Lichtimpulse.
### 11.4 Morcant, der Grabsprecher
| Feld | Festlegung |
| --- | --- |
| Kampfrolle | Beschwörer / Mengenaufbau |
| Merkmale | Unterwelt, Beschwörer |
| Empfohlene Startzone | Hinten |
| Level-1-Basiswerte | LP 980; Rüstung 14; Widerstand 38; Angriff 110; Intervall 1,7 s; Reichweite 25; Bewegung 5,0. |
| Standardangriff | Dunkler Energiestoß - 90% magischer Schaden. |
| Passive Fähigkeit | Übrig geblieben - Der erste besiegte normale, nicht beschworene Gegner erzeugt nach 0,8 s ein Eifriger-Skelett auf Morcants Seite in derselben Bahn. Boss, Elite, Konstruktion und Pflanzen zählen nicht. Level 2: Das Skelett erhält 4 s +30% Bewegung und 15% Schild. |
| Signaturfähigkeit | Knochenkommando - Startladung 6 s, Wiederaufladung 15 s. Beschwört bis zu drei Eifrige Skelette: zuerst je eines auf Bahnen mit Gegnern, dann auf Morcants Bahn. Bei weniger freien Beschwörungsplätzen werden entsprechend weniger erzeugt. Vorbereitung 0,7 s; Skelette erscheinen 3 X-Einheiten vor Morcant oder am nächsten freien Punkt. |
| Level-3-Sonderskill | Noch lange nicht fertig - einmal pro Kampf. Wird scharf, nachdem mindestens zwei von Morcant erzeugte Skelette gefallen sind und aktuell kein Morcant-Skelett aktiv ist. Beschwört einen Knochenwächter. Bei voller Beschwörungsgrenze ersetzt er das älteste Morcant-Skelett; fremde Beschwörungen werden nie entfernt. |
| KI-Verhalten | Bleibt hinter nächstem regulären Verbündeten; weicht nicht aktiv zwischen Bahnen. Beschwört nicht, wenn kein Gegner regulär aktiv ist. |
| Natürliche Gegenstrategien | Flächenschaden, Bannwirker, direkter Druck auf Morcant, Beschwörungsgrenze durch schwache Einheiten ausnutzen. |
| Telegraphie / Präsentation | Cartoonhafte Knochen, die magnetisch zusammenschnappen; keine Gruseleffekte; unterschiedliche Silhouette für Knochenwächter. |
Implementierungs- und Abnahmekriterien
Passiv zählt nur einmal pro Kampf und dokumentiert den auslösenden Gegner.
Knochenkommando respektiert globale Sechsergrenze.
Knochenwächter ersetzt nur ausdrücklich erlaubte eigene Beschwörung.
### 11.5 Sable, die Klingentänzerin
| Feld | Festlegung |
| --- | --- |
| Kampfrolle | Duellantin / Backline-Unterbrecherin |
| Merkmale | Söldner, Arkan |
| Empfohlene Startzone | Front oder Mitte |
| Level-1-Basiswerte | LP 1.120; Rüstung 24; Widerstand 24; Angriff 118; Intervall 0,78 s; Reichweite 2,7; Bewegung 8,5. |
| Standardangriff | Klingenfolge - 55% physischer Schaden pro Angriff; jeder dritte Treffer verursacht 90% statt 55%. Zähler bleibt beim Zielwechsel erhalten. |
| Passive Fähigkeit | Im Schwung - Nach eigenem Todesstoß 5 s lang +25% Bewegung und +20% Angriffsgeschwindigkeit. Erneuter Todesstoß erneuert Dauer. Level 2: Nach jedem Fähigkeits-Bahnwechsel weicht Sable dem ersten normalen Standardangriff innerhalb 2,5 s vollständig aus; Flächenangriffe nicht. |
| Signaturfähigkeit | Seitensprung - Startladung 5 s, Wiederaufladung 10 s. Sucht auf benachbarter Bahn einen ungeschützten Schützen, Heiler, Magier oder Beschwörer mit mindestens 25 höherem Zielscore als aktuelles Ziel. Sprungdauer 0,55 s, währenddessen nicht zielbar durch neue Standardangriffe; landet 2,5 X-Einheiten vor Ziel und verursacht 120% physischen Schaden. Ohne gültiges Ziel bleibt Fähigkeit geladen. |
| Level-3-Sonderskill | Drei Schritte voraus - einmal pro Kampf. Trigger: gegnerischer Unterstützer/Magier startet eine Signaturfähigkeit mit mindestens 0,4 s Vorbereitung. Sable springt, wenn Pfad gültig und Ziel nicht unverwundbar, unterbricht reguläre Gegner und führt drei Treffer zu je 75% aus. Boss wird nicht unterbrochen, verliert aber 15% aktuelle Fähigkeitsladung. |
| KI-Verhalten | Hoher Zielwechselwille gegen Hinterziele, aber keine Sprünge auf leere oder blockierte Position. Nach Sprung bindet sie Ziel mindestens 2 s. |
| Natürliche Gegenstrategien | Beschützende Front, Betäubung, robuste Köder-Unterstützer, mehrere gleichzeitige Bedrohungen, Schutzformation. |
| Telegraphie / Präsentation | Deutliche violette Bewegungsspur; Ausweichsymbol; Level-3-Trigger mit kurzem Zeitriss, keine unsichtbare Teleportation. |
Implementierungs- und Abnahmekriterien
Seitensprung nur auf benachbarte Bahn.
Ausweichen verbraucht sich nur bei einem tatsächlich verhinderten gültigen Standardangriff.
Level-3 darf nicht mehrfach durch denselben Fähigkeitsstart triggern.
### 11.6 Brunn, der Eisenmönch
| Feld | Festlegung |
| --- | --- |
| Kampfrolle | Kämpfer / Brecher / Kontrollkonter |
| Merkmale | Glaube, Söldner |
| Empfohlene Startzone | Front |
| Level-1-Basiswerte | LP 1.620; Rüstung 42; Widerstand 35; Angriff 142; Intervall 1,8 s; Reichweite 3,5; Bewegung 5,1; Kontrollresistenz 30%. |
| Standardangriff | Schwerer Stabangriff - 115% physischer Schaden; gegen Schild/Konstruktion +25% Rohschaden. |
| Passive Fähigkeit | Fester Stand - Nach Ende von Rückstoß, Betäubung oder Verlangsamung 5 s +20 Rüstung/Widerstand. Interner Cooldown 5 s. Level 2: Nächster Standardangriff während Fester Stand verursacht +55% Rohschaden und unterbricht reguläre Gegner 0,25 s. |
| Signaturfähigkeit | Glockenschlag - Startladung 7 s, Wiederaufladung 13 s. 0,85 s Vorbereitung; Radius 5 um Brunn, 150% physischer Schaden, reguläre Gegner 0,65 s betäubt und 2 X zurückgestoßen. Bosse: 0,2 s Stagger und kein Rückstoß. Wird nur bei mindestens zwei Zielen oder einem Elite/Boss verwendet. |
| Level-3-Sonderskill | Jetzt bin ich wach - einmal pro Kampf. Trigger beim ersten Unterschreiten von 50% LP. Entfernt alle reinigbaren Kontroll- und Schwächungseffekte, stößt reguläre Gegner Radius 6 um 3 X zurück, verursacht 80% physischen Schaden und gewährt Schild 25% Max-LP für 7 s. Kann während Betäubung auslösen und beendet sie. |
| KI-Verhalten | Bevorzugt Schilde, Konstruktionen und große Kreaturen. Wartet bei Glockenschlag höchstens 2 s auf zweites Ziel. |
| Natürliche Gegenstrategien | Fernkampfkiting, magischer Schaden, keine Kontrolle auf ihn verschwenden, Bannung des Schildes. |
| Telegraphie / Präsentation | Tiefe Glockenresonanz und klarer kreisförmiger Stoß; Bildschirmerschütterung nur bei Level 3 und reduzierbar. |
Implementierungs- und Abnahmekriterien
Passiv triggert beim Ende, nicht Beginn der Kontrolle.
Level-3 löst exakt einmal beim Schwellenübergang aus.
Rückstoß darf Gegner nicht außerhalb logischer Arenagrenzen schieben.
### 11.7 Ilyra, die Morgenhüterin
| Feld | Festlegung |
| --- | --- |
| Kampfrolle | Heilerin / Reinigung / Wiederbelebung |
| Merkmale | Glaube, Königreich |
| Empfohlene Startzone | Hinten |
| Level-1-Basiswerte | LP 900; Rüstung 12; Widerstand 42; Angriff 86; Intervall 1,65 s; Reichweite 26; Bewegung 5,0. |
| Standardangriff | Lichtimpuls - 70% magischer Schaden. Wenn kein Gegner in Reichweite, greift sie nicht künstlich vor. |
| Passive Fähigkeit | Erste Hilfe - Die erste direkte Heilung, die jeder reguläre Verbündete pro Kampf von Ilyra erhält, ist 35% stärker. Separater Marker pro Ziel. Level 2: Überheilung ihrer direkten Heilungen wird bis maximal 10% Ziel-Max-LP in Schild für 5 s umgewandelt. |
| Signaturfähigkeit | Morgenkreis - Startladung 6 s, Wiederaufladung 11 s. Trigger bei mindestens zwei Verbündeten unter 80% LP oder einem unter 45%. Heilt bis zu vier reguläre Verbündete im Radius 18 um jeweils 95% Ilyras Angriffskraft plus 4% Ziel-Max-LP. Entfernt je Ziel genau einen reinigbaren negativen Effekt nach Prioritätsliste. Vorbereitung 0,55 s. |
| Level-3-Sonderskill | Noch nicht Feierabend - einmal pro Kampf. Der erste gefallene reguläre Verbündete außer Ilyra selbst wird nach 1,2 s an seiner Todesposition mit 35% Max-LP wiederbelebt, erhält 1 s Unverwundbarkeit und verliert alle Effekte. Kein Trigger bei Beschwörungen; falls Position blockiert, nächster freier Punkt derselben Bahn. Wird Ilyra während Verzögerung besiegt, schlägt die Wiederbelebung fehl, Fähigkeit gilt nicht als verbraucht, kann aber nur beim nächsten Tod eines anderen Verbündeten erneut prüfen. |
| KI-Verhalten | Positioniert sich hinter regulärem Verbündeten; priorisiert Heilbedarf plus erwarteten eingehenden Schaden. Morgenkreis wartet nicht länger als 1,5 s. |
| Natürliche Gegenstrategien | Burst auf Ilyra, Stille, mehrere getrennte Bahnen, Bannung von Schilden, Todesstoß während Cooldown. |
| Telegraphie / Präsentation | Warme goldene Lichtkreise; Wiederbelebungsanker sichtbar; keine religiösen Realwelt-Symbole. |
Implementierungs- und Abnahmekriterien
Erste-Hilfe-Marker wird pro Ziel korrekt gespeichert.
Wiederbelebte Einheit zählt in Auswertung als gefallen und wiederbelebt.
Keine Endlosschleife durch mehrere Ilyras, da Helden einzigartig sind.
### 11.8 Thorn, der Rudelrufer
| Feld | Festlegung |
| --- | --- |
| Kampfrolle | Kämpfer / Tierbeschwörer / Zieljäger |
| Merkmale | Wildnis, Beschwörer |
| Empfohlene Startzone | Mitte |
| Level-1-Basiswerte | LP 1.260; Rüstung 28; Widerstand 22; Angriff 120; Intervall 1,15 s; Reichweite 4,2; Bewegung 6,8. |
| Standardangriff | Speerstoß - 100% physischer Schaden; gegen große Ziele +12%. |
| Passive Fähigkeit | Treuer Begleiter - Beginnt jeden Kampf mit einem Riftwolf auf derselben Bahn, 3 X vor Thorn. Level 2: Wölfe, die dasselbe Ziel angreifen, erhalten pro zusätzlichem Wolf +10% Angriffskraft, maximal +20%. |
| Signaturfähigkeit | Rudelpfiff - Startladung 7 s, Wiederaufladung 16 s. Ruft zwei Riftwölfe auf freien Positionen derselben oder benachbarter Bahnen. Alle Thorn-Wölfe erhalten das aktuelle reguläre Ziel als Jagdziel; Jagdziel gibt +80 Zielscore für 6 s. Bei Beschwörungsgrenze wird nur so viel gerufen wie möglich. |
| Level-3-Sonderskill | Der große Flausch - einmal pro Kampf. Trigger, wenn Thorn unter 35% LP fällt oder mindestens drei von ihm erzeugte Wölfe gefallen sind und kein Alphawolf aktiv ist. Ruft Alphawolf. Bei voller Grenze ersetzt er den ältesten Thorn-Wolf. Alphawolf verspottet keine Gegner, erhält aber 20% Schadensreduktion, solange Thorn lebt. |
| KI-Verhalten | Folgt seinem Rudel, überholt aber nicht den nächsten Verteidiger um mehr als 8 X-Einheiten. Wölfe verfolgen Jagdziel auch über eine Bahn, falls Weg gültig. |
| Natürliche Gegenstrategien | Flächenschaden, Bannwirker, Thorn zuerst besiegen, Beschwörungslimit, robuste Front auf Jagdbahn. |
| Telegraphie / Präsentation | Klare Wolfssilhouetten und farbige Halsband-Rune zur Zuordnung; Alphawolf deutlich größer, aber nicht bildschirmfüllend. |
Implementierungs- und Abnahmekriterien
Startwolf wird vor erstem Tick und nach Synergieprüfung erzeugt.
Rudelbonus zählt nur Thorn-Wölfe am selben Ziel.
Alphawolf ersetzt keine fremde Beschwörung.
### 11.9 Orrik, der Runenbauer
| Feld | Festlegung |
| --- | --- |
| Kampfrolle | Konstrukteur / stationäre Unterstützung |
| Merkmale | Konstruktion, Arkan |
| Empfohlene Startzone | Mitte oder Hinten |
| Level-1-Basiswerte | LP 1.050; Rüstung 26; Widerstand 32; Angriff 108; Intervall 1,45 s; Reichweite 24; Bewegung 4,7. |
| Standardangriff | Runengeschoss - 85% magischer Schaden. |
| Passive Fähigkeit | Vorbereitung ist alles - Erzeugt zu Kampfbeginn eine Runenbarrikade 4 X-Einheiten vor sich auf derselben Bahn. Barrikade ist stationär, blockiert Bewegung und bietet Deckung. Level 2: Orriks Konstruktionen reparieren 2% Max-LP pro Sekunde, solange Orrik lebt und sie 2 s keinen Schaden erhielten. |
| Signaturfähigkeit | Feldgeschütz - Startladung 8 s, Wiederaufladung 15 s. Stellt ein Runengeschütz 2 X-Einheiten hinter nächster eigener Frontlinie auf einer Bahn mit Gegnern; bei Gleichstand eigene Bahn. Lebensdauer 16 s, zählt als Beschwörung/Konstruktion. Wenn kein Platz, bleibt geladen. |
| Level-3-Sonderskill | Viel zu großer Knopf - einmal pro Kampf. Trigger bei mindestens zwei aktiven eigenen Orrik-Konstruktionen und mindestens zwei Gegnern. Überlädt sie 6 s: +45% Angriffsgeschwindigkeit/Wirksamkeit, keine Reparatur. Bei Zerstörung oder Ablauf während Überladung explodiert jede in Radius 5 für 100% magischen Schaden. Barrikade verursacht ebenfalls Explosion, aber keinen Angriffstempoeffekt. |
| KI-Verhalten | Bleibt in Deckung; Feldgeschütz nie hinter feindlicher Front. Wechselt Bahn nur, wenn eigene Bahn vollständig leer und keine Konstruktion dort aktiv ist. |
| Natürliche Gegenstrategien | Brecher, Bannwirker, Flächenmagie, schneller Bahnwechsel, Orrik ausschalten stoppt Reparatur. |
| Telegraphie / Präsentation | Klare geometrische Runen; Barrikade niedrig genug, Einheiten sichtbar zu halten; Überladung blinkt mit rhythmischem Warnring. |
Implementierungs- und Abnahmekriterien
Konstruktionen besitzen eindeutige Besitzer- und Beschwörungs-IDs.
Barrikade blockiert nicht dauerhaft beide Seiten ohne Ausweichregel.
Überladung triggert Explosion nur einmal pro Konstruktion.
### 11.10 Nyx, die Leerenseherin
| Feld | Festlegung |
| --- | --- |
| Kampfrolle | Kontrollmagierin / Fähigkeitsstörung |
| Merkmale | Arkan, Unterwelt |
| Empfohlene Startzone | Hinten |
| Level-1-Basiswerte | LP 850; Rüstung 8; Widerstand 46; Angriff 116; Intervall 1,9 s; Reichweite 28; Bewegung 5,1. |
| Standardangriff | Leerenimpuls - 105% magischer Schaden; langsames Projektil, 0,5 s Vorbereitung. |
| Passive Fähigkeit | Einen Moment bitte - Die erste gegnerische wiederholbare Signaturfähigkeit pro Kampf erhält bei Kampfbeginn zusätzliche 2,0 s Startladung. Betrifft nicht passive Startbeschwörungen oder Bossphasen. Level 2: zusätzlich -15% Reichweite für Gegner innerhalb Nyx Zeitblase. |
| Signaturfähigkeit | Zeitblase - Startladung 7 s, Wiederaufladung 14 s. Wählt Kreis Radius 7 mit höchster Gegnerzahl, mindestens zwei Ziele oder ein Elite/Boss. Dauer 6 s. Gegner darin -30% Bewegung und -20% Angriffsgeschwindigkeit. Bosswerte halbiert. Blase bleibt stationär. |
| Level-3-Sonderskill | Das war so nicht vorgesehen - einmal pro Kampf. Trigger, wenn innerhalb 0,8 s mindestens zwei gegnerische wiederholbare Fähigkeiten ihre Vorbereitung beginnen. Setzt bei betroffenen regulären Gegnern aktuelle Wiederaufladung um 35% der Vollaufladung zurück und verursacht 1,5 s Verwirrung. Bosse verlieren 15% Vollaufladung und zeigen 0,25 s Stagger. Einmalige Phasenfähigkeiten werden nicht zurückgesetzt. |
| KI-Verhalten | Setzt Blase auf größten Cluster, darf bis 1,5 s auf zweites Ziel warten. Bevorzugt Fähigkeitsträger für Standardziel bei Gleichstand. |
| Natürliche Gegenstrategien | Verteilte Formation, direkte Backline-Jagd, Stille, Konstruktionen außerhalb der Blase, Fähigkeiten zeitlich entzerren. |
| Telegraphie / Präsentation | Transparente violette Kugel mit klarer Bodenkante; Geschwindigkeitsreduktion nicht über starke Nachbilder; Level 3 zeigt zurückspringende Lade-Icons. |
Implementierungs- und Abnahmekriterien
Passiv betrifft exakt die erste gültige Fähigkeit der gesamten Gegnerseite.
Zeitblase prüft Position kontinuierlich und entfernt Debuff beim Verlassen.
Level-3-Trigger fasst nur Starts im definierten Zeitfenster zusammen.
### 11.11 Heldenübergreifende Balance- und Abnahmeregeln
Kein einzelner Held ist für eine Kampagnenmission zwingend. Bossvorschauen dürfen Rollen empfehlen, aber nie einen konkreten Helden voraussetzen.
Level 3 erhöht den erwarteten Gesamtbeitrag eines Helden gegenüber Level 1 im Durchschnitt um 18-28%, nicht um ein Vielfaches.
Jeder Held besitzt mindestens zwei natürliche Gegenstrategien und mindestens zwei klar passende Verbündetenrollen.
Automatische Fähigkeiten warten bei fehlendem sinnvollen Ziel, aber nicht länger als die im Kit genannte Wartezeit, sofern ein weniger ideales gültiges Ziel existiert.
Alle Sprünge, Beschwörungen und Wiederbelebungen verwenden eine gemeinsame Suche nach dem nächsten freien gültigen Punkt derselben Bahn.
Im Formationsscreen zeigt jeder Held drei kurze Karten: Kernrolle, stärkster Trigger, wichtigste Schwäche.

## 12. Truppenverträge und die 18 Truppentypen
### 12.1 Vertragslogik
Ein entdeckter Truppentyp kann in der Kaserne dauerhaft als Vertrag I gekauft werden. Vertrag II und III erhöhen ausschließlich die maximal gleichzeitig einsetzbaren Kopien auf zwei bzw. drei.
Verträge werden nicht verbraucht, verlangen keinen Lohn, sammeln keine Erfahrung und können nicht verloren gehen.
Temporäre Rekruten ignorieren fehlenden Vertrag, belegen aber einen regulären Gruppenplatz und respektieren die globale Dreiergrenze.
Jede eingesetzte Kopie kann ein eigenes Truppenkit tragen. Die Inventarsammlung fungiert als freigeschaltete Vorlage; ein Kit wird nicht verbraucht.
Truppen besitzen keine individuellen Namen, Verletzungen, Ausrüstungsslots außer Kit oder separate Level.
| Vertragsstufe | Maximale Kopien | Basiskosten nach Entdeckung |
| --- | --- | --- |
| I | 1 | 180 Gold |
| II | 2 | 420 Gold |
| III | 3 | 850 Gold |
Verbindlicher Hinweis: Alle Werte gelten auf Normal in Akt I Referenzskalierung. Gegner- und Missionsskalierung wird später beschrieben. Truppenkosten werden bei später Entdeckung nicht erhöht; die Progressionsbremse ist die Entdeckungszeit und der Goldfluss.
### 12.2 Schildwache
| Feld | Festlegung |
| --- | --- |
| Rolle | Verteidiger |
| Merkmale | Königreich |
| Empfohlene Zone | Front |
| Basiswerte | LP 1.650; Rüstung 52; Widerstand 24; Angriff 92; Intervall 1,55 s; Reichweite 3; Bewegung 4,6. |
| Standardangriff | Schildstoß: 90% physisch. |
| Fähigkeit/Passiv | Deckung halten: direkt dahinter stehender Verbündeter -14% Projektilschaden. Alle 12 s: Schildwall, 6 s Schild 14% Max-LP und +40 Zielscore für nahe Gegner. |
| Einsatzidentität und Schwäche | Günstiger Haupttank; schwach gegen Magie und Bannung. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.3 Speerwall
| Feld | Festlegung |
| --- | --- |
| Rolle | Anti-Ansturm / Verteidiger |
| Merkmale | Königreich |
| Empfohlene Zone | Front |
| Basiswerte | LP 1.350; Rüstung 40; Widerstand 20; Angriff 112; Intervall 1,45 s; Reichweite 5,5; Bewegung 4,4. |
| Standardangriff | Speerstich: 105% physisch. |
| Fähigkeit/Passiv | Auflaufen lassen: erster Gegner, der sich mit mindestens 7 Bewegung nähert, erhält 160% Schaden und 1,2 s Verlangsamung; 8 s interner Cooldown. +20% Schaden gegen große Ziele. |
| Einsatzidentität und Schwäche | Kontert schnelle Angreifer; weniger robust als Schildwache. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.4 Tempelwächter
| Feld | Festlegung |
| --- | --- |
| Rolle | Premium-Verteidiger |
| Merkmale | Glaube, Königreich |
| Empfohlene Zone | Front |
| Basiswerte | LP 1.720; Rüstung 46; Widerstand 44; Angriff 98; Intervall 1,7 s; Reichweite 3; Bewegung 4,3. |
| Standardangriff | Gesegneter Hieb: 85% physisch + 20% magisch. |
| Fähigkeit/Passiv | Erster Treffer über 12% Max-LP erzeugt Schild 18% Max-LP für sich und 10% für nächsten Verbündeten; einmal pro Kampf. Alle 15 s kleiner Schutzimpuls 8% Max-LP auf schwächsten Nahverbündeten. |
| Einsatzidentität und Schwäche | Teuer, breit defensiv; kein starker Schaden. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.5 Söldner
| Feld | Festlegung |
| --- | --- |
| Rolle | Flexibler Kämpfer |
| Merkmale | Söldner |
| Empfohlene Zone | Front/Mitte |
| Basiswerte | LP 1.250; Rüstung 28; Widerstand 24; Angriff 118; Intervall 1,2 s; Reichweite 3,2; Bewegung 5,8. |
| Standardangriff | Schwerthieb: 100% physisch. |
| Fähigkeit/Passiv | Pragmatisch: erhält je nach Startzone Front +10 Rüstung, Mitte +8% Angriff oder Hinten +10% Reichweite; Effekt wird vor Kampf angezeigt. |
| Einsatzidentität und Schwäche | Günstige Lückenfüllung ohne Extremstärke. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.6 Axtbrecher
| Feld | Festlegung |
| --- | --- |
| Rolle | Brecher |
| Merkmale | Söldner |
| Empfohlene Zone | Front |
| Basiswerte | LP 1.300; Rüstung 32; Widerstand 18; Angriff 162; Intervall 2,15 s; Reichweite 3,4; Bewegung 4,9. |
| Standardangriff | Axtschlag: 135% physisch; gegen Schild/Konstruktion +50%. |
| Fähigkeit/Passiv | Spaltkeil: alle 11 s 190% physisch, ignoriert 35 Rüstung und entfernt bis 18% Ziel-Max-LP Schild. Priorisiert Konstruktionen. |
| Einsatzidentität und Schwäche | Stark gegen Befestigung, leicht zu kiten und zu unterbrechen. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.7 Duellant
| Feld | Festlegung |
| --- | --- |
| Rolle | Mobiler Assassine |
| Merkmale | Söldner |
| Empfohlene Zone | Front/Mitte |
| Basiswerte | LP 850; Rüstung 16; Widerstand 16; Angriff 106; Intervall 0,72 s; Reichweite 2,6; Bewegung 8,8. |
| Standardangriff | Doppelschnitt: 48% physisch je Zyklus, zwei Treffer. |
| Fähigkeit/Passiv | Lücke finden: alle 9 s Wechsel auf benachbarte Bahn zu Ziel unter 45% LP; 120% Schaden und 2 s +20% Angriffstempo. |
| Einsatzidentität und Schwäche | Tötet Schwache, fällt schnell unter Fokus. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.8 Berserker
| Feld | Festlegung |
| --- | --- |
| Rolle | Riskanter DPS-Kämpfer |
| Merkmale | Wildnis, Söldner |
| Empfohlene Zone | Front |
| Basiswerte | LP 1.380; Rüstung 20; Widerstand 14; Angriff 130; Intervall 1,05 s; Reichweite 3; Bewegung 6,4. |
| Standardangriff | Breitaxt: 105% physisch. |
| Fähigkeit/Passiv | Raserei: pro 10% fehlender LP +4% Angriffskraft, maximal +32%. Unter 30% LP außerdem +15% Bewegung. Keine eigene Heilung. |
| Einsatzidentität und Schwäche | Skaliert mit Heilung/Schutz; anfällig für Burst. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.9 Bogenschütze
| Feld | Festlegung |
| --- | --- |
| Rolle | Konstanter Fernschaden |
| Merkmale | Königreich |
| Empfohlene Zone | Hinten |
| Basiswerte | LP 760; Rüstung 8; Widerstand 14; Angriff 112; Intervall 1,2 s; Reichweite 32; Bewegung 5,5. |
| Standardangriff | Pfeil: 100% physisch. |
| Fähigkeit/Passiv | Ruhige Hand: nach 3 s ohne Bahnwechsel +12% Schaden; verliert Bonus beim Nahkampftreffer. |
| Einsatzidentität und Schwäche | Einfacher Fernkämpfer, klarer Starter. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.10 Armbrustschütze
| Feld | Festlegung |
| --- | --- |
| Rolle | Panzerbrechender Schütze |
| Merkmale | Königreich, Söldner |
| Empfohlene Zone | Hinten |
| Basiswerte | LP 820; Rüstung 12; Widerstand 12; Angriff 175; Intervall 2,25 s; Reichweite 31; Bewegung 4,8. |
| Standardangriff | Bolzen: 145% physisch, ignoriert 25 Rüstung. |
| Fähigkeit/Passiv | Gezielter Bolzen: jeder dritte Angriff +55% Schaden gegen Ziel über 60% LP oder mit Schild. |
| Einsatzidentität und Schwäche | Hoher Einzelschaden, schwach gegen Schwärme. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.11 Messerwerfer
| Feld | Festlegung |
| --- | --- |
| Rolle | Kurzer mobiler Fernkampf |
| Merkmale | Söldner |
| Empfohlene Zone | Mitte |
| Basiswerte | LP 920; Rüstung 18; Widerstand 18; Angriff 78; Intervall 0,58 s; Reichweite 16; Bewegung 7,6. |
| Standardangriff | Wurfmesser: 55% physisch. |
| Fähigkeit/Passiv | Seitenwechsel: wenn eigener Bahn kein Ziel in 12 Reichweite, Wechsel auf benachbarte Bahn in 0,8 s; 5 s Cooldown. Jeder fünfte Treffer markiert 3 s für +10% eingehenden physischen Schaden von Messerwerfern. |
| Einsatzidentität und Schwäche | Hohe Frequenz, kurze Reichweite. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.12 Arkanschütze
| Feld | Festlegung |
| --- | --- |
| Rolle | Rüstungsignorierender Fernkampf |
| Merkmale | Arkan |
| Empfohlene Zone | Hinten |
| Basiswerte | LP 740; Rüstung 6; Widerstand 28; Angriff 122; Intervall 1,35 s; Reichweite 29; Bewegung 5,2. |
| Standardangriff | Arkanbolzen: 75% magisch + 35% physisch. |
| Fähigkeit/Passiv | Phasenschuss: alle 10 s 150% magisch, ignoriert Schild bis 8% Ziel-Max-LP; bevorzugt hohen Rüstungswert. |
| Einsatzidentität und Schwäche | Kontert physische Tanks, sehr fragil. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.13 Kampfmagier
| Feld | Festlegung |
| --- | --- |
| Rolle | Robuster Flächen-DPS |
| Merkmale | Arkan |
| Empfohlene Zone | Mitte |
| Basiswerte | LP 1.120; Rüstung 24; Widerstand 36; Angriff 124; Intervall 1,6 s; Reichweite 20; Bewegung 5,0. |
| Standardangriff | Energieschlag: 90% magisch, Radius 2,5. |
| Fähigkeit/Passiv | Runenfächer: alle 12 s Kegel auf eigener Bahn, bis 3 Ziele je 125% magisch. Bei nur einem Ziel 150%. |
| Einsatzidentität und Schwäche | Mittelzone, guter Kompromiss. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.14 Feldheiler
| Feld | Festlegung |
| --- | --- |
| Rolle | Regelmäßige Einzelheilung |
| Merkmale | Glaube |
| Empfohlene Zone | Hinten |
| Basiswerte | LP 830; Rüstung 10; Widerstand 34; Angriff 92; Intervall 1,8 s; Reichweite 25; Bewegung 5,0. |
| Standardangriff | Leichter Schlag: 55% magisch. |
| Fähigkeit/Passiv | Verbinden: alle 5,5 s heilt niedrigstes LP-%-Ziel um 105% Angriff + 3% Max-LP; Mindestbedarf 15%. Alle 14 s entfernt Brennen oder Gift. |
| Einsatzidentität und Schwäche | Verlässliche Heilung, wenig Offensive. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.15 Bannwirker
| Feld | Festlegung |
| --- | --- |
| Rolle | Dispel / Anti-Beschwörung |
| Merkmale | Arkan, Glaube |
| Empfohlene Zone | Hinten |
| Basiswerte | LP 790; Rüstung 8; Widerstand 40; Angriff 96; Intervall 1,65 s; Reichweite 27; Bewegung 5,1. |
| Standardangriff | Bannfunke: 75% magisch; gegen Beschwörung +35%. |
| Fähigkeit/Passiv | Entzaubern: alle 10 s entfernt stärksten bannbaren Buff oder reduziert Schild; wenn kein Buff, fügt Beschwörung/Konstruktion 180% magisch zu. |
| Einsatzidentität und Schwäche | Situativ stark; schwach gegen reine Kämpfer. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.16 Standartenträger
| Feld | Festlegung |
| --- | --- |
| Rolle | Aura-Unterstützer |
| Merkmale | Königreich, Söldner |
| Empfohlene Zone | Mitte |
| Basiswerte | LP 1.050; Rüstung 28; Widerstand 24; Angriff 76; Intervall 1,8 s; Reichweite 4; Bewegung 5,0. |
| Standardangriff | Standartenhieb: 65% physisch. |
| Fähigkeit/Passiv | Bannerfeld: reguläre Verbündete Radius 9 +8% Angriffskraft und +8 Rüstung/Widerstand. Effekt endet sofort bei Tod. Alle 14 s 4 s +15% Bewegung für Auraeinheiten. |
| Einsatzidentität und Schwäche | Muss geschützt und positioniert werden. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.17 Falkner
| Feld | Festlegung |
| --- | --- |
| Rolle | Backline-Poke / Tier |
| Merkmale | Wildnis |
| Empfohlene Zone | Hinten |
| Basiswerte | LP 780; Rüstung 10; Widerstand 18; Angriff 104; Intervall 1,4 s; Reichweite 25; Bewegung 5,8. |
| Standardangriff | Kurzbogen: 80% physisch. |
| Fähigkeit/Passiv | Jagdfalke: alle 7 s nicht belegende Projektil-Beschwörung auf entferntesten Schützen/Heiler, 140% physisch und Markierung 4 s; kann Bahnen überqueren. |
| Einsatzidentität und Schwäche | Erreicht Hinterziele, kein echter Körper. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.18 Alchemist
| Feld | Festlegung |
| --- | --- |
| Rolle | Vorhersehbarer Hybrid-Support |
| Merkmale | Arkan, Söldner |
| Empfohlene Zone | Mitte/Hinten |
| Basiswerte | LP 850; Rüstung 12; Widerstand 30; Angriff 100; Intervall 1,75 s; Reichweite 21; Bewegung 5,3. |
| Standardangriff | Fläschchenwurf: Zyklus fest Schaden -> Heilung -> Frost, dann wiederholt. Schaden: 100% magisch Radius 3; Heilung: 90% Angriff Radius 3; Frost: 55% magisch + Verlangsamung 4 s. |
| Fähigkeit/Passiv | Farbfolge ist permanent über Kopf sichtbar. Wird ein Ziel ungültig, bleibt der aktuelle Flaschentyp erhalten. |
| Einsatzidentität und Schwäche | Flexibel, aber einzelne Wirkung geringer. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
### 12.19 Konstrukteur
| Feld | Festlegung |
| --- | --- |
| Rolle | Truppen-Konstrukteur |
| Merkmale | Konstruktion |
| Empfohlene Zone | Mitte |
| Basiswerte | LP 1.020; Rüstung 26; Widerstand 24; Angriff 90; Intervall 1,65 s; Reichweite 19; Bewegung 4,7. |
| Standardangriff | Werkzeugbolzen: 75% physisch. |
| Fähigkeit/Passiv | Bauplan wählbar im Formationsscreen: Barrikade oder Kleingeschütz. Erzeugt bei Start genau eine Konstruktion. Barrikade LP 650; Geschütz LP 420, 55% physisch alle 1,1 s, Lebensdauer 15 s. |
| Einsatzidentität und Schwäche | Weniger stark als Orrik, aber flexibel kombinierbar. |
| KI | Verwendet gemeinsame Rollen-Zielwahl; besondere Prioritäten ergeben sich ausschließlich aus der Fähigkeit. |
Implementierungs- und Abnahmekriterien
Jeder Truppentyp besitzt im Kodex eine Vergleichsansicht mit identischer Stat-Reihenfolge.
Drei Kopien desselben Typs bleiben visuell unterscheidbar durch kleine Slotmarkierung und Kit-Icon, nicht durch zufällige Namen.
Keine Fähigkeit benötigt manuelle Aktivierung oder eine während des Kampfes wählbare Variante; Konstrukteur-Bauplan wird vor Kampf gewählt.
Jeder Trupp hat eine klar benannte Rolle und mindestens eine erkennbare Schwäche.

## 13. Beschwörungen
### 13.1 Globale Regeln
Maximal sechs aktive Beschwörungen pro Seite. Stationäre Konstruktionen und Pflanzen zählen mit; reine Projektiltiere wie der Jagdfalke nicht.
Beschwörungen belegen keinen regulären Gruppenplatz, sammeln keinen Ruhm, tragen keine Gegenstände und verschwinden nach dem Kampf.
Beschwörungen können Ziel von Angriffen, Heilung und Effekten sein, sofern die Quelle nicht ausdrücklich nur reguläre Einheiten erlaubt.
Heilung auf Beschwörungen ist standardmäßig nur 50% wirksam. Wiederbelebung wirkt nicht auf Beschwörungen.
Beim Überschreiten der Grenze wird nichts erzeugt, außer die Fähigkeit benennt eine Ersetzungsregel. UI zeigt kurz „Beschwörungslimit“ an der Quelle.
Zeitlich begrenzte Beschwörungen zeigen einen dünnen Lebensdauerring. Ablauf zählt als Verschwinden, nicht als Tod, sofern ein Todeseffekt dies nicht ausdrücklich einschließt.
Beschwörungen allein verhindern kein Kampfende.
| Name | Kategorie und Baseline | Verhalten |
| --- | --- | --- |
| Eifriges Skelett | Skelett | LP 320; Rüstung 8; Angriff 52; Intervall 0,95 s; Bewegung 7,2; Lebensdauer 14 s. |
| Knochenwächter | Skelett/Groß | LP 900; Rüstung 30; Angriff 95; Intervall 1,45 s; Bewegung 5,0; Dauer 18 s. |
| Riftwolf | Tier | LP 390; Rüstung 6; Angriff 66; Intervall 0,75 s; Bewegung 9,5; Dauer 16 s. |
| Alphawolf | Tier/Groß | LP 1.050; Rüstung 22; Angriff 120; Intervall 1,05 s; Bewegung 8,2; Dauer 20 s. |
| Runenbarrikade | Konstruktion | LP 850; Rüstung 55; Widerstand 25; stationär; Dauer unbegrenzt bis Kampfende. |
| Runengeschütz | Konstruktion | LP 520; Rüstung 20; Widerstand 30; Angriff 70; Intervall 0,9 s; Reichweite 26; Dauer 16 s. |
| Kleingeschütz | Konstruktion | LP 420; Rüstung 15; Angriff 55; Intervall 1,1 s; Reichweite 23; Dauer 15 s. |
| Glutelementar | Elementar | LP 460; Widerstand 40; Angriff 78; Intervall 1,0 s; Bewegung 6,0; Dauer 14 s. |
| Frostelementar | Elementar | LP 500; Rüstung 18; Angriff 62; Intervall 1,2 s; Bewegung 5,5; Dauer 16 s. |
| Riftdämon | Dämon | LP 1.100; Rüstung 28; Widerstand 28; Angriff 135; Intervall 1,6 s; Bewegung 4,4; Dauer 14 s. |
| Schutzgeist | Geist | LP 300; nicht angreifbar durch Standardzielwahl; Dauer 10 s. |
| Dornenknospe | Pflanze | LP 360; Rüstung 10; stationär; Dauer 12 s. |
| Heilblüte | Pflanze | LP 300; Widerstand 20; stationär; Dauer 12 s. |
| Ascheecho | Echo | LP 45% der Basis-LP des kopierten normalen Soldaten; Angriff 55% der Basis; Dauer 12 s. |
Implementierungs- und Abnahmekriterien
Die Sechsergrenze wird bei simultanen Beschwörungen atomar und deterministisch aufgelöst.
Besitzer, Quelle und Kategorie jeder Beschwörung sind im Kampflog verfügbar.
Ablauf, Tod und Ersetzung sind getrennte Ereignistypen.
Große Beschwörungen dürfen die Lesbarkeit regulärer Einheiten nicht verdecken; maximale visuelle Höhe 130% eines Helden, außer Bossbeschwörung.

## 14. Gegnerroster und regionale Kampfidentitäten
Gegner verwenden dieselben Grundformeln wie die Spielergruppe. Ihre Werte werden durch Mission, Schwierigkeit, Instabilität und Ascension skaliert. Die folgenden Werte sind Referenzwerte für die erste Expedition der jeweiligen Region auf Normal; regionale Skalierung wird im Kampagnenkapitel angewendet.
### 14.1 Aschenstraße
Visuelle Identität: Königreichsruinen, Rauch, militärische Echoformationen. Mechanische Identität: Brennen, Schildlinien, Wiederkehr schwacher Echos.
| Gegner | Rolle | Basiswerte | Fähigkeit | Lesbare Gegenstrategie |
| --- | --- | --- | --- | --- |
| Aschesoldat | Kämpfer | LP 1.000; Rüstung 24; Widerstand 12; Angriff 100; Intervall 1,25 s. | Gluthieb: jeder vierte Treffer verursacht Brennen 4 s. | Standardfront; Magie oder Fokusfeuer. |
| Rußschild | Verteidiger | LP 1.520; Rüstung 50; Widerstand 18; Angriff 80; Intervall 1,6 s. | Deckung: schützt nächsten Verbündeten; einmal Schild 15% bei 60% LP. | Bannung, Magie, Brecher. |
| Kohlebogner | Schütze | LP 720; Rüstung 8; Widerstand 10; Angriff 112; Intervall 1,25 s; Reichweite 31. | Brandpfeil alle 9 s: 130% physisch + Brennen. | Backline-Jagd, Projektilschutz. |
| Ascheträger | Unterstützer | LP 850; Rüstung 16; Widerstand 24; Angriff 70. | Glutbanner: Verbündete Radius 8 +10% Angriff; bei Tod 4 s Rauch, gegnerische Reichweite darin -20%. | Früh fokussieren, Bannung. |
| Funkenläufer | Duellant | LP 780; Rüstung 12; Angriff 108; Intervall 0,8 s; Bewegung 8,8. | Springt alle 8 s auf benachbarte Bahn zu Schütze/Heiler und hinterlässt Brennspur 3 s. | Speerwall, Schutzformation. |
| Rauchwirker | Kontrollmagier | LP 760; Widerstand 38; Angriff 96; Reichweite 25. | Rauchkugel alle 11 s: Radius 6, -25% Reichweite und -15% Angriffstempo 5 s. | Jagd auf Zauberer, verteilen. |
| Glutpriester | Heiler | LP 820; Widerstand 35; Angriff 88. | Alle 6 s Heilung 100% Angriff; heilt brennende Verbündete zusätzlich 3% Max-LP und entfernt deren Brennen. | Unterbrechen/fokussieren, Bannwirker. |
Jede normale Formation der Region verwendet 3-7 reguläre Gegner entsprechend freigeschalteter Spielerplätze.
Ein normaler Kampf darf höchstens zwei Exemplare derselben stark spezialisierten Unterstützerrolle enthalten.
Die ersten zwei Begegnungen einer Region führen neue Mechaniken isoliert ein; danach werden sie kombiniert.
Gegnerfähigkeiten werden beim ersten Kontakt als Kurzkarte und danach im Kodex vollständig gezeigt.
### 14.2 Dornenhain
Visuelle Identität: Überwachsene Wege, lebendige Pflanzen und Tierjäger. Mechanische Identität: Gift, Regeneration, Bahnkontrolle, Pflanzen.
| Gegner | Rolle | Basiswerte | Fähigkeit | Lesbare Gegenstrategie |
| --- | --- | --- | --- | --- |
| Dornenknecht | Kämpfer | LP 1.100; Rüstung 28; Widerstand 18; Angriff 102. | Bei Nahkampftreffer 20% Angriff als Rückschaden, maximal einmal 0,5 s. | Fernkampf, Magie. |
| Rankenwächter | Verteidiger | LP 1.600; Rüstung 42; Widerstand 35; Bewegung 3,8. | Alle 10 s verwurzelt nächsten Nahgegner 0,8 s und erhält Regeneration. | Bannung, Brecher, Reichweite. |
| Giftspucker | Schütze | LP 700; Widerstand 24; Angriff 92; Reichweite 27. | Jeder dritte Treffer Gift 8 s; priorisiert ungegiftete Ziele. | Reinigung, Backline-Druck. |
| Heilblüten-Hüter | Heiler/Beschwörer | LP 780; Widerstand 32. | Alle 9 s Heilblüte auf Bahn mit verletztem Verbündeten; max. zwei eigene Blüten. | Fläche, Bannwirker. |
| Sprunghase des Unheils | Duellant/Tier | LP 620; Rüstung 6; Angriff 116; Bewegung 10. | Erster Kontakt: 160% Schaden und springt danach 5 X zurück; 7 s Cooldown. | Speerwall, Schild. |
| Sporenmagier | Kontrolle | LP 800; Widerstand 40; Angriff 90. | Sporenfeld alle 12 s: 5 s Verlangsamung; bei Ablauf kleiner magischer Schaden. | Verteilen, Jagd. |
| Mooskoloss | Groß/Brecher | LP 2.050; Rüstung 48; Widerstand 30; Angriff 150; Intervall 2,1 s. | Schlag Radius 4; unter 50% LP Regeneration 2%/s für 8 s, einmal. | Gift/Bannung, Armbrust/Axtbrecher. |
Jede normale Formation der Region verwendet 3-7 reguläre Gegner entsprechend freigeschalteter Spielerplätze.
Ein normaler Kampf darf höchstens zwei Exemplare derselben stark spezialisierten Unterstützerrolle enthalten.
Die ersten zwei Begegnungen einer Region führen neue Mechaniken isoliert ein; danach werden sie kombiniert.
Gegnerfähigkeiten werden beim ersten Kontakt als Kurzkarte und danach im Kodex vollständig gezeigt.
### 14.3 Eisenschmiede
Visuelle Identität: Mechanische Hallen, Runenöfen und Konstruktionen. Mechanische Identität: Rüstung, Schilde, Geschütze, Überladung.
| Gegner | Rolle | Basiswerte | Fähigkeit | Lesbare Gegenstrategie |
| --- | --- | --- | --- | --- |
| Schmiedewache | Verteidiger | LP 1.650; Rüstung 58; Widerstand 20; Angriff 95. | Erster Schildbruch gibt 5 s +20 Rüstung. | Magie, Brecher. |
| Nietenläufer | Kämpfer | LP 1.050; Rüstung 36; Angriff 118; Bewegung 6,2. | Nach Bahnwechsel 3 s +20% Angriffstempo. | Linie halten, Kontrolle. |
| Bolzenschütze | Schütze | LP 760; Rüstung 18; Angriff 155; Intervall 2,2; Reichweite 30. | Bolzen ignoriert 20 Rüstung; jeder dritte durchdringt Deckung. | Backline-Jagd. |
| Runenmechaniker | Konstrukteur | LP 820; Rüstung 20; Widerstand 30. | Startet mit Kleingeschütz; repariert alle 4 s Konstruktion um 8% Max-LP. | Mechaniker zuerst, Bannwirker. |
| Ofenmagier | Flächenmagier | LP 850; Widerstand 38; Angriff 125. | Alle 11 s Ofenstoß auf Bahn: 125% magisch und Brennen. | Verteilen, Unterbrechung. |
| Kettengreifer | Kontrolle/Brecher | LP 1.200; Rüstung 34; Angriff 110. | Alle 10 s zieht entferntestes Ziel derselben Bahn bis auf 5 X heran; Boss/Verteidiger nur 3 X. | Leere Bahn vermeiden, Stille. |
| Überladener Golem | Groß | LP 2.200; Rüstung 55; Widerstand 35; Angriff 135. | Alle 6 s erhält Überladung; bei 3 Stapeln Explosion Radius 7, 170% magisch, verliert Stapel und 10% LP. Stapel bannbar. | Bannung, Abstand, Burst vor drittem Stapel. |
Jede normale Formation der Region verwendet 3-7 reguläre Gegner entsprechend freigeschalteter Spielerplätze.
Ein normaler Kampf darf höchstens zwei Exemplare derselben stark spezialisierten Unterstützerrolle enthalten.
Die ersten zwei Begegnungen einer Region führen neue Mechaniken isoliert ein; danach werden sie kombiniert.
Gegnerfähigkeiten werden beim ersten Kontakt als Kurzkarte und danach im Kodex vollständig gezeigt.
### 14.4 Zitadelle der Echos
Visuelle Identität: Unmögliche Architektur und gemischte Echoarmeen. Mechanische Identität: Kopien, Zeitstörung, gemischte Rollen, Phasen.
| Gegner | Rolle | Basiswerte | Fähigkeit | Lesbare Gegenstrategie |
| --- | --- | --- | --- | --- |
| Echo-Legionär | Kämpfer | LP 1.250; Rüstung 32; Widerstand 28; Angriff 116. | Passt Schadenstyp nach erstem Treffer an: gegen niedrigere Verteidigung; sichtbar. | Ausgewogene Verteidigung, Fokus. |
| Spiegelwache | Verteidiger | LP 1.650; Rüstung 40; Widerstand 40. | Reflektiert ersten direkten Fähigkeits-Treffer zu 25% als reinen Schaden, max. 8% Angreifer-LP; einmal. | Mit kleinem Skill auslösen, Standardangriff. |
| Zeitbogner | Schütze | LP 800; Widerstand 28; Angriff 120. | Jeder vierte Treffer verzögert nächste Fähigkeit des Ziels um 1 s. | Jagd, Schutz. |
| Echoheiler | Heiler | LP 880; Widerstand 42. | Heilt 95% Angriff; kopiert beim ersten Heilen 50% des zuletzt auf Gegnerseite erzeugten Schildes auf Ziel. | Bannung, früh fokussieren. |
| Rissduellant | Duellant | LP 900; Rüstung 18; Widerstand 26; Angriff 118; Bewegung 8,3. | Nach Tod einer Beschwörung teleportiert er einmal je 6 s auf deren Bahn und erhält 3 s Eile. | Beschwörungen dosieren, Kontrolle. |
| Kurator-Adept | Unterstützer | LP 900; Widerstand 40. | Konservieren alle 12 s: Ziel 2 s unverwundbar, danach 4 s -25% Angriff. Nicht bannbar, klar sichtbar. | Ziel wechseln, Adept töten. |
| Riftverschlinger | Groß/Anti-Beschwörung | LP 2.000; Rüstung 38; Widerstand 45; Angriff 145. | Verschlingt alle 9 s schwächste feindliche Beschwörung in Radius 10, heilt 8% Max-LP; ohne Ziel normaler Biss 160%. | Wenig Beschwörungen, Fernfokus, Gift. |
Jede normale Formation der Region verwendet 3-7 reguläre Gegner entsprechend freigeschalteter Spielerplätze.
Ein normaler Kampf darf höchstens zwei Exemplare derselben stark spezialisierten Unterstützerrolle enthalten.
Die ersten zwei Begegnungen einer Region führen neue Mechaniken isoliert ein; danach werden sie kombiniert.
Gegnerfähigkeiten werden beim ersten Kontakt als Kurzkarte und danach im Kodex vollständig gezeigt.

## 15. Eliteeigenschaften, Champions und Zwischenbosse
### 15.1 Eliteeigenschaften
Ein Elitekampf markiert ein oder zwei normale Gegner als Elite. Auf Normal erhält ein Elitegegner genau eine Eigenschaft; ab Ascension 7 kann ein Elitegegner zwei kompatible Eigenschaften tragen. Eliteeigenschaften sind vor dem Kampf vollständig sichtbar und besitzen ein großes Symbol am Lebensbalken.
| Eigenschaft | Mechanische Definition |
| --- | --- |
| Gehärtet | +25% Max-LP, +18 Rüstung/Widerstand; keine weitere Fähigkeit. |
| Rasend | Unter 50% LP +30% Angriffstempo und +15% Bewegung. |
| Arkan geladen | Alle 8 s nächster Angriff verursacht zusätzlich 60% magischen Flächenschaden Radius 3. |
| Vampirisch | Heilt 20% des verursachten direkten Endschadens; gegen Beschwörungen nur 10%. |
| Beschwörer | Bei 70% und 35% LP je eine regionale schwache Beschwörung; globale Grenze gilt. |
| Wächter | Erste zwei Verbündeten unter 50% LP erhalten Schild 12% ihrer Max-LP; je Ziel einmal. |
| Störend | Erster Fähigkeitsstart eines Spielers erhält 1,5 s zusätzliche Vorbereitung; sichtbar. |
| Explosiv | Bei Tod nach 0,8 s Explosion Radius 6, 120% magisch; Warnkreis. |
| Phasenhaft | Alle 9 s 1 s unverwundbar und Bahnwechsel zum höchsten Zielscore; nicht während Fähigkeit. |
| Kommandierend | Andere Gegner Radius 10 +10% Angriff und +10% Bewegung; Aura endet bei Tod. |
| Nachhallend | Erste wiederholbare Fähigkeit wird nach 2 s mit 55% Stärke wiederholt; Ziel neu validiert. |
| Unnachgiebig | Erster tödlicher Treffer lässt Elite 3 s bei 1 LP weiterkämpfen, danach fällt sie; nicht heilbar. |
### 15.2 Kompatibilitätsregeln
Unnachgiebig darf nicht mit Explosiv kombiniert werden, damit das Todesfenster eindeutig bleibt.
Phasenhaft darf nicht auf stationären Konstruktionen oder Pflanzen erscheinen.
Beschwörer darf nicht auf einem Gegner liegen, der bereits mehr als zwei Beschwörungen erzeugt.
Vampirisch heilt nicht aus reflektiertem, Gift- oder Brennschaden.
Nachhallend kopiert keine einmalige Phasenfähigkeit und keine Beschwörung, die das globale Limit überschreiten würde.
Ein Eliteattribut erhöht den Belohnungswert des Kampfes um 1; zwei Attribute um 2.
### 15.3 Champions
Champions werden ab Ascension-Rang 5 in normalen und Elitekämpfen zugelassen. Sie sind eigene kuratierte Gegner, keine zufällige Kombination. Höchstens ein Champion pro Kampf, außer Endlose Rift Tiefe 41+.
| Champion | Vollständige Kernmechanik |
| --- | --- |
| Aschenherold | Alle 7 s markiert eine Bahn; nach 1,2 s Ascheregen 100% magisch + Brennen. Bewegt sich wie Unterstützer. |
| Dornenschläfer | Beginnt als stationäre Knospe mit 40% Schadensreduktion; erwacht bei 70% LP als schneller Brecher. |
| Stahlprophet | Zeigt drei Symbole in fester Reihenfolge: Schild, Geschütz, Explosion; nutzt alle 8 s nächstes Symbol. |
| Spiegelritter | Kopiert zu Kampfbeginn die Doktrinwirkung der Spielergruppe in gegnerischer Form, aber keine Werteboni. |
| Rudelalpha | Beginnt mit zwei Schattenwölfen; erhält +12% Angriff pro aktivem Wolf. |
| Riftarchivar | Speichert ersten negativen Effekt, den er erhält, und wendet ihn nach 3 s auf den Verursacher an; einmal. |
| Kettenmeister | Verbindet sich mit robustestem Verbündeten; 25% seines eingehenden Schadens geht auf Partner, bis einer fällt. |
| Leerenkantor | Alle 10 s 1,5 s Stille auf Bahn mit meisten Fähigkeitsnutzern; Vorwarnung 0,8 s. |
### 15.4 Zwischenbosse
| Name | Region | Baseline | Mechaniken | Gegenstrategie |
| --- | --- | --- | --- | --- |
| Der Rußgeneral | Aschenstraße | LP 5.800; Rüstung 45; Widerstand 30. Begleitet von Rußschild und Kohlebogner. | Befehlsruf alle 10 s: Front +20% Bewegung/Angriff 5 s. Bei 50% LP ruft zwei Ascheechos der zuerst gefallenen normalen Begleiter. | General fokussieren oder Begleiter schnell flächig räumen; Banner bannbar. |
| Die wandernde Hecke | Dornenhain | LP 6.300; Rüstung 38; Widerstand 42; groß und langsam. | Wechselt alle 8 s Bahn, hinterlässt Dornenknospe. Bei 40% LP Heilblüte und 8 s Regeneration. | Bahnen abdecken, Pflanzen zerstören, Regeneration bannbar. |
| Vorarbeiter Neunhammer | Eisenschmiede | LP 6.000; Rüstung 58; Widerstand 28. Begleitet von zwei Konstruktionen. | Alle 9 s markiert Konstruktion zur Überladung; zerstörte Konstruktion betäubt ihn 1 s. Unter 35% LP schwerer Flächenschlag. | Konstruktionen gezielt zum richtigen Zeitpunkt zerstören. |
| Der falsche Pip | Zitadelle | LP 5.500; Rüstung/Widerstand 35; schwebend. | Imitiert nacheinander eine vereinfachte Fähigkeit von Aurel, Veyra und Nyx; Reihenfolge vor Kampf sichtbar. | Flexible Gruppe; auf bekannte Telegraphe reagieren, kein einzelner harter Counter nötig. |
Implementierungs- und Abnahmekriterien
Jeder Elite- und Championeffekt besitzt Vor-Kampf-Tooltip, Icon und eindeutige Kampftelegraphie.
Kein Eliteeffekt kann eine reguläre Fähigkeit in eine nicht konterbare Soforttötung verwandeln.
Formationsgenerator prüft Kompatibilitätsregeln und erstellt keine illegale Kombination.
Zwischenbosse dauern auf Normal 45-70 Sekunden und besitzen mindestens einen, höchstens zwei Mechanikwechsel.

## 16. Vollständiges Bossdesign
Jeder Hauptboss ist eine kuratierte Begegnung mit eigener Arena, Musik, Silhouette, mindestens drei klaren taktischen Momenten, vollständiger Vorschau und garantierter Freischaltung. Boss-LP schließen alle Phasen ein. Phasenschwellen werden nach Endschaden geprüft; überschüssiger Treffer wird nicht abgeschnitten, außer ein Übergang benötigt ausdrücklich Mindestdauer.
Bossleiste zeigt aktuelle Phase, nächste Schwelle, aktive Ressource und vorbereitete Fähigkeit.
Bosse sind reguläre Einheiten für Kampfende, aber keine normalen/Elitegegner für Kopier-, Wiederbelebungs- oder Exekutionsregeln.
Kontrolle wirkt reduziert; Rückstoß verändert nur Animationsstagger, nicht Position, sofern Bossdefinition nichts anderes sagt.
Jeder Boss hat mindestens ein offensives, ein strategisches und ein Zeitfenster-Element.
Ein erster Versuch darf wegen mangelnder Ausführung scheitern, aber nicht wegen verschwiegener Kernmechanik.
### 16.1 Der Aschenkönig - Boss von Akt I
| Feld | Festlegung |
| --- | --- |
| Kampfidentität | Militärischer Nekro-Kommandant. Der Spieler muss entscheiden, ob er Echos schnell räumt oder den König unter Druck setzt. |
| Arena | Verfallener Thronsaal auf der Aschenstraße. Drei klare Bahnen; je Bahn zwei leere Aschesiegel im Boden. |
| Baseline Normal | LP 18.000; Rüstung 42; Widerstand 36; Angriff 145; Bewegung 3,8; Reichweite 4; Kontrollresistenz 70%; Bossgröße. |
| Startformation | Aschenkönig mittlere Bahn Front; je ein Aschesoldat oben und unten Mitte; ein Ascheträger hinten Mitte. |
| Standardangriff | Königsklinge: 110% physisch. Jeder dritte Treffer: Aschenschlag 85% physisch Radius 4 und Brennen 4 s. |
| Zentrale Ressource | Aschesiegel. Wenn ein normaler Soldat fällt, entsteht an seiner Todesposition 10 s lang ein sichtbares Siegel. Maximal sechs aktive Siegel. |
#### Phase 1 - Die Probe (100-70% LP)
Echoappell: Startladung 8 s, Wiederaufladung 13 s, Vorbereitung 1,0 s. Wählt bis zu zwei älteste aktive Aschesiegel und beschwört dort je ein Ascheecho des gefallenen normalen Gegners. Echos besitzen 45% ursprüngliche LP, 55% Angriff, nur Standardangriff, 12 s Lebensdauer und zählen zur Beschwörungsgrenze.
Königlicher Befehl: alle 11 s; alle aktiven Echos erhalten 5 s +25% Bewegung und wechseln ihr Jagdziel auf den regulären Spielercharakter mit niedrigstem LP-Prozent auf ihrer oder benachbarter Bahn.
Unterbrechungsfenster: Verliert der König während der Vorbereitung von Echoappell Endschaden in Höhe von 5% seiner Max-LP, wird die Beschwörung auf ein statt zwei Siegel reduziert. Bei 8% wird sie vollständig unterbrochen; er verliert 50% Wiederaufladung. Schwelle wird als Segment unter der Bossleiste angezeigt.
#### Phase 2 - Das Heer erinnert sich (70-35% LP)
Übergang: 1,2 s unverwundbar, stößt reguläre Nahgegner 4 X zurück, löscht keine Siegel und ruft einmalig zwei Ascheechos aus den ältesten Siegeln. Übergang wird durch Thronruf und Kamerafokus angekündigt.
Ascheformation: Alle 12 s markiert der König eine Bahn. Nach 1,2 s marschiert eine Linie aus drei nicht-kollidierenden Echos über diese Bahn und verursacht jedem Ziel einmal 125% physischen Schaden plus Brennen. Die Linie ist keine Beschwörung und kann nicht angegriffen werden; Bahnwarnung muss klar sein.
Echoappell verbessert: bis zu drei Siegel, aber weiterhin Unterbrechungsschwellen. Bei voller Beschwörungsgrenze werden keine zusätzlichen Echos erzeugt und der König erhält stattdessen pro fehlendem Echo 4 s Schild 4% Max-LP, maximal 12%.
Königlicher Befehl: gibt zusätzlich 15% Angriffskraft.
#### Phase 3 - Der letzte Auftritt (35-0% LP)
Übergang: alle verbliebenen Siegel werden verbraucht. Pro Siegel entsteht ein 6 s langes Schwaches Echo; höchstens sechs. Der König kann danach keine neuen Echos aus normalen Toten erzeugen.
Brennende Krone: permanente Aura Radius 8; Echos +20% Angriff, Spielerbeschwörungen erleiden 3% Max-LP magischen Schaden pro Sekunde. Reguläre Einheiten sind von der Aura nicht direkt betroffen.
Kronensturz: alle 10 s, Vorbereitung 1,1 s; Sprung zur Bahn mit meisten regulären Spielerzielen, 180% physischer Schaden Radius 5, 2 X Rückstoß. Landepunkt deutlich markiert. Danach 2,5 s lang -20 Rüstung/Widerstand auf dem König: vorgesehenes Burstfenster.
Echoappell entfällt. Standardangriff wird 12% schneller. Phase soll offensiver Endspurt statt unendlicher Beschwörung sein.
#### Ascension-Erweiterungen
Rang 4 - Aschearchiv: Beim ersten Echoappell jeder Phase erhält das älteste beschworene Echo zusätzlich die vereinfachte Fähigkeit seines Basistyps mit 50% Stärke. Diese Fähigkeit ist in der Vorschau aufgelistet.
Rang 9 - Zusätzliche Phase „Die Parade“ bei 55% LP: Arena verschiebt die äußeren Bahnen näher zur Mitte; 12 s lang erscheinen abwechselnd angekündigte Echomärsche oben/unten. König ist angreifbar, nutzt aber keine anderen Fähigkeiten. Nach Ablauf kehrt Arena zurück und Phase 2 setzt fort.
Veteran: +15% Boss-LP, Unterbrechungsschwellen 5,5%/9%, Echos 55% Basis-LP.
#### Spielerinformation und Gegenstrategie
Vorschau erklärt: Gefallene normale Soldaten hinterlassen Siegel; Appell kann durch hohen Schaden reduziert/unterbrochen werden; Flächenschaden und Bannwirker sind hilfreich; Phase 3 besitzt ein Burstfenster nach Kronensturz.
Empfohlene Rollen: eine stabile Front, Flächenschaden oder Anti-Beschwörung, mindestens eine Quelle konzentrierten Schadens. Keine davon ist zwingend.
Alternative Lösungen: Echos ignorieren und König bursten; Siegel durch langsames Töten verteilen; Beschwörungsgrenze kontrolliert füllen; Jagd auf Ascheträger, bevor viele Siegel entstehen.
#### Belohnung
Garantiert beim ersten Sieg: Sable, Banner „Verkohlter Eid“, 280 Gold, ein Hauptausrüstungsfund. Wiederholungen: Bossbeute-Pool, 140-200 Gold und erhöhte Chance auf Aschen-Relikt.
Implementierungs- und Abnahmekriterien
Jedes Echo ist eindeutig mit seinem Ursprungssiegel verbunden und übernimmt keine Eliteeigenschaft.
Unterbrechungsschwelle zählt ausschließlich Endschaden während der sichtbaren Vorbereitung.
Siegel verfallen nach zehn Sekunden oder bei Verbrauch; nie unsichtbar aktiv.
Phase 3 kann nicht durch dauerndes Wiederbeleben endlos werden.
Normaler Testkampf mit angemessener Gruppe dauert 65-90 Sekunden; mindestens drei unterschiedliche Gruppenkonzepte müssen zuverlässig siegen können.
### 16.2 Die Dornenmutter - Boss von Akt II
| Feld | Festlegung |
| --- | --- |
| Kampfidentität | Stationäre Pflanzenherrscherin, die Bahnen mit unterschiedlichen Pflanzenfunktionen besetzt. Der Spieler muss mehrere Bahnen abdecken und Schutzfenster verstehen. |
| Arena | Riesiges Gewächshaus. Die Dornenmutter steht rechts hinter allen Bahnen; je Bahn zwei sichtbare Wurzelfelder. |
| Baseline Normal | LP 23.000; Rüstung 34; Widerstand 48; Angriff 138; stationär; Reichweite 30; Kontrollresistenz 75%. |
| Startformation | Je ein Rankenwächter oben/unten Front, Giftspucker Mitte Hinten. |
| Standardangriff | Dornensalve: drei Projektile auf aktuelle Bahn, je 45% physisch; ein Ziel kann höchstens zwei treffen. |
#### Pflanzenregeln
Wurzelfelder sind feste Spawnpunkte und werden vor Kampf gezeigt. Pro Feld höchstens eine Pflanze.
Dornenknospe: greift alle 3 s an; Heilblüte: heilt; Fangranke: LP 500, alle 4 s 0,7 s Wurzel auf nächsten Nahgegner; Giftkelch: LP 420, alle 3 s kleines Giftfeld Radius 4.
Pflanzen zählen als Beschwörung. Bei voller Gegner-Beschwörungsgrenze kann die Dornenmutter eine vorhandene eigene Pflanze derselben niedrigeren Priorität ersetzen: Dornenknospe < Fangranke < Giftkelch < Heilblüte.
Zerstörte Pflanze hinterlässt 5 s freie Erde und kann in dieser Zeit nicht neu bepflanzt werden. Visueller Timer am Feld.
#### Phase 1 - Aussaat (100-65% LP)
Dreifache Saat: Start 6 s, Cooldown 12 s. Pflanzt je nach Bedarf zwei Pflanzen: Heilblüte bei Boss/Verbündetem unter 75% LP, Fangranke bei Nahdruck, sonst Dornenknospe. Nie beide auf derselben Bahn.
Dornenwall: alle 10 s markiert eine Bahn; nach 1 s wachsen 8 s lang Dornen aus dem Boden. Bewegung dort -30%; alle 2 s 45% physischer Schaden an Einheiten in Kontaktzone. Pflanzen sind nicht betroffen.
#### Phase 2 - Geschlossener Kelch (65-30% LP)
Übergang: Boss schließt Blütenpanzer für 7 s und erhält 65% Schadensreduktion. Gleichzeitig erscheinen drei klar markierte Wurzelherzen, je Bahn eines, LP 750.
Jedes zerstörte Wurzelherz reduziert Panzer sofort um 20 Prozentpunkte. Werden alle drei zerstört, bricht Panzer vorzeitig und Boss ist 3 s verwundbar: -25 Widerstand/Rüstung.
Nach Panzerende Pollenstoß: 100% magischer Flächenschaden über alle Bahnen; pro überlebendem Wurzelherz zusätzlich 35% und 2 s Schwächung. Herzen verschwinden danach.
Anschließend normale Saat, aber kann Giftkelche erzeugen. Panzer wiederholt sich nach 18 s, falls Phase noch aktiv.
#### Phase 3 - Wilde Blüte (30-0% LP)
Boss öffnet sich vollständig, verliert permanent 15 Rüstung/Widerstand, Standardintervall -15%.
Überwuchern: alle 9 s werden zwei freie Felder sofort mit Dornenknospen bepflanzt; keine Heilblüten mehr.
Rankenschlag: Bahn mit meisten regulären Zielen, 1 s Warnung, 175% physisch und Wechsel auf benachbarte Bahn erzwungen, falls Platz; sonst 0,5 s Betäubung.
Phase ist kurzer DPS-/Überlebensabschluss und darf nicht durch Heilblüten verlängert werden.
#### Ascension-Erweiterungen
Rang 4: Samenraub - erste zerstörte Spielerbeschwörung je Phase erzeugt auf nächstem freien Gegnerfeld eine Dornenknospe.
Rang 9: zusätzliche Phase bei 45% LP Der wandernde Garten - Bosswurzel verschiebt sich alle 4 s zwischen Bahnen; nur ihre aktuelle Bahn kann Boss direkt angreifen, andere Ziele werden von Ranken blockiert. Dauer 16 s.
Veteran: Wurzelherzen 900 LP; Pollenstoß-Schwächung 3 s; keine höhere Schadensreduktion.
#### Gegenstrategien und Belohnung
Mehrere Bahnen abdecken; mobile Nahkämpfer oder Beschwörungen auf Wurzelherzen; Flächenschaden gegen Pflanzen; Bannung gegen Regeneration; Panzer nicht stumpf angreifen.
Garantiert: Ilyras „Morgensamen“-Talisman, Banner „Offener Hain“, 360 Gold, Freischaltung Akt III und sechster Gruppenplatz.
Implementierungs- und Abnahmekriterien
Pflanzenwahl folgt deterministischer Priorität und ist in Vorschau verständlich.
Panzerreduktion durch Herzen ist unmittelbar sichtbar und mathematisch korrekt.
Keine Pflanzen können auf belegtem oder gesperrtem Wurzelfeld entstehen.
Mindestens eine sichere Strategie ohne Flächenmagier und eine ohne Beschwörer muss funktionieren.
### 16.3 Der Ewige Schmied - Boss von Akt III
| Feld | Festlegung |
| --- | --- |
| Kampfidentität | Wechselt zwischen Aufbau, befestigter Verteidigung und aggressiver Überhitzung. Konstruktionen sind echte Ziele und zugleich Bossressource. |
| Arena | Runenschmiede mit je einem Amboss-Slot pro Bahn und zentralem Ofenkern. |
| Baseline Normal | LP 28.000; Rüstung 60; Widerstand 30; Angriff 165; Bewegung 4,2; Reichweite 4; Kontrollresistenz 78%. |
| Startformation | Boss Mitte Front; zwei Schmiedewachen außen; ein Runenmechaniker hinten. |
| Standardangriff | Hammerhieb 125% physisch; jeder dritte Angriff 90% Radius-4-Schockwelle. |
| Ressource | Hitze 0-100. Fähigkeiten erzeugen Hitze; zerstörte gegnerische Konstruktionen reduzieren sie. Leiste ist immer sichtbar. |
#### Phase 1 - Aufbau (100-70% LP)
Schmiedebefehl: alle 9 s baut auf freiem Amboss-Slot nach Priorität Barrikade (wenn Bahn offen), Geschütz (wenn Barrikade aktiv), Reparaturdrohne (wenn Konstruktion unter 60% LP). Maximal vier Bosskonstruktionen und globale Sechsergrenze.
Jeder Bau +18 Hitze. Standardangriff +2 Hitze. Zerstörung einer Bosskonstruktion -15 Hitze und 0,5 s Stagger am Boss.
Glühender Hammer: bei 60+ Hitze ersetzt jeder dritte Angriff die Schockwelle durch 150% magischen Schaden + Brennen.
#### Phase 2 - Festung (70-40% LP)
Übergang: Boss springt zum Ofenkern, 1 s unverwundbar, erzeugt je eine Runenbarrikade auf äußeren Bahnen und Schild 18% Max-LP. Hitze wird auf mindestens 50 gesetzt.
Ofenkern speisen: Solange mindestens eine Bosskonstruktion aktiv ist, erhält Boss 25% Schadensreduktion. Jede aktive Konstruktion gibt zusätzlich +5 Rüstung/Widerstand, maximal +20.
Metallregen: alle 11 s, zwei Bahnen werden 1,2 s markiert, dann je 135% physisch auf alle Ziele dort. Konstruktionen des Bosses heilen 10% statt Schaden.
Notfallreparatur: bei 30% Schildrest, 1 s Kanal; repariert aktive Konstruktionen 25% und Schild 8% Max-LP. Kann durch Zerstörung einer Konstruktion während Kanal vollständig unterbrochen werden.
#### Phase 3 - Überhitzung (40-0% LP)
Alle Bosskonstruktionen überladen: +50% Angriff/Wirksamkeit, verlieren 4% Max-LP/s. Boss-Schadensreduktion endet. Hitze steigt automatisch 5/s.
Bei 100 Hitze Ofenbruch: 1,4 s globale Warnung, 190% magischer Schaden an allen regulären Einheiten, 80% an Beschwörungen; danach Hitze 30 und Boss 3 s verwundbar (-30 Rüstung/Widerstand). Jede in den letzten 5 s zerstörte Bosskonstruktion reduziert Ofenbruch um 15%, max. 45%.
Hammersturm: alle 8 s drei Schläge auf aktuelle/benachbarte Bahnen zu je 100% physisch; jeder Zielcharakter max. zweimal.
Boss baut in Phase 3 keine neuen Konstruktionen. Kampf besitzt damit eindeutigen Endzustand.
#### Ascension-Erweiterungen
Rang 4: Magnetkran - alle 14 s zieht entfernteste Spieler-Konstruktion oder, falls keine, entferntesten Schützen 6 X zum Zentrum; 0,9 s Warnung.
Rang 9: Zusatzphase bei 55% LP Qualitätskontrolle - Boss präsentiert nacheinander drei Konstruktionen; Spieler muss innerhalb 15 s zwei zerstören. Jede überlebende wird als verbesserte Version in Phase 2 übernommen.
Veteran: Hitze aus Standardangriff +3; Konstruktionen +15% LP; Ofenbruch unverändert, um Fairness zu bewahren.
#### Gegenstrategien und Belohnung
Brecher und Bannwirker; Konstruktionen zeitlich passend statt blind zerstören; defensive Phase überstehen; Ofenbruch durch Zerstörung abschwächen; Burst im Verwundbarkeitsfenster.
Garantiert: Orrik, Banner „Perfekter Bauplan“, 450 Gold, siebter Gruppenplatz und Akt IV.
Implementierungs- und Abnahmekriterien
Hitzeänderungen sind vollständig im Log und an Leiste sichtbar.
Konstruktionstod reduziert Hitze exakt einmal, auch bei Überladungsexplosion.
Boss baut nie über definierte Grenzen und blockiert nicht alle drei Bahnen ohne gültigen Angriffsweg.
Ofenbruch hat mindestens 1,4 s lesbare Warnung bei 1x und passende Zeitlupe bei 2x/3x.
### 16.4 Das Herz des Risses und der Kurator - Endboss von Akt IV
| Feld | Festlegung |
| --- | --- |
| Kampfidentität | Prüfung aller vier Regionallektionen. Der Kurator kontrolliert die Arena, ist aber kein normal angreifbares Ziel. Das Herz wechselt sichtbare Formen. |
| Arena | Schwebende Zitadellenplattform. Drei Bahnen bleiben logisch konstant, visuell verändern sich Hintergrund und Boden pro Phase. |
| Baseline Normal | Herz LP 36.000; Rüstung/Widerstand 40; stationär zentral rechts; Kontrollresistenz 85%. Kurator besitzt keine LP und kann nicht als Ziel gewählt werden. |
| Startformation | Herz allein; jede Phase erzeugt kuratierte Unterstützer, höchstens drei reguläre Gegner gleichzeitig. |
| Standardangriff | Riftstrahl alle 1,7 s: 105% magisch auf Ziel mit höchstem Gefahrwert; Strahl kann durch Deckung nicht reduziert werden, ist aber sichtbar. |
| Phasenwechsel | Bei 75%, 50% und 25% LP; 1,5 s unverwundbar, laufende Herzfähigkeit abgebrochen, Spielerfähigkeiten laufen weiter. |
#### Phase 1 - Konservierte Asche (100-75% LP)
Ruft je einen Aschesoldaten oben/unten. Gefallene hinterlassen Siegel. Archivappell alle 12 s belebt höchstens ein Echo; Kanal kann bei 5% Boss-Max-LP Schaden verhindert werden.
Aschenspur: alle 9 s eine Bahn 5 s Brennzone; 3% Quellenangriff magisch pro Sekunde und -15% Bewegung.
Ziel: bekannte Aschenregel in vereinfachter Form, kein vollständiger Aschenkönig-Replay.
#### Phase 2 - Idealer Garten (75-50% LP)
Alle Aschesiegel/Echos verschwinden. Zwei Wurzelfelder pro äußerer Bahn erscheinen. Herz pflanzt alle 9 s eine Dornenknospe oder Heilblüte.
Konservierter Kelch: 6 s 50% Schadensreduktion und je ein Wurzelherz auf zwei Bahnen. Zerstörung beider beendet Schutz; sonst Pollenstoß 120% magisch.
#### Phase 3 - Vollkommene Maschine (50-25% LP)
Pflanzen verschwinden. Erzeugt Barrikade und Geschütz. Jede aktive Konstruktion gibt Herz 12% Schadensreduktion.
Kurator überlädt: alle 10 s markiert eine Konstruktion; nach 4 s explodiert sie Radius 6 für 150% magisch. Zerstörung vor Ablauf verhindert Explosion und macht Herz 1,5 s verwundbar (-20 Verteidigung).
Metalllinie: eine Bahn, 1 s Warnung, 150% physisch.
#### Phase 4 - Unmögliche Zukunft (25-0% LP)
Alle Unterstützer und Konstruktionen verschwinden. Arena mischt alle Regionen. Herz erhält keine Schadensreduktion und kann nicht mehr heilen.
Drei Möglichkeiten: Alle 8 s zeigt der Kurator drei Symbole über den Bahnen: Asche, Dornen, Stahl. Nach 1,2 s tritt je Bahn der entsprechende Effekt auf: Asche = 110% magisch + Brennen; Dornen = 100% physisch + Verlangsamung; Stahl = 135% physisch, ignoriert 20 Rüstung. Symbole/Zuordnung bleiben konsistent.
Zukunft löschen: bei 10% LP einmalig 4 s Kanal. Währenddessen erscheinen drei Riftfragmente mit je 650 LP auf den Bahnen. Wird mindestens zwei zerstört, bricht Kanal und Herz verliert 5% Max-LP reinen Schaden. Sonst globale Explosion 180% magisch und 3 s Schwächung; kein Soforttod.
Nach Sieg zerbricht das Herz in kontrollierte Fragmente; Kurator flieht nicht als DLC-Haken, sondern wird in einer kurzen Szene vom eigenen statischen Archiv eingeschlossen. Kampagne ist abgeschlossen.
#### Kurator-Regeln
Der Kurator darf nie Ziel, Kollisionskörper, Heilempfänger oder Schadensquelle ohne sichtbare Arenaaktion sein.
Jeder Eingriff besitzt Symbol, Sprachausgabe/Untertitel und mindestens 0,8 s Vorwarnung.
Kuratoraktionen werden wie Bossfähigkeiten im Vorschaufenster aufgelistet und im Kampflog dem Kurator zugeordnet.
#### Ascension-Erweiterungen
Rang 4: Redigierte Fußnote - einmal pro Phase friert der Kurator die aktuell höchste Spieler-Synergie 5 s ein; ihre neuen Trigger pausieren, bestehende Schilde/Einheiten bleiben. Vorwarnung und betroffene Synergie sichtbar.
Rang 9: Zwischen jeder Regionalphase 10 s Korridor der Möglichkeiten: zwei Bahnen sind abwechselnd gefährlich, während drei kleine Fragmente erscheinen. Zerstörte Fragmente geben der Gruppe je 4% Schild. Keine zusätzlichen regulären Gegner.
Rang 10 vollständige Fassung: Phasenreihenfolge wird aus drei kuratierten Reihenfolgen gewählt und vor Kampf angezeigt; Phase 4 bleibt immer zuletzt.
#### Gegenstrategien und Belohnung
Flexible Rollenverteilung statt extremer Einzelsynergie; vor Kampf alle Phasen lesen; zwischen sichtbaren Phasen verändert der Spieler nicht aktiv die Formation, daher muss Startgruppe mehrere Aufgaben lösen.
Garantiert erster Sieg: Abschluss der Kampagne, Riftkammer, Ascension, Endlose Rift, Nyx, 700 Gold, Talisman „Offene Möglichkeit“, Titel „Riftwarden“.
Implementierungs- und Abnahmekriterien
Jede Phase ist mechanisch wiedererkennbar, aber kürzer und einfacher als ihr Regionalboss.
Kurator kann niemals durch Targeting-Fehler angegriffen werden.
Alle Phase-Objekte werden beim Übergang sauber entfernt; keine alten Auren oder Timer wirken weiter.
Endphase besitzt keine Heil- oder Endlosschleife.
Auf Normal müssen mindestens fünf deutlich verschiedene Gruppenkompositionen den Boss in internen Tests besiegen können.

## 17. Kampfvarianten und Schlachtfeldmodifikatoren
### 17.1 Kampfvarianten
| Variante | Exakte Regel | Design- und Belohnungsregel |
| --- | --- | --- |
| Standardkampf | Normale spiegelnde Startentfernung. Keine zusätzlichen Einheiten oder Ziele. | Referenzkampf; 20-45 s. |
| Hinterhalt | Startabstand aller Einheiten -12 X oder genau ein angekündigter mobiler Gegner beginnt in der mittleren Tiefenzone seiner Bahn. | Vorbereitung zeigt rote Startlinien; Belohnungswert +1. |
| Befestigte Stellung | Gegner beginnen mit 1-3 sichtbaren Barrikaden/Konstruktionen. Mindestens eine Bahn bleibt direkt begehbar. | Brecher/Konstruktionstargeting; Belohnungswert +1. |
| Verstärkungen | Eine zweite, vollständig sichtbare Gruppe von 1-3 Gegnern erscheint nach 12 s oder beim ersten Fall unter 50% Gesamtgegner-LP. Auslöser ist vor Kampf angegeben. | Neue Einheiten spawnen nur rechts außerhalb Kollisionsbereich; Belohnungswert +1. |
| Anführer | Ein markierter regulärer Gegner besitzt eine sichtbare Aura. Aura endet sofort bei Tod und ist im Tooltip exakt angegeben. | Zielpriorisierung; Belohnungswert +1. |
| Riftsturm | Ein festes, vor Kampf sichtbares Intervall aktiviert einen Schlachtfeldeffekt. Der Effekt besitzt mindestens 1 s Warnung. | Rhythmische Gefahr; Belohnungswert +1. |
| Überleben | Drei kurze Wellen; Kampf endet nach Sieg über Welle 3. Zwischen Wellen 2 s Pause, reguläre eigene Einheiten werden nicht geheilt, Fähigkeitladung läuft nicht. Maximaldauer 75 s. | Selten; nur Missionen/Endless; Belohnungswert +2. |
### 17.2 Die 18 Schlachtfeldmodifikatoren
Ein Modifikator wirkt grundsätzlich symmetrisch, sofern die Definition nicht ausdrücklich eine Seite nennt. Er wird auf Missionskarte, Knotenvorschau und Kampfbildschirm mit identischem Namen und Kurztext angezeigt. Normale Kampagne: höchstens ein Modifikator; Ascension 8+: höchstens zwei kompatible; Endlose Rift Tiefe 31+: bis zu zwei, niemals drei.
| Name | Mechanische Regel | Telegraphie | Taktischer Umgang |
| --- | --- | --- | --- |
| Nebelbank | Alle Projektil-Reichweiten -22%; Mindestreichweite 8. Nahkampf unverändert. | Grauer Horizontstreifen; Reichweitenvorschau verkürzt. | Kurze/mittlere Reichweite, Vorwärtspositionierung. |
| Echoüberfluss | Beschwörungen beider Seiten +20% Max-LP und +15% Lebensdauer. | Beschwörungs-Icon mit Plus. | Anti-Beschwörung oder eigene Beschwörer. |
| Dünnes Licht | Direkte Heilung -25%; Schilde unverändert. | Heilzahlen mit gebrochenem Sonnenicon. | Schilde, Burst, Reinigung statt Sustain. |
| Glashaut | Schilde +25%, aber nach vollständigem Bruch erleidet Ziel 3 s Schwächung. | Schild erhält Rissmuster. | Bannung, fokussierter Schildbruch. |
| Früher Funke | Erste wiederholbare Fähigkeit jeder regulären Einheit beginnt mit 30% Vorladung; einmalige Level-3-Skills nicht. | Vorladungsring vor Kampf. | Schnelle Counterfähigkeiten, defensive Starts. |
| Gefährliche Flanken | Äußere Bahnen erhalten alle 6 s nach 1 s Warnung 60% magischen Bodenschaden auf Kontaktzone X 35-65. | Rote/violette Außenränder. | Mittlere Bahn, kurze Aufenthalte, Schutz. |
| Riftwind | Alle 5 s wechselt Windrichtung. Projektile in Windrichtung +25% Geschwindigkeit, entgegen -25%; Schaden unverändert. | Pfeile/Partikel und UI-Pfeil. | Timing, Nahkampf, schnelle Projektile. |
| Sturmritt | Alle regulären Einheiten +18% Bewegung. | Laufspur; Startvorschau. | Speerwall, kompakte Formation. |
| Schwere Zeit | Alle Standardangriffsintervalle +18%; Fähigkeitsladung unverändert. | Uhrsymbol, leicht gedehnte Attack-Windups. | Fähigkeitsgruppen, Burst. |
| Spröde Konstruktionen | Konstruktionen -25% Max-LP, verursachen bei Zerstörung Radius 4 80% magischen Schaden an Gegnern ihrer Besitzerseite; Friendly Fire nur für Konstruktionsteam. | Warnriss und Explosionskreis. | Gezieltes Zerstören, Abstand. |
| Harter Impuls | Harte Kontrolle +35% Basisdauer, aber jede Einheit erhält nach Ende 5 s Kontrollimmunität. Boss-Cap bleibt. | Immunitätsring nach Effekt. | Einzelne gezielte Kontrolle statt Spam. |
| Siegesfunken | Tod eines Elitegegners heilt alle regulären Spielerverbündeten 5% Max-LP; Tod einer Spieler-Elite existiert nicht. | Goldener Impuls. | Elite gezielt als Heilfenster nutzen. |
| Offene Wunden | Brennen und Gift +25% Tickstärke, Dauer -20%. | Statusicon pulsiert schneller. | Reinigung, schneller Kampf. |
| Stille Zonen | Alle 8 s wird eine Bahn 1 s angekündigt und 3 s stummgeschaltet. Standardangriffe bleiben. Reihenfolge oben-mitte-unten. | Großes Bahn-Symbol und Bodenrune. | Formation verteilen, Timing. |
| Wandernde Deckung | Je Bahn bewegt sich eine neutrale Riftplatte langsam hin und her. Einheiten dahinter erhalten 15% Projektilreduktion. | Klarer physischer Körper, keine Kollision. | Nahkampf, Bahnwahl. |
| Unruhige Anker | Alle Startbeschwörungen erscheinen 3 X weiter vorne; spätere normal. | Spawnmarken versetzt. | Früher Beschwörungsdruck oder schnelle Räumung. |
| Wechselnde Schwäche | Alle 10 s wechselt globales Symbol Physisch/Magisch. Betroffener Schadenstyp +15%, anderer -10%. Starttyp vor Kampf sichtbar. | Großes, farbunabhängig geformtes Symbol. | Gemischte Schadensgruppe, Burstfenster. |
| Letzter Atem | Erste reguläre Einheit jeder Seite, die unter 15% LP fällt, erhält einmal 4 s +25% Angriff und Bewegung; kein Schild. | Flammenkranz mit Einmalmarker. | Fokus abschließen oder defensiv retten. |
### 17.3 Inkompatible Kombinationen
Früher Funke darf nicht mit Stille Zonen im ersten 4-Sekunden-Fenster beginnen; erste Stille startet frühestens Sekunde 6.
Nebelbank und Riftwind dürfen zusammen auftreten, aber nicht in einer Mission, deren Ziel ausdrücklich Fernkampfschaden verlangt.
Schwere Zeit und Wechselnde Schwäche dürfen zusammen auftreten; Kampfzeitlimit wird jedoch um 10 s erhöht.
Gefährliche Flanken und Stille Zonen dürfen nicht dieselbe Bahn im selben 2-Sekunden-Fenster erzwingen.
Spröde Konstruktionen ist unzulässig, wenn eine Missionsbedingung den Erhalt einer Konstruktion verlangt.
Echoüberfluss darf nicht mit einer Bossphase kombiniert werden, die bereits sechs unvermeidliche Beschwörungen startet, ohne Ersetzungsregel.
Implementierungs- und Abnahmekriterien
Jeder Modifikator besitzt mindestens einen sichtbaren UI-Indikator zusätzlich zur Farbe.
Kombinationsvalidator verhindert alle explizit inkompatiblen Paarungen.
Modifikatoren verändern niemals zufällig während eines Kampfes ihre Grundregel; nur fest definierte Intervalle wechseln.
Automatische Hinweise können einen Modifikator als Ursache nennen, wenn er mindestens 25% des relevanten Schadens/Heilverlusts erklärt.

## 18. Riftinstabilität
Jede Expedition besitzt eine Instabilitätsleiste von 0 bis 100. Der nächste Knoten zeigt seine garantierte Erhöhung vor Auswahl. Instabilität sinkt nicht automatisch und wird nur durch ausdrücklich benannte Dienste/Ereignisse reduziert.
| Bereich | Name | Auswirkung auf nachfolgende Kämpfe | Belohnung |
| --- | --- | --- | --- |
| 0-24 | Stabil | Keine Gegnerverstärkung. | 100% Basisgold/-beute. |
| 25-49 | Flackernd | Gegner +5% Max-LP und +3% Angriff. | +8% Gold, +5 Prozentpunkte Beutechance. |
| 50-74 | Unruhig | Gegner +10% Max-LP, +6% Angriff; Elitechance +15 Prozentpunkte. | +18% Gold, Reliktqualität +1 Gewicht. |
| 75-89 | Aufgerissen | Gegner +16% Max-LP, +10% Angriff; jeder Kampf erhält einen Modifikator. | +30% Gold, +20% Chance auf zusätzliche Belohnungswahl. |
| 90-100 | Kritisch | Gegner +22% Max-LP, +14% Angriff; Elitekampf kann zwei Eliteziele haben; Boss +10% LP. | +45% Gold, garantierte hochwertige Wahl beim nächsten Elite/Boss. |
Instabilität wird beim Betreten, nicht beim Abschluss eines Knotens erhöht; Laden eines Spielstands darf sie nicht doppelt anwenden.
Ein Wert über 100 ist unmöglich. Überschuss wird abgeschnitten, nicht in zusätzliche Strafe umgewandelt.
Knoten, die Instabilität reduzieren, zeigen neuen exakten Wert. Standardreduktionen: klein -8, mittel -15, stark -25.
Bossvorschau verwendet bereits den erwarteten Instabilitätswert nach Betreten des Bossknotens.
Auf Normal sollen sichere Routen gewöhnlich bei 35-60 enden; riskante Routen bei 70-95.

## 19. Dungeonkarten und Knoten
### 19.1 Kartenform
Eine Standardexpedition besitzt sechs horizontale Ebenen: Start; erste Wahl; Aufbau/Risiko; sicherer Anker; letzte Vorbereitung; Boss/Ziel.
9-13 sichtbare Gesamtknoten, davon 5-8 tatsächlich besucht. Mindestens zwei echte Routenentscheidungen.
Wege dürfen sich teilen und zusammenlaufen. Kein Knoten außer Start darf unerreichbar und kein gewählter Weg darf in eine Sackgasse ohne Abschluss führen.
Mindestens ein sicherer Ankerpunkt und mindestens eine Anpassungsmöglichkeit unmittelbar vor Boss/Ziel.
Maximal drei Knoten pro Ebene; maximal zwei ausgehende Wege pro Knoten auf mobilen Displays.
Knoten werden aus kuratierten Strukturbausteinen zusammengesetzt, nicht frei zufällig verbunden.
| Knotentyp | Verbindlicher Inhalt | Standardfolge |
| --- | --- | --- |
| Normaler Kampf | Standardbegegnung; Basisbelohnung Gold plus Chance auf Beute. | Instabilität +8. |
| Elitekampf | Mindestens ein Eliteattribut; genaue Kombination sichtbar. | Instabilität +12; hochwertige Belohnung. |
| Händler | 4 Angebote plus 1 Dienst; einmaliger Neuwurf, falls Ressource vorhanden. | Instabilität +3. |
| Rekrutierung | Drei temporäre Truppen aus gültigem regionalem Pool; eine kostenlos oder Goldkosten je Qualität. | Instabilität +4. |
| Schatz | Ein sichtbarer Beutetyp und ggf. sichtbare Bedingung. | Instabilität +5. |
| Ereignis | Illustrierte Situation mit 2-3 transparenten Optionen. | Instabilität +3 bis +10 laut Option. |
| Werkstatt | Sichern, temporär polieren, Kit wechseln oder Gegenstand verkaufen. | Instabilität +2. |
| Riftaltar | Starker Vorteil gegen klaren Nachteil; immer ablehnbar. | Instabilität +8 bis +15. |
| Spähposten | Enthüllt alle Details der nächsten zwei Ebenen und Bosszusatzinformationen. | Instabilität +2. |
| Sicherer Ankerpunkt | Sichern, freiwillig zurückkehren, vollständig umordnen; ein garantierter Dienst. | Instabilität +0. |
| Boss/Ziel | Abschließende Begegnung. | Keine zusätzliche Instabilität vor dem Kampf. |
### 19.2 Generierungsalgorithmus als Inhaltsregel
Wähle einen zur Mission passenden Strukturbaustein mit 6 Ebenen und 2-3 Routen.
Setze festen Start-, Anker- und Abschlussknoten.
Platziere missionspflichtige Knotentypen auf erreichbaren Ebenen.
Fülle übrige Slots anhand regionaler Gewichtung: Kampf 35%, Elite 12%, Ereignis 15%, Händler 8%, Schatz 8%, Rekrutierung 7%, Werkstatt 5%, Altar 4%, Spähposten 6%.
Prüfe, dass jede Route mindestens einen Kampf und vor Abschluss mindestens eine Belohnungs-/Anpassungsoption enthält.
Prüfe, dass keine Route zwei harte Risikoknoten ohne sichtbare alternative Route erzwingt.
Prüfe Ereignis- und Begegnungswiederholung gegen aktuellen Run; identische Ereignisse sind im selben Run verboten.
Berechne erwartete Instabilität jeder Route und verwerfe Karten, deren sicherste Route über 75 oder riskanteste unter 55 endet, sofern Mission nichts anderes verlangt.
Validiere maximale Besuchslänge 8 und minimale 5 Knoten.
Speichere finalen Karten-Seed und alle Inhalte; späteres Laden generiert nichts neu.
### 19.3 Knoteninteraktion
Vor Auswahl sieht der Spieler Knotentyp, Instabilitätsänderung, bekannte Belohnungskategorie und bei Kämpfen vollständige Formation.
Weiter entfernte Knoten dürfen Details verdecken, aber Typ und erreichbare Verbindung bleiben sichtbar. Spähposten enthüllt Details.
Nach Betreten kann der Spieler nicht zum vorherigen Knoten zurücklaufen. Rückkehr ist nur freiwilliges Expeditionsende am Anker oder über ausdrücklich benannte Option.
Formation, Doktrin und Ausrüstung dürfen zwischen allen Knoten kostenlos geändert werden; Gruppenmitglieder nur aus aktuell verfügbaren permanenten/temporären Rekruten.
Händlerangebote, Ereignisergebnisse und Belohnungswahlen werden beim Öffnen gespeichert, damit Neustart kein Neurollen erlaubt.
Implementierungs- und Abnahmekriterien
10.000 generierte Karten pro Missionsprofil enthalten keine Sackgasse, keinen fehlenden Anker und keine Besuchslänge außerhalb 5-8.
Mindestens 95% der Karten besitzen zwei Routen mit unterschiedlichem Risiko-/Belohnungsprofil.
Kein identisches Ereignis oder identische Encounter-ID erscheint zweimal in derselben Expedition.
Speichern/Laden vor und nach Knotenauswahl verändert weder Karte noch Angebote.

## 20. Ereignissystem und 30 vollständige Ereignisse
### 20.1 Globale Ereignisregeln
Jedes Ereignis besitzt Illustration, Titel, maximal 120 Wörter Situationstext, zwei oder drei Optionen und eine sichtbare Risikostufe.
Jede Option zeigt garantierte Kosten, garantierte Folgen, mögliche Zufallsresultate und exakte Wahrscheinlichkeiten vor Bestätigung.
Ein Ereignis darf nie permanent einen Helden, Vertrag, freigeschalteten Gegenstand oder Ruhm entfernen.
Zufallsergebnis wird beim Öffnen des Ereignisses deterministisch festgelegt und durch Neustart nicht neu gewürfelt.
Nicht erfüllbare Optionen bleiben sichtbar, ausgegraut und erklären die Voraussetzung. Es gibt immer mindestens eine kostenlose wählbare Option.
Identisches Ereignis erscheint höchstens einmal pro Expedition. Regionsereignisse besitzen höheres Gewicht in ihrer Region.
Einmalige Kodex/Kosmetik-Belohnungen werden nach Freischaltung durch 40-80 Gold oder gleichwertigen Dienst ersetzt.
### 20.2 Verlassene Waffenkammer
Pool: Allgemein. Risiko: Niedrig.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Schnell zugreifen | Erhalte 1 zufällige Hauptausrüstung/Talisman aus aktuellem Akt-Pool; Instabilität +6. | Garantiert. |
| Gezielt suchen | Zahle 90 Gold; wähle eine von 3 Ausrüstungskategorien, dann 1 von 2 Objekten; Instabilität +4. | Nur wählbar bei 90 Gold. |
| Versiegeln | Keine Beute; Instabilität -10. | Garantiert. |
### 20.3 Der verwundete Söldner
Pool: Allgemein. Risiko: Niedrig.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Rekrutieren | Wähle 1 von 2 Söldner-Truppen als temporären Rekruten bis Expeditionsende; Instabilität +4. | Freier Gruppenplatz nicht nötig, nur verfügbar im Pool. |
| Versorgen | Zahle 35 Gold; erhalte danach 80 Gold aus seiner versteckten Kasse und 1 Händler-Neuwurf. | Garantiert Netto +45. |
| Karte übernehmen | Enthüllt alle Details der nächsten zwei Ebenen; Instabilität +2. | Garantiert. |
### 20.4 Flüsternder Altar
Pool: Allgemein. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Klinge berühren | Nächster Kampf: eigene reguläre Einheiten +20% Angriff, -15 Rüstung/Widerstand; danach Effekt endet; erhalte 45 Gold. | Exakte temporäre Regel. |
| Erinnerung tauschen | Gib 1 Relikt ab; wähle 1 von 3 gleich- oder höherwertigen Relikten; Instabilität +8. | Nicht wählbar ohne Relikt. |
| Weitergehen | Keine Wirkung. | Sichere Option. |
### 20.5 Pips hervorragende Abkürzung
Pool: Allgemein. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Abkürzung | Überspringe die nächste Ebene und verbinde direkt mit einem zufälligen gültigen Knoten der übernächsten Ebene; Instabilität +15; erhalte 60 Gold. | Zielknoten wird vor Bestätigung gezeigt. |
| Sichere Route | Keine Änderung; erhalte 1 Spähreichweite für einen weiter entfernten Knoten. | Garantiert. |
| Pip entscheiden lassen | 50% Abkürzung, 50% sichere Route; beide Ergebnisse und Chancen sichtbar; bei Abkürzung nur +12 Instabilität. | Einziger Zufall. |
### 20.6 Der beleidigte Händler
Pool: Allgemein. Risiko: Niedrig.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Entschuldigen | Öffnet normalen Händler mit 4 Angeboten. | Keine Kosten. |
| Fair tauschen | Gib 1 ungesicherten Gegenstand ab; erhalte 1 Angebot gleicher Kategorie und +40 Gold. | Vorschau der Kategorie. |
| Pip verhandeln lassen | 70%: alle Angebote -20%; 30%: erhalte kosmetischen „Viel zu teuren Hut“ für diesen Run und Händlerpreise +10%. | Chancen sichtbar; Hut ohne Kampfwert. |
### 20.7 Die riesige Picknickdecke
Pool: Allgemein. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Vorräte nehmen | Erhalte 100 Gold; Instabilität +7. | Garantiert. |
| Rastende Gegner wecken | Starte sichtbaren Elitekampf; bei Sieg hochwertiges Relikt und 140 Gold. | Formation vor Bestätigung vollständig sichtbar. |
| Banner ausleihen | Erhalte für Expedition temporär 1 von 2 seltenen Bannern; Instabilität +10. | Aktuelles Banner bleibt in Sammlung, Auswahl wechselt ausgerüstetes Banner. |
### 20.8 Falsch zusammengesetztes Skelett
Pool: Aschenstraße. Risiko: Niedrig.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Morcant helfen | Falls Morcant verfügbar: alle eigenen Skelette im nächsten Kampf +25% LP/Angriff; sonst Option heißt „Sorgfältig sortieren“ und gibt 35 Gold. | Kein regulärer Truppenplatz. |
| Als Begleiter mitnehmen | Erhalte temporäres Relikt „Schiefer Knochen“: Kampfbeginn erzeugt ein Eifriges Skelett; endet nach 3 Kämpfen. | Beschwörungsgrenze gilt. |
| Korrekt beschriften | Kodexseite „Anatomie ungefähr“ und 25 Gold; erstmalig zusätzlich 1 Riftessenz nach Kampagnenabschluss. | Garantiert. |
### 20.9 Der rauchende Wegweiser
Pool: Aschenstraße. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Rauch löschen | Nächste zwei Knoten vollständig enthüllt; Instabilität -5; nächster Kampf erhält Nebelbank. | Modifikator sichtbar. |
| Glut lesen | Wähle einen von zwei kommenden Kampfmodifikatoren; Belohnung dieses Kampfes +20%. | Auswahl vor Route. |
| Als Brennholz nehmen | Erhalte 70 Gold; Instabilität +8. | Garantiert. |
### 20.10 Die letzte Parade
Pool: Aschenstraße. Risiko: Hoch.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Salutieren | Nächster Kampf beginnt mit zwei neutralen Ascheechos, die nach 6 s zur Spielerseite wechseln; bis dahin Gegner. Belohnung +1 Reliktwahl. | Ablauf vollständig erklärt. |
| Parade auflösen | Sofortiger Kampf gegen 5 schwache Ascheechos; bei Sieg Instabilität -12 und 80 Gold. | Formation sichtbar. |
| Umgehen | Instabilität +3, keine weitere Wirkung. | Sicher. |
### 20.11 Krone im Staub
Pool: Aschenstraße. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Aufsetzen | Bis Anker: erster eigene Todesstoß gibt Gruppe 4 s +10% Angriff; Gegner +5% LP. | Temporäre Regel sichtbar. |
| Einschmelzen | Erhalte 120 Gold. | Garantiert. |
| Im Archiv sichern | Schalte Relikt „Aschenkrone“ für zukünftige Runs frei; aktueller Run erhält nichts. | Einmalige permanente Entdeckung. |
### 20.12 Hungrige Ranken
Pool: Dornenhain. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Füttern | Zahle 60 Gold; Instabilität -12 und nächster Schatz wird hochwertig. | Garantiert. |
| Zurückschneiden | Starte Kampfvariante Befestigte Stellung gegen Pflanzen; Sieg gibt 1 Truppenkit. | Formation sichtbar. |
| Vorbeischleichen | 50% keine Wirkung, 50% nächster Kampf Gefährliche Flanken; Chancen sichtbar; erhalte immer 30 Gold. | Zufall begrenzt. |
### 20.13 Das höfliche Wolfsrudel
Pool: Dornenhain. Risiko: Niedrig.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Fleisch teilen | Zahle 40 Gold; erhalte temporären Riftwolf-Rekruten als Startbeschwörungsrelikt für 3 Kämpfe. | Grenze gilt. |
| Thorn rufen | Falls Thorn in Gruppe/Reserve: nächster Kampf beginnt mit zusätzlichem Wolf und Wildnis-Synergie zählt eine Stufe höher, maximal 3; sonst 50 Gold. | Nur nächster Kampf. |
| Den Weg freigeben | Nächster Rekrutierungsknoten zeigt einen zusätzlichen Wildnis-Trupp. | Garantiert. |
### 20.14 Schlafende Heilblüte
Pool: Dornenhain. Risiko: Niedrig.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Wecken | Alle regulären Einheiten erhalten im nächsten Kampf Regeneration 1,5%/s für erste 8 s; Instabilität +5. | Garantiert. |
| Ernten | Erhalte 1 Heilrelikt und 30 Gold. | Auswahl 1 von 2. |
| Umpflanzen | Nächster Kampf startet mit eigener Heilblüte; Beschwörungsgrenze gilt; Instabilität +7. | Garantiert. |
### 20.15 Pollenorakel
Pool: Dornenhain. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Kommenden Kampf fragen | Zeigt exakte erste 15 Sekunden geplanter Gegnerfähigkeiten in Vorschau; erhalte 1 Ereigniswiederholung. | Keine Zufallsänderung. |
| Nach Beute fragen | Zeigt Belohnungen aller erreichbaren Knoten; Instabilität +5. | Garantiert. |
| Niesen | Erhalte 20 Gold; zufällig eine von drei Pip-Kommentarvarianten, keine Mechanik. | Sicher. |
### 20.16 Der unmögliche Teich
Pool: Dornenhain. Risiko: Hoch.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Trinken | Eine zufällige reguläre Einheit erhält bis Anker +15% Max-LP; eine andere -10% Angriff. Betroffene Einheiten vor Bestätigung gezeigt. | Deterministisch beim Öffnen gespeichert. |
| Wasser abfüllen | Erhalte Dienst: einmal im Dungeon Instabilität -15. | Verbrauchbare Ressource. |
| Teich versiegeln | Erhalte 70 Gold und Kodexeintrag; Instabilität -5. | Garantiert. |
### 20.17 Streikende Zahnräder
Pool: Eisenschmiede. Risiko: Niedrig.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Forderungen anhören | Nächster Konstrukteur/Orrik-Bau beginnt poliert: +20% LP; 50 Gold Kosten. | Nur nächster Kampf. |
| Schmieren | Zahle 30 Gold; nächste Werkstattaktion kostenlos und Instabilität -4. | Garantiert. |
| Als Ersatzteile nehmen | Erhalte 1 zufälliges Konstruktions-Truppenkit; Instabilität +6. | Garantiert. |
### 20.18 Der viel zu große Knopf
Pool: Eisenschmiede. Risiko: Hoch.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Drücken | Startet sichtbaren Überlebenskampf mit Spröde Konstruktionen; Sieg gibt seltenes Relikt und 180 Gold. | Kein verstecktes Ergebnis. |
| Beschriften | Schaltet Kodexseite und kosmetischen Knopf für Orrik frei; 40 Gold. | Einmalig Kosmetik. |
| Nicht drücken | Pip ist enttäuscht; Instabilität -3. | Sicher. |
### 20.19 Runenprüfstelle
Pool: Eisenschmiede. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Gegenstand prüfen | Wähle ungesicherten Gegenstand; er wird bis Expeditionsende poliert. | Keine Kosten. |
| Truppenkit prüfen | Wähle Kit; in nächsten 2 Kämpfen Effekt +25%, danach normal. | Exakte Dauer. |
| Prüfer bestechen | Zahle 75 Gold; erhalte Gegenstandssicherungsplatz. | Garantiert. |
### 20.20 Abgekühlter Ofenkern
Pool: Eisenschmiede. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Neu entfachen | Nächste drei Kämpfe: magischer Schaden beider Seiten +12%; jeder Sieg +45 Gold. | Regel sichtbar. |
| Ausschlachten | Erhalte 130 Gold; nächster Händler zeigt ein Angebot weniger. | Garantiert. |
| Als Anker nutzen | Instabilität -18; nächster Kampf startet mit Schwere Zeit. | Garantiert. |
### 20.21 Mechaniker ohne Plan
Pool: Eisenschmiede. Risiko: Niedrig.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Plan zeichnen | Wähle Barrikade oder Geschütz; erhalte entsprechende Startkonstruktion für nächsten Kampf. | Grenze gilt. |
| Orrik fragen | Falls Orrik verfügbar: erhalte Relikt „Sauberer Bauplan“; sonst 60 Gold. | Keine Blockade. |
| Weitervermitteln | Nächster Rekrutierungsknoten garantiert Konstrukteur. | Garantiert. |
### 20.22 Die Tür von gestern
Pool: Zitadelle. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Gestern öffnen | Kehre zum Belohnungspool des zuletzt gewonnenen Kampfes zurück und darf 1 andere, nicht bereits gewählte Option nehmen; Instabilität +12. | Nicht wählbar ohne letzten Sieg/Alternative. |
| Heute öffnen | Erhalte 90 Gold und enthülle nächsten Knoten. | Garantiert. |
| Morgen versiegeln | Nächster Kampf +25% Belohnung, aber Gegner +12% LP. | Garantiert. |
### 20.23 Drei identische Pips
Pool: Zitadelle. Risiko: Niedrig.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Den lautesten wählen | Erhalte 1 Händler-Neuwurf und 40 Gold. | Garantiert. |
| Den stillsten wählen | Instabilität -8. | Garantiert. |
| Alle mitnehmen | Für den nächsten Kampf erscheinen drei kosmetische Pips und die Gruppe startet mit 5% Max-LP Schild; keine Sicht- oder Steuerungsstrafe; Instabilität +6. | Klare kleine Mechanik. |
### 20.24 Redigierte Schatzkarte
Pool: Zitadelle. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Lücken rekonstruieren | Wähle einen von drei verborgenen Belohnungsknoten auf der nächsten Ebene; er wird erreichbar eingefügt; Instabilität +10. | Knotentyp sichtbar. |
| Tinte verkaufen | 100 Gold. | Garantiert. |
| Kurator ärgern | Nächster Kampf erhält Champion, aber Belohnung +1 hochwertige Wahl. | Champion sichtbar. |
### 20.25 Stillgelegte Zukunft
Pool: Zitadelle. Risiko: Hoch.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Befreien | Alle kommenden Kämpfe im Run erhalten Wechselnde Schwäche; dafür +20% Gold und Reliktqualität. | Dauer bis Runende. |
| Konservieren | Instabilität -20; nächster Boss +8% LP. | Exakt sichtbar. |
| Ignorieren | Keine Wirkung. | Sicher. |
### 20.26 Der Spiegel, der zuerst blinzelt
Pool: Zitadelle. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Zurückblicken | Kopiert aktuelles Gruppenbanner als temporäres zweites Banner mit 50% Effekt für nächste 2 Kämpfe. | Keine doppelten Trigger, numerisch halbiert. |
| Spiegel zerbrechen | Sofort 110 Gold; nächster Kampf Gegner starten mit 8% Schild. | Garantiert. |
| Verhängen | Instabilität -7 und 1 Formationshinweis. | Garantiert. |
### 20.27 Anker mit Schluckauf
Pool: Allgemein. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Neu kalibrieren | Zahle 50 Gold; Instabilität -15 und vollständige Sicherung eines Gegenstands. | Garantiert. |
| Energie ableiten | Nächster Kampf Früher Funke; Sieg gibt 80 Gold. | Garantiert. |
| Pip halten lassen | 50% Instabilität -10, 50% +5; Chancen sichtbar; immer 1 Händler-Neuwurf. | Zufall gespeichert. |
### 20.28 Die singende Rüstung
Pool: Allgemein. Risiko: Niedrig.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Mitsingen | Nächster Kampf: erste Signaturfähigkeit jedes Helden 10% schneller; kurze kosmetische Melodie. | Nur Helden. |
| Polieren | Wähle Hauptausrüstung; temporär poliert bis Runende. | Garantiert. |
| Verkaufen | 75 Gold. | Garantiert. |
### 20.29 Riftpost ohne Empfänger
Pool: Allgemein. Risiko: Niedrig.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Öffnen | Erhalte zufälliges Relikt aus nicht regionalem Pool; Instabilität +5. | Garantiert Kategorie. |
| Zustellen | Nächster Händler schenkt ein Angebot bis 80 Gold; darüber wird nur 80 abgezogen. | Gutschein. |
| Archivieren | Kodexgeschichte und 35 Gold. | Garantiert. |
### 20.30 Tauschbörse der Echos
Pool: Allgemein. Risiko: Mittel.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Ausrüstung tauschen | Gib einen ungesicherten Gegenstand; wähle 1 von 2 gleicher Seltenheit anderer Kategorie. | Keine Wertverschlechterung. |
| Rekrut tauschen | Ersetze einen temporären Rekruten durch 1 von 2 anderen gleicher Vertragsstufe. | Nicht wählbar ohne Rekrut. |
| Erinnerung verkaufen | Gib ein Relikt ab; 100/150/220 Gold je Seltenheit. | Wert vor Bestätigung. |
### 20.31 Die letzte sichere Bank
Pool: Allgemein. Risiko: Hoch.
| Option | Kosten und Wirkung | Transparenz/Sonderfall |
| --- | --- | --- |
| Alles sichern | Sichert alle ungesicherten permanenten Gegenstände; Instabilität +18 und nächster Kampf Gegner +8% Angriff. | Exakt. |
| Nur eines sichern | Sichert 1 Gegenstand; Instabilität +5. | Garantiert. |
| Bank ausrauben | 180 Gold; löst sichtbaren Elitekampf sofort aus. Niederlage beendet Expedition normal. | Formation sichtbar. |
Implementierungs- und Abnahmekriterien
Alle 30 Ereignisse können in automatisierten Tests mit jeder Option ohne ungültigen Zustand abgeschlossen werden.
Keine Option erzeugt Gold, Gegenstände oder Knoten doppelt nach Speichern/Laden.
Ausgegraute Optionen besitzen konkrete Voraussetzung statt generischem Fehler.
Zufallsoptionen zeigen Prozentwerte und verwenden gespeicherten Event-Seed.
Ereignistexte bleiben kurz; mechanische Details stehen strukturiert unter der Option und nicht versteckt im Fließtext.

## 21. Permanente Ausrüstung
### 21.1 Globale Ausrüstungsregeln
Permanente Gegenstände sind einmalige Sammlungseinträge ohne zufällige Affixe. Eine Freischaltung erlaubt beliebige Verwendung als Ausrüstungsvorlage; das Objekt wird nicht verbraucht.
Jeder Held trägt eine passende Hauptausrüstung und einen universellen Talisman. Jede Truppenkopie trägt genau ein Kit. Eine Gruppe trägt genau ein Banner.
Jeder Gegenstand hat höchstens einen kleinen Wertefokus und genau einen leicht verständlichen Sondereffekt.
Polieren ist eine einmalige permanente Verbesserung je Sammlungseintrag. Polierte Werte sind fest und kein Auswahlpfad.
Gleiche Gegenstandsvorlage darf mehreren kompatiblen Einheiten gleichzeitig zugewiesen werden; die Sammlung ist kein physisches Einzelexemplar-Inventar. Dadurch entsteht kein unnötiges Umstecken vor jedem Kampf.
Effekte mit „erste“ oder „einmal“ werden pro Träger und Kampf zurückgesetzt, sofern nicht Banner/Relikt ausdrücklich gruppenweit ist.
### 21.2 12 Hauptausrüstungen
| Name | Kategorie | Basiswert | Sondereffekt | Poliert |
| --- | --- | --- | --- | --- |
| Eidbrecher-Schild | martialisch | +12 Rüstung | Erster erhaltene Treffer über 10% Max-LP erzeugt 10% Max-LP Schild; einmal/Kampf. | Poliert: +15 Rüstung; Schild 13%. |
| Klinge der zweiten Reihe | martialisch | +8% Angriff | Wenn direkt vor einem Verbündeten: Standardangriff +10% Schaden. | Poliert: +10% Angriff; Effekt +14%. |
| Hammer der klaren Antwort | martialisch | +10 Angriff, +8 Rüstung | Gegen Schild/Konstruktion +25% Rohschaden. | Poliert: +14 Angriff/+10 Rüstung; +32%. |
| Stiefel des kurzen Wegs | martialisch | +12% Bewegung | Erster Bahnwechsel pro Kampf dauert 50% kürzer. | Poliert: +15% Bewegung; zwei erste Wechsel. |
| Bogen der ruhigen Linie | Fernkampf | +10% Angriff | Nach 3 s ohne Bahnwechsel +12% Reichweite. | Poliert: +12% Angriff; +16% Reichweite. |
| Riftarmbrust | Fernkampf | +16 Angriff | Jeder dritte Standardtreffer ignoriert 25 Rüstung. | Poliert: +20 Angriff; ignoriert 35. |
| Köcher der geteilten Ziele | Fernkampf | +8% Angriffstempo | Beim Zielwechsel nächster Treffer +35% Rohschaden; 4 s Cooldown. | Poliert: +10%; +45%. |
| Falkenlinse | Fernkampf | +4 Reichweite | Gegen ungeschützte Hinterziele +12% Endschaden. | Poliert: +5 Reichweite; +16%. |
| Stab der Nachglut | arkan | +12 Angriff, +8 Widerstand | Statusschaden Brennen/Gift der Trägerquelle +18%. | Poliert: +16/+10; +24%. |
| Uhrstab der kleinen Pause | arkan | +10% Fähigkeitsladung | Erste gegnerische Fähigkeit, die Träger trifft, verliert 10% Vollaufladung; einmal/Kampf. | Poliert: +13%; Verlust 15%. |
| Morgenstab | Unterstützung | +12% Heilwirkung | Erste Heilung auf Ziel unter 35% LP zusätzlich +5% Ziel-Max-LP. | Poliert: +15%; +7%. |
| Runenschlüssel | Unterstützung/Konstruktion | +10 Widerstand | Eigene Beschwörungen/Konstruktionen +12% Max-LP. | Poliert: +14 Widerstand; +17%. |
### 21.3 12 Talismane
| Name | Basiswert | Sondereffekt | Poliert |
| --- | --- | --- | --- |
| Ankersplitter | +6% Max-LP | Nach Wiederbelebung/Phasenrettung 3 s +20 Rüstung/Widerstand. | Poliert: +8%; 4 s. |
| Kleine goldene Glocke | +8 Widerstand | Erste harte Kontrolle -50% Dauer. | Poliert: +11; erste zwei -40%. |
| Miras Ersatzsehne | +5% Angriff | Gegen markierte Ziele +10% Schaden. | Poliert: +7%; +14%. |
| Morgensamen | +8% Heilung/Schild | Bei Überheilung einmal/Kampf 8% Max-LP Schild. | Poliert: +11%; 11%. |
| Offene Möglichkeit | +5 Rüstung/Widerstand | Wenn Kampfmodifikator aktiv: +6% Angriff und Bewegung. | Poliert: +7; +8%. |
| Schiefer Knochen | +6% Max-LP | Erste eigene Beschwörung startet mit 15% Schild. | Poliert: +8%; 22%. |
| Wolfspfote | +8% Bewegung | Bei aktiver Tierbeschwörung +6% Angriff. | Poliert: +11%; +9%. |
| Funkenflasche | +7% Angriffstempo | Erster Status-Todesstoß erzeugt Radius-3-Explosion 60% magisch. | Poliert: +9%; 80%. |
| Blanker Niet | +10 Rüstung | Nach Schildbruch 3 s +15 Widerstand. | Poliert: +14; +20. |
| Leerenfaden | +10 Widerstand | Fähigkeiten gegen kontrollierte Ziele +12% Effekt. | Poliert: +14; +16%. |
| Händlerglück | Kein Kampfwert | Erster Händler jedes Runs zeigt ein zusätzliches Angebot. | Poliert: Angebot 10% günstiger. |
| Pips Krümel | +3% alle Kernwerte | Nach Überlegen-Sieg +8 Gold. | Poliert: +4%; +12 Gold. |
### 21.4 12 Truppenkits
| Name | Basiswirkung | Trade-off/Sondereffekt | Poliert |
| --- | --- | --- | --- |
| Verstärkte Platten | +15 Rüstung | -8% Bewegung. | Poliert: +20, -6%. |
| Leichte Stiefel | +15% Bewegung | -8 Rüstung. | Poliert: +20%, -6. |
| Gezackte Klinge | +10% Angriff | Standardtreffer gegen Schild +10% Rohschaden. | Poliert: +13%; +15%. |
| Giftbeutel | Kein Basiswert | Jeder fünfte Treffer Gift 6 s mit 60% Stärke. | Poliert: jeder vierte, 70%. |
| Weites Visier | +4 Reichweite | -6% Angriffstempo. | Poliert: +5, -4%. |
| Schnellverschluss | +10% Angriffstempo | Standardangriff -6% Rohschaden. | Poliert: +13%, -4%. |
| Sanitätertasche | +10% Heilung | Angriff -8%. | Poliert: +14%, -6%. |
| Bannkreide | +10 Widerstand | Gegen Beschwörung/Konstruktion +18% Schaden. | Poliert: +14; +24%. |
| Standartenhaken | Aura-Radius +2 | Träger -5% Bewegung. | Poliert: +3, -3%. |
| Runenöl | Konstruktion +15% LP | Konstruktion Lebensdauer +10%. | Poliert: +20%/+15%. |
| Notfallverband | +5% Max-LP | Unter 30% LP einmal 8% Max-LP Heilung. | Poliert: +7%; 11%. |
| Spiegelmarke | +6 Rüstung/Widerstand | Erster auf Träger angewandte Debuff dauert 30% kürzer. | Poliert: +9; 40%. |
### 21.5 6 Gruppenbanner
| Name | Gruppeneffekt | Poliert |
| --- | --- | --- |
| Verkohlter Eid | Erste eigene Frontfigur je Bahn erhält 8% Max-LP Schild. | Poliert: 11%. |
| Offener Hain | Eigene Beschwörungen +12% Bewegung; erste Tierbeschwörung +10% Angriff. | Poliert: +16%/+14%. |
| Perfekter Bauplan | Konstruktionen +12% LP und reparieren nach 4 s ohne Schaden 1%/s. | Poliert: +16%; 1,5%/s. |
| Gemeinsamer Takt | Erste wiederholbare Fähigkeit aller regulären Einheiten 10% schneller. | Poliert: 14%. |
| Sicherer Rückweg | Kampfbewertung Kontrolliert oder besser: +12 Gold; kein Kampfwert. | Poliert: +18 Gold. |
| Drei offene Wege | Bei genau drei verschiedenen aktiven Merkmalen +6% Max-LP/Angriff für reguläre Einheiten. | Poliert: +8%. |
Implementierungs- und Abnahmekriterien
Alle Gegenstandseffekte erscheinen mit eigener Quellen-ID in Auswertung.
Polieren verändert exakt die dokumentierten Felder und kann nicht mehrfach gekauft werden.
Inkompatible Hauptausrüstung ist sichtbar, aber nicht ausrüstbar; Tooltip nennt passende Kategorien.
Ein Gegenstand darf keine versteckte Zufallschance besitzen.

## 22. Temporäre Relikte
Relikte gelten nur für die aktuelle Expedition oder den aktuellen Ascension-Zyklus. Standardlimit: sechs aktive Relikte. Bei voller Kapazität muss vor Annahme eines neuen Relikts eines ersetzt oder die Belohnung abgelehnt werden. Relikte besitzen die Seltenheiten Gewöhnlich, Selten und Legendär; Legendär erscheint höchstens einmal pro Kampagnenexpedition und nicht vor Akt III.
| Name | Seltenheit | Exakter Effekt |
| --- | --- | --- |
| Aschenkrone | Selten | Erster eigene Todesstoß: Gruppe 4 s +12% Angriff. |
| Rußlaterne | Gewöhnlich | Brennende Gegner sind immer sichtbar und erleiden -8 Widerstand. |
| Letzter Salut | Selten | Erster gefallener normaler Gegner erzeugt neutrales Ascheecho, das nach 2 s für Spieler kämpft. |
| Dornenherz | Selten | Wenn regulärer Verbündeter geheilt wird, nächster Nahangreifer erhält 35% Rückschaden; 3 s Cooldown. |
| Samenbeutel | Gewöhnlich | Kampfbeginn: Heilblüte auf Bahn mit niedrigster Gesamt-LP; 10 s Dauer. |
| Pollenmantel | Gewöhnlich | Gift- und Brenndauer auf Gruppe -20%. |
| Sauberer Bauplan | Selten | Erste eigene Konstruktion je Kampf erscheint poliert: +25% LP/Wirksamkeit. |
| Notfallniet | Gewöhnlich | Erster Schildbruch je Kampf gibt 5 s +15 Rüstung. |
| Überdruckventil | Selten | Bei Zerstörung eigener Konstruktion Gruppe 4 s +10% Angriffstempo. |
| Offene Fußnote | Selten | Erste gegnerische Elitefähigkeit startet 1,5 s später. |
| Spiegelstück | Gewöhnlich | Erster erhaltene positive Effekt wird auf nächstgelegenen Verbündeten mit 50% Stärke kopiert. |
| Zeitkrümel | Gewöhnlich | Nach 30 s Kampfzeit Fähigkeiten der Gruppe laden 8% schneller. |
| Rudelzeichen | Gewöhnlich | Tierbeschwörungen +10% LP/Angriff. |
| Knochenvertrag | Gewöhnlich | Skelette +15% Lebensdauer; ältestes Skelett bei Limit +10% Angriff. |
| Dämonensiegel | Selten | Erste starke Beschwörung +25% Angriff, aber -20% Dauer. |
| Morgenrest | Gewöhnlich | Erste Heilung jedes Kampfes +25%. |
| Glasgebet | Selten | Schilde +20%, nach Schildbruch 2 s Schwächung. |
| Stiller Kreis | Gewöhnlich | Erste Stille auf Gruppe dauert 50% kürzer. |
| Jagdfeder | Gewöhnlich | Angriffe auf ungeschützte Hinterziele +8% Schaden. |
| Risskompass | Selten | Erster Bahnwechsel jeder regulären Einheit +20% Bewegung 3 s. |
| Kettenlöser | Gewöhnlich | Rückstoß/Zug-Effekte -40% Distanz. |
| Händlerglocke | Gewöhnlich | Ein zusätzlicher Händler-Neuwurf im Run. |
| Goldener Flicken | Gewöhnlich | Überlegen-Siege +15 Gold. |
| Sicherungswachs | Selten | Ein zusätzlicher Gegenstand kann beim nächsten Anker gesichert werden. |
| Instabilitätsventil | Selten | Erster Elitekampf jeder Region erhöht Instabilität nicht. |
| Riftpflaster | Gewöhnlich | Einmal pro Expedition kann vor Knotenwahl Instabilität um 8 reduziert werden. |
| Kurze Abkürzung | Gewöhnlich | Nach Betreten des fünften Knotens +60 Gold, Instabilität +5. |
| Echolupe | Gewöhnlich | Weiter entfernte Kampfrollen und Eliteattribute sind ohne Spähposten sichtbar. |
| Klarer Takt | Selten | Fokusfeuer-Marker hält 1 s länger; andere Doktrin: +5% Bewegung. |
| Zweite Meinung | Selten | Ein Ereignisangebot pro Expedition darf einmal neu erzeugt werden; gespeicherter neuer Pool. |
| Popcornfunke | Gewöhnlich | Erste Flächenexplosion mit 3+ Zielen +20% Schaden. |
| Schutzlack | Gewöhnlich | Erste erhaltene Projektiltreffer jeder Hintereinheit -20% Schaden. |
| Leihwolf | Selten | Kampfbeginn erzeugt Riftwolf; max. 3 Kämpfe, danach Relikt zerbricht. |
| Archivstempel | Gewöhnlich | Erster Kodex-neuer Gegner im Kampf gibt nach Sieg +25 Gold. |
| Unfertiger Titel | Selten | Wenn keine aktive 3er-Synergie: Gruppe +6% Max-LP/Angriff. |
| Pips Plan B | Legendär | Einmal pro Expedition wird eine Niederlage gegen normalen Kampf zu Rückzug vor diesem Knoten; keine Belohnung, Instabilität +12. Wirkt nicht bei Boss/Elite. |
Gewöhnliche Relikte haben Basisgewicht 70, seltene 27, legendäre 3. Akt, Elite und Instabilität verändern Gewicht, nicht die Definition.
Doppelte Relikte sind verboten, sofern kein Effekt ausdrücklich stapelbar ist; Release-Relikte sind nicht stapelbar.
Ein Relikt kann bei Händler für 55/100/180 Gold verkauft werden.
Reliktangebote zeigen immer drei unterschiedliche Optionen, sofern Pool mindestens drei gültige enthält.

## 23. Wirtschaft, Beute und Sicherung
### 23.1 Währungen
| Währung | Gültigkeit | Verwendung |
| --- | --- | --- |
| Gold | Permanent zwischen Kampagnenexpeditionen; 60% des ungesicherten Expeditionsgoldes bleibt bei Niederlage. | Verträge, Polieren, Händler, Dienste. |
| Zyklusmünzen | Nur aktueller Ascension-Zyklus. | Händler, Rekrutierung, zyklusinterne Verbesserungen. |
| Riftessenz | Permanent nach Kampagne; sofort an Meilensteinen gutgeschrieben. | Ascension-Konstellation. |
| Ruhm | Permanent je Held, nicht ausgebbar. | Held Level 2/3. |
### 23.2 Gold-Baseline
| Quelle/Kosten | Normal-Baseline |
| --- | --- |
| Normaler Kampf | 45-70 Gold, skaliert mit Akt/Instabilität |
| Elitekampf | 90-140 Gold |
| Hauptboss | 280/360/450/700 erster Sieg; Wiederholung niedriger |
| Händlerangebot gewöhnlich | 70-130 Gold |
| selten | 150-240 Gold |
| legendär/hochwertig | 280-420 Gold |
| Vertrag I/II/III | 180/420/850 Gold |
| Polieren Haupt/Talisman/Kit/Banner | 220/180/140/300 Gold |
| Händler-Neuwurf | 40 Gold, danach 70; max. zwei bezahlte je Händler |
| Instabilität -10 Dienst | 90 Gold |
### 23.3 Beutelogik
Normaler Kampf: Gold + 35% Chance auf eine Wahl aus zwei gewöhnlichen Relikten oder einen ungesicherten permanenten Gegenstand, abhängig vom Missionspool.
Elitekampf: Gold + garantierte Wahl aus drei Belohnungen; mindestens eine seltene Relikt-/Gegenstandsoption.
Schatz: vorher angezeigte Kategorie; 60% Gold+Relikt, 30% permanenter Gegenstand, 10% Banner/seltenes Paket, angepasst an Freischaltungen.
Boss: garantierte fest definierte Erstbelohnung plus eine Wahl aus drei Boss-Pool-Belohnungen.
Doppelte permanente Funde werden automatisch in 45% ihres Händlerbasiswertes Gold umgewandelt; UI zeigt die Umwandlung.
Neue permanente Gegenstände sind zunächst ungesichert. Sie werden am Anker, bei erfolgreichem Missionsabschluss oder durch Sicherungsdienst permanent gespeichert.
### 23.4 Sieg, Rückzug und Niederlage
| Ausgang | Behalten | Verlieren |
| --- | --- | --- |
| Missionssieg | Alles gesicherte und ungesicherte permanente; gesamtes Gold; Ruhm/Freischaltungen. | Temporäre Relikte/Rekruten nach Runende. |
| Freiwilliger Rückzug am Anker | Gesicherte Gegenstände; gesamtes bis Anker gesichertes Gold plus 80% danach gesammeltes Gold; Ruhm für erreichte Bedingungen. | Ungesicherte Gegenstände, 20% spätes Gold, temporäre Inhalte. |
| Niederlage normal | Gesicherte Gegenstände; 60% gesamten im Run verdienten Goldes; bereits gutgeschriebener Ruhm/Kodex. | Ungesicherte Gegenstände, 40% Run-Gold, temporäre Inhalte. |
| Ascension-Niederlage | Bereits gutgeschriebene Riftessenz, Meisterschaft/Kodex/Kosmetik. | Zyklusmünzen, Zyklusgegenstände, Relikte/Rekruten. |
Implementierungs- und Abnahmekriterien
Jede Belohnung wird genau einmal vergeben und sofort im Run-Snapshot gespeichert.
Niederlagenbildschirm listet konkret behaltene und verlorene Werte, nicht nur Prozentregeln.
Die Kampagne ist auf Normal ohne Grind abschließbar; erwartetes Gold aus Pflichtmissionen reicht für mindestens 12 Vertrag-I-, 6 Vertrag-II- und 15 Politurkäufe nach individueller Wahl.
Kein Händler kann ausschließlich unbrauchbare Angebote zeigen; mindestens zwei Angebote sind für aktuelle Sammlung/Gruppe gültig.

## 24. Kampagne: 4 Akte und 20 implementierungsreife Expeditionen
### 24.1 Globale Kampagnenregeln
Jede Expedition besitzt einen festen Storyzweck, einen Lern-/Prüfschwerpunkt, ein Abschlussziel, ein Kartenprofil und feste Erstfreischaltungen.
Normale Begegnungsformationen werden aus kuratierten Varianten gewählt, nicht frei aus allen Gegnern gewürfelt.
Eine neue Mechanik wird zuerst isoliert gezeigt, danach in derselben oder nächsten Mission kombiniert.
Pflichtmissionen können sofort wiederholt werden. Ein gescheiterter Bossversuch darf vom letzten Anker mit identischem Seed/Angeboten neu gestartet oder vollständig neu begonnen werden.
Freischaltungen werden bei Missionssieg atomar angewendet. Wiederholung ersetzt einmalige Freischaltungen durch Gold/Beutewahl.
Storytexte vor/nach Mission maximal 4 kurze Dialogkarten; Zwischenkommentare maximal 2 Sätze.
### 24.2 Expedition 1.1 - Ein Riss zum Frühstück
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | I - Die Aschenstraße |
| Storyfunktion | Ein kleiner Rift öffnet sich direkt neben dem Hauptquartier; Pip erklärt sich voreilig zum Retter. |
| Abschlussziel | Besiege den Elite-Aschesoldaten am Zielknoten. |
| Kartenprofil | 5 besuchte Knoten; lineare Einführung mit einer optionalen Schatzabzweigung. |
| Pflichtstruktur | Start -> Normal -> Schatz oder Normal -> Anker -> Eliteziel. |
| Begegnungspool | Nur Aschesoldat, Rußschild, Kohlebogner; maximal 4 Gegner. |
| Neue/prüfende Regeln | Keine Instabilitätsstrafe unter 25; Kampf pausiert bei erster Formationswarnung. |
| Freischaltungen | Kaserne; Schildwache, Söldner, Bogenschütze; Helden Aurel, Mira, Veyra verfügbar. |
| Erstbelohnung | 120 Gold, garantierter Talisman Ankersplitter. |
### 24.3 Expedition 1.2 - Die Brücke, die zweimal da war
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | I - Die Aschenstraße |
| Storyfunktion | Eine Brücke existiert in zwei Echozuständen und beide beanspruchen, das Original zu sein. |
| Abschlussziel | Erreiche und sichere den Brückenanker. |
| Kartenprofil | 6 Knoten; zwei parallele Routen: Schildlinie oder Fernkampf. |
| Pflichtstruktur | Start -> Wahlkampf -> Händler/Schatz -> Kampf -> Ankerziel. |
| Begegnungspool | Führt Ascheträger und Rauchwirker ein. |
| Neue/prüfende Regeln | Erste vollständige Gegnerformation; ein Kampf mit Nebelbank auf Fernroute. |
| Freischaltungen | Doktrin Linie halten; Speerwall; Werkstatt. |
| Erstbelohnung | 150 Gold, Hauptausrüstung Eidbrecher-Schild. |
### 24.4 Expedition 1.3 - Picknick auf dem Friedhof
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | I - Die Aschenstraße |
| Storyfunktion | Morcant sucht einen friedlichen Ort für seine Skelette und interpretiert das Problem sehr optimistisch. |
| Abschlussziel | Gewinne den Überlebenskampf mit drei Echo-Wellen. |
| Kartenprofil | 6-7 Knoten; Rekrutierung verpflichtend, Anker vor Ziel. |
| Pflichtstruktur | Start -> Rekrutierung -> Ereignis -> Normal/Schatz -> Anker -> Überleben. |
| Begegnungspool | Glutpriester und Funkenläufer erstmals getrennt. |
| Neue/prüfende Regeln | Temporärer Morcant als Pflichtangebot; Beschwörungsgrenze und Kampfende werden erklärt. |
| Freischaltungen | Morcant; Feldheiler; fünfter Gruppenplatz; Reliktsystem. |
| Erstbelohnung | 180 Gold, Relikt Schiefer Knochen entdeckt. |
### 24.5 Expedition 1.4 - Der sehr unpünktliche Konvoi
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | I - Die Aschenstraße |
| Storyfunktion | Ein Versorgungskonvoi steckt in einer zwölfminütigen Echo-Schleife. |
| Abschlussziel | Besiege die angekündigten Verstärkungen und sichere Fracht. |
| Kartenprofil | 7 Knoten; riskante Eliteabkürzung oder Händlerroute. |
| Pflichtstruktur | Start -> Wahl -> Kampf/Elite -> Werkstatt/Händler -> Anker -> Verstärkungsziel. |
| Begegnungspool | Alle Aschen-Grundgegner; Verstärkungsgruppe 2 Gegner nach 12 s. |
| Neue/prüfende Regeln | Erste Gegenstandssicherung, freiwilliger Rückzug, Kampfvariante Verstärkungen. |
| Freischaltungen | Doktrin Fokusfeuer; Armbrustschütze; Vertrag-II-Kauf wird nach Boss nur angekündigt. |
| Erstbelohnung | 220 Gold, 1 Gegenstandssicherungsplatz. |
### 24.6 Expedition 1.5 - Der Aschenkönig probt seinen Auftritt
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | I - Die Aschenstraße |
| Storyfunktion | Der Aschenkönig hält seine große Wiederkehr für eine Theaterpremiere. |
| Abschlussziel | Besiege den Aschenkönig. |
| Kartenprofil | 6 Knoten; mindestens Händler und Anker, optional Elite für bessere Bossbelohnung. |
| Pflichtstruktur | Start -> Kampf -> Händler/Elite -> Ereignis -> Anker -> Boss. |
| Begegnungspool | Kuratierte Bossvorbereitung mit Aschesoldat/Rußschild/Ascheträger. |
| Neue/prüfende Regeln | Bossvorschau vollständig; keine zufälligen Modifikatoren auf Erstversuch. |
| Freischaltungen | Sable; Vertrag II global kaufbar; Akt II; Banner Verkohlter Eid. |
| Erstbelohnung | Boss-Erstbelohnungen laut Bosskapitel. |
### 24.7 Expedition 2.1 - Bitte nicht die Blumen treten
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | II - Der Dornenhain |
| Storyfunktion | Der Hain reagiert auf jeden Schritt mit beleidigter Botanik. |
| Abschlussziel | Zerstöre drei Giftkelche und besiege den Hainwächter. |
| Kartenprofil | 6 Knoten; Pflanzenroute und Tierroute. |
| Pflichtstruktur | Start -> Kampf -> Wahl -> Ereignis/Rekrutierung -> Anker -> Eliteziel. |
| Begegnungspool | Dornenknecht, Giftspucker, Rankenwächter, Sporenmagier. |
| Neue/prüfende Regeln | Gift/Reinigung; ein Kampf mit offenen Wurzelfeldern, aber ohne Bossregeln. |
| Freischaltungen | Brunn; Bannwirker; Modifikator Offene Wunden freigeschaltet. |
| Erstbelohnung | 240 Gold, Kit Bannkreide. |
### 24.8 Expedition 2.2 - Wölfe sind auch nur Kollegen
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | II - Der Dornenhain |
| Storyfunktion | Thorns Rudel folgt einer falschen Version seines Pfiffs. |
| Abschlussziel | Besiege den Rudelalpha-Champion und rette zwei Wölfe. |
| Kartenprofil | 6-7 Knoten; mindestens eine Rekrutierung und Tierereignis. |
| Pflichtstruktur | Start -> Rekrutierung -> Kampf -> Ereignis/Schatz -> Anker -> Champion. |
| Begegnungspool | Sprunghase, Giftspucker, Rankenwächter; Champion Rudelalpha. |
| Neue/prüfende Regeln | Wildnis-Synergie, Jagdziel; gerettete Wölfe erscheinen kosmetisch am HQ. |
| Freischaltungen | Thorn; Falkner; Doktrin Jagd auf Zauberer. |
| Erstbelohnung | 260 Gold, Talisman Wolfspfote. |
### 24.9 Expedition 2.3 - Der Alchemist war das nicht
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | II - Der Dornenhain |
| Storyfunktion | Farbige Explosionen werden dem Alchemisten zugeschrieben, obwohl die Pflanzen begonnen haben. |
| Abschlussziel | Schließe zwei Riftsturm-Kämpfe und besiege den Sporenmagier-Elite. |
| Kartenprofil | 7 Knoten; Riftaltar optional. |
| Pflichtstruktur | Start -> Kampf -> Händler/Altar -> Riftsturm -> Anker -> Elite. |
| Begegnungspool | Heilblüten-Hüter, Sporenmagier, Dornenknecht. |
| Neue/prüfende Regeln | Feste Alchemistenfolge; Bodenwarnungen; Modifikator Gefährliche Flanken einmal verpflichtend. |
| Freischaltungen | Alchemist; Doktrin Schutzformation; Ereigniswiederholung als Ressource. |
| Erstbelohnung | 280 Gold, Hauptausrüstung Stab der Nachglut. |
### 24.10 Expedition 2.4 - Durch die Hecke gedacht
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | II - Der Dornenhain |
| Storyfunktion | Eine sichere Route ist lang; eine kurze Route ist offenbar nur aus Dornen gebaut. |
| Abschlussziel | Erreiche den Anker bei mindestens 70 Instabilität oder nimm die sichere Route und besiege zusätzliche Kämpfe. |
| Kartenprofil | 5-8 Knoten abhängig Route. |
| Pflichtstruktur | Start -> sichere Dreiknotenroute oder riskante Abkürzung -> Anker -> Zwischenboss. |
| Begegnungspool | Mooskoloss, Heilblüten-Hüter; Zwischenboss Wandernde Hecke. |
| Neue/prüfende Regeln | Instabilitätsstufen, hochwertige Relikte auf Risiko; beide Routen gleichwertig abschließbar. |
| Freischaltungen | Ilyra; Tempelwächter; Reliktlimit sechs. |
| Erstbelohnung | 320 Gold, Talisman Morgensamen. |
### 24.11 Expedition 2.5 - Die Dornenmutter braucht Abstand
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | II - Der Dornenhain |
| Storyfunktion | Die Dornenmutter möchte den Hain konservieren, aber nur nach ihren Wachstumsplänen. |
| Abschlussziel | Besiege die Dornenmutter. |
| Kartenprofil | 6 Knoten; Spähposten und Händler garantiert; Anker. |
| Pflichtstruktur | Start -> Kampf -> Spähposten/Händler -> Elite/Ereignis -> Anker -> Boss. |
| Begegnungspool | Kuratierte Mischung aller Hainrollen. |
| Neue/prüfende Regeln | Bossmechanik Pflanzenfelder/Panzer; kein zufälliger Modifikator Erstversuch. |
| Freischaltungen | Akt III; sechster Gruppenplatz; Banner Offener Hain. |
| Erstbelohnung | Boss-Erstbelohnungen. |
### 24.12 Expedition 3.1 - Willkommen in der Qualitätskontrolle
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | III - Die Eisenschmiede |
| Storyfunktion | Die Schmiede erkennt die Gruppe als mangelhaft zertifizierte Bauteile. |
| Abschlussziel | Zerstöre vier Konstruktionen und besiege Vorarbeiter-Echo. |
| Kartenprofil | 6 Knoten; Werkstatt verpflichtend. |
| Pflichtstruktur | Start -> Befestigungskampf -> Werkstatt -> Kampf/Schatz -> Anker -> Eliteziel. |
| Begegnungspool | Schmiedewache, Runenmechaniker, Bolzenschütze. |
| Neue/prüfende Regeln | Konstruktionen, Brecherzielwahl, Spröde Konstruktionen optional. |
| Freischaltungen | Axtbrecher; Konstrukteur; Kit Runenöl. |
| Erstbelohnung | 340 Gold, Hauptausrüstung Hammer der klaren Antwort. |
### 24.13 Expedition 3.2 - Der Ofen hat Gefühle
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | III - Die Eisenschmiede |
| Storyfunktion | Ein Ofenkern weigert sich, weiter als dramatisches Hintergrundobjekt zu arbeiten. |
| Abschlussziel | Stabilisiere drei Hitzeknoten in Kämpfen und besiege den Ofenmagier-Champion. |
| Kartenprofil | 7 Knoten; drei markierte Kampfziele auf zwei Routen. |
| Pflichtstruktur | Start -> Kampfziel -> Wahl -> zwei Zielknoten -> Anker -> Champion. |
| Begegnungspool | Ofenmagier, Nietenläufer, Kettengreifer. |
| Neue/prüfende Regeln | Hitzeleiste als Missionsregel: jeder Zielkampf hat angekündigten Ofenbruch bei 60 s. |
| Freischaltungen | Kampfmagier; Modifikator Wechselnde Schwäche; Polieren verfügbar, falls noch nicht. |
| Erstbelohnung | 360 Gold, Relikt Überdruckventil. |
### 24.14 Expedition 3.3 - Orriks völlig vernünftiger Prototyp
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | III - Die Eisenschmiede |
| Storyfunktion | Orrik baut ein Gerät, das nach eigener Aussage nur in drei Richtungen explodieren kann. |
| Abschlussziel | Schütze den Prototyp in einem Überlebenskampf. |
| Kartenprofil | 6 Knoten; Rekrutierung/Konstruktion und Werkstatt garantiert. |
| Pflichtstruktur | Start -> Rekrutierung -> Werkstatt -> Kampf -> Anker -> Überleben. |
| Begegnungspool | Bolzenschütze, Runenmechaniker, Überladener Golem. |
| Neue/prüfende Regeln | Neutrale Prototypkonstruktion mit 2.000 LP. Wird sie zerstört, scheitert das Missionsziel sofort und die Expedition endet als Niederlage, auch wenn reguläre Einheiten noch leben. |
| Freischaltungen | Orrik; Banner Perfekter Bauplan; Truppenkit-Politur. |
| Erstbelohnung | 390 Gold, Hauptausrüstung Runenschlüssel. |
### 24.15 Expedition 3.4 - Neun Hammer, keine Anleitung
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | III - Die Eisenschmiede |
| Storyfunktion | Vorarbeiter Neunhammer hat neun Hämmer und hält das für eine Strategie. |
| Abschlussziel | Besiege Zwischenboss Neunhammer bei einem aktiven Schlachtfeldmodifikator. |
| Kartenprofil | 7 Knoten; zwei Eliteoptionen, Spähposten. |
| Pflichtstruktur | Start -> Kampf -> Wahl Elite/Händler -> Ereignis -> Spähposten -> Anker -> Zwischenboss. |
| Begegnungspool | Vollständiges Schmiederoster. |
| Neue/prüfende Regeln | Erste mögliche Kombination Kampfvariante + Modifikator; Gegnermechaniken vollständig sichtbar. |
| Freischaltungen | Arkanschütze; Doktrin Durchbruch; Vertrag III wird nach Boss freigeschaltet. |
| Erstbelohnung | 420 Gold, Kit Gezackte Klinge. |
### 24.16 Expedition 3.5 - Der Ewige Schmied macht Überstunden
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | III - Die Eisenschmiede |
| Storyfunktion | Der Schmied hält jede zerstörte Welt für einen Prototyp, der nur mehr Metall benötigt. |
| Abschlussziel | Besiege den Ewigen Schmied. |
| Kartenprofil | 6 Knoten; Brecher-/Bannwirker-Angebot garantiert, aber nicht erzwungen. |
| Pflichtstruktur | Start -> Kampf -> Händler/Rekrutierung -> Elite/Werkstatt -> Anker -> Boss. |
| Begegnungspool | Kuratierte Konstruktionsformation. |
| Neue/prüfende Regeln | Hitze, Bauphasen, Ofenbruch; Erstversuch ohne Zusatzmodifikator. |
| Freischaltungen | Akt IV; siebter Gruppenplatz; Vertrag III; Banner Perfekter Bauplan falls nicht. |
| Erstbelohnung | Boss-Erstbelohnungen. |
### 24.17 Expedition 4.1 - Alles schon einmal gesehen
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | IV - Die Zitadelle der Echos |
| Storyfunktion | Die Zitadelle mischt bekannte Orte in einer unpraktischen Reihenfolge. |
| Abschlussziel | Besiege drei gemischte Formationen aus je zwei Regionen. |
| Kartenprofil | 6 Knoten; drei Pflichtkämpfe. |
| Pflichtstruktur | Start -> Gemischt 1 -> Wahl -> Gemischt 2 -> Anker -> Gemischt 3. |
| Begegnungspool | Echo-Legionär, Spiegelwache plus regionale Gegner. |
| Neue/prüfende Regeln | Gemischte Fraktionen, vollständige Synergien; kein Boss. |
| Freischaltungen | Nyx als Storygast noch nicht spielbar; Talisman Spiegelmarke. |
| Erstbelohnung | 460 Gold, Relikt Spiegelstück. |
### 24.18 Expedition 4.2 - Pip gegen Pip
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | IV - Die Zitadelle der Echos |
| Storyfunktion | Ein falsches Pip-Echo behauptet, das Original sei nur eine frühe Version. |
| Abschlussziel | Besiege den falschen Pip. |
| Kartenprofil | 6 Knoten; Ereignis Drei identische Pips garantiert. |
| Pflichtstruktur | Start -> Ereignis -> Kampf -> Händler/Schatz -> Anker -> Zwischenboss. |
| Begegnungspool | Zeitbogner, Echoheiler, Rissduellant; Zwischenboss Falscher Pip. |
| Neue/prüfende Regeln | Imitationen bekannter Heldenskills; Zielwechsel erklären. |
| Freischaltungen | Leerenfaden; Modifikator Stille Zonen. |
| Erstbelohnung | 480 Gold, kosmetische Pip-Farbe. |
### 24.19 Expedition 4.3 - Die Fußnote wehrt sich
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | IV - Die Zitadelle der Echos |
| Storyfunktion | Der Kurator hat einen ganzen Korridor aus der Realität gestrichen; der Korridor widerspricht. |
| Abschlussziel | Zerstöre vier Riftfragmente in zwei Riftsturm-Kämpfen. |
| Kartenprofil | 7 Knoten; Spähposten oder Altar, zwei Fragmentziele. |
| Pflichtstruktur | Start -> Kampf -> Späh/Altar -> Fragmentkampf -> Anker -> Fragment-Elite. |
| Begegnungspool | Kurator-Adept, Zeitbogner, Riftverschlinger. |
| Neue/prüfende Regeln | Stille/Verzögerung; Fragmente als neutrale Missionsziele; keine unfairen Sofortverluste. |
| Freischaltungen | Modifikator Stille Zonen dauerhaft freigeschaltet; Relikt Offene Fußnote. |
| Erstbelohnung | 520 Gold, Hauptausrüstung Uhrstab der kleinen Pause. |
### 24.20 Expedition 4.4 - Generalprobe für das Ende
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | IV - Die Zitadelle der Echos |
| Storyfunktion | Der Kurator präsentiert eine kuratierte Zusammenfassung, die niemand bestellt hat. |
| Abschlussziel | Besiege vier kurze Wellen mit je anderer Regionalregel. |
| Kartenprofil | 6 Knoten; Überlebensziel, vorher Händler und Anker. |
| Pflichtstruktur | Start -> Händler -> Kampf/Schatz -> Spähposten -> Anker -> Überleben. |
| Begegnungspool | Eine Welle pro Region, keine Hauptbosse. |
| Neue/prüfende Regeln | Vorschau zeigt Reihenfolge; zwischen Wellen 3 s Formation nicht änderbar, aber Fähigkeitladung pausiert. |
| Freischaltungen | Banner Gemeinsamer Takt; vollständige Bossvorschau für 4.5. |
| Erstbelohnung | 560 Gold, legendäre Reliktwahl. |
### 24.21 Expedition 4.5 - Eine perfekte, unveränderliche Katastrophe
| Feld | Verbindliche Festlegung |
| --- | --- |
| Akt | IV - Die Zitadelle der Echos |
| Storyfunktion | Der Kurator aktiviert das Herz des Risses und will jede mögliche Zukunft auf eine einzige Fassung reduzieren. |
| Abschlussziel | Besiege das Herz des Risses. |
| Kartenprofil | 6 Knoten; alle Serviceknoten garantiert über zwei Routen; letzter Anker. |
| Pflichtstruktur | Start -> Händler/Werkstatt -> Elite/Schatz -> Ereignis/Spähposten -> Anker -> Endboss. |
| Begegnungspool | Kuratierte Vorschau aller vier Phasen. |
| Neue/prüfende Regeln | Keine zufälligen Modifikatoren im ersten Storysieg; Retry direkt ab Anker mit unveränderten Angeboten möglich. |
| Freischaltungen | Kampagnenabschluss; Nyx; Riftkammer; Ascension; Endlose Rift; Meisterschaften vollständig. |
| Erstbelohnung | Boss-Erstbelohnungen, Titel Riftwarden. |
### 24.22 Kampagnen-Skalierungsbaseline
| Missionsbereich | Gegner-LP-Multiplikator | Gegner-Angriff | Belohnungsgold-Multiplikator |
| --- | --- | --- | --- |
| 1.1-1.2 | 0,82-0,90 | 0,85-0,92 | 0,85 |
| 1.3-1.5 | 0,95-1,05 | 0,95-1,05 | 1,00 |
| 2.1-2.5 | 1,10-1,28 | 1,08-1,22 | 1,20 |
| 3.1-3.5 | 1,32-1,55 | 1,26-1,42 | 1,45 |
| 4.1-4.5 | 1,60-1,95 | 1,45-1,72 | 1,75 |
Multiplikatoren werden auf die regionalen Referenzwerte angewendet. Bosswerte sind bereits separat definiert und verwenden nur Schwierigkeits-/Instabilitätsmultiplikatoren, nicht diese Normalgegner-Tabelle.

## 25. Kampagnenschwierigkeiten
| Regel | Entdecker | Normal | Veteran |
| --- | --- | --- | --- |
| Freischaltung | Sofort | Sofort | Nach Kampagnenabschluss auf beliebigem Modus |
| Gegner-LP | -15% | Baseline | +18% |
| Gegner-Angriff | -12% | Baseline | +14% |
| Fähigkeitsladung Gegner | +8% Zeit | Baseline | -8% Zeit |
| Instabilitätswert-Boni | Gegnerboni 25% schwächer | Baseline | Gegnerboni 20% stärker |
| Kampfvorschau | Zusätzliche konkrete Rollenempfehlung | Vollständig, keine Lösung | Vollständig; keine zusätzliche Hilfe |
| Niederlage Goldbehalt | 75% | 60% | 50% |
| Bossmechanik | Gleiche Mechaniken; Unterbrechungsschwellen 10% leichter | Baseline | Veteran-Erweiterung laut Boss |
| Belohnungen | Gleiche Freischaltungen, -5% Gold | Baseline | +15% Gold, kosmetische Veteran-Abzeichen |
Schwierigkeit darf zwischen Expeditionen jederzeit geändert werden, nicht innerhalb einer laufenden Expedition.
Story, Helden, Verträge, Gegenstände und Endgame werden auf Entdecker vollständig freigeschaltet; keine inhaltliche Bestrafung.
Veteran ist keine Voraussetzung für Ascension. Er dient Kampagnenwiederholung und Meisterschaften.
Entdecker verändert keine Zielwahl oder entfernt keine Mechanik; er vergrößert Fehlertoleranz.

## 27. Ascension-Endgame
### 27.1 Freischaltung und Zyklusstruktur
Ascension wird nach dem ersten Kampagnenabschluss freigeschaltet und besteht aus einem Zyklus über alle vier Regionen mit je einer verkürzten Expedition und Regionsboss.
Zu Zyklusbeginn wählt der Spieler eine vollständige Gruppe, genau drei permanente Gegenstände insgesamt und höchstens vier aktive Segnungen. Ein Banner zählt zu den drei Gegenständen.
Alle übrigen permanenten Gegenstände bleiben für diesen Zyklus gesperrt, aber niemals gelöscht. Neue Zyklusgegenstände können während des Runs gefunden werden.
Heldenlevel und Vertragsstufen bleiben permanent aktiv. Eingesetzt werden dürfen nur die zu Zyklusbeginn ausgewählten Truppentypen plus später rekrutierte temporäre Typen.
Nach jedem Regionsboss darf der Spieler eine Einheit austauschen oder einen zusätzlichen Truppentyp für den restlichen Zyklus freischalten; Auswahl aus drei kuratierten Optionen.
Ein Zyklus dauert 45-80 Minuten und kann an jedem Knoten unterbrochen/fortgesetzt werden.
Vollständige Niederlage beendet den Zyklus. Bereits gutgeschriebene Riftessenz, Kodex, Meisterschaften und Kosmetik bleiben; Zyklusmünzen, Relikte, Rekruten und Zyklusgegenstände verfallen.
### 27.2 Riftessenz-Meilensteine
| Meilenstein | Essenz Baseline |
| --- | --- |
| Jede abgeschlossene Regionsexpedition | 1 + Rangbonus |
| Jeder besiegte Regionsboss | 2 + Rang/3 abgerundet |
| Vollständiger Zyklus | 5 + Rang |
| Erstmalige Zusatzherausforderung | 2 |
| Erstabschluss eines Rangs | zusätzlich 3 |
Riftessenz wird sofort am Meilenstein persistent gespeichert. Ein späteres Scheitern nimmt sie nicht zurück. Wiederholtes Farmen desselben niedrigen Rangs bleibt möglich, aber der Erstabschlussbonus entfällt und die Effizienz liegt unter dem höchsten stabil abschließbaren Rang.
### 27.3 Die zehn kumulativen Ascension-Ränge
| Rang | Kumulative neue Regel | Abschlussbelohnung |
| --- | --- | --- |
| Rang 1 - Der erste Schritt | Gegner +5% LP/+3% Angriff; Elitegewicht +20%; alle abgeschlossenen Expeditionen geben +1 Riftessenz. | Zyklusabschluss: 6 Riftessenz; schaltet zwei Konstellationsknoten frei. |
| Rang 2 - Früher Ärger | Gegnerische Unterstützer starten mit 20% Fähigkeitsvorladung; Generator schützt Unterstützer in mindestens 60% der Formationen durch Front/Deckung. | Bossmeilensteine +1 Riftessenz; Champion-Pool noch gesperrt. |
| Rang 3 - Unruhiger Boden | Jeder Kampf besitzt mindestens einen sichtbaren Modifikator. Inkompatibilitätsregeln gelten. Endlose Rift erhält zusätzliche Rang-3-Meilensteine. | 8 Riftessenz Abschluss; schaltet Modifikator-Segnungen frei. |
| Rang 4 - Neue Tricks | Jeder Regionsboss erhält die definierte Rang-4-Fähigkeit. Vorschau zeigt sie vollständig. Zwischenbosse +10% LP. | 9 Riftessenz; Bosskosmetik-Farbvariante. |
| Rang 5 - Champions | Normale/Elitekämpfe können genau einen Champion enthalten: 25%/45% Chance, nie in ersten zwei Kämpfen einer Region. | 10 Riftessenz; Champions im Kodex/Endless freigeschaltet. |
| Rang 6 - Knappe Auswahl | Händler 3 statt 4 Angebote; bezahlter Neuwurf +20 Gold; Elitekämpfe bieten garantiert mindestens zwei seltene Optionen. | 11 Riftessenz; zusätzliche Händler-/Routen-Segnungen. |
| Rang 7 - Organisierte Gegner | Mindestens 50% der Kämpfe besitzen aktive 2er-, 25% aktive 3er-Gegnersynergie. Formationen wählen aus kuratierten Anti-Meta-Profilen, aber kennen keine konkrete Spielerformation nach Start. | 12 Riftessenz; zweite Eliteeigenschaft möglich. |
| Rang 8 - Instabil | Knoteninstabilität x1,25 aufgerundet; riskante Knotenbelohnung +25%; ab 75 Instabilität können zwei kompatible Modifikatoren auftreten. | 13 Riftessenz; Instabilitätskosmetik. |
| Rang 9 - Zweite Vorstellung | Jeder Hauptboss erhält die definierte zusätzliche Phase. Boss-LP +8%, damit neue Phase Raum hat; Schaden nicht zusätzlich erhöht. | 15 Riftessenz; Bossmeisterschaft V freigeschaltet. |
| Rang 10 - Die große Verknotung | Alle Regeln kumulativ; gemischte Fraktionen ab Akt II; normale Gegner +8% LP/+5% Angriff zusätzlich; Endboss vollständige Rang-10-Fassung; Encounterlisten vollständig kuratiert. | 20 Riftessenz, Titel „Jenseits der Verknotung“, Jenseits-Modus. |
### 27.4 Anti-Meta-Formationen auf Rang 7+
Encounterprofile werden vor Zyklusstart anhand der gewählten Startgruppe gewichtet, nicht nach jeder Formation spontan angepasst.
Profile: Beschwörungsdruck, Schildfestung, Backline-Jagd, Flächenverteilung, Kontrollschutz, gemischte Verteidigung.
Maximal 35% der Begegnungen dürfen als direkter Counter zum stärksten Spielerprofil gewichtet sein; mindestens 30% bleiben neutral und 15% günstig.
Gegner „cheaten“ nicht durch Kenntnis einer unmittelbar vor Kampf geänderten Doktrin/Position.
Implementierungs- und Abnahmekriterien
Jeder Rang ist separat auswählbar, sobald abgeschlossen; höhere Ränge enthalten nachweislich alle niedrigeren Regeln.
Ein Rang zeigt vor Start eine vollständige Liste aller aktiven kumulativen Regeln.
Genau drei Startgegenstände werden validiert; kein verstecktes viertes Banner.
Niederlage löscht keine bereits persistierte Riftessenz.
Rang 10 ist mit mehreren Gruppenarchitekturen testbar und nicht auf eine dominante Synergie zugeschnitten.

## 28. Ascension-Konstellation - 28 Knoten
Die Konstellation bietet neue Optionen, Komfort und kuratierte Inhalte statt einer unbegrenzten Folge globaler Schadens-/Lebensboni. Dauerhafte Knoten müssen nicht ausgerüstet werden. Segnungen werden vor einem Zyklus gewählt; maximal vier aktiv. Kosten sind Riftessenz und jeder Knoten besitzt sichtbare Verbindungsvoraussetzungen in sieben Ringen A-G.
| ID | Name | Kosten | Typ | Wirkung |
| --- | --- | --- | --- | --- |
| A1 | Erster Funke | 2 | Dauerhaft | Schaltet zwei zusätzliche Startrelikte im Ascension-Pool frei. |
| A2 | Routenleser | 2 | Segnung | Einmal pro Region zeigt ein Knoten seine vollständige Belohnung ohne Spähposten. |
| A3 | Kleine Reserve | 3 | Segnung | Start jedes Zyklus mit 60 Zyklusmünzen. |
| A4 | Bunte Banner | 2 | Dauerhaft | Alternative kosmetische Farbvarianten für drei Banner. |
| B1 | Händlergeduld | 3 | Segnung | Ein kostenloser Händler-Neuwurf pro Region. |
| B2 | Offene Rekrutierung | 3 | Segnung | Erster temporäre Rekrut jeder Region kostet 50% weniger. |
| B3 | Sicherer Eliteweg | 4 | Segnung | Erster Elitekampf jeder Region erhöht Instabilität nicht. |
| B4 | Neue Begegnungen | 3 | Dauerhaft | Schaltet sechs Ascension-exklusive Encountervarianten frei; keine stärkeren Belohnungen zwingend. |
| C1 | Reliktblick | 4 | Segnung | Einmal pro Region darf ein Reliktangebot vollständig neu erzeugt werden. |
| C2 | Polierter Start | 5 | Segnung | Die exakt drei mitgebrachten Gegenstände gelten für den Zyklus als poliert, auch wenn permanent unpoliert. |
| C3 | Kontrollierter Lohn | 4 | Segnung | Erster Kontrolliert-/Überlegen-Sieg je Region +45 Zyklusmünzen. |
| C4 | Championarchiv | 4 | Dauerhaft | Schaltet zwei zusätzliche Championtypen frei. |
| D1 | Ankerschild | 5 | Segnung | Zu Beginn des ersten Kampfes jeder Region erhält schwächster regulärer Verbündeter 12% Max-LP Schild. |
| D2 | Zusätzliche Wahl | 5 | Segnung | Nach Regionsboss eine zusätzliche Truppenoption neben normaler Belohnung. |
| D3 | Pips Rückfrage | 4 | Segnung | Ein Ereignis pro Zyklus darf einmal zurückgenommen werden, bevor ein Folgekampf gestartet wurde; neue Wahl aus denselben Optionen. |
| D4 | Meisterliche Echos | 4 | Dauerhaft | Schaltet je Held ein zusätzliches kosmetisches Meisterschaftsziel frei; zählt nicht zu fünf Kernzielen. |
| E1 | Riftversicherung | 6 | Segnung | Einmal pro Zyklus kann eine drohende Niederlage in einem normalen Kampf in einen sofortigen Rückzug umgewandelt werden. Der aktuelle Kampf gibt keine Belohnung und die Hälfte der aktuellen Zyklusmünzen geht verloren. Keine Wirkung bei Elite- oder Bosskämpfen. |
| E2 | Breite Auswahl | 6 | Segnung | Erster Händler jedes Zyklus zeigt wieder vier statt drei Angebote auf Rang 6+. |
| E3 | Stabiler Kern | 5 | Segnung | Einmal pro Region vor Knotenwahl Instabilität -10. |
| E4 | Kuratorenschatten | 5 | Dauerhaft | Schaltet vier neue Story-/Kodexseiten und eine Endboss-Farbvariante frei. |
| F1 | Schneller Aufbau | 6 | Segnung | Erste eigene Startkonstruktion jeder Region +20% LP. |
| F2 | Rudelproviant | 6 | Segnung | Tier- und Skelettbeschwörungen im ersten Kampf jeder Region +15% Dauer. |
| F3 | Geklärte Essenz | 7 | Segnung | Erste Zusatzherausforderung pro Zyklus gibt +2 Riftessenz; nur einmal. |
| F4 | Jenseitsfarben | 6 | Dauerhaft | Kosmetische Jenseits-Palette für HQ und Riftkammer. |
| G1 | Vierter Blick | 8 | Segnung | Bei Bossbelohnung vier statt drei Optionen, weiterhin nur eine wählbar. |
| G2 | Kompakter Marsch | 8 | Segnung | Erster Kampfknoten jeder Region +25% Gold und nur +50% Instabilität. |
| G3 | Ankermeister | 8 | Segnung | Anker sichert automatisch einen zusätzlichen ungesicherten Gegenstand. |
| G4 | Riftwarden-Siegel | 10 | Dauerhaft | Abschlussknoten der Konstellation: Titel, Porträtrahmen, alternative Pip-Spur; kein globaler Machtbonus. |
### 28.1 Konstellationspfade
Ring A ist nach Kampagne offen. Ring B benötigt zwei gekaufte A-Knoten; Ring C vier Gesamtknoten; D sieben; E zehn; F vierzehn; G achtzehn und Ascension-Rang 10.
Knoten können kostenlos zurückgesetzt werden, aber nur ausgerüstete Segnungen ändern sich. Dauerhafte Freischaltungen bleiben entdeckt, auch wenn Pfad neu verteilt wird; ausgegebene Essenz wird bei Reset vollständig erstattet.
Ein Zyklus speichert seine Segnungen beim Start. Änderungen in der Riftkammer wirken erst auf einen neuen Zyklus.
Knoten E1 wird technisch als Rückzugsrecht umgesetzt, nicht als Währungsumwandlung; dies verhindert farmbare Essenzschleifen.

## 29. Jenseits-Modus
Nach Ascension-Rang 10 wählt der Spieler Jenseitsgrad 1-20. Jeder Grad: Gegner +2,5% Max-LP und +1,8% Angriff kumulativ; ab Grad 11 nur +1,5% LP/+1,0% Angriff pro Grad.
Alle fünf Grade wird eine zusätzliche kuratierte Regel aktiviert: Grad 5 zweites Eliteattribut häufiger; 10 Championchance +15 Prozentpunkte; 15 zwei Modifikatoren ab Instabilität 50; 20 Boss-Rang-9-Phasen +10% Geschwindigkeit ihrer Arenaereignisse, nicht Schaden.
Jenseits gibt keine permanenten Machtboni. Einmalige kosmetische Meilensteine auf Grad 1, 5, 10, 15, 20.
Lokaler Rekord speichert höchsten abgeschlossenen Grad, Gruppe, drei Startgegenstände, Segnungen und Seed.
Der Spieler darf jeden bereits freigeschalteten Grad wiederholen; fehlgeschlagener Grad reduziert keinen Rekord.

## 30. Endlose Rift
### 30.1 Start und Ablauf
Freischaltung nach Kampagne. Start: vollständige Gruppe, genau drei permanente Gegenstände inklusive möglichem Banner, Doktrin und optional bereits abgeschlossener Ascension-Regelsatz.
Fortlaufende einzelne Kämpfe. Nach jedem Sieg Wahl aus drei Belohnungen: Relikt, temporäres Kit/Gegenstand, Rekrut, Heil-/Sicherungsdienst, Gold/Zyklusmünzen existieren hier nicht.
Nach jeweils fünf Kämpfen Checkpoint: Formation/Ausrüstung ordnen, freiwillig beenden, Rekord sichern. Gruppe darf nur mit im Lauf gewonnenen Rekruten verändert werden.
Niederlage beendet Lauf und speichert erreichte Tiefe. Freiwilliges Ende am Checkpoint gilt ebenfalls als gültiger Rekord.
Keine wiederholbare permanente Machtbelohnung. Erstmalige Meilensteine sind kosmetisch oder geringe einmalige Riftessenz.
### 30.2 Tiefenskalierung
| Tiefe | Gegnerwerte | Begegnungsregeln |
| --- | --- | --- |
| 1-5 | Baseline Kampagnenende x0,90 | Eine Region, keine Champions, max. 1 Modifikator. |
| 6-10 | LP +12%, Angriff +8% | Elitechance 25%, erster Zwischenboss auf 10. |
| 11-20 | Je Tiefe +2% LP/+1,2% Angriff ab 11 | Zwei Regionen gemischt; Championchance 15%; Boss auf 20. |
| 21-30 | Je Tiefe +1,7% LP/+1% Angriff | Eliteattribute kombiniert; alle Regionen ab 26. |
| 31-40 | Je Tiefe +1,5% LP/+0,9% Angriff | Bis 2 Modifikatoren; Championchance 30%; Bossvarianten 35/40. |
| 41-60 | Je Tiefe +1,2% LP/+0,7% Angriff | Bis 2 Champions ab 51, aber nie plus zwei Eliteattribute auf beiden. |
| 61+ | Je Tiefe +0,9% LP/+0,5% Angriff | Kuratierte Rotationen; keine neue Mechanik, nur Rekorddruck. |
### 30.3 Belohnungsrhythmus
Nach Kämpfen 1-4: mindestens zwei gewöhnliche und eine beliebige Option.
Jeder fünfte Kampf: mindestens eine seltene Option; Bosscheckpoint: eine von vier, davon mindestens zwei selten/legendär.
Reliktlimit sechs bis Tiefe 20, acht ab Tiefe 21. Darüber kein weiteres Wachstum.
Rekrutierungswahl kann Vertragsgrenze drei nicht überschreiten; temporärer Rekrut bleibt bis Laufende.
Alle zehn Tiefen wird eine Begegnung bewusst leichter als Erholungsfenster, danach Boss/harte Gruppe.
### 30.4 Meilensteine
| Tiefe | Name | Einmalige Belohnung |
| --- | --- | --- |
| 5 | Erste Tiefe | Porträtrahmen „Fünf Schritte“. |
| 10 | Zweistellig | 1 Riftessenz und Titel. |
| 15 | Gemischte Front | Kosmetische Gruppenbannerfarbe. |
| 20 | Erster tiefer Boss | Kodexseite und 2 Riftessenz. |
| 25 | Langer Atem | Pip-Farbspur. |
| 30 | Instabile Dreißig | 2 Riftessenz und Titel. |
| 40 | Vier Regionen, ein Problem | Heldenporträtrahmen. |
| 50 | Halbe Hundert | 3 Riftessenz, gold-violette Arenafarbe. |
| 60 | Kein Ende in Sicht | Titel und Kodexgeschichte. |
| 75 | Tiefe Verflechtung | 4 Riftessenz und Bossfarbvariante. |
| 100 | Hundertfacher Riftwarden | Legendärer rein kosmetischer Rahmen, Statistikplakette. |
### 30.5 Zusätzliche Rang-3-Meilensteine
| Bedingung | Belohnung |
| --- | --- |
| Tiefe 10 mit aktivem Ascension-Rang 3+ | 1 Riftessenz und Rahmen „Unruhiger Boden“. |
| Tiefe 20 mit mindestens 10 unterschiedlichen Modifikatoren gesehen | Kodexseite „Wetterbericht des Rifts“. |
| Tiefe 30 ohne denselben Modifikator in zwei aufeinanderfolgenden Kämpfen - Generatorregel erfüllt automatisch, Leistung ist Erreichen | Kosmetische Bodenrune. |
| Tiefe 40 mit zwei aktiven Modifikatoren im letzten Kampf | 2 Riftessenz und Titel „Doppelt instabil“. |
| Tiefe 50 mit Ascension-Rang 10 | Bossfarbvariante „Verknotet“. |
Implementierungs- und Abnahmekriterien
Endless-Generator wiederholt identische Encounter-ID nicht innerhalb der letzten acht Kämpfe.
Jeder Checkpoint speichert vollständig; Neustart kann keine Belohnung neu würfeln.
Skalierung bleibt numerisch berechenbar und besitzt keine versteckten Sprünge außerhalb Tabelle.
Tiefe 100 ist theoretisch erreichbar, aber nicht als durchschnittliches Balanceziel verlangt.
Alle Meilensteinbelohnungen werden einmalig vergeben und danach als abgeschlossen markiert.

## 31. Heldenmeisterschaften
Jeder Held besitzt fünf Kernziele. Ziele werden sichtbar, sobald der Held freigeschaltet ist; Ziel 4 nach Kampagnenabschluss, Ziel 5 nach Level 3. Fortschritt wird nur in gewonnenen Kämpfen oder erfolgreich abgeschlossenen Modi gewertet, außer reiner Teilnahmecounter. Kein Ziel verlangt Onlinefunktionen oder zeitlich begrenzte Inhalte.
| Stufe | Belohnung |
| --- | --- |
| I | Alternative Farbvariante |
| II | Porträtrahmen |
| III | Kurze Charaktergeschichte im Archiv |
| IV | Kosmetischer Signaturfähigkeitseffekt |
| V | Heldentitel und 2 Riftessenz |
### 31.1 Aurel
| Nr. | Verbindliches Ziel |
| --- | --- |
| 1 | 10 Expeditionen mit Aurel abschließen. |
| 2 | Aschenkönig besiegen, während Aurel mindestens drei Ascheechos gebunden hat. |
| 3 | Einen Kampf Überlegen gewinnen, wobei Schildbruder mindestens 800 Projektilschaden verhindert. |
| 4 | Ascension-Rang 6 mit Aurel in jeder Region abschließen. |
| 5 | Nicht an mir vorbei auslösen und bedrohten Verbündeten bis Kampfende am Leben halten. |
### 31.2 Mira
| Nr. | Verbindliches Ziel |
| --- | --- |
| 1 | 10 Expeditionen mit Mira abschließen. |
| 2 | Dornenmutter besiegen, wobei Mira mindestens zwei Wurzelherzen zerstört. |
| 3 | Einen Elitegegner mit fünf Fokusstapeln besiegen. |
| 4 | Endlose Rift Tiefe 30 mit Mira erreichen. |
| 5 | Perfekten Schuss gegen Boss unter 18% LP auslösen und Kampf innerhalb 8 s gewinnen. |
### 31.3 Veyra
| Nr. | Verbindliches Ziel |
| --- | --- |
| 1 | 10 Expeditionen mit Veyra abschließen. |
| 2 | In einem Kampf sechs Nachglut-Explosionen erzeugen. |
| 3 | Einen Kampf mit 8+ gegnerischen Beschwörungen insgesamt gewinnen. |
| 4 | Ascension-Rang 7 abschließen. |
| 5 | Popcorninferno trifft mindestens vier Ziele je mindestens zweimal. |
### 31.4 Morcant
| Nr. | Verbindliches Ziel |
| --- | --- |
| 1 | 10 Expeditionen mit Morcant abschließen. |
| 2 | Aschenkönig besiegen, während mindestens ein eigenes Skelett lebt. |
| 3 | In einem Kampf sechs Morcant-Skelette erzeugen, ohne Beschwörungsgrenze zu verletzen. |
| 4 | Endlose Rift Tiefe 25 mit Unterwelt-3er-Synergie. |
| 5 | Knochenwächter beschwören und dieser überlebt bis Sieg. |
### 31.5 Sable
| Nr. | Verbindliches Ziel |
| --- | --- |
| 1 | 10 Expeditionen mit Sable abschließen. |
| 2 | Ewigen Schmied besiegen, nachdem Sable Runenmechaniker unterbrochen hat. |
| 3 | Drei Unterstützer in einem Kampf mit Seitensprung erreichen. |
| 4 | Ascension-Rang 8 mit Jagd auf Zauberer abschließen. |
| 5 | Drei Schritte voraus unterbricht eine Fähigkeit und alle drei Treffer landen. |
### 31.6 Brunn
| Nr. | Verbindliches Ziel |
| --- | --- |
| 1 | 10 Expeditionen mit Brunn abschließen. |
| 2 | Dornenmutter besiegen, nachdem Brunn drei Wurzelherzen getroffen hat. |
| 3 | In einem Kampf fünf Kontrolleffekte erhalten und überleben. |
| 4 | Jenseitsgrad 5 mit Brunn abschließen. |
| 5 | Jetzt bin ich wach entfernt mindestens zwei Effekte und Schild absorbiert 500 Schaden. |
### 31.7 Ilyra
| Nr. | Verbindliches Ziel |
| --- | --- |
| 1 | 10 Expeditionen mit Ilyra abschließen. |
| 2 | Herz des Risses besiegen, ohne dass Ilyra fällt. |
| 3 | In einem Kampf 2.000 Heilung und 600 Überheilungsschild erzeugen. |
| 4 | Ascension-Rang 9 abschließen. |
| 5 | Noch nicht Feierabend belebt Einheit wieder, die anschließend MVP wird. |
### 31.8 Thorn
| Nr. | Verbindliches Ziel |
| --- | --- |
| 1 | 10 Expeditionen mit Thorn abschließen. |
| 2 | Dornenmutter mit aktivem Alphawolf besiegen. |
| 3 | Vier Wölfe greifen gleichzeitig dasselbe Ziel an. |
| 4 | Endlose Rift Tiefe 35 mit Wildnis-3er-Synergie. |
| 5 | Großen Flausch über gefallene Wölfe auslösen und Alphawolf erzielt Todesstoß. |
### 31.9 Orrik
| Nr. | Verbindliches Ziel |
| --- | --- |
| 1 | 10 Expeditionen mit Orrik abschließen. |
| 2 | Ewigen Schmied besiegen, während eigenes Geschütz aktiv ist. |
| 3 | Drei Konstruktionen in einem Kampf erzeugen und keine durch Bewegung blockieren. |
| 4 | Ascension-Rang 8 mit Konstruktion-3er-Synergie. |
| 5 | Viel zu großer Knopf überlädt zwei Konstruktionen; beide Explosionen treffen je zwei Gegner. |
### 31.10 Nyx
| Nr. | Verbindliches Ziel |
| --- | --- |
| 1 | 10 Expeditionen mit Nyx abschließen. |
| 2 | Herz des Risses besiegen, während Zeitblase jede Phase mindestens einmal trifft. |
| 3 | In einem Kampf drei gegnerische Fähigkeitsstarts verzögern/zurücksetzen. |
| 4 | Jenseitsgrad 10 mit Nyx abschließen. |
| 5 | Das war so nicht vorgesehen betrifft mindestens drei Gegner oder zwei plus Boss. |
Implementierungs- und Abnahmekriterien
Jedes Meisterschaftsziel besitzt eindeutige maschinenprüfbare Eventbedingungen.
Fortschritt wird unmittelbar nach Kampf angezeigt und persistent gespeichert.
Kosmetische Effekte verändern Trefferzeit, Fläche und Lesbarkeit nicht.
Kein Ziel ist durch dauerhaft verpassbaren Inhalt blockierbar.

## 32. Kodex
Kategorien: 10 Helden, 18 Truppen, 14 Beschwörungen, 28 Grundgegner, 12 Eliteattribute, 8 Champions, 4 Zwischenbosse, 4 Hauptbosse, 42 Gegenstände, 36 Relikte, 30 Ereignisse, 4 Regionen, Story, Ascension-Regeln und Modifikatoren.
Unbekannte Einträge erscheinen als Silhouette mit Entdeckungsquelle, sofern die Quelle bereits zugänglich ist.
Erste Begegnung schaltet Namen, Rolle, Kurzmechanik und Gegenstrategie frei. Erster Sieg schaltet vollständige Baselinewerte und Fähigkeiten frei.
Boss-Kodex zeigt normale, Veteran-, Rang-4- und Rang-9-Regeln getrennt.
Einträge enthalten niemals versteckte aktuelle Endwerte nach Schwierigkeit; stattdessen Basis plus aktive Multiplikatoren.
Such-/Filteroptionen: Name, Rolle, Merkmal, Region, Schadenstyp, Beschwörung/Konstruktion, freigeschaltet/ungesehen.

## 33. Interne Erfolge
Erfolge sind lokal, offline und rein intern. Sie geben Kosmetik, Titel oder kleine einmalige Gold-/Riftessenzbeträge, niemals exklusive notwendige Macht. Versteckte Erfolge sind erlaubt, dürfen aber keine ernsthafte Fehlhandlung verlangen.
| Erfolg | Bedingung |
| --- | --- |
| Erster Riss | Expedition 1.1 abschließen. |
| Volles Haus | Sieben reguläre Gruppenplätze erstmals belegen. |
| Drei sind eine Gesellschaft | Eine aktive 3er-Synergie einsetzen. |
| Acht Wege | Alle acht Synergien mindestens einmal aktivieren. |
| Keiner fiel | Einen Bosskampf Überlegen gewinnen. |
| Letzter Stand | Einen Kampf mit genau einer überlebenden regulären Einheit gewinnen. |
| Nicht heute | Eine Einheit wiederbeleben und Kampf gewinnen. |
| Pünktliche Unterbrechung | Eine Bosskanalisierung vollständig unterbrechen. |
| Knochenarbeit | Sechs eigene Skelette in einem Kampf erzeugen. |
| Sehr großer Flausch | Alphawolf erstmals beschwören. |
| Baugenehmigung | Drei eigene Konstruktionen gleichzeitig aktiv. |
| Popcorn! | Mit einer Kettenreaktion fünf Gegner treffen. |
| Alles gebannt | In einem Kampf fünf Buffs/Schilde mit Bannung beeinflussen. |
| Perfekte Linie | Drei Bahnen mit je Front- und Hintereinheit aufstellen. |
| Mut zur Lücke | Mit leerer Startbahn einen Elitekampf gewinnen. |
| Fokusgruppe | Drei Fernkämpfer greifen fünf Sekunden dasselbe Ziel an. |
| Goldener Anker | Fünf Gegenstände in einer Expedition sichern. |
| Vertraglich geregelt | Einen Vertrag auf Stufe III verbessern. |
| Poliert | Ersten Gegenstand polieren. |
| Werkstattmuseum | Alle 42 permanenten Gegenstände entdecken. |
| Geschichten am Weg | Alle 30 Ereignisse erleben. |
| Ein wirklich teurer Hut | Kosmetischen Händlerhut erhalten. |
| Pip hatte recht | Pips Zufallsoption wählen und positives Ergebnis erhalten. |
| Pip hatte auch mal nicht recht | Pips Zufallsoption wählen und negatives Ergebnis erhalten. |
| Vier Kronen | Alle vier Hauptbosse besiegen. |
| Riftwarden | Kampagne abschließen. |
| Veteran | Kampagne auf Veteran abschließen. |
| Keine Eile | Einen 80+ Sekunden Bosskampf ohne Riftkollaps gewinnen. |
| Aufgestiegen | Ascension-Rang 1 abschließen. |
| Verknotet | Ascension-Rang 10 abschließen. |
| Jenseits | Jenseitsgrad 10 abschließen. |
| Konstellation | Alle 28 Konstellationsknoten mindestens einmal kaufen. |
| Tiefe 25 | Endlose Rift Tiefe 25 erreichen. |
| Tiefe 50 | Endlose Rift Tiefe 50 erreichen. |
| Hundert Schritte | Endlose Rift Tiefe 100 erreichen. |
| Zehn Meister | Je Held mindestens drei Meisterschaftsziele abschließen. |
Normale Erfolge: 100 Gold oder kosmetisches Abzeichen. Kampagnen-/Endgame-Meilensteine: Titel/Rahmen und höchstens 1-3 Riftessenz.
Erfolge werden nachträglich geprüft, wenn ein altes Savegame auf eine Version mit neuer Prüfung geladen wird.
„Pip hatte recht/nicht recht“ verwendet ausschließlich die explizit zufälligen Pip-Optionen und keine versteckten Wertungen.

## 34. Kampfauswertung und automatische Hinweise
### 34.1 Auswertungsdaten
| Metrik | Definition |
| --- | --- |
| Kampfdauer | Simulationszeit von Startsignal bis Kampfende, ohne Pause. |
| Verursachter Schaden | Endschaden an LP plus effektiv verbrauchter Schildschaden getrennt. |
| Erhaltener Schaden | LP- und Schildschaden getrennt. |
| Heilung | Tatsächlich wiederhergestellte LP; Überheilung separat. |
| Schilde | Erzeugte Menge und tatsächlich absorbierte Menge. |
| Kontrolle | Gesamte effektive Kontrollsekunden nach Resistenz. |
| Beschwörungen | Erzeugt, gefallen, abgelaufen, ersetzt. |
| Erster Verlust | Zeitpunkt und Ursache des ersten regulären eigenen Falls. |
| MVP | Gewichteter Beitrag: Schaden 1, Heilung 0,8, absorbierter Schild 0,7, Kontrolle 45 Punkte/s, Bossmechanikobjekte 100; normalisiert nach Rolle. |
| Gefährlichster Gegner | Höchster gewichteter Beitrag gegen Spieler; Bossmechanikschaden eingeschlossen. |
### 34.2 Kampfbewertung
| Bewertung | Bedingung | Bonus |
| --- | --- | --- |
| Überlegen | Keine reguläre eigene Einheit gefallen. | +15% Gold, höhere Reliktgewichtung klein. |
| Kontrolliert | Höchstens ein Drittel der Startgruppe gefallen. | +8% Gold. |
| Hart erkämpft | Mehr als ein Drittel gefallen, mindestens zwei überlebt. | Kein Bonus/Malus. |
| Letzter Stand | Genau eine reguläre Einheit überlebt. | Kein Malus; eigener Statistikmarker. |
### 34.3 Hinweis-Engine
Nach jedem Kampf werden maximal zwei Hinweise aus objektiven Regeln gewählt. Ein Hinweis benötigt eine Mindestkonfidenz und darf keine einzige perfekte Lösung behaupten. Priorität: unmittelbare Niederlagenursache; ungenutzter klarer Counter; Positionsproblem; Wirtschaft/Belohnung nie als Kampfhinweis.
| Regel | Trigger | Beispieltext |
| --- | --- | --- |
| Leere Bahn | Gegner erreichte auf anfangs leerer Bahn innerhalb 8 s eine Hintereinheit. | „Deine obere Bahn war unbesetzt und wurde sehr schnell durchbrochen.“ |
| Heiler ungestört | Gegnerischer Heiler wirkte mindestens viermal und erzeugte >18% gegnerische Gesamt-LP Heilung. | „Der gegnerische Heiler konnte viermal wirken und viel Schaden ausgleichen.“ |
| Backline früh verloren | Schütze/Heiler fiel vor Sekunde 12 und erhielt >60% Schaden von Nahkämpfer. | „Deine Hinterlinie wurde früh im Nahkampf erreicht.“ |
| Keine Schildantwort | >35% Gesamtschaden wurde von Schilden absorbiert; Gruppe besitzt keinen Brecher/Bann. | „Deiner Gruppe fehlte eine verlässliche Antwort auf Schilde.“ |
| Flächenschaden | Mindestens 45% eigener LP-Schaden kam aus Flächenquellen. | „Die meisten Verluste entstanden durch Flächenschaden; eine breitere Verteilung könnte helfen.“ |
| Beschwörungsdruck | Gegnerbeschwörungen verursachten >30% Schaden oder blockierten >8 s. | „Gegnerische Beschwörungen blieben lange aktiv und banden deine Front.“ |
| Überdehnung | Eine offensive Einheit war >15 X vor nächstem Verbündeten und fiel innerhalb 4 s. | „Eine Einheit rückte weit ohne Unterstützung vor.“ |
| Bossfenster verpasst | Boss besaß mindestens 2 s Verteidigungs-Schwäche, Spieler verursachte darin <5% Gesamtschaden. | „Das sichtbare Verwundbarkeitsfenster des Bosses wurde kaum genutzt.“ |
Implementierungs- und Abnahmekriterien
Auswertungswerte stimmen mit Kampflog auf Rundungsdifferenz unter 0,1% überein.
MVP-Algorithmus bevorzugt nicht automatisch reine DPS über essentielle Heilung/Tankleistung.
Hinweise werden nur bei vollständig erfüllten Triggern gezeigt und nennen keine nicht vorhandene Fähigkeit.
Spieler kann von jeder Metrik direkt zur Ereignis-Timeline springen.

## 41. Inhaltliche Datenverträge
Version 4 legt die technische Speicherform als validierte, versionierte JSON-Inhaltsdaten plus TypeScript-Schemas fest. Jede Datenentität muss mindestens die folgenden semantischen Felder besitzen. IDs sind stabile, kleingeschriebene ASCII-Schlüssel und dürfen nach Veröffentlichung nicht ohne explizite Migration umbenannt werden.
| Entität | Pflichtfelder |
| --- | --- |
| Einheit | id, displayNameKey, category, roleTags, traitIds[0..2], stats, collisionSize, preferredZones, basicAttackId, passiveIds, abilityIds, targetProfileId, visualId, audioId, codexId. |
| Fähigkeit | id, ownerId, triggerType, startCharge, cooldown, preparation, targetRule, validityRule, effects[], interruptPolicy, oncePerBattle, visibilityTextKey, telegraphId, logTags. |
| Effekt | type, magnitude, scalingSource, damageType, duration, radius/range, stackGroup, maxStacks, dispellable, cleanseable, bossModifier, sourceAttribution. |
| Beschwörung | unitId, ownerEntityId, sourceAbilityId, lifetime, countsTowardLimit, replacementPriority, expirationPolicy. |
| Begegnung | id, region, missionRange, formation[], variantId, modifierPool, rewardTier, introRules, validationTags. |
| Bossphase | id, hpStart, hpEnd, transition, abilities, adds, arenaState, previewText, ascensionOverrides. |
| Gegenstand | id, category, compatibility, baseStatMods, effectId, polishMods, acquisitionPool, duplicateGold. |
| Relikt | id, rarity, effectIds, maxCopies, durationScope, poolTags, unlockCondition. |
| Ereignis | id, regionTags, riskTier, textKeys, options[], prerequisites, deterministicRollSlots, replacementReward. |
| Mission | id, act, titleKey, storyKeys, objective, mapProfile, encounterPools, mandatoryNodes, unlocks, firstRewards, repeatRewards. |
| Ascensionregel | rank, cumulativeRules[], bossOverrides, generatorConstraints, rewards. |
### 41.1 Stabile ID-Konvention
Helden: hero_aurel, hero_mira usw.; Truppen: troop_shieldguard; Gegner: enemy_ash_soldier; Fähigkeiten: ability__.
Missionen: mission_1_1 bis mission_4_5; Ereignisse: event_; Gegenstände: gear_main_, gear_talisman_, gear_kit_, gear_banner_.
Lokalisierte Namen sind nie IDs und werden nicht für Savegame-Logik verwendet.
Alle Referenzen werden beim Build validiert; unbekannte ID ist harter Fehler, kein stilles Überspringen.

## 43. Balancing-Leitplanken
| Leitplanke | Zielbereich |
| --- | --- |
| Regulärer Kampf Normal | Spieler gewinnt mit sinnvoller neutraler Gruppe 70-85% beim ersten Versuch; Anpassung hebt auf 85-95%. |
| Elite Normal | Erster Versuch 55-75%; nach Anpassung 75-90%. |
| Boss Normal | Erster Versuch 35-60%; nach Verständnis 70-85%. |
| Kampfdauer | Regulär 20-45 s; Elite 35-60 s; Boss 60-100 s; weniger als 2% Riftkollaps. |
| Einheitenbeitrag | Kein nicht-supportiver regulärer Slot verursacht dauerhaft <60% oder >170% des rollenbereinigten Medianbeitrags. |
| Heilung | Sustain verlängert Kampf, darf ohne Schaden/Front aber kein Unentschieden garantieren. |
| Beschwörungen | Beschwörerbeitrag 25-45% über Beschwörungen, Rest eigene Angriffe/Utility. |
| Synergie | 2er-Synergie ca. 5-9% Gruppenwert; 3er insgesamt 10-16%. |
| Gegenstände | Ein polierter Gegenstand erhöht Trägerbeitrag typischerweise 6-12%; keine Pflichtausrüstung. |
| Level 3 | Gesamtbeitrag gegenüber Level 1 im Mittel 18-28%. |
### 43.1 Verbotene Balance-Abkürzungen
Keine Begegnung wird nur durch massive LP-Skalierung schwierig; mindestens eine Formations-/Mechanikänderung.
Keine Fähigkeit erhält versteckte Trefferchance oder zufällige kritische Treffer, um Zielwerte zu erreichen.
Kein Boss wird gegen Kontrolle vollständig immun ohne sichtbares reduziertes Feedback.
Keine einzelne Synergie oder Heldengruppe darf alle vier Hauptbosse ohne Anpassung deutlich dominieren.
Keine Kampagnenfreischaltung verlangt wiederholtes Farmen derselben Mission auf Normal.
Keine Niederlage wird durch Reduzieren permanenter Progression „gelöst“; zuerst Lesbarkeit, Counter und Werte prüfen.

## 47. Definition der vollständigen inhaltlichen Zielversion
Riftwarden: Auto RPG Roguelite ist releasebereit, wenn der Spieler eine ungewöhnliche Gruppe aufbauen, Gegner vollständig verstehen, einen Plan durch Formation/Doktrin/Ausrüstung formulieren und anschließend klar beobachten kann, wie dieser Plan automatisch umgesetzt wird. Siege und Niederlagen müssen erklärbar sein. Die Kampagne muss abgeschlossen, das Endgame substanziell, die Präsentation poliert und jede Funktion vollständig offline nutzbar sein.
Die zentrale Qualitätsfrage lautet bei jeder Implementierungsentscheidung: „Kann der Spieler erkennen, welche Vorbereitung zu welchem Kampfverhalten und welchem Ergebnis geführt hat?“ Ist die Antwort nicht eindeutig, muss zuerst Lesbarkeit oder Regeldefinition verbessert werden, nicht zusätzlicher Content ergänzt.

## 48. Verbindliche Restklarstellungen und Konfliktauflösung
Dieses Kapitel beseitigt die letzten Interpretationsräume der inhaltlichen Version 3. Bei Widersprüchen gilt die folgende Prioritätsreihenfolge: explizite V4-Klarstellung vor älterer V3-Formulierung; konkrete Einheiten- oder Bossregel vor globaler Standardregel; Sicherheits-, Save- und Store-Regel vor Komfortregel; feste Obergrenze vor Bonus; deterministischer Tie-Break vor zufälliger Auswahl. Kein Implementierungsagent darf aus einer unklaren Formulierung neue Inhalte, neue Währungen, weitere Slots oder zusätzliche Live-Systeme ableiten.
### 48.1 Begriffe und verbindliche Zeitbasis
| Begriff | Verbindliche Bedeutung |
| --- | --- |
| Kampfzeit | Simulationszeit bei 1x. 2x und 3x beschleunigen Simulationsschritte, verändern aber keine Dauer in Kampfzeit. |
| Reale Zeit | Wall-Clock-Zeit des Geräts. Sie wird nur für UI-Animationen, Debounce und Systemdialoge benutzt, nie für Belohnung oder Kampfentscheidung. |
| Nah | Gleiche Bahn und Distanz <= 8 logische X-Einheiten, sofern keine Fähigkeit einen anderen Radius nennt. |
| Benachbart | Direkt angrenzende Bahn oder direkt angrenzende Tiefenzone. Diagonal ist nur benachbart, wenn die konkrete Regel es sagt. |
| Deutlich verletzt | Aktuelle LP <= 60% des Maximums. |
| Wenig Leben | Aktuelle LP <= 30% des Maximums. |
| Starker Treffer | Ein einzelnes Schadensereignis nach Verteidigung >= 18% der maximalen LP des Ziels oder ausdrücklich als stark markiert. |
| Gefährlichster Gegner | Höchster Threat-Rating-Wert aus erwarteter 8-Sekunden-Wirkung; Gleichstand: Boss > Champion > Elite > Support > Schaden > Tank > niedrigste stabile Entity-ID. |
| Reguläre Einheit | Held oder eingesetzte Truppenkopie. Beschwörungen, Bossobjekte und Konstruktionen ohne Gruppenplatz sind nicht regulär. |
| Fallen | Entity wechselt atomar in defeated; Zielbarkeit, Kollision und Aura enden sofort. Die sichtbare Auflösungsanimation ist rein kosmetisch. |
| Einmal pro Kampf | Zähler wird bei BattleStart auf verfügbar gesetzt und erst beim erfolgreichen Commit des Effekts verbraucht; abgebrochene Vorbereitung verbraucht ihn nicht. |
| Fähigkeit bereit | Ladung vollständig, Trigger erfüllt, gültiges Ziel vorhanden und Owner kampffähig. Fehlt ein Ziel, bleibt sie bereit ohne Überladung. |
### 48.2 Priorität gleichzeitiger Ereignisse
1. Ein Simulations-Tick sammelt zunächst Eingaben und bereits geplante Ereignisse, verändert aber noch keinen Zustand.
2. Zuerst werden Kampfende- und Phasenübergangsbedingungen geprüft. Ein Bossphasenwechsel verhindert Schaden über die Phasengrenze nur, wenn die Bossdefinition ausdrücklich eine Übergangssperre besitzt.
3. Danach werden Wiederbelebungen, Todesverhinderungen und Schild-vor-LP-Regeln aufgelöst.
4. Danach werden Schaden, Heilung, Kontrolle, Bewegung und Beschwörungen in der Ereignispriorität ausgeführt.
5. Gleichrangige Ereignisse werden nach scheduledTick, priority, sourceEntityId, abilityId und eventSequence sortiert. Entity-IDs sind stabil; Array- oder Renderreihenfolge ist niemals ein Tie-Break.
6. Erreicht eine Seite im selben Tick den Zustand ohne reguläre kampffähige Einheit, gilt: Boss-/Missionssonderregel, sonst Doppelniederlage. Eine Doppelniederlage zählt als Niederlage des Spielers und erzeugt keinen Siegloot.
### 48.3 Beschwörungslimit und Ersatz
Jede Seite besitzt exakt sechs aktive Beschwörungs-Slots. Stationäre Konstruktionen zählen mit, wenn ihre Definition countsTowardSummonLimit=true setzt.
Kann eine Fähigkeit mehrere Einheiten erzeugen, werden freie Slots in der definierten Spawn-Reihenfolge belegt. Nicht erzeugte Einheiten verursachen weder Explosion noch OnSpawn-Effekt.
Ersatz ist nur erlaubt, wenn die Fähigkeit replacementPolicy=replace_lower_priority besitzt. Ersetzt wird die eigene aktive Beschwörung mit niedrigstem replacementPriority; Gleichstand: kürzeste Restlebenszeit, dann älteste Spawn-Sequenz.
Ein ersetztes Wesen erhält expirationReason=replaced und löst keine Effekte aus, die nur bei defeated gelten. Ausdrücklich auf expiration reagierende Effekte dürfen auslösen.
Beschwörungen können einen Gegner besiegen, aber der Kampf endet sofort, wenn ihre Seite keine reguläre Einheit mehr besitzt; nach Kampfende werden keine nachlaufenden Geschosse gewertet.
### 48.4 Kontrolle, Immunität und Bossinteraktion
Betäubung, Stille, Rückstoß und erzwungener Bahnwechsel sind harte Kontrolle. Verlangsamung, Schwächung, Markierung, Brennen und Gift sind weiche Effekte.
Kontrollresistenz reduziert nur Dauer, nie die sichtbare Auslösung. Eine auf 0,15 s oder weniger reduzierte harte Kontrolle wird als 0,15-s-Unterbrechungsimpuls dargestellt.
Phasenübergänge reinigen harte Kontrolle, unterbrechen gegnerische Projektile jedoch nicht. Bereits abgeschossene Geschosse dürfen treffen, sofern die Phase nicht ausdrücklich unverwundbar ist.
Bosse können nicht von normalen Effekten die Bahn wechseln. Rückstoß wird in 0,25 s Unterbrechung umgewandelt, sofern keine Bossfähigkeit gerade als uninterruptible markiert ist.
Mehrere Reinigungen im selben Tick entfernen einen Effekt nur einmal. Die Quelle der zuerst sortierten Reinigung erhält die Statistikgutschrift.
### 48.5 Beute, Duplikate und volle Inventare
Das permanente Inventar besitzt keine Gesamtplatzgrenze. Ein Gegenstand kann nur einmal dauerhaft besessen werden; ein Duplikat wird unmittelbar in den im Gegenstandsdatensatz definierten Goldwert umgewandelt.
Politur ist ein boolescher permanenter Zustand je Gegenstands-ID. Ein poliertes Duplikat erzeugt nicht mehr Gold als ein unpoliertes Duplikat.
Temporäre Relikte dürfen bis zu acht unterschiedliche aktive Karten besitzen. Ein neuntes Relikt öffnet zwingend Ersetzen oder Ablehnen; Ablehnen gibt 20% des Relikt-Händlerwerts in Zyklus-/Dungeonwährung.
Belohnungen werden vor der nächsten Navigation persistent committed. Ein Prozessabbruch zwischen Wahl und Animation lädt den bereits committed Zustand und zeigt nur die Abschlussanimation erneut.
Kann eine Erstbelohnung wegen bereits freigeschaltetem Inhalt nicht erneut vergeben werden, wird exakt die dokumentierte Ersatzbelohnung genutzt; niemals wird zufällig ein anderer permanenter Inhalt vergeben.
### 48.6 Schwierigkeit, Instabilität und Ascension
| Reihenfolge | Multiplikation/Regel |
| --- | --- |
| 1. Basis | Einheiten- oder Bossbasiswerte. |
| 2. Missionsbereich | Nur normale Gegner: Kampagnen-Missionsmultiplikator. |
| 3. Kampagnenschwierigkeit | Entdecker/Normal/Veteran auf LP, Angriff und Ladung. |
| 4. Riftinstabilität | Nur explizit definierte Instabilitätsboni. |
| 5. Ascension/Jenseits | Kumulative Rangregeln und Gradmultiplikator. |
| 6. Elite/Champion | Eigenschaftsspezifische Werte. |
| 7. Schlachtfeld | Kampfmodifikator; keine rückwirkende Änderung bereits erzeugter Schilde. |
| Rundung | Zwischenergebnisse bleiben Integer-Milliwerte; erst sichtbare UI-Werte werden kaufmännisch gerundet. |
Entdecker, Normal und Veteran gelten nur für Kampagne und Kampagnenwiederholung. Ascension verwendet seine eigene Baseline und ignoriert die Kampagnenschwierigkeit.
Endlose Rift nutzt Normal-Baseline plus Tiefenskalierung und optional gewählten bereits freigeschalteten Ascension-Regelsatz. Jenseitsgrad darf nicht zusätzlich auf Endlose Rift angewendet werden.
Ein Schlachtfeldmodifikator darf nie eine Bosskernmechanik vollständig neutralisieren oder deren angekündigte Gegenstrategie unmöglich machen. Der Encounter-Validator lehnt solche Kombinationen ab.
### 48.7 Anti-Wiederholung und Generator-Fallback
Der Generator führt pro Modus einen Verlauf der letzten drei Kartenprofile, letzten acht Ereignisse, letzten sechs normalen Formationen und letzten vier Modifikatoren.
Identische Ereignis-ID ist innerhalb einer Expedition verboten. Außerhalb darf sie erst nach vier anderen Ereignissen erneut erscheinen, sofern der Pool mindestens fünf gültige Einträge besitzt.
Kann ein Pool wegen Freischaltungen oder Ausschlüssen die Regel nicht erfüllen, wird die geringste Wiederholungsstrafe gewählt; die Karte darf niemals unendlich neu würfeln. Maximal 50 Generierungsversuche, danach deterministisches Fallback-Profil.
Das Fallback-Profil enthält genau sechs Ebenen, einen normalen Kampf, einen Händler oder Rekrutierungsknoten, einen Elitekampf, einen Anker, eine letzte Vorbereitung und das Ziel. Es ist immer erreichbar und verwendet keine Doppelmodifikatoren.
Generatorfehler werden lokal protokolliert, aber der Spieler sieht nur „Die Rift wurde stabilisiert“; Fortschritt und Seed bleiben erhalten.
### 48.8 Abschlusszustände
| Zustand | Folge |
| --- | --- |
| Mission gewonnen | Erst-/Wiederholungsbelohnung committen, Ruhm und Meisterschaft aktualisieren, Storyflag setzen, HQ laden. |
| Freiwilliger Rückzug am Anker | Gesicherte Beute plus dokumentierter Anteil ungesicherten Goldes; Mission nicht abgeschlossen; Ruhm nur wenn mindestens drei Knoten erreicht. |
| Niederlage | Modusabhängiger Goldbehalt; keine ungesicherten Gegenstände/Relikte; permanente Freischaltungen unverändert. |
| App geschlossen | Kein Spielereignis. Letzter atomarer Snapshot wird geladen; kein Verlust als Strafe. |
| Kampagne abgeschlossen | Abschlusssequenz einmal, danach frei wiederholbar; Endgameflags atomar gemeinsam setzen. |
| 100% Fortschritt | Keine zusätzliche Macht. Titel, Statistik und kosmetische HQ-Auszeichnung. |

## 59. Content-Pipeline, Schemas und Buildvalidierung
### 59.1 Datenformat
Alle Gameplayinhalte liegen als UTF-8 JSON ohne Kommentare unter src/game/content/data. Eine Datei pro Entitätskategorie, große Pools nach Region geteilt.
Zod-Schemas sind SSOT. Aus ihnen werden TypeScript-Typen, JSON Schemas und Dokumentationsreports generiert.
Der Build erzeugt immutable ContentIndex-Maps nach ID. Runtime-Suche über frei formulierte Namen ist verboten.
Alle Sekundenwerte in Autorendaten dürfen Dezimalzahlen sein; Loader wandelt sie einmal in ganze Ticks und protokolliert Rundung > 0,01 s als Warnung.
Localization Keys müssen in de und en existieren. Pseudo-Localization muss jedes Layout ohne unersetzte Schlüssel rendern.
### 59.2 Build-Validatoren
| Validator | Harter Fehler bei |
| --- | --- |
| Referenzen | Unbekannter Held, Effekt, Fähigkeit, Lootpool, Mission oder Localization Key. |
| IDs | Duplikat, Großbuchstabe, Leerzeichen, nachträglich entfernte veröffentlichte ID ohne Migration. |
| Kampf | Negative LP, Cooldown < 0,45 s ohne Ausnahme, ungültige Phase, unendliche Triggerkette. |
| Formation | Mehr als Plätze/Kopien/Helden, identische Startfelder, nicht erreichbare Pflichtbahn. |
| Beschwörung | Mehr als sechs ohne Ersatzregel, Rekursion ohne Safety Cap. |
| Dungeon | Nicht erreichbarer Boss, kein Anker, keine Vorbereitung, >13 sichtbare oder >8 besuchte Knoten ohne Modusausnahme. |
| Loot | Leerer Pool, Erstbelohnung ohne Ersatz, nicht besitzbares Item. |
| Text | Fehlende Sprache, Kurztooltip >220 Zeichen, Buttonlabel >30 Zeichen ohne approved compact variant. |
| Assets | Fehlendes Manifest, Atlas >2048, unbekannter Audio Cue, nicht lizenziertes Asset. |
| Store | Produktionsbuild enthält server.url, INTERNET-Permission, Debuggable, Remote Script oder verbotenen SDK-Identifier. |
### 59.3 Referenzschnittstellen
interface ContentHeader {
  schemaVersion: number; contentVersion: string; generatedAt: string;
}
interface BattleSnapshot {
  simulationVersion: number; tick: number; rngStreams: RngStateMap;
  entities: EntitySnapshot[]; scheduledEvents: ScheduledEvent[];
  phase: BattlePhase; sequence: number; checksum: string;
}
interface ScreenContract {
  screenId: ScreenId; entryReason: string; backTarget: ScreenId | 'EXIT';
  requiredData: string[]; restoreKey?: string;
}

## 70. V3-Inhaltserhaltungs- und Abweichungsaudit
Version 4 wurde nicht aus einer verkürzten Zusammenfassung neu aufgebaut, sondern direkt auf der vollständigen DOCX-Version 3 ergänzt. Sämtliche Kapitel 2 bis 46, alle zehn Helden, 18 Truppen, 14 Beschwörungen, Gegner, Elites, Champions, Zwischen- und Hauptbosse, 18 Modifikatoren, 30 Ereignisse, 42 permanente Gegenstände, 36 Relikte, 20 Missionen, Ascension, Konstellation, Jenseits, Endlose Rift, Meisterschaften, Kodex, Erfolge, UX-, Audio-, Save-, Balancing- und Release-Regeln bleiben enthalten.
### 70.1 Explizit ersetzte V3-Aussagen
| V3-Aussage | V4-Änderung | Grund |
| --- | --- | --- |
| Technische Architektur nicht festgelegt | Stack, Module, Build, Native-Konfiguration und Pipeline verbindlich festgelegt. | Expliziter Nutzerauftrag. |
| Assetformate/Dateinamen nicht festgelegt | Formate, Atlanten, Budgets, Manifest und Namensverträge ergänzt. | Sofortige Produktion. |
| UI nur als Layoutregeln | Designsystem, Tokens, Screenkatalog und responsive Klassen ergänzt. | Polished Mobile-GUI und Storetests. |
| Textskalierung bis 150% | Bis 200% plus adaptive Karten/Screenreader-Ansicht erweitert. | Aktuelle Mobile-Accessibility. |
| Technische Speicherform offen | Versioniertes JSON, Zod, atomare Dateisaves und Migration festgelegt. | Save-/Implementierungsreife. |
| Kapitel 47 „finale Zielversion“ | Als vollständige inhaltliche Zielversion präzisiert; technische Finaldefinition folgt in Kapitel 71. | Keine Inhaltsverwerfung. |
### 70.2 Nicht verworfene Inhalte
Kein Held, Trupp, Gegner, Boss, Item, Relikt, Ereignis, Mission, Modus, Meisterschaftsziel oder Erfolg wurde entfernt.
Keine V3-Obergrenze wurde erhöht: sieben reguläre Einheiten, drei Helden, drei gleiche Truppen, sechs Beschwörungen, drei Heldenlevel und drei Ascension-Startgegenstände bleiben verbindlich.
Das Premium-Einmalkaufmodell, vollständige Offlinefunktion, keine Werbung/IAP/Accounts/Server und keine manuelle Kampfsteuerung bleiben unverändert.
Die V4-Technik implementiert die bestehenden Inhaltsregeln; sie ersetzt keine Bossmechanik, Synergie, Belohnungslogik oder Kampagnenstruktur.

## 75. Konkrete Datenmodelle, Schemas und Inhaltskompilierung
### 75.1 Null-/Optional-Semantik
Ein Pflichtfeld fehlt niemals. undefined ist ausschließlich für technisch optionale, nicht serialisierte Funktionsparameter zulässig.
JSON verwendet null nur, wenn „bewusst kein Wert“ eine fachliche Aussage ist. Leere Arrays bedeuten „gültig, aber keine Einträge“.
Defaults werden beim Source-Content nicht still ergänzt. Der Compiler materialisiert explizite Defaults in generated content, damit Runtime und Tests denselben Wert sehen.
Unbekannte Felder sind in Source-, Save- und Importdaten Fehler. Forward Compatibility erfolgt über schemaVersion und Migration, nicht durch Ignorieren.
### 75.2 Zentrale Typen
type ContentId = string;
type LocalizationKey = string;
type Tick = number;
type MilliValue = number;
type BasisPoints = number;

interface ContentManifest {
  schemaVersion: number;
  contentVersion: string;          // SHA-256 of canonical generated content
  simulationVersion: number;
  localeVersions: Record<'de' | 'en', string>;
  counts: Record<string, number>;
  files: Array<{ path: string; sha256: string; byteLength: number }>;
}

interface UnitStats {
  maxHp: MilliValue;
  armor: MilliValue;
  resistance: MilliValue;
  attackPower: MilliValue;
  attackIntervalTicks: Tick;
  preparationTicks: Tick;
  rangeX100: number;
  movementX100PerSecond: number;
  controlResistanceBps: BasisPoints;
}

interface UnitDefinition {
  id: ContentId;
  category: 'hero' | 'troop' | 'summon' | 'enemy' | 'boss' | 'boss_object';
  displayNameKey: LocalizationKey;
  roleTags: RoleTag[];
  traitIds: ContentId[];           // 0..2
  baseStats: UnitStats;
  collisionRadiusX100: number;
  preferredDepths: Depth[];
  basicAttackId: ContentId;
  passiveAbilityIds: ContentId[];
  activeAbilityIds: ContentId[];
  targetProfileId: ContentId;
  visualId: ContentId;
  audioId: ContentId;
  codexId: ContentId;
}

interface AbilityDefinition {
  id: ContentId;
  kind: AbilityKind;
  trigger: TriggerDefinition;
  target: TargetQuery;
  chargeTicks: Tick | null;
  cooldownTicks: Tick | null;
  castTicks: Tick;
  recoveryTicks: Tick;
  interruptPolicy: 'interruptible' | 'cast_committed' | 'uninterruptible';
  usesPerBattle: number | null;
  effects: EffectDefinition[];
  telegraphId: ContentId;
  invalidTargetPolicy: 'wait' | 'retarget' | 'consume_without_effect';
}

interface StatusDefinition {
  id: ContentId;
  kind: StatusKind;
  stackPolicy: StackPolicy;
  maxStacks: number;
  durationCapTicks: Tick | null;
  dispelCategory: 'positive' | 'negative' | 'control' | 'none';
  bossPolicy: 'normal' | 'duration_reduced' | 'convert_to_interrupt' | 'immune';
  statModifiers: StatModifier[];
  periodicEffects: PeriodicEffect[];
}
### 75.3 Encounter-, Mission- und Ereignisverträge
interface EncounterDefinition {
  id: ContentId;
  regionId: ContentId;
  kind: 'normal' | 'elite' | 'boss' | 'survival' | 'reinforcement';
  enemySlots: Array<{ unitId: ContentId; lane: Lane; depth: Depth; eliteId?: ContentId }>;
  modifierIds: ContentId[];
  reinforcementWaves: ReinforcementWave[];
  objective: CombatObjective;
  rewardTableId: ContentId;
  previewDisclosure: PreviewDisclosure;
  allowedModes: RunMode[];
}

interface MissionDefinition {
  id: ContentId;
  act: 1 | 2 | 3 | 4;
  sequence: number;
  titleKey: LocalizationKey;
  objective: MissionObjective;
  mapProfileId: ContentId;
  mandatoryNodeRules: NodeRule[];
  encounterPoolIds: ContentId[];
  firstCompletionRewards: RewardDefinition[];
  repeatRewards: RewardDefinition[];
  unlockFlags: string[];
  storyEntryKeys: LocalizationKey[];
}

interface EventDefinition {
  id: ContentId;
  regionTags: ContentId[];
  riskTier: 0 | 1 | 2 | 3;
  titleKey: LocalizationKey;
  bodyKey: LocalizationKey;
  prerequisites: PredicateDefinition[];
  options: EventOptionDefinition[];
  deterministicRollSlots: string[];
  repeatPolicy: 'once_per_run' | 'history_limited';
}
### 75.4 Compiler- und Laufzeitpipeline
| Schritt | Eingabe | Ausgabe/Gate |
| --- | --- | --- |
| 1 Source parse | UTF-8 JSON, Localization ICU, Assetmanifest | Syntaxfehler, Duplikatkeys und verbotene Unicode-Steuerzeichen blockieren. |
| 2 Schema validation | Zod strict schemas | Kein unbekanntes oder fehlendes Feld. |
| 3 Cross-reference | Alle IDs/Keys/Assets | Jede Referenz existiert und besitzt passenden Typ. |
| 4 Semantic validation | Regeln/Counts/Kompatibilität | Obergrenzen, Trigger, Pools, Bossphasen und Screenlinks gültig. |
| 5 Canonicalization | Sortierte Source-Daten | Stabile Schlüsselreihenfolge, normalisierte Zahlen, keine Kommentare. |
| 6 Index build | Canonical content | Maps nach ID, Poolindizes, Such-/Kodexindizes. |
| 7 Hashing | Alle generated files | contentVersion und file SHA-256. |
| 8 Runtime load | Manifest + generated content | Hash/Schema prüfen; bei Fehler S02 Recovery statt Teilstart. |
### 75.5 Semantische Pflichtvalidatoren
Exakte Releasecounts gemäß Kapitel 2.1; eine Abweichung blockiert release, außer eine neue Dokumentversion ändert den Umfang.
Jede reguläre Einheit besitzt genau einen Standardangriff, mindestens ein Zielprofil, vollständige Visual-/Audio-/Codexreferenzen und gültige Startzone.
Jede automatisch auslösende Fähigkeit besitzt Trigger, Ziel, Cast-/Recoveryzeit, InvalidTargetPolicy, Telegraphie und Effektliste.
Jeder Boss besitzt vollständig abgedeckte LP-Phasen ohne Lücke/Überlappung, eine maximale Kampfdauer und Vorschau für alle strategisch relevanten Mechaniken.
Jede Mission generiert 5-8 besuchte Knoten, garantiert ihre Pflichtknoten, hat mindestens drei gültige normale Encounter-Varianten pro Kampfslot und endet erreichbar.
Jedes Ereignis besitzt zwei oder drei Optionen, sichtbare Kosten/Folgen, deterministische Randomslots und eine valide Ablehn-/Fallbackfolge.
Jeder Screen verweist auf existierende Route, Localization Keys, Icons und mindestens einen Happy-Path-E2E-Test.

## 86. V4-Inhaltserhalt, Korrekturen und Vollständigkeitsaudit
### 86.1 Erhaltungsprinzip
V5 wurde direkt auf der vollständigen V4-DOCX aufgebaut. Kapitel 1-71, sämtliche Tabellen und alle nicht ausdrücklich unten ersetzten Regeln bleiben Bestandteil des Dokuments. Die neuen Kapitel 72-87 sind Ergänzung und autoritative Schließung, keine verkürzte Neuerzählung.
| Inhaltsgruppe | V4 | V5-Ergebnis |
| --- | --- | --- |
| Produkt/Scope | Premium, offline, keine Ads/IAP/Accounts, 4 Akte | Unverändert. |
| Kampf | Auto-Battle, 3 Bahnen, Formeln, Zielwahl, Status | Unverändert; Tickpipeline/Edge Cases präzisiert. |
| Roster | 10 Helden, 18 Truppen, 14 Beschwörungen, 28 Grundgegner | Vollständig erhalten. |
| Bosse/Inhalte | 4 Hauptbosse, Zwischenbosse, Modifikatoren, 30 Events | Vollständig erhalten. |
| Progression | 42 Items, 36 Relikte, 20 Missionen, Ascension/Endless | Vollständig erhalten. |
| UX/Screens | S00-S65, O01-O07, Designsystem | Erhalten; Zustände, Routes, Persistenz und Golden States ergänzt. |
| Technik | Capacitor/React/Pixi/Simulation/Save/CI | Erhalten; konkrete Contracts, Commands, Budgets, Native Atomizität ergänzt. |
| Store/QA | Android/iOS-Gates, Privacy, 16 KB, Tests | Erhalten und als Go/No-Go geschlossen. |
### 86.2 Explizite V5-Korrekturen gegenüber V4
| V4-Stelle | V5-Korrektur | Auswirkung |
| --- | --- | --- |
| Kapitel 49.1 PixiJS | Canvas-Fallback entfernt. WebGL ist Produktion, WebGPU deaktiviert, fehlendes WebGL führt zu S02. | Technisch korrekter, testbarer Rendererpfad; Gameplay unverändert. |
| Kapitel 58/Filesystem | NativeSaveStore mit atomarem Rename/Flush ist Autorität; Filesystemplugin allein reicht nicht als Garantie. | Save-Sicherheit präzisiert. |
| Allgemeine Defaults | Enums, Units, Settings, Buildvariablen, Commands und Dateninterfaces materialisiert. | Keine neue Mechanik; Implementierungsfragen geschlossen. |
| Screenkatalog | Loading/Empty/Error/Transaktion/Restore und Routeparameter verbindlich ergänzt. | Keine Screens entfernt. |
| Performance | Messmethoden und harte Budgets ergänzt; Low Quality darf nur Kosmetik reduzieren. | Keine Inhalts- oder Telegraphieverluste. |
| Kapitel 6/51 Zeitlimits | Riftkollaps startet regulär/Elite bei 90 s und Boss bei 120 s, dauert 15 s; 180 s bleibt ausschließlich absoluter Failsafe. | Widersprüchliche Soft-/Hard-Konstanten beseitigt; vorhandene Kampfregel erhalten. |
| Reliktlimit | Sechs als Kampagne/Standard, acht ausschließlich Endlose Rift ab Tiefe 21; absolutes Maximum acht. | Bestehende Modusregel technisch materialisiert. |
| Audio/Voice | DE-/EN-Pflichtscope und beide Plattform-Audioformate festgelegt. | Keine Budgetentscheidung während Implementierung nötig. |
| Capacitor Plugins/ABI | Browser verpflichtend; Filesystem nicht Save-Autorität; Production-ABI-Slices verbindlich. | Native- und Storepfade geschlossen. |
### 86.3 Automatische V5-Vollständigkeitsgates
Dokumentaudit vergleicht normalisierte V4-Absätze und Tabellenzellen gegen V5. Ausnahmen sind ausschließlich Cover-/Versionslabels, der dokumentierte Pixi-Fix und V5-Autoritätstexte.
Contentvalidator bestätigt exakt 10/18/14/28/4/4/18/30/42/36/20/28/36 gemäß Releaseumfang.
Headingaudit bestätigt lückenlose Kapitel 1-87 und statisches Inhaltsverzeichnis.
Renderaudit prüft jede Seite auf Leerseite, Beschnitt, Tabellenüberlauf, beschädigte Glyphen und Footer/Header.
DOCX-A11y-Audit und PDF-Preflight müssen ohne kritische Befunde abschließen.
### 86.4 Bewusst weiterhin nicht im GDD
Konkrete Sprint-/Taskzerlegung, Aufwandsschätzung, personelle Zuordnung und Kalendertermine: gehören in den nachfolgenden Entwicklungsplan.
Publisheridentität, Signing-Secrets, endgültige Storepreisstufen und rechtsverbindliche Texte: externe Releaseinputs mit Gates aus Kapitel 72.4.
Feintuning außerhalb der Baseline: erfolgt evidenzbasiert über Simulation/Playtest innerhalb der dokumentierten Korridore; keine neue Mechanik.
