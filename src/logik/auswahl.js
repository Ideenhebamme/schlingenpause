// Stellt eine Pause zusammen: Ziel + Dauer → 3–5 Übungen in 1–2 Runden.
//
// Abwechslung entsteht über eine Punktzahl je Kandidat:
//   + lange nicht gemacht (bis 72 h)            → bis zu 3 Punkte
//   + nie gemacht                               → +0,5 (neue Übungen kennenlernen)
//   + Bewegungsmuster lange nicht trainiert     → bis zu 2 Punkte (bis 48 h)
//   − Muster schon in dieser Pause              → −5
//   + Zufall                                    → bis zu 1,5 Punkte
// Gewählt wird jeweils der beste Kandidat, danach wird neu gerechnet.

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

const STUNDE = 3600 * 1000;

export function parameterFuer(ziel, dauer) {
  return (ziel === 'mobilitaet' ? DAUER_MOBILITAET : DAUER)[dauer] ?? DAUER.kurz;
}

function kandidaten(bibliothek, zustaende, ziel, maxIntensitaet) {
  const passt = (u) =>
    (ziel === 'mix' || u.ziele.includes(ziel)) && !zustaende?.[u.id]?.gesperrt;
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

function alsEintrag(u, zustaende) {
  const z = zustandFuer(zustaende, u);
  return { id: u.id, ...vorgabe(u, z) };
}

export function erstelleSession({ bibliothek, zustaende, ziel, dauer, jetzt = Date.now(), rng = Math.random }) {
  const par = parameterFuer(ziel, dauer);
  const { alle, bevorzugt } = kandidaten(bibliothek, zustaende, ziel, par.maxIntensitaet);
  const pool = bevorzugt.length >= par.anzahl ? bevorzugt : alle;
  const ctx = { zustaende, musterZeit: musterZuletzt(bibliothek, zustaende), jetzt, rng };

  const gewaehlt = waehle(pool, par.anzahl, ctx)
    // ruhigere Übungen zuerst – wirkt wie ein kurzes Aufwärmen
    .map((u, i) => ({ u, i }))
    .sort((a, b) => a.u.intensitaet - b.u.intensitaet || a.i - b.i)
    .map(({ u }) => u);

  return {
    ziel,
    dauer,
    runden: par.runden,
    erstellt: jetzt,
    eintraege: gewaehlt.map((u) => alsEintrag(u, zustaende)),
  };
}

// Tauscht eine Übung gegen die nächstbeste aus, die noch nicht im Plan ist.
// Gibt null zurück, wenn es keine Alternative gibt.
export function tauscheUebung(session, index, { bibliothek, zustaende, jetzt = Date.now(), rng = Math.random, bereitsGetauscht = [] }) {
  const par = parameterFuer(session.ziel, session.dauer);
  const { alle } = kandidaten(bibliothek, zustaende, session.ziel, par.maxIntensitaet);
  const nachId = new Map(bibliothek.uebungen.map((u) => [u.id, u]));
  const andere = session.eintraege.filter((_, i) => i !== index).map((e) => nachId.get(e.id));
  const ausgeschlossen = new Set([...session.eintraege.map((e) => e.id), ...bereitsGetauscht]);
  let pool = alle.filter((u) => !ausgeschlossen.has(u.id));
  if (pool.length === 0) {
    // alle Alternativen schon einmal getauscht → wieder von vorn, nur nicht die aktuellen
    pool = alle.filter((u) => !session.eintraege.some((e) => e.id === u.id));
  }
  if (pool.length === 0) return null;

  const ctx = { zustaende, musterZeit: musterZuletzt(bibliothek, zustaende), jetzt, rng };
  const [u] = waehle(pool, 1, ctx, andere);
  const eintraege = [...session.eintraege];
  eintraege[index] = alsEintrag(u, zustaende);
  return { ...session, eintraege };
}

// Grobe Zeitschätzung in Minuten.
export function schaetzeMinuten(session, bibliothek) {
  const nachId = new Map(bibliothek.uebungen.map((u) => [u.id, u]));
  let sek = 0;
  for (const e of session.eintraege) {
    const u = nachId.get(e.id);
    const seiten = u?.einseitig ? 2 : 1;
    const arbeit = e.einheit === "sek" ? e.ziel : e.ziel * 3.5;
    sek += (arbeit * seiten + 30) * session.runden; // 30 s Einrichten/Pause je Satz
  }
  return Math.max(1, Math.round(sek / 60));
}
