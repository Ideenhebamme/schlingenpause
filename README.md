# Schlingenpause

Kurze Schlingentrainings-Pausen am Schreibtisch – als Web-App fürs iPhone.

**App:** https://ideenhebamme.github.io/schlingenpause/
In Safari öffnen → Teilen → „Zum Home-Bildschirm“.

## Entwicklung

```bash
npm install
npm run dev      # lokaler Server
npm test         # Logik + Übungsbibliothek prüfen
npm run build    # Produktions-Build nach dist/
```

Push auf `main` → GitHub Action testet, baut und veröffentlicht auf GitHub Pages.

Übungen: `src/daten/uebungen.json` (Schema siehe `CLAUDE.md`).
Trainingsstand und Verlauf bleiben im Browser des Geräts (localStorage).
