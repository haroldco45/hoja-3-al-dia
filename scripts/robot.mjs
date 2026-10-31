// Robot de noticias SIGEP 3.0 — Vibras Positivas HM
// Corre en GitHub Actions cada 30 minutos y actualiza data/noticias.json
import fs from 'node:fs';

const FILE = 'data/noticias.json';
const RELEVANT = /sigep|hoja de vida|funcion publica|dafp/;
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { items: [] };
let items = [...(old.items || [])];
const seen = new Set(items.map(n => norm(n.title).slice(0, 60)));

function add(n) {
  if (!n.title || !n.url) return;
  const k = norm(n.title).slice(0, 60);
  if (seen.has(k) || !RELEVANT.test(norm(n.title))) return;
  seen.add(k);
  items.push(n);
}

async function get(url, ms = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'user-agent': 'Mozilla/5.0 (VibrasPositivasHM robot)' } });
    return r.ok ? await r.text() : '';
  } catch { return ''; } finally { clearTimeout(t); }
}

const decode = s => (s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

// 1) Google Noticias (Colombia)
const queries = ['SIGEP 3.0', '"SIGEP III"', 'hoja de vida SIGEP Función Pública'];
for (const q of queries) {
  const xml = await get(`https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:30d')}&hl=es-419&gl=CO&ceid=CO:es-419`);
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const pick = tag => decode((it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1]);
    let title = pick('title');
    const source = pick('source');
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    add({ title, url: pick('link'), source, image: '', date: new Date(pick('pubDate')).toISOString() });
  }
}

// 2) GDELT (trae foto de la noticia)
for (const q of ['SIGEP', '"hoja de vida" "Función Pública"']) {
  const txt = await get(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q + ' sourcelang:spanish')}&mode=artlist&format=json&maxrecords=50&sort=datedesc&timespan=1month`);
  try {
    for (const a of JSON.parse(txt).articles || []) {
      const d = (a.seendate || '').replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
      add({ title: a.title, url: a.url, source: a.domain, image: a.socialimage || '', date: d });
    }
  } catch {}
}

// 3) Buscar foto real (og:image) a las noticias que no tienen
items.sort((a, b) => new Date(b.date) - new Date(a.date));
items = items.slice(0, 80);
for (const n of items.filter(n => !n.image).slice(0, 15)) {
  const html = await get(n.url, 10000);
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i);
  if (m && /^https?:/.test(m[1]) && !/logo|fallback|google/i.test(m[1])) n.image = decode(m[1]);
}

// Solo guarda si cambió algo (así no llena el repo de commits vacíos)
if (JSON.stringify(items) === JSON.stringify(old.items || [])) {
  console.log('Sin noticias nuevas');
} else {
  fs.writeFileSync(FILE, JSON.stringify({ updated: new Date().toISOString(), items }, null, 2));
  console.log(`Noticias guardadas: ${items.length}`);
}
