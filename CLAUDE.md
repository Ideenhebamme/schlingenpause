# CLAUDE.md – Projektgedächtnis: Schlingenpause

Lies diese Datei zu Beginn jeder Arbeitssitzung.

## Was das ist

Persönliche Web-App (PWA) für Nils: kurze Schlingentrainings-Pausen am Schreibtisch,
vor allem auf dem iPhone. Die Schlinge (TRX-Prinzip: ein Ankerpunkt, Y-Gurt, zwei Griffe)
hängt an der Mittelsäule einer Wendeltreppe, ca. 2 m neben dem Schreibtisch.

Ausgangspunkt war die „Pause App“ (ReZuKi-Begleiter) im Ordner
`RESIKASI/Pause App/Code Arbeitsordner`. Die alte App bleibt unverändert bestehen.

## Entscheidungen

- **Hosting:** GitHub Pages, `https://ideenhebamme.github.io/schlingenpause/`.
  Jeder Push auf `main` baut und deployt über `.github/workflows/deploy.yml`.
- **Tech:** Vite + Vanilla JS + `vite-plugin-pwa`. Kein Framework, kein Backend.
- **Übungsbibliothek** liegt im Bundle (`src/daten/uebungen.json`), nicht als separater
  Download – Updates kommen mit jedem Deploy.
- **Kein Arbeitstimer:** Eine Web-App auf dem iPhone kann im Hintergrund nicht
  zuverlässig erinnern. Erinnerungen laufen über iOS (Kurzbefehl/Erinnerung).
- **Trainingsziele:** Kraft, Haltung & Rücken, Mobilität, dazu „Überrasch mich“ (mix).
- **Dauer pro Pause wählbar:** kurz (3 Übungen, 1 Runde) / länger (4 Übungen × 2 Runden;
  Mobilität: 5 Übungen × 1 Runde).
- **Schrift:** Systemschrift (keine Google Fonts → offline + DSGVO).
- Daten nur in `localStorage` auf dem Gerät; Backup als JSON-Export/-Import.

## Datenmodell Übung (`schema_version` 1.x)

```json
{
  "id": "zug-rudern",
  "titel": "Rudern",
  "ziele": ["kraft", "haltung"],          // kraft | haltung | mobilitaet
  "muster": "zug",                         // zug | druck | beine | rumpf | schulter | huefte | wirbelsaeule
  "intensitaet": 2,                        // 1 kaum schwitzen … 3 fordernd (kurz: max. 2)
  "einseitig": false,                      // true → Vorgabe gilt je Seite
  "aufbau": "Gurtlänge, Stand zum Anker, Griffhaltung",
  "ablauf": ["Schritt 1", "Schritt 2"],
  "achte_auf": "Wichtigster Technikhinweis",
  "warum": "Kurze Begründung ohne Heilversprechen",
  "vorsicht": "optional – z. B. Außenrotation vorsichtig testen",
  "stufen": [
    { "hinweis": "Körperwinkel/Fußposition dieser Stufe", "einheit": "wdh", "min": 8, "max": 12 }
  ],
  "bild": { "ansicht": "seite", "gurt": "zwei", "posen": [ {…Start…}, {…Ende…} ] }
}
```

Progression der Stufen: Zugübungen mit Blick zum Anker werden schwerer, je weiter die Füße
Richtung/unter den Ankerpunkt gehen; Druckübungen mit Rücken zum Anker werden schwerer,
je näher die Füße Richtung Ankerpunkt kommen (Körper flacher).

## Piktogramme

`scripts/piktogramme.mjs` erzeugt aus `bild` je Übung `public/bilder/<id>.svg`
(Start- und Endposition nebeneinander, Strichfigur mit Anker und Gurt).
Posen werden über Gelenkwinkel beschrieben – Doku im Kopf des Skripts.
Läuft automatisch bei `npm run build`; einzeln mit `npm run bilder`.

`npm test` prüft die Bibliothek mit `src/logik/schema.js` und rendert alle Piktogramme.
Aktuell: Bibliothek 1.0.0 mit 29 Übungen (Kraft, Haltung & Rücken, Mobilität).
Anker bei Nils: Mittelsäule der Wendeltreppe, 2,0–2,2 m; Körpergröße 1,83 m.
Außenrotation der Schulter (Face Pull, W-Heben) ist mit `vorsicht` markiert – Nils testet, was geht.

## Logik

- `src/logik/progression.js` – Anpassung aus Rückmeldung:
  passt → +1 Wdh./+5 Sek. (max. 1× pro Tag), über max → nächste Stufe;
  zu leicht → nächste Stufe; zu schwer → −2 Wdh./−10 Sek., unter min → vorherige Stufe.
- `src/logik/auswahl.js` – Session: Punktzahl aus „lange nicht gemacht“,
  „Muster lange nicht trainiert“, Strafe für doppeltes Muster, Zufall.
  Ruhigere Übungen zuerst.
- Rückmeldung nur in der letzten Runde einer Übung.

## Regeln

- Texte nur über `textContent` (Helfer `h()` in `src/ui/dom.js`), kein `innerHTML`.
- Strenge CSP im `index.html` – keine Inline-Skripte/-Styles.
- Keine Gamification (Streaks, Badges), keine medizinischen Wirkversprechen.
- Sprache: deskriptiv, keine Marketingsprache.
- Keine Atemanhalteübungen.

## Offen

- Feedback aus der Nutzung: Stufen, Wiederholungsbereiche, Piktogramme nachschärfen
- Finaler App-Name (Arbeitstitel „Schlingenpause“)
