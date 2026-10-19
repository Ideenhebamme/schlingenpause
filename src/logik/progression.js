// Anpassung an den Trainingsstand.
//
// Jede Übung hat Stufen (leichter → schwerer, meist über den Körperwinkel).
// Pro Stufe gibt es einen Zielbereich (min–max Wiederholungen oder Sekunden).
//
// Rückmeldung nach der Übung:
//   passt      → nächstes Mal +1 Wdh. bzw. +5 Sek. (höchstens einmal pro Tag).
//                Über max hinaus → nächste Stufe, wieder bei min.
//   zu leicht  → direkt nächste Stufe bei min (schnelles Einpendeln).
//   zu schwer  → −2 Wdh. bzw. −10 Sek.; unter min → vorherige Stufe, Mitte des Bereichs.

export const SCHRITT = { wdh: 1, sek: 5 };
const VERLAUF_MAX = 20;

export function tagesSchluessel(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startZustand(uebung) {
  return {
    stufe: 0,
    ziel: uebung.stufen[0].min,
    zuletzt: null,
    letzteSteigerung: null,
    gesperrt: false,
    verlauf: [],
  };
}

// Liefert einen gültigen Zustand, auch wenn sich die Bibliothek geändert hat
// (z. B. weniger Stufen als vorher).
export function zustandFuer(alleZustaende, uebung) {
  const z = alleZustaende?.[uebung.id];
  if (!z) return startZustand(uebung);
  const letzte = uebung.stufen.length - 1;
  const stufe = Math.min(Math.max(0, z.stufe | 0), letzte);
  const s = uebung.stufen[stufe];
  const untergrenze = stufe === 0 ? untersteGrenze(s) : s.min;
  let ziel = Number.isFinite(z.ziel) ? z.ziel : s.min;
  ziel = Math.min(Math.max(ziel, untergrenze), s.max);
  return { ...startZustand(uebung), ...z, stufe, ziel };
}

function untersteGrenze(stufe) {
  const schritt = SCHRITT[stufe.einheit];
  return Math.max(schritt, Math.floor(stufe.min / 2));
}

export function vorgabe(uebung, z) {
  const s = uebung.stufen[z.stufe];
  return {
    stufeIndex: z.stufe,
    anzahlStufen: uebung.stufen.length,
    hinweis: s.hinweis,
    einheit: s.einheit,
    ziel: z.ziel,
  };
}

export function formatVorgabe(einheit, ziel, einseitig) {
  const wert = einheit === 'sek' ? `${ziel} Sek.` : `${ziel} Wdh.`;
  return einseitig ? `${wert} je Seite` : wert;
}

// Wendet eine Rückmeldung an. Gibt { zustand, aenderung } zurück.
// aenderung.art: 'stufe-hoch' | 'stufe-runter' | 'mehr' | 'weniger' | 'gleich'
export function wendeRueckmeldungAn(uebung, zAlt, rueckmeldung, jetzt) {
  const z = { ...zAlt, verlauf: [...(zAlt.verlauf ?? [])] };
  const heute = tagesSchluessel(jetzt);
  const letzte = uebung.stufen.length - 1;
  const s = uebung.stufen[z.stufe];
  const schritt = SCHRITT[s.einheit];
  let art = 'gleich';

  if (rueckmeldung === 'passt') {
    if (z.letzteSteigerung === heute) {
      art = 'gleich';
    } else if (z.ziel + schritt <= s.max) {
      z.ziel += schritt;
      art = 'mehr';
    } else if (z.stufe < letzte) {
      z.stufe += 1;
      z.ziel = uebung.stufen[z.stufe].min;
      art = 'stufe-hoch';
    } else {
      z.ziel = s.max;
      art = 'gleich';
    }
    if (art !== 'gleich') z.letzteSteigerung = heute;
  } else if (rueckmeldung === 'zu-leicht') {
    if (z.stufe < letzte) {
      z.stufe += 1;
      z.ziel = uebung.stufen[z.stufe].min;
      art = 'stufe-hoch';
    } else if (z.ziel < s.max) {
      z.ziel = Math.min(s.max, z.ziel + 2 * schritt);
      art = 'mehr';
    }
    z.letzteSteigerung = heute;
  } else if (rueckmeldung === 'zu-schwer') {
    const neu = z.ziel - 2 * schritt;
    if (neu >= s.min) {
      z.ziel = neu;
      art = 'weniger';
    } else if (z.stufe > 0) {
      z.stufe -= 1;
      const v = uebung.stufen[z.stufe];
      const st = SCHRITT[v.einheit];
      z.ziel = Math.round((v.min + v.max) / 2 / st) * st;
      art = 'stufe-runter';
    } else {
      const grenze = untersteGrenze(s);
      const gesenkt = Math.max(grenze, neu);
      art = gesenkt < z.ziel ? 'weniger' : 'gleich';
      z.ziel = gesenkt;
    }
  }

  z.zuletzt = jetzt;
  z.verlauf.push({ t: jetzt, r: rueckmeldung });
  if (z.verlauf.length > VERLAUF_MAX) z.verlauf = z.verlauf.slice(-VERLAUF_MAX);

  return { zustand: z, aenderung: { art, ...beschreibe(uebung, z, art) } };
}

function beschreibe(uebung, z, art) {
  const s = uebung.stufen[z.stufe];
  const ziel = formatVorgabe(s.einheit, z.ziel, uebung.einseitig);
  switch (art) {
    case 'stufe-hoch': return { text: `Stufe ${z.stufe + 1} – nächstes Mal ${ziel}` };
    case 'stufe-runter': return { text: `Zurück auf Stufe ${z.stufe + 1} – ${ziel}` };
    case 'mehr': return { text: `Nächstes Mal ${ziel}` };
    case 'weniger': return { text: `Nächstes Mal ${ziel}` };
    default: return { text: `Bleibt bei ${ziel}` };
  }
}

// Manuelle Korrektur in der Bibliothek (Stufe ±1).
export function setzeStufe(uebung, zAlt, neueStufe) {
  const stufe = Math.min(Math.max(0, neueStufe), uebung.stufen.length - 1);
  return { ...zAlt, stufe, ziel: uebung.stufen[stufe].min };
}
