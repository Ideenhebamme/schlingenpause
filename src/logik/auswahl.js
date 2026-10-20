// Stellt eine Pause zusammen: Gerät + Ziel + Dauer → 3–5 Übungen in 1–2 Runden.
//
// Abwechslung entsteht über eine Punktzahl je Kandidat:
//   + lange nicht gemacht (bis 72 h)            → bis zu 3 Punkte
//   + nie gemacht                               → +0,5 (neue Übungen kennenlernen)
//   + Bewegungsmuster lange nicht trainiert     → bis zu 2 Punkte (bis 48 h)
//   − Muster schon in dieser Pause              → −5
//   + Zufall                                    → bis zu 1,5 Punkte
// Gewählt wird jeweils der beste Kandidat, danach wird neu gerechnet.
//
// Geräte: "schlinge" (Standard) und "baelle". Eine Schlingen-Pause kann mit einer
// Ball-Übung als Einstieg beginnen (einmalig, läuft nur in der ersten Runde).

import { zustandFuer, vorgabe } from './progression.js';

export const DAUER = {
  kurz: { anzahl: 3, runden: 1, maxIntensitaet: 2 },
  lang: { anzahl: 4, runden: 2, maxIntensitaet: 3 },
};
// Mobilität: Halteübungen dauern pro Satz länger, dafür eine Runde.
const DAUER_MOBILITAET = {
  kurz: { anzahl: 3, runden: 1, maxIntensitaet: 2 },
  lang: { anzahl: 5, runden: 1, maxIntensitaet: 3 },
};
// Bälle: ruhige Übungen, eine Runde.
const DAUER_BAELLE = {
  kurz: { anzahl: 3, runden: 1, maxIntensitaet: 3 },
  lang: { anzahl: 5, runden: 1, maxIntensitaet: 3 },
};

const STUNDE = 3600 * 1000;

export function geraetVon(u) {
  return u?.geraet ?? 'schlinge';
}

export function gurtVon(u) {
  return u?.gurt ?? (geraetVon(u) === 'baelle' ? 'keiner' : 'mittel');
}

export function parameterFuer(ziel, dauer, geraet = 'schlinge') {
  const tabelle = geraet === 'baelle' ? DAUER_BAELLE : ziel === 'mobilitaet' ? DAUER_MOBILITAET : DAUER;
  return tabelle[dauer] ?? tabelle.kurz;
}

function kandidaten(bibliothek, zustaende, geraet, ziel, maxIntensitaet) {
  const passt = (u) =>
    geraetVon(u) === geraet &&
    (ziel === 'mix' || u.ziele.includes(ziel)) &&
    !zustaende?.[u.id]?.gesperrt;
  const alle = bibliothek.uebungen.filter(passt);
  const leichtGenug = alle.filter((u) => u.intensitaet <= maxIntensitaet);
  return { alle, bevorzugt: leichtGenug };
}

function musterZuletzt(bibliothek, zustaende) {
  const m = {};
  for (const u of bibliothek.uebungen) {
    const t = zustaende?.[u.id]?.zuletzt;
    if (t && (!m[u.muster] || t > m[u.muster])) m[u.muster] = t;
  }
  return m;
}

function punkte(u, { zustaende, musterZeit, jetzt, imPlan, rng }) {
  const zuletzt = zustaende?.[u.id]?.zuletzt;
  let p = 0;
  if (!zuletzt) p += 3.5;
  else p += (Math.min((jetzt - zuletzt) / STUNDE, 72) / 72) * 3;

  const mz = musterZeit[u.muster];
  p += mz ? (Math.min((jetzt - mz) / STUNDE, 48) / 48) * 2 : 2;

  if (imPlan.some((x) => x.muster === u.muster)) p -= 5;
  p += rng() * 1.5;
  return p;
}

function waehle(pool, anzahl, ctx, schonGewaehlt = []) {
  const plan = [...schonGewaehlt];
  const rest = pool.filter((u) => !plan.some((x) => x.id === u.id));
  const neu = [];
  while (neu.length < anzahl && rest.length > 0) {
    let besterIndex = 0;
    let besterWert = -Infinity;
    rest.forEach((u, i) => {
      const w = punkte(u, { ...ctx, imPlan: plan });
      if (w > besterWert) { besterWert = w; besterIndex = i; }
    });
    const [u] = rest.splice(besterIndex, 1);
    plan.push(u);
    neu.push(u);
  }
  return neu;
}

function alsEintrag(u, zustaende, einmalig = false) {
  const z = zustandFuer(zustaende, u);
  const e = { id: u.id, geraet: geraetVon(u), gurt: gurtVon(u), ...vorgabe(u, z) };
  if (einmalig) e.einmalig = true;
  return e;
}

// Reihenfolge innerhalb einer Pause:
// Übungen mit gleicher Gurtlänge stehen zusammen (weniger Umstellen).
// Zuerst die Gruppe mit der ruhigsten Übung, innerhalb der Gruppe ruhigere zuerst.
const GURT_RANG = { keiner: -1, kurz: 0, mittel: 1, lang: 2 };
export function ordne(uebungen) {
  const gruppen = new Map();
  uebungen.forEach((u, i) => {
    const g = gurtVon(u);
    if (!gruppen.has(g)) gruppen.set(g, []);
    gruppen.get(g).push({ u, i });
  });
  const sortiert = [...gruppen.entries()].map(([g, liste]) => ({
    g,
    liste: liste.sort((a, b) => a.u.intensitaet - b.u.intensitaet || a.i - b.i),
  }));
  sortiert.sort((a, b) =>
    a.liste[0].u.intensitaet - b.liste[0].u.intensitaet || GURT_RANG[a.g] - GURT_RANG[b.g]);
  return sortiert.flatMap((x) => x.liste.map(({ u }) => u));
}

