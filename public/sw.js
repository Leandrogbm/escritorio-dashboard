// Service worker mínimo pro "instalar como app" funcionar (PWA) — network-first com
// fallback pro cache quando offline. Não pré-cacheia nada de propósito: os assets do build
// têm hash no nome (Vite), então só entram no cache na primeira vez que forem buscados.
// ponytail: sem estratégia de invalidação de cache mais esperta — se sobrar lixo de build
// antigo, o próprio network-first já prioriza a versão nova sempre que há rede.
const CACHE = "mysaldo-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

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
