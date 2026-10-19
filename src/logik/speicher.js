// Lokaler Speicher (nur auf diesem Gerät). Kein Server, kein Account.
// Alle Zugriffe abgesichert: Wenn localStorage nicht verfügbar ist,
// läuft die App mit einem Zustand im Arbeitsspeicher weiter.

const SCHLUESSEL = 'schlingenpause_v1';
const MAX_SESSIONS = 400;

export function leererZustand() {
  return {
    version: 1,
    uebungen: {},      // id → Progressionszustand
    sessions: [],      // abgeschlossene Pausen, neueste zuletzt
    einstellungen: { ton: true, dauer: 'kurz' },
    hinweisGelesen: false,
  };
}

let speicherOk = true;

export function laden() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) return leererZustand();
    return normalisiere(JSON.parse(roh));
  } catch {
    speicherOk = false;
    return leererZustand();
  }
}

export function speichern(zustand) {
  try {
    zustand.sessions = zustand.sessions.slice(-MAX_SESSIONS);
    localStorage.setItem(SCHLUESSEL, JSON.stringify(zustand));
    speicherOk = true;
    return true;
  } catch {
    speicherOk = false;
    return false;
  }
}

export function speicherVerfuegbar() {
  return speicherOk;
}

export function normalisiere(d) {
  const leer = leererZustand();
  if (!d || typeof d !== 'object' || d.version !== 1) throw new Error('Unbekanntes Format');
  return {
    ...leer,
    ...d,
    uebungen: d.uebungen && typeof d.uebungen === 'object' ? d.uebungen : {},
    sessions: Array.isArray(d.sessions) ? d.sessions : [],
    einstellungen: { ...leer.einstellungen, ...(d.einstellungen ?? {}) },
  };
}

export function alsBackupText(zustand) {
  return JSON.stringify({ ...zustand, exportiert: new Date().toISOString() }, null, 2);
}

export function ausBackupText(text) {
  return normalisiere(JSON.parse(text));
}
