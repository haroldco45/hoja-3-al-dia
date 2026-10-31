const CACHE='sigep3-v1';
const CORE=['./','index.html','manifest.json','img/anuncio-presidencia.jpg','img/icon-192.png','img/icon-512.png','data/noticias.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  // Red primero: siempre lo más nuevo; si no hay señal, lo guardado
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request.url.split('?')[0],c));return r})
    .catch(()=>caches.match(e.request.url.split('?')[0]).then(r=>r||caches.match('index.html'))));
});
