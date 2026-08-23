// Prueba de arranque real: carga index.html en un DOM headless, con
// IndexedDB simulado, y comprueba que la app pinta una pantalla en vez de
// quedarse en blanco. Es exactamente el fallo que se coló dos veces.
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
import 'fake-indexeddb/auto';

const datos = fs.readFileSync('oraciones.json', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

const errores = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errores.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errores.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://agusmltkd.github.io/dios-sabe-mas/index.html',
  virtualConsole: vc,
  beforeParse(w) {
    w.indexedDB = globalThis.indexedDB;
    w.IDBKeyRange = globalThis.IDBKeyRange;
    w.fetch = async () => ({
      ok: true, status: 200,
      text: async () => datos,
      json: async () => JSON.parse(datos),
    });
    w.matchMedia = q => ({
      matches: false, media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    });
    w.scrollTo = () => {};
    Object.defineProperty(w.navigator, 'onLine', { value: true, configurable: true });
  },
});

const { window } = dom;
const esperar = ms => new Promise(r => setTimeout(r, ms));
await esperar(1500);

const doc = window.document;
const visibles = [...doc.querySelectorAll('.pantalla.mostrar')].map(s => s.id);
const navbarVisible = doc.getElementById('navbar').style.display !== 'none';

console.log('--- ARRANQUE ---');
console.log('pantallas visibles:', visibles.length ? visibles : '(NINGUNA -> pantalla en blanco)');
console.log('navbar visible:', navbarVisible);

let fallos = 0;
if (visibles.length !== 1) { console.log('FALLO: deberia haber exactamente 1 pantalla visible'); fallos++; }
if (visibles[0] === 'p-error') { console.log('FALLO: arranco en pantalla de error'); fallos++; }

// La pantalla Hoy debe tener contenido real, no solo el navbar
const chips = doc.getElementById('chips-hoy').children.length;
const dia = doc.getElementById('bloque-dia').textContent.trim();
console.log('chips pintados:', chips);
console.log('oracion del dia:', dia ? dia.slice(0, 60) : '(vacia)');
if (!chips) { console.log('FALLO: no se pintaron los chips'); fallos++; }
if (!dia) { console.log('FALLO: no se pinto la oracion del dia'); fallos++; }

// Navegar a las demas pantallas
console.log('\n--- NAVEGACION ---');
for (const [hash, esperado] of [
  ['#/indice', 'p-indice'], ['#/buscar?q=57', 'p-buscar'],
  ['#/o/59', 'p-leer'], ['#/guardadas', 'p-guardadas'], ['#/ajustes', 'p-ajustes'],
]) {
  window.location.hash = hash;
  await esperar(120);
  const v = [...doc.querySelectorAll('.pantalla.mostrar')].map(s => s.id);
  const ok = v.length === 1 && v[0] === esperado;
  console.log(`  ${hash.padEnd(16)} -> ${v.join(',') || '(ninguna)'} ${ok ? 'OK' : 'FALLO'}`);
  if (!ok) fallos++;
}

// Contenido concreto
window.location.hash = '#/o/59';
await esperar(150);
const cuerpo = doc.getElementById('cuerpo-lectura').textContent;
console.log('\nleyendo la 59 ->', cuerpo.slice(0, 55).replace(/\s+/g, ' ').trim());
if (!cuerpo.includes('tarea')) { console.log('FALLO: no cargo la oracion 59'); fallos++; }

window.location.hash = '#/buscar?q=57';
await esperar(150);
const busq = doc.getElementById('contenido-buscar').textContent;
console.log('buscar "57" ->', busq.slice(0, 70).replace(/\s+/g, ' ').trim());
if (!busq.includes('57')) { console.log('FALLO: entrar por numero no funciona'); fallos++; }

window.location.hash = '#/ajustes';
await esperar(150);
console.log('version en ajustes ->', doc.getElementById('version-app').textContent);
console.log('version contenido  ->', doc.getElementById('valor-version-datos').textContent);

// El aviso tiene que irse solo. Se quedaba asomando por abajo y parecia una
// pastilla clara pegada a la pantalla para siempre.
console.log('\n--- AVISOS ---');
const aviso = doc.getElementById('aviso');
window.mostrarAviso('probando');
await esperar(80);
const visible = aviso.classList.contains('mostrar');
console.log('  al mostrarlo:', visible ? 'visible OK' : 'FALLO: no aparece');
if (!visible) fallos++;
await esperar(3000);
const sigue = aviso.classList.contains('mostrar');
console.log('  a los 3 s   :', sigue ? 'FALLO: sigue visible' : 'oculto OK');
if (sigue) fallos++;
await esperar(400);
console.log('  texto tras ocultarse:', aviso.textContent === '' ? 'vacio OK' : `FALLO: "${aviso.textContent}"`);
if (aviso.textContent !== '') fallos++;

if (errores.length) { console.log('\nERRORES EN CONSOLA:'); errores.forEach(e => console.log('  ' + e)); }

console.log('\n=== ' + (fallos ? fallos + ' FALLOS' : 'TODO OK') + ' ===');
dom.window.close();
process.exit(fallos ? 1 : 0);
