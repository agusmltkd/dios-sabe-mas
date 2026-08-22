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

// Orígenes desde los que se permite pedir los datos. Cambia el primero por
// tu URL real de GitHub Pages en cuanto la tengas.
const ORIGENES_PERMITIDOS = [
  'https://REEMPLAZA-TU-USUARIO.github.io',
  'http://localhost:8080',
];

function cabecerasCORS(origen) {
  const permitido = ORIGENES_PERMITIDOS.includes(origen);
  return {
    'Access-Control-Allow-Origin': permitido ? origen : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };
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

    return new Response(datos, {
      headers: {
        ...cors,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  },
};
