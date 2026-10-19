// Kleiner DOM-Helfer. Texte werden ausschließlich als Textknoten eingefügt,
// nie als HTML – damit bleibt die Content Security Policy streng.

export function h(tag, props = {}, ...kinder) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kind of kinder.flat(Infinity)) {
    if (kind == null || kind === false) continue;
    el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return el;
}

export function knopf(text, onclick, klasse = 'btn') {
  return h('button', { type: 'button', class: klasse, onclick }, text);
}
