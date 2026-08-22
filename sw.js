/*
 * sw.js — service worker de "Dios sabe más".
 *
 * Objetivo sencillo: que la app abra sin conexión, como el libro en papel.
 *
 * - App shell (index.html, manifest, iconos): cache-first. Es la interfaz,
 *   casi no cambia una vez publicada.
 * - oraciones.json: network-first con caída a caché. Mientras se está
 *   ajustando el contenido de prueba conviene ver el fichero nuevo al
 *   recargar; si no hay red, se sirve la última copia guardada.
 *
 * Durante el desarrollo, si los cambios en index.html no se notan al
 * recargar: sube CACHE_VERSION en uno, o haz una recarga forzada
 * (Ctrl/Cmd + Shift + R), o borra el service worker desde las herramientas
 * de desarrollador (Aplicación -> Service Workers -> Unregister).
 */

const CACHE_VERSION = "v1";
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

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/oraciones.json")) {
    evento.respondWith(redSobreCache(evento.request));
    return;
  }

  evento.respondWith(cacheSobreRed(evento.request));
});

async function cacheSobreRed(peticion) {
  const enCache = await caches.match(peticion);
  if (enCache) return enCache;
  try {
    const respuesta = await fetch(peticion);
    const cache = await caches.open(CACHE_SHELL);
    cache.put(peticion, respuesta.clone());
    return respuesta;
  } catch (e) {
    // navegación sin red y sin copia previa: al menos ofrece la app
    if (peticion.mode === "navigate") return caches.match("./index.html");
    throw e;
  }
}

async function redSobreCache(peticion) {
  try {
    const respuesta = await fetch(peticion);
    const cache = await caches.open(CACHE_DATOS);
    cache.put(peticion, respuesta.clone());
    return respuesta;
  } catch (e) {
    const enCache = await caches.match(peticion);
    if (enCache) return enCache;
    throw e;
  }
}
