// Ton und Bildschirm-wach-halten – beides funktioniert auf dem iPhone nur
// eingeschränkt und wird deshalb still übersprungen, wenn es nicht klappt.

let ctx = null;

// Muss in einem Tipp-Handler aufgerufen werden (iOS entsperrt Audio nur dort).
export function tonVorbereiten() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx || ctx.state === 'closed') ctx = new AC();
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch { /* still */ }
}

export function piep({ frequenz = 880, dauer = 0.25, lautstaerke = 0.4 } = {}) {
  if (!ctx) return;
  const spielen = () => {
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequenz, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lautstaerke, t + 0.02);
      g.gain.linearRampToValueAtTime(0, t + dauer);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dauer + 0.02);
    } catch { /* still */ }
  };
  if (ctx.state === 'running') spielen();
  else ctx.resume().then(spielen).catch(() => {});
}

export function piepEnde() {
  piep({ frequenz: 880, dauer: 0.35 });
  setTimeout(() => piep({ frequenz: 1175, dauer: 0.5 }), 380);
}

// --- Bildschirm wach halten während einer Pause ---
let sperre = null;
let gewuenscht = false;

async function anfordern() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      sperre = await navigator.wakeLock.request('screen');
      sperre.addEventListener?.('release', () => { sperre = null; });
    }
  } catch { sperre = null; }
}

export function wachHalten(an) {
  gewuenscht = an;
  if (an) anfordern();
  else { sperre?.release?.().catch(() => {}); sperre = null; }
}

document.addEventListener('visibilitychange', () => {
  if (gewuenscht && document.visibilityState === 'visible' && !sperre) anfordern();
});
