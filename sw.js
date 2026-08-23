/*
 * sw.js — service worker de "Dios sabe más".
 *
 * Objetivo: que la app abra sin conexión, como el libro en papel, pero sin
 * quedarse congelada para siempre en la versión con la que se instaló.
 *
 * Política de actualización. El worker nuevo SÍ toma el control en cuanto
 * se instala (skipWaiting + clients.claim). No es negociable: dejarlo en
 * espera provocó un bloqueo real. El worker viejo era cache-first, servía
 * siempre su index.html guardado, el nuevo se quedaba esperando, y lo
 * único que podía despertarlo era un botón que vivía en el index.html
 * nuevo que nunca llegaba a servirse. La app instalada quedó congelada
 * para siempre en una versión rota.
 *
 * Lo de "no cambiar el HTML bajo los pies de quien está leyendo" se sigue
 * respetando, pero se resuelve en la PÁGINA, no bloqueando aquí: el worker
 * nuevo se activa (así el próximo arranque ya trae lo último) y la app
 * enseña un aviso discreto; solo recarga cuando la persona lo toca.
 *
 * Estrategias:
 * - index.html y navegaciones: network-first. Con cache-first, una PWA ya
 *   instalada nunca se enteraba de las correcciones. Offline sigue
 *   funcionando: cae a la copia guardada.
 * - Resto del shell (manifest, iconos, fuentes): cache-first, no cambian.
 * - oraciones.json: network-first con caída a caché. La app además hace su
 *   propio stale-while-revalidate contra IndexedDB.
 *
 * Al cambiar index.html, sube CACHE_VERSION: tira las cachés viejas.
 */

const CACHE_VERSION = "v8";
const CACHE_SHELL = `dios-sabe-mas-shell-${CACHE_VERSION}`;
const CACHE_DATOS = `dios-sabe-mas-datos-${CACHE_VERSION}`;

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./iconos/icon-192.png",
  "./iconos/icon-512.png",
  "./iconos/icon-maskable-512.png",
  "./iconos/apple-touch-icon.png",
  "./iconos/favicon.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_SHELL)
      .then((cache) => cache.addAll(SHELL))
      // toma el control sin esperar: si se queda esperando, un worker viejo
      // cache-first puede dejar la app congelada para siempre (ver cabecera)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((n) => n !== CACHE_SHELL && n !== CACHE_DATOS)
          .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// La app manda esto cuando la persona toca "Actualizar" en el aviso.
self.addEventListener("message", (evento) => {
  if (evento.data && evento.data.tipo === "SALTAR_ESPERA") self.skipWaiting();
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== "GET") return;

  // El contenido vive en el worker de Cloudflare, otro origen. Que pase de
  // largo: lo gestiona la propia app contra IndexedDB.
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/oraciones.json")) {
    evento.respondWith(redSobreCache(evento.request, CACHE_DATOS));
    return;
  }

  const esApp = evento.request.mode === "navigate" ||
                url.pathname.endsWith("/index.html") ||
                url.pathname.endsWith("/");
  if (esApp) {
    evento.respondWith(redSobreCache(evento.request, CACHE_SHELL));
    return;
  }

  evento.respondWith(cacheSobreRed(evento.request));
});

async function cacheSobreRed(peticion) {
  const enCache = await caches.match(peticion);
  if (enCache) return enCache;
  const respuesta = await fetch(peticion);
  if (respuesta && respuesta.ok) {
    const cache = await caches.open(CACHE_SHELL);
    cache.put(peticion, respuesta.clone());
  }
  return respuesta;
}

async function redSobreCache(peticion, dondeGuardar) {
  try {
    const respuesta = await fetch(peticion);
    if (respuesta && respuesta.ok) {
      const cache = await caches.open(dondeGuardar);
      cache.put(peticion, respuesta.clone());
    }
    return respuesta;
  } catch (e) {
    const enCache = await caches.match(peticion);
    if (enCache) return enCache;
    if (peticion.mode === "navigate") {
      const app = await caches.match("./index.html");
      if (app) return app;
    }
    throw e;
  }
}
