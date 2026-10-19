import './style.css';
import bibliothek from './daten/uebungen.json';
import { pruefeBibliothek } from './logik/schema.js';
import { erstelleSession, tauscheUebung, schaetzeMinuten, schrittFolge, anzahlGurtwechsel, gurtVon } from './logik/auswahl.js';
import { zustandFuer, wendeRueckmeldungAn, formatVorgabe, setzeStufe, startZustand, vorgabe } from './logik/progression.js';
import { laden, speichern, leererZustand, alsBackupText, ausBackupText, speicherVerfuegbar } from './logik/speicher.js';
import { h, knopf } from './ui/dom.js';
import { tonVorbereiten, piep, piepEnde, wachHalten } from './ui/geraet.js';

const VERSION = '0.3.0';

function piktogramm(u) {
  if (!u.bild) return null;
  return h('img', {
    class: 'piktogramm',
    src: `${import.meta.env.BASE_URL}bilder/${u.id}.svg`,
    alt: `Piktogramm ${u.titel}: links Startposition, rechts Endposition`,
    width: '464', height: '256', loading: 'lazy', decoding: 'async',
  });
}

function vorsichtHinweis(u) {
  return u.vorsicht ? h('div', { class: 'vorsicht' }, h('p', { class: 'label' }, 'Vorsichtig testen'), h('p', {}, u.vorsicht)) : null;
}

const pruefung = pruefeBibliothek(bibliothek);
if (!pruefung.ok) console.error('Übungsbibliothek fehlerhaft:', pruefung.fehler);

const nachId = new Map(bibliothek.uebungen.map((u) => [u.id, u]));
let zustand = laden();
const app = document.getElementById('app');

const ZIELE = {
  kraft:      { name: 'Kraft',            text: 'Zug, Druck, Beine, Rumpf',        klasse: 'z-kraft' },
  haltung:    { name: 'Haltung & Rücken', text: 'Oberer Rücken, Schulterblätter',  klasse: 'z-haltung' },
  mobilitaet: { name: 'Mobilität',        text: 'Dehnen, Hüfte, Brustwirbelsäule', klasse: 'z-mobilitaet' },
  mix:        { name: 'Überrasch mich',   text: 'Querbeet aus allem',              klasse: 'z-mix' },
};
const MUSTER = {
  zug: 'Zug', druck: 'Druck', beine: 'Beine', rumpf: 'Rumpf',
  schulter: 'Schulter', huefte: 'Hüfte', wirbelsaeule: 'Wirbelsäule',
};
const DAUER_LABEL = { kurz: 'kurz', lang: 'länger' };
const GURT_LABEL = { kurz: 'kurz', mittel: 'mittel', lang: 'lang' };

function sichern() {
  speichern(zustand);
}

function zeige(...kinder) {
  app.replaceChildren(...kinder);
  window.scrollTo(0, 0);
}

// ---------- Hilfen ----------

function relativeZeit(ms) {
  if (!ms) return 'noch nie';
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 2) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  const tage = Math.round(std / 24);
  return tage === 1 ? 'gestern' : `vor ${tage} Tagen`;
}

