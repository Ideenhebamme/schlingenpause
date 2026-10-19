// Erzeugt die Übungs-Piktogramme (SVG) aus den Posen in src/daten/uebungen.json.
// Aufruf: npm run bilder   → schreibt public/bilder/<id>.svg
//
// Posen werden über Gelenkwinkel beschrieben (Grad):
//
// Seitenansicht (ansicht: "seite")
//   b   Blickrichtung: -1 = nach links (zum Anker), 1 = nach rechts (vom Anker weg)
//   x   x-Position des Knöchels von Bein 1 (Anker steht bei x = 0)
//   r   Rumpfneigung ab senkrecht oben, + = nach vorn
//   a1  Arm [Oberarm, Unterarm] ab senkrecht unten, + = nach vorn;
//       "anker" = gestreckt Richtung Anker; {rel: n} = relativ zum vorigen Segment
//   a2  zweiter (hinterer) Arm, hell gezeichnet – optional
//   l1  Bein [Oberschenkel, Unterschenkel], l2 hinteres Bein – optional
//   z1/z2  Zehenstand, f1 Fußspitze hoch (Ferse am Boden)
//   boden  1 = nur Bein 1 steht am Boden; hoch = Sprung (cm über Boden)
//
// Frontansicht (ansicht: "front")
//   x   Hüftmitte (Panelmitte = 0), n Seitneigung Rumpf (+ = nach rechts)
//   al/ar  Arme, ll/lr Beine: Winkel ab senkrecht unten, + = nach außen
//   Segmente können [winkel, faktor] sein (Verkürzung, z. B. Arm zeigt zum Betrachter)
//   griff [dx, dy]  beide Hände gestreckt an einem Punkt relativ zur Schultermitte
//
// bild.gurt: "zwei" | "einer" (beide Hände an einem Griff) | "links" | "rechts" | "arm1"

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const L = { kopf: 11, hals: 5, rumpf: 52, oberarm: 30, unterarm: 33, ober: 46, unter: 46, fuss: 15, knoechel: 6, schulter: 19, huefte: 9 };
const ANKER_Y = 212;
const FARBE = { koerper: '#1B1F23', hinten: '#9AA0A6', gurt: '#6C8538', boden: '#C9C6BC', saeule: '#D8D5CC', text: '#8A8F96' };
const rad = (g) => (g * Math.PI) / 180;

function segWinkel(spec) {
  if (Array.isArray(spec)) return { w: spec[0], k: spec[1] ?? 1 };
  return { w: spec, k: 1 };
}

