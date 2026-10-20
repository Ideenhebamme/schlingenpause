// Vorlesen über die Sprachausgabe des Geräts (Web Speech API).
// Läuft offline mit den Stimmen, die auf dem iPhone installiert sind.
// Auf iOS muss die erste Ausgabe in einem Tipp-Handler starten (entsperren()).

const ok = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let stimme = null;
let gewuenscht = null; // voiceURI aus den Einstellungen
let auftrag = 0; // erhöht sich bei jedem neuen Vorlesen → ältere Ketten brechen ab
const beiAenderung = new Set();

// Spaß- und Effektstimmen von Apple, die nicht für Ansagen taugen
const EFFEKT = /\b(eddy|flo|grandma|grandpa|oma|opa|reed|rocko|sandy|shelley|bahh|bells|boing|bubbles|cellos|wobble|zarvox|news|jester|organ|superstar|trinoids|whisper|albert|fred|junior|kathy|ralph)\b/i;

// Rangfolge: 3 Premium, 2 Erweitert, 1 Standard, 0.5 Siri (von iOS für Web-Apps meist gesperrt), 0 Effekt
function qualitaet(v) {
  const id = `${v.voiceURI ?? ''} ${v.name ?? ''}`.toLowerCase();
  if (/siri/.test(id)) return 0.5;
  if (/premium/.test(id)) return 3;
  if (/enhanced|erweitert|verbessert/.test(id)) return 2;
  if (EFFEKT.test(v.name ?? '')) return 0;
  return 1;
}

export function qualitaetsName(v) {
  const q = qualitaet(v);
  return q === 0.5 ? 'Siri, evtl. nicht nutzbar' : ['Effekt', 'Standard', 'Erweitert', 'Premium'][q];
}

// Alle deutschen Stimmen, beste zuerst
export function deutscheStimmen() {
  if (!ok) return [];
  return speechSynthesis.getVoices()
    .filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('de'))
    .sort((a, b) => qualitaet(b) - qualitaet(a) || (b.lang === 'de-DE') - (a.lang === 'de-DE') || a.name.localeCompare(b.name));
}

function waehleStimme() {
  if (!ok) return;
  const liste = deutscheStimmen();
  stimme = (gewuenscht && liste.find((v) => v.voiceURI === gewuenscht)) ?? liste.find((v) => qualitaet(v) >= 1) ?? liste[0] ?? null;
  beiAenderung.forEach((f) => f());
}
if (ok) {
  waehleStimme();
  speechSynthesis.addEventListener?.('voiceschanged', waehleStimme);
  // iOS liefert die Liste manchmal erst verzögert
  setTimeout(waehleStimme, 500);
  setTimeout(waehleStimme, 2000);
}

export function setzeStimme(voiceURI) {
  gewuenscht = voiceURI || null;
  waehleStimme();
}

export function aktuelleStimme() {
  return stimme;
}

export function wennStimmenGeladen(f) {
  beiAenderung.add(f);
  return () => beiAenderung.delete(f);
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