function uhrzeit(ms) {
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function tagLabel(ms) {
  return new Date(ms).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function istHeute(ms) {
  return new Date(ms).toDateString() === new Date().toDateString();
}

function kopf({ titel, zurueck, rechts }) {
  return h('header', { class: 'kopf' },
    zurueck ? knopf('‹ Zurück', zurueck, 'kopf-zurueck') : h('span'),
    titel ? h('h1', { class: 'kopf-titel' }, titel) : h('span'),
    rechts ?? h('span'),
  );
}

function aktionsleiste(...kinder) {
  return h('div', { class: 'aktionsleiste' }, ...kinder);
}

// ---------- Erststart: Sicherheitshinweis ----------

function sicherheitsText() {
  return [
    h('h3', {}, 'Befestigung'),
    h('p', {}, 'Den Gurt um die Mittelsäule der Treppe legen, direkt oberhalb einer Stufenhalterung auf etwa 2–2,2 m Höhe, damit er nicht abrutschen kann. Nicht am Handlauf oder an den Drahtseilen befestigen.'),
    h('p', {}, 'Vor der ersten Nutzung mit kräftigem Zug in alle Übungsrichtungen prüfen, ob Säule und Gurt sicher halten. Den Gurt regelmäßig auf Abrieb kontrollieren.'),
    h('h3', {}, 'Platz'),
    h('p', {}, 'Vor dem Anker etwa 2–2,5 m freien Boden einplanen. Rutschfeste Schuhe oder barfuß – nicht in Socken auf glattem Boden.'),
    h('h3', {}, 'Körper'),
    h('p', {}, 'Die Übungen sind Vorschläge, keine medizinische oder therapeutische Anleitung. Die eigene Körperwahrnehmung hat Vorrang. Bei Schmerzen, Schwindel oder Unwohlsein abbrechen.'),
  ];
}

function zeigeHinweis() {
  zeige(
    h('section', { class: 'seite' },
      h('h1', { class: 'titel-gross' }, 'Bevor es losgeht'),
      h('div', { class: 'prosa' }, sicherheitsText()),
    ),
    aktionsleiste(knopf('Verstanden', () => {
      zustand.hinweisGelesen = true;
      sichern();
      zeigeStart();
    }, 'btn btn-primaer')),
  );
}

// ---------- Start ----------

function zeigeStart() {
  const heute = zustand.sessions.filter((s) => istHeute(s.start));
  const letzte = zustand.sessions.at(-1);
  const dauer = zustand.einstellungen.dauer === 'lang' ? 'lang' : 'kurz';

  const statusText = heute.length === 0
    ? (letzte ? `Heute noch keine Pause · zuletzt ${relativeZeit(letzte.start)}` : 'Noch keine Pause gemacht')
    : `Heute ${heute.length} ${heute.length === 1 ? 'Pause' : 'Pausen'} · zuletzt ${uhrzeit(letzte.start)} ${ZIELE[letzte.ziel]?.name ?? ''}`;

  const dauerKnopf = (wert, titel, info) => h('button', {
    type: 'button',
    class: `segment${dauer === wert ? ' ist-aktiv' : ''}`,
    'aria-pressed': dauer === wert ? 'true' : 'false',
    onclick: () => { zustand.einstellungen.dauer = wert; sichern(); zeigeStart(); },
  }, h('span', { class: 'segment-titel' }, titel), h('span', { class: 'segment-info' }, info));

  const zielKachel = (key) => {
    const z = ZIELE[key];
    return h('button', {
      type: 'button',
      class: `kachel ${z.klasse}`,
      onclick: () => zeigePlan(erstelleSession({ bibliothek, zustaende: zustand.uebungen, ziel: key, dauer })),
    }, h('span', { class: 'kachel-name' }, z.name), h('span', { class: 'kachel-text' }, z.text));
  };

  zeige(
    h('section', { class: 'seite start' },
      h('p', { class: 'marke' }, 'Schlingenpause'),
      h('h1', { class: 'titel-gross' }, 'Zeit für eine Pause'),
      h('p', { class: 'leise' }, statusText),

      bibliothek.platzhalter
        ? h('p', { class: 'banner' }, `Testbetrieb mit ${bibliothek.uebungen.length} Platzhalter-Übungen – die vollständige Bibliothek folgt.`)
        : null,
      !speicherVerfuegbar()
        ? h('p', { class: 'banner banner-warnung' }, 'Speichern ist gerade nicht möglich – der Trainingsstand geht beim Schließen verloren.')
        : null,

      h('h2', { class: 'abschnitt' }, 'Dauer'),
      h('div', { class: 'segmente', role: 'group', 'aria-label': 'Dauer' },
        dauerKnopf('kurz', 'Kurz', 'ca. 3–5 Min'),
        dauerKnopf('lang', 'Länger', 'ca. 7–10 Min'),
      ),

      h('h2', { class: 'abschnitt' }, 'Worauf hast du Lust?'),
      h('div', { class: 'kacheln' }, ['haltung', 'kraft', 'mobilitaet', 'mix'].map(zielKachel)),
    ),
    h('nav', { class: 'fussnav', 'aria-label': 'Weitere Bereiche' },
      knopf('Übungen', () => zeigeBibliothek(), 'fussnav-link'),
      knopf('Verlauf', () => zeigeVerlauf(), 'fussnav-link'),
      knopf('Einstellungen', () => zeigeEinstellungen(), 'fussnav-link'),
    ),
  );
}

// ---------- Plan (Vorschau) ----------

function zeigePlan(session, getauscht = []) {
  const minuten = schaetzeMinuten(session, bibliothek);
  const z = ZIELE[session.ziel];

  const karte = (e, i) => {
    const u = nachId.get(e.id);
    return h('li', { class: 'plan-karte' },
      h('div', { class: 'plan-nr', 'aria-hidden': 'true' }, String(i + 1)),
      h('div', { class: 'plan-inhalt' },
        h('p', { class: 'plan-titel' }, u.titel, h('span', { class: `gurt-pill gurt-${e.gurt ?? gurtVon(u)}` }, `Gurt ${GURT_LABEL[e.gurt ?? gurtVon(u)]}`)),
        h('p', { class: 'plan-vorgabe' }, `Stufe ${e.stufeIndex + 1}/${e.anzahlStufen} · ${formatVorgabe(e.einheit, e.ziel, u.einseitig)}`),
        h('p', { class: 'plan-aufbau' }, u.aufbau.split('.')[0] + '.'),
      ),
      knopf('Tauschen', () => {
        const neu = tauscheUebung(session, i, { bibliothek, zustaende: zustand.uebungen, bereitsGetauscht: getauscht });
        if (neu) zeigePlan(neu, [...getauscht, e.id]);
      }, 'btn-klein'),
    );
  };

  zeige(
    kopf({ zurueck: zeigeStart }),
    h('section', { class: 'seite' },
      h('p', { class: `ziel-tag ${z.klasse}` }, `${z.name} · ${DAUER_LABEL[session.dauer]}`),
      h('h1', { class: 'titel-gross' }, `ca. ${minuten} Min`),
      h('p', { class: 'leise' },
        `${session.eintraege.length} Übungen · ${session.runden} ${session.runden === 1 ? 'Runde' : 'Runden'}`),
      h('p', { class: 'leise' }, gurtZusammenfassung(session)),
      h('ol', { class: 'plan-liste' }, session.eintraege.map(karte)),
    ),
    aktionsleiste(knopf('Los geht’s', () => {
      tonVorbereiten();
      starteDurchlauf(session);
    }, 'btn btn-primaer')),
  );
}

function gurtZusammenfassung(session) {
  const start = session.eintraege[0]?.gurt ?? 'mittel';
  const n = anzahlGurtwechsel(session);
  if (n === 0) return `Gurte die ganze Zeit auf „${GURT_LABEL[start]}“`;
  return `Start mit Gurten auf „${GURT_LABEL[start]}“ · ${n}× umstellen`;
}

// ---------- Durchlauf ----------

let lauf = null;
let timer = null;

function starteDurchlauf(session) {
  const schritte = schrittFolge(session);
  lauf = { session, schritte, pos: 0, start: Date.now(), ergebnisse: [] };
  wachHalten(true);
  zeigeSchritt();
}

function stoppeTimer() {
  if (timer) { clearInterval(timer.id); timer = null; }
}

function beendeDurchlauf(abgebrochen = false) {
  stoppeTimer();
  wachHalten(false);
  const l = lauf;
  lauf = null;
  if (!l) return zeigeStart();
  if (l.ergebnisse.length > 0) {
    zustand.sessions.push({
      start: l.start,
      ende: Date.now(),
      ziel: l.session.ziel,
      dauer: l.session.dauer,
      runden: l.session.runden,
      abgebrochen,
      eintraege: l.ergebnisse.map(({ id, stufeIndex, einheit, ziel, rueckmeldung }) => ({ id, stufeIndex, einheit, ziel, rueckmeldung })),
    });
    sichern();
  }
  if (abgebrochen) zeigeStart();
  else zeigeFertig(l);
}

function weiter() {
  stoppeTimer();
  lauf.pos += 1;
  if (lauf.pos >= lauf.schritte.length) beendeDurchlauf(false);
  else zeigeSchritt();
}

function istLetzteRundeFuer(index) {
  const spaeter = lauf.schritte.slice(lauf.pos + 1);
  return !spaeter.some((s) => s.index === index);
}

function rueckmelden(eintrag, u, rueckmeldung) {
  const z = zustandFuer(zustand.uebungen, u);
  const { zustand: neu, aenderung } = wendeRueckmeldungAn(u, z, rueckmeldung, Date.now());
  zustand.uebungen[u.id] = neu;
  sichern();
  lauf.ergebnisse.push({ ...eintrag, rueckmeldung, aenderung });
  weiter();
}

function zeigeSchritt() {
  const schritt = lauf.schritte[lauf.pos];
  const eintrag = lauf.session.eintraege[schritt.index];
  const u = nachId.get(eintrag.id);
  const letzteRunde = istLetzteRundeFuer(schritt.index);
  const fortschritt = (lauf.pos + 1) / lauf.schritte.length;

  const fortschrittBalken = h('div', { class: 'fortschritt', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(lauf.schritte.length), 'aria-valuenow': String(lauf.pos + 1) },
    h('div', { class: 'fortschritt-fuellung' }));
  fortschrittBalken.firstChild.style.width = `${fortschritt * 100}%`;

  const bereich = eintrag.einheit === 'sek' ? halteTimer(eintrag, u) : null;

  const gurt = eintrag.gurt ?? gurtVon(u);
  const vorher = lauf.pos > 0 ? lauf.session.eintraege[lauf.schritte[lauf.pos - 1].index] : null;
  const gurtVorher = vorher ? (vorher.gurt ?? gurtVon(nachId.get(vorher.id))) : null;
  const gurtHinweis = gurtVorher === null
    ? h('div', { class: 'gurt-hinweis' }, `Gurte auf „${GURT_LABEL[gurt]}“ einstellen`)
    : gurt !== gurtVorher
      ? h('div', { class: 'gurt-hinweis gurt-wechsel' }, `Jetzt umstellen: Gurte auf „${GURT_LABEL[gurt]}“`)
      : null;

  const unten = letzteRunde
    ? aktionsleiste(
        h('p', { class: 'frage' }, 'Wie war’s?'),
        h('div', { class: 'feedback' },
          knopf('zu leicht', () => rueckmelden(eintrag, u, 'zu-leicht'), 'btn btn-feedback'),
          knopf('passt', () => rueckmelden(eintrag, u, 'passt'), 'btn btn-feedback btn-primaer'),
          knopf('zu schwer', () => rueckmelden(eintrag, u, 'zu-schwer'), 'btn btn-feedback'),
        ),
      )
    : aktionsleiste(knopf('Weiter', weiter, 'btn btn-primaer'));

  zeige(
    h('header', { class: 'kopf' },
      knopf('Beenden', () => beendeDurchlauf(true), 'kopf-zurueck'),
      h('span', { class: 'kopf-zaehler' }, `${lauf.pos + 1} / ${lauf.schritte.length}`),
      knopf('Überspringen', weiter, 'kopf-rechts'),
    ),
    fortschrittBalken,
    h('section', { class: 'seite uebung' },
      lauf.session.runden > 1
        ? h('p', { class: 'leise' }, `Runde ${schritt.runde + 1} von ${lauf.session.runden}`)
        : null,
      gurtHinweis,
      h('h1', { class: 'titel-gross' }, u.titel),
      h('p', { class: 'vorgabe' }, formatVorgabe(eintrag.einheit, eintrag.ziel, u.einseitig)),
      h('p', { class: 'stufe' }, `Stufe ${eintrag.stufeIndex + 1} von ${eintrag.anzahlStufen}`),
      piktogramm(u),
      vorsichtHinweis(u),

      h('div', { class: 'position' },
        h('p', { class: 'label' }, 'Position'),
        h('p', {}, eintrag.hinweis),
      ),
      bereich,
      h('div', { class: 'block' },
        h('p', { class: 'label' }, 'Aufbau'),
        h('p', {}, u.aufbau),
      ),
      h('div', { class: 'block' },
        h('p', { class: 'label' }, 'Ablauf'),
        h('ol', { class: 'ablauf' }, u.ablauf.map((s) => h('li', {}, s))),
      ),
      h('div', { class: 'block' },
        h('p', { class: 'label' }, 'Achte auf'),
        h('p', {}, u.achte_auf),
      ),
      h('details', { class: 'warum' },
        h('summary', {}, 'Warum diese Übung?'),
        h('p', {}, u.warum),
      ),
    ),
    unten,
  );
}

// Countdown für Halteübungen: 5 s Vorlauf, dann Haltezeit, bei einseitigen
// Übungen danach Seitenwechsel.
function halteTimer(eintrag, u) {
  const VORLAUF = 5;
  const seiten = u.einseitig ? 2 : 1;
  let seite = 1;

  const anzeige = h('p', { class: 'timer-zahl' }, formatSek(eintrag.ziel));
  const status = h('p', { class: 'timer-status' }, u.einseitig ? 'Seite 1' : 'Bereit');
  const start = knopf('Timer starten', () => los(), 'btn btn-timer');
  const box = h('div', { class: 'timer' }, status, anzeige, start);

  function los() {
    tonVorbereiten();
    stoppeTimer();
    start.hidden = true;
    box.classList.add('laeuft');
    let phase = 'vorlauf';
    let ende = Date.now() + VORLAUF * 1000;
    let zuletzt = null;
    status.textContent = 'In Position gehen …';

    const tick = () => {
      const rest = Math.max(0, Math.ceil((ende - Date.now()) / 1000));
      if (rest !== zuletzt) {
        zuletzt = rest;
        anzeige.textContent = phase === 'vorlauf' ? String(rest) : formatSek(rest);
        if (zustand.einstellungen.ton && phase === 'vorlauf' && rest > 0 && rest <= 3) piep({ frequenz: 660, dauer: 0.12 });
      }
      if (rest > 0) return;
      if (phase === 'vorlauf') {
        phase = 'halten';
        ende = Date.now() + eintrag.ziel * 1000;
        zuletzt = null;
        status.textContent = u.einseitig ? `Seite ${seite} – halten` : 'Halten';
        if (zustand.einstellungen.ton) piep({ frequenz: 990, dauer: 0.2 });
        return;
      }
      stoppeTimer();
      box.classList.remove('laeuft');
      if (zustand.einstellungen.ton) piepEnde();
      if (seite < seiten) {
        seite += 1;
        status.textContent = `Seite ${seite}`;
        anzeige.textContent = formatSek(eintrag.ziel);
        start.textContent = 'Seite 2 starten';
        start.hidden = false;
      } else {
        status.textContent = 'Geschafft';
        anzeige.textContent = '✓';
        start.textContent = 'Noch einmal';
        start.hidden = false;
        seite = 1;
      }
    };
    timer = { id: setInterval(tick, 200) };
    tick();
  }
  return box;
}

function formatSek(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- Fertig ----------

function zeigeFertig(l) {
  const min = Math.max(1, Math.round((Date.now() - l.start) / 60000));
  // Pro Übung nur die letzte Rückmeldung (bei 2 Runden gibt es nur eine)
  const zeilen = l.ergebnisse.map((e) => {
    const u = nachId.get(e.id);
    return h('li', { class: `aenderung a-${e.aenderung.art}` },
      h('span', { class: 'aenderung-titel' }, u.titel),
      h('span', { class: 'aenderung-text' }, e.aenderung.text),
    );
  });
  zeige(
    h('section', { class: 'seite' },
      h('p', { class: 'marke' }, 'Pause beendet'),
      h('h1', { class: 'titel-gross' }, `${min} Min bewegt`),
      zeilen.length
        ? [h('h2', { class: 'abschnitt' }, 'Angepasst für das nächste Mal'), h('ul', { class: 'aenderungen' }, zeilen)]
        : h('p', { class: 'leise' }, 'Keine Rückmeldung gegeben – der Trainingsstand bleibt unverändert.'),
    ),
    aktionsleiste(knopf('Zurück an den Schreibtisch', zeigeStart, 'btn btn-primaer')),
  );
}

// ---------- Bibliothek ----------

let bibFilter = 'alle';

function zeigeBibliothek() {
  const filterKnopf = (key, name) => h('button', {
    type: 'button',
    class: `chip${bibFilter === key ? ' ist-aktiv' : ''}`,
    'aria-pressed': bibFilter === key ? 'true' : 'false',
    onclick: () => { bibFilter = key; zeigeBibliothek(); },
  }, name);

  const liste = bibliothek.uebungen
    .filter((u) => bibFilter === 'alle' || u.ziele.includes(bibFilter))
    .map((u) => {
      const z = zustandFuer(zustand.uebungen, u);
      const v = vorgabe(u, z);
      return h('li', {},
        h('button', { type: 'button', class: 'bib-eintrag', onclick: () => zeigeDetail(u) },
          h('span', { class: 'bib-titel' }, u.titel, z.gesperrt ? h('span', { class: 'pill' }, 'pausiert') : null),
          h('span', { class: 'bib-info' },
            `${MUSTER[u.muster]} · Stufe ${v.stufeIndex + 1}/${v.anzahlStufen} · ${formatVorgabe(v.einheit, v.ziel, u.einseitig)}`),
          h('span', { class: 'bib-zuletzt' }, `zuletzt ${relativeZeit(z.zuletzt)}`),
        ),
      );
    });

  zeige(
    kopf({ titel: 'Übungen', zurueck: zeigeStart }),
    h('section', { class: 'seite' },
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter' },
        filterKnopf('alle', 'Alle'),
        filterKnopf('kraft', 'Kraft'),
        filterKnopf('haltung', 'Haltung'),
        filterKnopf('mobilitaet', 'Mobilität'),
      ),
      h('ul', { class: 'bib-liste' }, liste),
    ),
  );
}

function zeigeDetail(u) {
  const z = zustandFuer(zustand.uebungen, u);
  const aktualisieren = (neu) => { zustand.uebungen[u.id] = neu; sichern(); zeigeDetail(u); };

  zeige(
    kopf({ zurueck: zeigeBibliothek }),
    h('section', { class: 'seite' },
      h('p', { class: 'leise' }, `${MUSTER[u.muster]} · ${u.ziele.map((k) => ZIELE[k].name).join(', ')}`),
      h('h1', { class: 'titel-gross' }, u.titel),
      piktogramm(u),
      vorsichtHinweis(u),
      h('div', { class: 'block' }, h('p', { class: 'label' }, 'Aufbau'), h('p', {}, u.aufbau)),
      h('div', { class: 'block' }, h('p', { class: 'label' }, 'Ablauf'), h('ol', { class: 'ablauf' }, u.ablauf.map((s) => h('li', {}, s)))),
      h('div', { class: 'block' }, h('p', { class: 'label' }, 'Achte auf'), h('p', {}, u.achte_auf)),
      h('div', { class: 'block' }, h('p', { class: 'label' }, 'Warum'), h('p', {}, u.warum)),

      h('h2', { class: 'abschnitt' }, 'Stufen'),
      h('ol', { class: 'stufen' }, u.stufen.map((s, i) => h('li', { class: i === z.stufe ? 'ist-aktuell' : '' },
        h('span', { class: 'stufen-hinweis' }, s.hinweis),
        h('span', { class: 'stufen-bereich' },
          i === z.stufe
            ? `aktuell: ${formatVorgabe(s.einheit, z.ziel, u.einseitig)}`
            : `${s.min}–${s.max} ${s.einheit === 'sek' ? 'Sek.' : 'Wdh.'}`),
      ))),
      h('div', { class: 'stufen-steuerung' },
        knopf('− Stufe', () => aktualisieren(setzeStufe(u, z, z.stufe - 1)), 'btn btn-sekundaer'),
        knopf('+ Stufe', () => aktualisieren(setzeStufe(u, z, z.stufe + 1)), 'btn btn-sekundaer'),
      ),

      h('label', { class: 'schalter' },
        h('input', { type: 'checkbox', checked: z.gesperrt, onchange: (e) => aktualisieren({ ...z, gesperrt: e.target.checked }) }),
        h('span', {}, 'Nicht mehr vorschlagen'),
      ),
      knopf('Trainingsstand dieser Übung zurücksetzen', () => {
        if (confirm(`Stand für „${u.titel}“ zurücksetzen?`)) aktualisieren(startZustand(u));
      }, 'link-knopf'),
    ),
  );
}

// ---------- Verlauf ----------

function zeigeVerlauf() {
  const sessions = [...zustand.sessions].reverse();
  const wocheStart = (() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  })();
  const dieseWoche = sessions.filter((s) => s.start >= wocheStart);
  const minWoche = dieseWoche.reduce((a, s) => a + Math.max(1, Math.round((s.ende - s.start) / 60000)), 0);

  const gruppen = [];
  for (const s of sessions.slice(0, 60)) {
    const tag = tagLabel(s.start);
    if (!gruppen.length || gruppen.at(-1).tag !== tag) gruppen.push({ tag, eintraege: [] });
    gruppen.at(-1).eintraege.push(s);
  }

  zeige(
    kopf({ titel: 'Verlauf', zurueck: zeigeStart }),
    h('section', { class: 'seite' },
      h('p', { class: 'kennzahl' }, `Diese Woche: ${dieseWoche.length} ${dieseWoche.length === 1 ? 'Pause' : 'Pausen'} · ${minWoche} Min`),
      sessions.length === 0 ? h('p', { class: 'leise' }, 'Noch keine Pausen gespeichert.') : null,
      gruppen.map((g) => h('div', { class: 'verlauf-tag' },
        h('h2', { class: 'abschnitt' }, g.tag),
        h('ul', { class: 'verlauf-liste' }, g.eintraege.map((s) => h('li', {},
          h('span', { class: 'verlauf-zeit' }, uhrzeit(s.start)),
          h('span', {}, `${ZIELE[s.ziel]?.name ?? s.ziel} · ${DAUER_LABEL[s.dauer] ?? ''} · ${Math.max(1, Math.round((s.ende - s.start) / 60000))} Min`),
          h('span', { class: 'verlauf-uebungen' },
            [...new Set(s.eintraege.map((e) => nachId.get(e.id)?.titel ?? e.id))].join(', ')
            + (s.abgebrochen ? ' (abgebrochen)' : '')),
        ))),
      )),
    ),
  );
}

// ---------- Einstellungen ----------

function zeigeEinstellungen() {
  const dateiEingabe = h('input', {
    type: 'file', accept: 'application/json,.json', class: 'versteckt',
    onchange: async (e) => {
      const datei = e.target.files?.[0];
      if (!datei) return;
      try {
        const neu = ausBackupText(await datei.text());
        if (!confirm('Backup einspielen? Der aktuelle Stand wird ersetzt.')) return;
        zustand = neu;
        sichern();
        alert('Backup eingespielt.');
        zeigeEinstellungen();
      } catch {
        alert('Diese Datei ist kein gültiges Backup.');
      }
    },
  });

  zeige(
    kopf({ titel: 'Einstellungen', zurueck: zeigeStart }),
    h('section', { class: 'seite' },
      h('label', { class: 'schalter' },
        h('input', { type: 'checkbox', checked: zustand.einstellungen.ton, onchange: (e) => { zustand.einstellungen.ton = e.target.checked; sichern(); } }),
        h('span', {}, 'Signaltöne beim Halte-Timer'),
      ),
      h('p', { class: 'leise klein' }, 'Ist das iPhone stumm geschaltet, bleiben die Töne eventuell aus.'),

      h('h2', { class: 'abschnitt' }, 'Auf den Home-Bildschirm'),
      h('div', { class: 'prosa' },
        h('p', {}, 'In Safari: Teilen-Symbol → „Zum Home-Bildschirm“. Danach startet die App im Vollbild und funktioniert auch offline.'),
        h('p', {}, 'Wichtig: Wird die Seite nur im Browser genutzt, kann Safari den gespeicherten Trainingsstand nach einigen Tagen ohne Nutzung löschen. Als Home-Bildschirm-App passiert das nicht.'),
      ),

      h('h2', { class: 'abschnitt' }, 'Sicherung'),
      h('p', { class: 'leise' }, `Gespeichert: ${zustand.sessions.length} ${zustand.sessions.length === 1 ? 'Pause' : 'Pausen'}, ${Object.keys(zustand.uebungen).length} Übungsstände.`),
      h('div', { class: 'knopf-reihe' },
        knopf('Backup speichern', () => backupExport(), 'btn btn-sekundaer'),
        knopf('Backup einspielen', () => dateiEingabe.click(), 'btn btn-sekundaer'),
      ),
      dateiEingabe,

      h('h2', { class: 'abschnitt' }, 'Sicherheit'),
      h('div', { class: 'prosa' }, sicherheitsText()),

      h('h2', { class: 'abschnitt' }, 'Zurücksetzen'),
      knopf('Alles löschen', () => {
        if (confirm('Trainingsstand und Verlauf wirklich löschen?')) {
          zustand = { ...leererZustand(), hinweisGelesen: true };
          sichern();
          zeigeStart();
        }
      }, 'link-knopf link-warnung'),

      h('p', { class: 'leise klein version' }, `Version ${VERSION} · Bibliothek ${bibliothek.library_version} · Daten bleiben auf diesem Gerät.`),
    ),
  );
}

async function backupExport() {
  const text = alsBackupText(zustand);
  const name = `schlingenpause-backup-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    const datei = new File([text], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [datei] })) {
      await navigator.share({ files: [datei], title: 'Schlingenpause Backup' });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------- Start ----------

if (zustand.hinweisGelesen) zeigeStart();
else zeigeHinweis();
