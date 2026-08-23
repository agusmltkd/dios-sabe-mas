/*
 * sw.js — service worker de "Dios sabe más".
 *
 * Objetivo sencillo: que la app abra sin conexión, como el libro en papel.
 *
 * - index.html (y cualquier navegación): NETWORK-FIRST. Con cache-first,
 *   una vez instalada en el móvil la app se quedaba congelada para siempre
 *   en la primera versión: las correcciones se desplegaban en GitHub Pages
 *   pero el teléfono seguía sirviendo su copia vieja. Ahora, si hay red, se
 *   coge siempre la última; si no hay, se cae a la copia guardada y sigue
 *   funcionando offline igual.
 * - Resto del shell (manifest, iconos): cache-first, casi nunca cambian.
 * - oraciones.json: network-first con caída a caché, por lo mismo.
 *
 * Al cambiar index.html conviene subir CACHE_VERSION: fuerza a tirar las
 * cachés viejas y a que el service worker nuevo tome el control.
 */

const CACHE_VERSION = "v2";
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

  // la propia app: siempre la última si hay red, para que las correcciones
  // lleguen al móvil sin tener que desinstalarla y volverla a añadir
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

async function redSobreCache(peticion, dondeGuardar = CACHE_DATOS) {
  try {
    const respuesta = await fetch(peticion);
    const cache = await caches.open(dondeGuardar);
    cache.put(peticion, respuesta.clone());
    return respuesta;
  } catch (e) {
    const enCache = await caches.match(peticion);
    if (enCache) return enCache;
    // navegación sin red y sin copia de esta URL exacta: ofrece la app
    if (peticion.mode === "navigate") {
      const app = await caches.match("./index.html");
      if (app) return app;
    }
    throw e;
  }
}
