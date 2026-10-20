// Vorlesen über die Sprachausgabe des Geräts (Web Speech API).
// Läuft offline mit den Stimmen, die auf dem iPhone installiert sind.
// Auf iOS muss die erste Ausgabe in einem Tipp-Handler starten (entsperren()).

const ok = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let stimme = null;
let auftrag = 0; // erhöht sich bei jedem neuen Vorlesen → ältere Ketten brechen ab

function waehleStimme() {
  if (!ok) return;
  const deutsch = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('de'));
  stimme =
    deutsch.find((v) => /premium|enhanced|erweitert/i.test(v.name)) ??
    deutsch.find((v) => /anna|helena|petra|markus|yannick/i.test(v.name)) ??
    deutsch.find((v) => v.localService) ??
    deutsch[0] ??
    null;
}
if (ok) {
  waehleStimme();
  speechSynthesis.addEventListener?.('voiceschanged', waehleStimme);
}

export function spracheVerfuegbar() {
  return ok;
}

// Text für die Aussprache aufbereiten (Abkürzungen, Zeichen).
export function fuerSprache(text) {
  return String(text)
    .replace(/(\d+)\s*Wdh\./g, (_, n) => `${n} ${n === '1' ? 'Wiederholung' : 'Wiederholungen'}`)
    .replace(/(\d+)\s*Sek\./g, (_, n) => `${n} ${n === '1' ? 'Sekunde' : 'Sekunden'}`)
    .replace(/(\d+)\s*Min\b\.?/g, '$1 Minuten')
    .replace(/(\d+)\s*°/g, '$1 Grad')
    .replace(/(\d),(\d)\s*m\b/g, '$1 Komma $2 Meter')
    .replace(/z\. ?B\./g, 'zum Beispiel')
    .replace(/[„“"]/g, '')
    .replace(/\s+–\s+/g, ', ')
    .replace(/…/g, '.')
    .trim();
}

// Liest eine Liste von Abschnitten nacheinander vor.
// Gibt ein Promise zurück, das erfüllt wird, wenn alles gelesen wurde (true)
// oder abgebrochen wurde (false).
export function sprich(abschnitte, { tempo = 1 } = {}) {
  if (!ok) return Promise.resolve(false);
  const meiner = ++auftrag;
  speechSynthesis.cancel();
  const liste = abschnitte.filter(Boolean).map(fuerSprache).filter((t) => t.length > 0);
  return new Promise((fertig) => {
    let i = 0;
    const naechster = () => {
      if (meiner !== auftrag) return fertig(false);
      if (i >= liste.length) return fertig(true);
      const u = new SpeechSynthesisUtterance(liste[i++]);
      u.lang = 'de-DE';
      if (stimme) u.voice = stimme;
      u.rate = tempo;
      u.onend = naechster;
      u.onerror = () => fertig(false);
      speechSynthesis.speak(u);
    };
    // iOS verschluckt manchmal die erste Ausgabe direkt nach cancel()
    setTimeout(naechster, 60);
  });
}

// Kurze Ansage, ohne laufendes Vorlesen abzubrechen, wenn nichts läuft.
export function sage(text, { tempo = 1 } = {}) {
  return sprich([text], { tempo });
}

export function stoppe() {
  if (!ok) return;
  auftrag++;
  speechSynthesis.cancel();
}

export function sprichtGerade() {
  return ok && (speechSynthesis.speaking || speechSynthesis.pending);
}

// In einem Tipp-Handler aufrufen, damit iOS spätere Ausgaben zulässt.
export function entsperren() {
  if (!ok) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    u.lang = 'de-DE';
    speechSynthesis.speak(u);
  } catch { /* still */ }
}
