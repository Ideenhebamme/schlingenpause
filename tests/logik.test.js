import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pruefeBibliothek } from '../src/logik/schema.js';
import { startZustand, wendeRueckmeldungAn, zustandFuer } from '../src/logik/progression.js';
import { erstelleSession, tauscheUebung, schaetzeMinuten } from '../src/logik/auswahl.js';

const bib = JSON.parse(readFileSync(new URL('../src/daten/uebungen.json', import.meta.url)));
const nach = (id) => bib.uebungen.find((u) => u.id === id);
const TAG = 24 * 3600 * 1000;
const t0 = new Date('2026-10-19T09:00:00').getTime();

function rngAus(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

test('Bibliothek ist gültig', () => {
  const r = pruefeBibliothek(bib);
  assert.deepEqual(r.fehler, []);
});

test('passt: +1 Wdh., höchstens einmal pro Tag', () => {
  const u = nach('zug-rudern');
  let z = startZustand(u);
  ({ zustand: z } = wendeRueckmeldungAn(u, z, 'passt', t0));
  assert.equal(z.ziel, 9);
  ({ zustand: z } = wendeRueckmeldungAn(u, z, 'passt', t0 + 3600e3));
  assert.equal(z.ziel, 9, 'am selben Tag keine zweite Steigerung');
  ({ zustand: z } = wendeRueckmeldungAn(u, z, 'passt', t0 + TAG));
  assert.equal(z.ziel, 10);
});

test('passt über max → nächste Stufe bei min', () => {
  const u = nach('zug-rudern');
  let z = { ...startZustand(u), ziel: 12 };
  const r = wendeRueckmeldungAn(u, z, 'passt', t0);
  assert.equal(r.zustand.stufe, 1);
  assert.equal(r.zustand.ziel, 8);
  assert.equal(r.aenderung.art, 'stufe-hoch');
});

test('zu leicht springt eine Stufe, zu schwer geht zurück', () => {
  const u = nach('zug-rudern');
  let z = startZustand(u);
  ({ zustand: z } = wendeRueckmeldungAn(u, z, 'zu-leicht', t0));
  assert.equal(z.stufe, 1);
  ({ zustand: z } = wendeRueckmeldungAn(u, z, 'zu-schwer', t0));
  assert.equal(z.stufe, 0);
  assert.equal(z.ziel, 10);
});

test('zu schwer auf Stufe 1 senkt bis zur Untergrenze', () => {
  const u = nach('mob-brustdehnung');
  let z = startZustand(u);
  for (let i = 0; i < 5; i++) ({ zustand: z } = wendeRueckmeldungAn(u, z, 'zu-schwer', t0));
  assert.equal(z.ziel, 10);
});

test('Zustand bleibt gültig, wenn die Bibliothek weniger Stufen hat', () => {
  const u = nach('mob-rotation');
  const z = zustandFuer({ 'mob-rotation': { stufe: 7, ziel: 99 } }, u);
  assert.equal(z.stufe, 1);
  assert.equal(z.ziel, 10);
});

test('Session: richtige Anzahl, kein Muster doppelt, passt zum Ziel', () => {
  for (let seed = 1; seed < 50; seed++) {
    const s = erstelleSession({ bibliothek: bib, zustaende: {}, ziel: 'kraft', dauer: 'kurz', jetzt: t0, rng: rngAus(seed) });
    assert.equal(s.eintraege.length, 3);
    const muster = s.eintraege.map((e) => nach(e.id).muster);
    assert.equal(new Set(muster).size, 3, `Muster doppelt bei seed ${seed}: ${muster}`);
    assert.ok(s.eintraege.every((e) => nach(e.id).ziele.includes('kraft')));
  }
});

test('Session bevorzugt Übungen, die lange nicht dran waren', () => {
  const zustaende = {};
  for (const u of bib.uebungen) zustaende[u.id] = { ...startZustand(u), zuletzt: t0 - 3600e3 };
  zustaende['druck-brustpresse'].zuletzt = t0 - 5 * TAG;
  let treffer = 0;
  for (let seed = 1; seed < 30; seed++) {
    const s = erstelleSession({ bibliothek: bib, zustaende, ziel: 'kraft', dauer: 'kurz', jetzt: t0, rng: rngAus(seed) });
    if (s.eintraege.some((e) => e.id === 'druck-brustpresse')) treffer++;
  }
  assert.ok(treffer >= 27, `nur ${treffer}/29`);
});

test('Gesperrte Übungen werden nicht vorgeschlagen', () => {
  const zustaende = { 'zug-rudern': { ...startZustand(nach('zug-rudern')), gesperrt: true } };
  for (let seed = 1; seed < 30; seed++) {
    const s = erstelleSession({ bibliothek: bib, zustaende, ziel: 'haltung', dauer: 'lang', jetzt: t0, rng: rngAus(seed) });
    assert.ok(!s.eintraege.some((e) => e.id === 'zug-rudern'));
  }
});

test('Tauschen ersetzt eine Übung durch eine neue', () => {
  const s = erstelleSession({ bibliothek: bib, zustaende: {}, ziel: 'mix', dauer: 'lang', jetzt: t0, rng: rngAus(3) });
  const neu = tauscheUebung(s, 1, { bibliothek: bib, zustaende: {}, jetzt: t0, rng: rngAus(4) });
  assert.notEqual(neu.eintraege[1].id, s.eintraege[1].id);
  assert.equal(new Set(neu.eintraege.map((e) => e.id)).size, neu.eintraege.length);
});

test('Zeitschätzung liegt im erwarteten Rahmen', () => {
  const kurz = erstelleSession({ bibliothek: bib, zustaende: {}, ziel: 'kraft', dauer: 'kurz', jetzt: t0, rng: rngAus(1) });
  const lang = erstelleSession({ bibliothek: bib, zustaende: {}, ziel: 'kraft', dauer: 'lang', jetzt: t0, rng: rngAus(1) });
  const mk = schaetzeMinuten(kurz, bib);
  const ml = schaetzeMinuten(lang, bib);
  assert.ok(mk >= 2 && mk <= 5, `kurz: ${mk}`);
  assert.ok(ml >= 6 && ml <= 12, `lang: ${ml}`);
});
