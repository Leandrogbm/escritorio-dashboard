// Service worker mínimo pro "instalar como app" funcionar (PWA) — network-first com
// fallback pro cache quando offline. Não pré-cacheia nada de propósito: os assets do build
// têm hash no nome (Vite), então só entram no cache na primeira vez que forem buscados.
//
// CACHE muda a cada deploy que precisar invalidar cache antigo pra valer (não precisa
// mudar em todo deploy — só quando desconfiar que cache de aba antiga tá causando bug real,
// como o "processos sumidos"/build velho que já aconteceu nesse projeto). Trocar a string
// aqui é o "limpa cache de todo mundo": o activate abaixo apaga qualquer cache com nome
// diferente do atual, e main.jsx recarrega sozinho toda aba que já estava aberta.
const CACHE = "actum-v3";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys()
    .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // não intercepta chamada pro Supabase
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