// ---------- Seitenansicht ----------
function seitePose(p) {
  const b = p.b ?? -1;
  const runter = (w, len) => [b * Math.sin(rad(w)) * len, -Math.cos(rad(w)) * len];
  const plus = (a, v) => [a[0] + v[0], a[1] + v[1]];

  const H = [0, 0];
  const r = p.r ?? 0;
  const S = plus(H, [b * Math.sin(rad(r)) * L.rumpf, Math.cos(rad(r)) * L.rumpf]);
  const kopfR = L.hals + L.kopf;
  const K = plus(S, [b * Math.sin(rad(r)) * kopfR, Math.cos(rad(r)) * kopfR]);

  const bein = (spec, zehen, fussHoch) => {
    if (!spec) return null;
    const o = segWinkel(spec[0]), u = segWinkel(spec[1]);
    const knie = plus(H, runter(o.w, L.ober * o.k));
    const kn = plus(knie, runter(u.w, L.unter * u.k));
    let fuss;
    if (zehen) fuss = plus(kn, [b * 12, -L.knoechel - 4]);
    else if (fussHoch) fuss = plus(kn, [b * 10, 8]);
    else fuss = plus(kn, [b * L.fuss, -2]);
    return { knie, kn, fuss, zehen };
  };
  const b1 = bein(p.l1 ?? [0, 0], p.z1, p.f1);
  const b2 = bein(p.l2, p.z2, p.f2);

  // Boden: Knöchel auf Knöchelhöhe (bzw. Zehen am Boden)
  const tiefster = (bb) => (bb.zehen ? bb.fuss[1] : bb.kn[1] - L.knoechel);
  let boden = tiefster(b1);
  if (b2 && p.boden !== 1) boden = Math.min(boden, tiefster(b2));
  const dy = -boden + (p.hoch ?? 0);
  const dx = (p.x ?? 80) - b1.kn[0];
  const T = (pt) => (pt ? [pt[0] + dx, pt[1] + dy] : pt);

  const anker = [0, ANKER_Y];
  const arm = (spec, Sw) => {
    if (!spec) return null;
    const zumAnker = Math.atan2(anker[0] - Sw[0], -(anker[1] - Sw[1])); // Winkel ab unten (Bildschirm-x)
    const wAnker = (zumAnker * 180) / Math.PI * b; // in Blickkoordinaten
    let vorher = 0;
    const w = (s) => {
      if (s === 'anker') return (vorher = wAnker);
      if (s && typeof s === 'object' && !Array.isArray(s)) return (vorher = vorher + s.rel);
      const { w: ww } = segWinkel(s);
      return (vorher = ww);
    };
    const k = (s) => (Array.isArray(s) ? s[1] ?? 1 : 1);
    const spec2 = spec === 'anker' ? ['anker', 'anker'] : spec;
    const w1 = w(spec2[0]);
    const E = plus(Sw, runter(w1, L.oberarm * k(spec2[0])));
    const w2 = w(spec2[1]);
    const Hd = plus(E, runter(w2, L.unterarm * k(spec2[1])));
    return { E, Hd };
  };
  const Sw = T(S);
  return {
    H: T(H), S: Sw, K: T(K),
    beine: [b1, b2].map((bb) => bb && { knie: T(bb.knie), kn: T(bb.kn), fuss: T(bb.fuss) }),
    arme: [arm(p.a1 ?? [0, 0], Sw), arm(p.a2, Sw)],
    schultern: [Sw],
    hueften: [T(H)],
    anker,
  };
}

// ---------- Frontansicht ----------
function frontPose(p, ankerX) {
  const plus = (a, v) => [a[0] + v[0], a[1] + v[1]];
  const n = p.n ?? 0;
  const auf = [Math.sin(rad(n)), Math.cos(rad(n))];
  const quer = [Math.cos(rad(n)), -Math.sin(rad(n))];
  const H = [0, 0];
  const S = plus(H, [auf[0] * L.rumpf, auf[1] * L.rumpf]);
  const K = plus(S, [auf[0] * (L.hals + L.kopf), auf[1] * (L.hals + L.kopf)]);
  const seite = (mitte, breite, s) => plus(mitte, [quer[0] * breite * s, quer[1] * breite * s]);
  const hL = seite(H, L.huefte, -1), hR = seite(H, L.huefte, 1);
  const sL = seite(S, L.schulter, -1), sR = seite(S, L.schulter, 1);

  const glied = (start, spec, s, l1, l2) => {
    const a = segWinkel(spec[0]), c = segWinkel(spec[1]);
    const v = (w, len) => [s * Math.sin(rad(w)) * len, -Math.cos(rad(w)) * len];
    const m = plus(start, v(a.w, l1 * a.k));
    const e = plus(m, v(c.w, l2 * c.k));
    return { m, e };
  };
  const bL = glied(hL, p.ll ?? [4, 4], -1, L.ober, L.unter);
  const bR = glied(hR, p.lr ?? [4, 4], 1, L.ober, L.unter);
  // Arm "anker": beide Hände treffen sich am gemeinsamen Griff Richtung Anker
  const griff = (() => {
    const ziel = [ankerX - (p.x ?? 0), ANKER_Y - (p.hoehe ?? 92)];
    const d = [ziel[0] - S[0], ziel[1] - S[1]];
    const len = Math.hypot(d[0], d[1]);
    return [S[0] + (d[0] / len) * 58, S[1] + (d[1] / len) * 58];
  })();
  const zumGriff = (start) => ({ m: [(start[0] + griff[0]) / 2, (start[1] + griff[1]) / 2], e: griff });
  // griff: [dx, dy] relativ zur Schultermitte – beide Hände gestreckt an einem Punkt
  const amGriff = (start) => {
    const g = [S[0] + p.griff[0], S[1] + p.griff[1]];
    return { m: [(start[0] + g[0]) / 2, (start[1] + g[1]) / 2], e: g };
  };
  const aL = p.griff ? amGriff(sL) : p.al === 'anker' ? zumGriff(sL) : glied(sL, p.al ?? [8, 8], -1, L.oberarm, L.unterarm);
  const aR = p.griff ? amGriff(sR) : p.ar === 'anker' ? zumGriff(sR) : glied(sR, p.ar ?? [8, 8], 1, L.oberarm, L.unterarm);

  const boden = Math.min(bL.e[1], bR.e[1]) - L.knoechel;
  const dy = -boden + (p.hoch ?? 0);
  const dx = (p.x ?? 0) - 0;
  const T = (pt) => [pt[0] + dx, pt[1] + dy];
  const fuss = (kn, s) => [kn[0] + s * 9, kn[1] - L.knoechel];
  return {
    H: T(H), S: T(S), K: T(K),
    hueften: [T(hL), T(hR)], schultern: [T(sL), T(sR)],
    beine: [
      { knie: T(bL.m), kn: T(bL.e), fuss: T(fuss(bL.e, -1)) },
      { knie: T(bR.m), kn: T(bR.e), fuss: T(fuss(bR.e, 1)) },
    ],
    arme: [{ E: T(aL.m), Hd: T(aL.e), S: T(sL) }, { E: T(aR.m), Hd: T(aR.e), S: T(sR) }],
    anker: [ankerX, ANKER_Y],
  };
}

