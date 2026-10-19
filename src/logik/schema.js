// Prüft die Übungsbibliothek. Gibt { ok, fehler[] } zurück.
// Texte aus der Bibliothek werden in der App nur über textContent ausgegeben.

export const ZIELE = ['kraft', 'haltung', 'mobilitaet'];
export const MUSTER = ['zug', 'druck', 'beine', 'rumpf', 'schulter', 'huefte', 'wirbelsaeule'];
export const EINHEITEN = ['wdh', 'sek'];

const istText = (v) => typeof v === 'string' && v.trim().length > 0;
const istZahl = (v) => Number.isInteger(v) && v > 0;

export function pruefeBibliothek(daten) {
  const fehler = [];
  if (!daten || typeof daten !== 'object') return { ok: false, fehler: ['Kein Objekt'] };
  if (typeof daten.schema_version !== 'string' || !daten.schema_version.startsWith('1.')) {
    fehler.push(`schema_version nicht unterstützt: ${daten.schema_version}`);
  }
  if (!Array.isArray(daten.uebungen) || daten.uebungen.length === 0) {
    return { ok: false, fehler: [...fehler, 'uebungen fehlt oder leer'] };
  }

  const ids = new Set();
  for (const u of daten.uebungen) {
    const p = `[${u?.id ?? '?'}]`;
    if (!istText(u.id)) fehler.push(`${p} id fehlt`);
    else if (ids.has(u.id)) fehler.push(`${p} id doppelt`);
    else ids.add(u.id);

    for (const feld of ['titel', 'aufbau', 'achte_auf', 'warum']) {
      if (!istText(u[feld])) fehler.push(`${p} ${feld} fehlt`);
    }
    if (!Array.isArray(u.ziele) || u.ziele.length === 0 || !u.ziele.every((z) => ZIELE.includes(z))) {
      fehler.push(`${p} ziele ungültig`);
    }
    if (!MUSTER.includes(u.muster)) fehler.push(`${p} muster ungültig: ${u.muster}`);
    if (![1, 2, 3].includes(u.intensitaet)) fehler.push(`${p} intensitaet muss 1–3 sein`);
    if (typeof u.einseitig !== 'boolean') fehler.push(`${p} einseitig muss true/false sein`);
    if (!Array.isArray(u.ablauf) || u.ablauf.length === 0 || !u.ablauf.every(istText)) {
      fehler.push(`${p} ablauf ungültig`);
    }
    if (u.vorsicht !== undefined && !istText(u.vorsicht)) fehler.push(`${p} vorsicht muss Text sein`);
    if (u.bild !== undefined) {
      if (!['seite', 'front'].includes(u.bild.ansicht ?? 'seite')) fehler.push(`${p} bild.ansicht ungültig`);
      if (!Array.isArray(u.bild.posen) || u.bild.posen.length === 0) fehler.push(`${p} bild.posen fehlen`);
    }
    if (!Array.isArray(u.stufen) || u.stufen.length === 0) {
      fehler.push(`${p} stufen fehlen`);
    } else {
      u.stufen.forEach((s, i) => {
        if (!istText(s.hinweis)) fehler.push(`${p} Stufe ${i + 1}: hinweis fehlt`);
        if (!EINHEITEN.includes(s.einheit)) fehler.push(`${p} Stufe ${i + 1}: einheit ungültig`);
        if (!istZahl(s.min) || !istZahl(s.max) || s.min > s.max) {
          fehler.push(`${p} Stufe ${i + 1}: min/max ungültig`);
        }
      });
    }
  }
  return { ok: fehler.length === 0, fehler };
}