// Ablauf über alle Runden. Einmalige Einträge (Ball-Einstieg) nur zu Beginn.
// Jede zweite Runde läuft rückwärts, damit am Rundenwechsel keine Gurtlänge
// umgestellt werden muss.
export function schrittFolge(session) {
  const einmalig = [];
  const haupt = [];
  session.eintraege.forEach((e, i) => (e.einmalig ? einmalig : haupt).push(i));
  const schritte = einmalig.map((index) => ({ index, runde: 0 }));
  for (let r = 0; r < session.runden; r++) {
    const folge = r % 2 === 0 ? haupt : [...haupt].reverse();
    folge.forEach((index) => schritte.push({ index, runde: r }));
  }
  return schritte;
}

// Zählt Gurtwechsel; Übungen ohne Gurt (Bälle) zählen nicht mit.
export function anzahlGurtwechsel(session) {
  let wechsel = 0;
  let vorher = null;
  for (const s of schrittFolge(session)) {
    const g = session.eintraege[s.index].gurt;
    if (!g || g === 'keiner') continue;
    if (vorher && g !== vorher) wechsel++;
    vorher = g;
  }
  return wechsel;
}

function waehleEinstieg(bibliothek, zustaende, ctx, ausser = []) {
  const { alle } = kandidaten(bibliothek, zustaende, 'baelle', 'mix', 3);
  const pool = alle.filter((u) => !ausser.includes(u.id));
  return waehle(pool.length ? pool : alle, 1, ctx)[0] ?? null;
}

export function erstelleSession({
  bibliothek, zustaende, ziel, dauer, geraet = 'schlinge', ballEinstieg = false,
  jetzt = Date.now(), rng = Math.random,
}) {
  const par = parameterFuer(ziel, dauer, geraet);
  const { alle, bevorzugt } = kandidaten(bibliothek, zustaende, geraet, ziel, par.maxIntensitaet);
  const pool = bevorzugt.length >= par.anzahl ? bevorzugt : alle;
  const ctx = { zustaende, musterZeit: musterZuletzt(bibliothek, zustaende), jetzt, rng };

  const gewaehlt = ordne(waehle(pool, par.anzahl, ctx));
  const eintraege = gewaehlt.map((u) => alsEintrag(u, zustaende));

  if (geraet === 'schlinge' && ballEinstieg) {
    const ball = waehleEinstieg(bibliothek, zustaende, ctx);
    if (ball) eintraege.unshift(alsEintrag(ball, zustaende, true));
  }

  return { geraet, ziel, dauer, runden: par.runden, erstellt: jetzt, eintraege };
}

// Tauscht eine Übung gegen die nächstbeste aus, die noch nicht im Plan ist.
// Gibt null zurück, wenn es keine Alternative gibt.
export function tauscheUebung(session, index, { bibliothek, zustaende, jetzt = Date.now(), rng = Math.random, bereitsGetauscht = [] }) {
  const nachId = new Map(bibliothek.uebungen.map((u) => [u.id, u]));
  const ctx = { zustaende, musterZeit: musterZuletzt(bibliothek, zustaende), jetzt, rng };
  const eintraege = [...session.eintraege];
  const alt = eintraege[index];

  if (alt.einmalig) {
    const u = waehleEinstieg(bibliothek, zustaende, ctx, [alt.id, ...bereitsGetauscht]);
    if (!u || u.id === alt.id) return null;
    eintraege[index] = alsEintrag(u, zustaende, true);
    return { ...session, eintraege };
  }

  const geraet = session.geraet ?? 'schlinge';
  const par = parameterFuer(session.ziel, session.dauer, geraet);
  const { alle } = kandidaten(bibliothek, zustaende, geraet, session.ziel, par.maxIntensitaet);
  const haupt = eintraege.filter((e) => !e.einmalig);
  const andere = haupt.filter((e) => e !== alt).map((e) => nachId.get(e.id));
  const ausgeschlossen = new Set([...eintraege.map((e) => e.id), ...bereitsGetauscht]);
  let pool = alle.filter((u) => !ausgeschlossen.has(u.id));
  if (pool.length === 0) {
    // alle Alternativen schon einmal getauscht → wieder von vorn, nur nicht die aktuellen
    pool = alle.filter((u) => !eintraege.some((e) => e.id === u.id));
  }
  if (pool.length === 0) return null;

  const [u] = waehle(pool, 1, ctx, andere);
  const neuerEintrag = alsEintrag(u, zustaende);
  const neueHaupt = haupt.map((e) => (e === alt ? neuerEintrag : e));
  const geordnet = ordne(neueHaupt.map((e) => nachId.get(e.id)))
    .map((x) => neueHaupt.find((e) => e.id === x.id));
  return { ...session, eintraege: [...eintraege.filter((e) => e.einmalig), ...geordnet] };
}

// Grobe Zeitschätzung in Minuten.
export function schaetzeMinuten(session, bibliothek) {
  const nachId = new Map(bibliothek.uebungen.map((u) => [u.id, u]));
  let sek = 0;
  for (const e of session.eintraege) {
    const u = nachId.get(e.id);
    const seiten = u?.einseitig ? 2 : 1;
    const arbeit = e.einheit === 'sek' ? e.ziel : e.ziel * 3.5;
    const runden = e.einmalig ? 1 : session.runden;
    sek += (arbeit * seiten + 30) * runden; // 30 s Einrichten/Pause je Satz
  }
  return Math.max(1, Math.round(sek / 60));
}