// ---------- Zeichnen ----------
const f = (v) => Math.round(v * 10) / 10;
const pt = (p) => `${f(p[0])},${f(-p[1])}`;
const linie = (pts, farbe, breite) =>
  `<polyline points="${pts.map(pt).join(' ')}" fill="none" stroke="${farbe}" stroke-width="${breite}" stroke-linecap="round" stroke-linejoin="round"/>`;

function zeichnePanel(fig, bild, ansicht, ox, nummer) {
  const out = [];
  const [ax, ay] = fig.anker;
  // Säule + Boden
  out.push(`<line x1="${ax}" y1="${-ay}" x2="${ax}" y2="${-240}" stroke="${FARBE.saeule}" stroke-width="7" stroke-linecap="round"/>`);
  const bx0 = ansicht === 'front' ? -105 : -25, bx1 = ansicht === 'front' ? 105 : 185;
  out.push(`<line x1="${bx0}" y1="0" x2="${bx1}" y2="0" stroke="${FARBE.boden}" stroke-width="3" stroke-linecap="round"/>`);

  const dick = 7.5;
  const zeichneArm = (a, farbe, S) => a && linie([S, a.E, a.Hd], farbe, dick - 1);
  const zeichneBein = (bb, farbe, H) => bb && linie([H, bb.knie, bb.kn, bb.fuss], farbe, dick);

  if (ansicht === 'seite') {
    // hinteres Bein/Arm zuerst, hell
    out.push(zeichneBein(fig.beine[1], FARBE.hinten, fig.H) ?? '');
    out.push(zeichneArm(fig.arme[1], FARBE.hinten, fig.S) ?? '');
  }

  // Gurt
  const haende = fig.arme.filter(Boolean).map((a) => a.Hd);
  let ziele = [];
  const g = bild.gurt ?? 'zwei';
  if (g === 'zwei') ziele = ansicht === 'seite' ? [fig.arme[0].Hd] : haende;
  else if (g === 'arm1' || g === 'links') ziele = [fig.arme[0].Hd];
  else if (g === 'rechts') ziele = [fig.arme[1].Hd];
  else if (g === 'einer') ziele = [[(haende[0][0] + (haende[1] ?? haende[0])[0]) / 2, (haende[0][1] + (haende[1] ?? haende[0])[1]) / 2]];
  if (g !== 'keiner') {
    if (ziele.length === 2) {
      // Y-Gurt: gemeinsamer Strang bis zur Gabelung
      const mitte = [(ziele[0][0] + ziele[1][0]) / 2, (ziele[0][1] + ziele[1][1]) / 2];
      const gabel = [ax + (mitte[0] - ax) * 0.45, ay + (mitte[1] - ay) * 0.45];
      out.push(linie([fig.anker, gabel], FARBE.gurt, 3.5));
      ziele.forEach((z) => out.push(linie([gabel, z], FARBE.gurt, 3)));
    } else {
      ziele.forEach((z) => out.push(linie([fig.anker, z], FARBE.gurt, 3.5)));
    }
  }
  out.push(`<circle cx="${ax}" cy="${-ay}" r="5" fill="${FARBE.gurt}"/>`);

  // Körper
  if (ansicht === 'seite') {
    out.push(zeichneBein(fig.beine[0], FARBE.koerper, fig.H));
    out.push(linie([fig.H, fig.S], FARBE.koerper, dick + 1.5));
    out.push(zeichneArm(fig.arme[0], FARBE.koerper, fig.S));
  } else {
    out.push(zeichneBein(fig.beine[0], FARBE.koerper, fig.hueften[0]));
    out.push(zeichneBein(fig.beine[1], FARBE.koerper, fig.hueften[1]));
    out.push(linie([fig.hueften[0], fig.hueften[1]], FARBE.koerper, dick));
    out.push(linie([[(fig.hueften[0][0] + fig.hueften[1][0]) / 2, (fig.hueften[0][1] + fig.hueften[1][1]) / 2], fig.S], FARBE.koerper, dick + 1.5));
    out.push(linie([fig.schultern[0], fig.schultern[1]], FARBE.koerper, dick));
    out.push(zeichneArm(fig.arme[0], FARBE.koerper, fig.schultern[0]));
    out.push(zeichneArm(fig.arme[1], FARBE.koerper, fig.schultern[1]));
  }
  // Griffe
  ziele.forEach((z) => out.push(`<circle cx="${f(z[0])}" cy="${f(-z[1])}" r="3.6" fill="${FARBE.gurt}"/>`));
  out.push(`<circle cx="${f(fig.K[0])}" cy="${f(-fig.K[1])}" r="${L.kopf}" fill="${FARBE.koerper}"/>`);

  const tx = ansicht === 'front' ? 95 : 175;
  out.push(`<text x="${tx}" y="-222" text-anchor="end" font-family="-apple-system,system-ui,sans-serif" font-size="18" font-weight="600" fill="${FARBE.text}">${nummer}</text>`);
  return `<g transform="translate(${ox},0)">${out.join('')}</g>`;
}

