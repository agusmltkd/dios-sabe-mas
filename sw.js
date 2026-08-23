/*
 * sw.js — service worker de "Dios sabe más".
 *
 * Objetivo: que la app abra sin conexión, como el libro en papel, pero sin
 * quedarse congelada para siempre en la versión con la que se instaló.
 *
 * Política de actualización (a propósito, para una app de LECTURA):
 * el worker nuevo NO llama a skipWaiting() por su cuenta. Se queda en
 * espera, la app lo detecta y enseña un aviso discreto ("hay una versión
 * nueva"), y solo salta cuando la persona lo toca. Cambiarle el HTML bajo
 * los pies a alguien que está rezando es peor que esperar un rato.
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

const CACHE_VERSION = "v3";
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
  // sin skipWaiting: espera a que la app lo pida (ver mensaje SALTAR_ESPERA)
  evento.waitUntil(
    caches.open(CACHE_SHELL).then((cache) => cache.addAll(SHELL))
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
