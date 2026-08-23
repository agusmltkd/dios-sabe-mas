/*
 * oraciones-worker.js — Cloudflare Worker que sirve oraciones.json aparte
 * del repo público de GitHub Pages.
 *
 * Por qué existe: CLAUDE.md es tajante en que el contenido del libro no
 * puede acabar en un repo público ("el HTML puede ser público pero el
 * contenido se importa aparte a IndexedDB"). La app (index.html, en el
 * repo público, servida por GitHub Pages) le pide los datos a ESTE worker
 * en vez de traerlos de un fichero del propio repo. El worker lee de un
 * KV de Cloudflare — el JSON con las oraciones nunca pasa por git, ni en
 * el commit actual ni en el historial.
 *
 * Este fichero SÍ va en el repo público. No contiene ninguna oración: solo
 * la lógica que las sirve. Los datos se suben aparte con `wrangler kv key
 * put` (ver README.md de esta carpeta).
 */

// Orígenes desde los que se permite pedir los datos.
const ORIGENES_PERMITIDOS = [
  'https://agusmltkd.github.io',
  'http://localhost:8080',
];

function cabecerasCORS(origen) {
  const permitido = ORIGENES_PERMITIDOS.includes(origen);
  return {
    'Access-Control-Allow-Origin': permitido ? origen : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'If-None-Match',
    'Vary': 'Origin',
  };
}

// ETag a partir del contenido: si no ha cambiado, la app recibe un 304 y no
// se descarga otra vez el JSON entero. El campo "version" de dentro del
// propio JSON es lo que la app compara para decidir si reemplaza lo que
// tiene en IndexedDB; el ETag solo ahorra datos.
async function calcularETag(texto) {
  const datos = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest('SHA-256', datos);
  const hex = Array.from(new Uint8Array(hash).slice(0, 16))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return `"${hex}"`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origen = request.headers.get('Origin') || '';
    const cors = cabecerasCORS(origen);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method !== 'GET' || url.pathname !== '/oraciones.json') {
      return new Response('No encontrado', { status: 404, headers: cors });
    }

    const datos = await env.ORACIONES_KV.get('oraciones.json');
    if (!datos) {
      return new Response(
        '{"error":"sin datos: falta sembrar el KV, ver worker/README.md"}',
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const etag = await calcularETag(datos);
    if (request.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers: { ...cors, ETag: etag } });
    }

    return new Response(datos, {
      headers: {
        ...cors,
        'Content-Type': 'application/json; charset=utf-8',
        // corto: cuando se suban las 300 reales interesa que llegue pronto.
        // El grueso del ahorro lo hace el ETag, no este max-age.
        'Cache-Control': 'public, max-age=60',
        'ETag': etag,
      },
    });
  },
};