export function renderBild(bild) {
  const ansicht = bild.ansicht ?? 'seite';
  const breite = ansicht === 'front' ? 220 : 220;
  const links = ansicht === 'front' ? -110 : -30;
  const figuren = bild.posen.map((p) =>
    ansicht === 'front' ? frontPose(p, bild.anker_x ?? 0) : seitePose(p));
  const abstand = 24;
  const panels = figuren.map((fig, i) => zeichnePanel(fig, bild, ansicht, i * (breite + abstand), i + 1));
  const gesamt = figuren.length * breite + (figuren.length - 1) * abstand;
  // Pfeil zwischen den Panels
  const pfeile = figuren.slice(1).map((_, i) => {
    const x = links + (i + 1) * breite + i * abstand + abstand / 2;
    return `<path d="M ${x - 6} -120 L ${x + 4} -110 L ${x - 6} -100" fill="none" stroke="${FARBE.text}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${links} -248 ${gesamt} 256" role="img">${panels.join('')}${pfeile.join('')}</svg>`;
}

// ---------- CLI ----------
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
  const bib = JSON.parse(readFileSync(join(wurzel, 'src/daten/uebungen.json'), 'utf8'));
  const ziel = join(wurzel, 'public/bilder');
  mkdirSync(ziel, { recursive: true });
  let n = 0;
  for (const u of bib.uebungen) {
    if (!u.bild) continue;
    writeFileSync(join(ziel, `${u.id}.svg`), renderBild(u.bild));
    n++;
  }
  console.log(`${n} Piktogramme geschrieben → public/bilder/`);
}
