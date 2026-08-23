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

// Botón de inicio dentro de la lectura (pedido explícitamente: una
// "casita" junto a guardar/compartir/pantalla que lleve a Hoy).
console.log('\n--- BOTON DE INICIO EN LECTURA ---');
window.location.hash = '#/o/59';
await esperar(150);
const btnInicio = doc.querySelector('#p-leer .acciones [aria-label="Inicio"]');
console.log('  presente:', btnInicio ? 'OK' : 'FALLO: no esta');
if (!btnInicio) fallos++;
if (btnInicio) {
  const va = btnInicio.getAttribute('onclick') || '';
  const ok = va.includes("'#/hoy'");
  console.log('  lleva a #/hoy:', ok ? 'OK' : 'FALLO: onclick="' + va + '"');
  if (!ok) fallos++;
}

// Pedido explícitamente: el primero de todos, a la izquierda del resto.
const primerBoton = doc.querySelector('#p-leer .acciones button');
const esPrimero = primerBoton === btnInicio;
console.log('  es el primero (más a la izquierda):', esPrimero ? 'OK' : 'FALLO: hay otro botón antes');
if (!esPrimero) fallos++;

// La barra de acciones queda anclada al fondo de #p-leer (position:absolute
// sobre .lect-scroll), no como sticky dentro del propio scroll: así no se
// ve la siguiente oración asomando por debajo al hacer scroll.
const scrollExiste = !!doc.getElementById('lect-scroll');
const accionesFuera = doc.querySelector('#p-leer > .acciones') !== null;
console.log('  #lect-scroll existe:', scrollExiste ? 'OK' : 'FALLO');
console.log('  .acciones es hermana de .lect-scroll (no está dentro):', accionesFuera ? 'OK' : 'FALLO');
if (!scrollExiste) fallos++;
if (!accionesFuera) fallos++;

// Pantalla de apertura: visible al arrancar, se retira sola.
console.log('\n--- PANTALLA DE APERTURA ---');
const splash = doc.getElementById('splash');
console.log('  presente en el HTML:', splash ? 'OK' : 'FALLO');
if (!splash) fallos++;
else {
  const ocultaAlFinal = splash.classList.contains('oculto');
  console.log('  se retira sola (tras el arranque + margen):', ocultaAlFinal ? 'OK' : 'FALLO: sigue visible');
  if (!ocultaAlFinal) fallos++;
}

// Saludo personalizado: sin nombre no debe verse ningún hueco raro, y con
// nombre guardado tiene que aparecer al entrar a Buscar con el campo vacío.
console.log('\n--- SALUDO EN BUSCAR ---');
window.location.hash = '#/buscar';
await esperar(120);
const sinNombre = doc.getElementById('contenido-buscar').innerHTML;
console.log('  sin nombre, sin saludo:', sinNombre.includes('class="marca"') ? 'FALLO: hay un hueco de saludo vacío' : 'OK');
if (sinNombre.includes('class="marca"')) fallos++;

// CONFIG es un "let" del script, no cuelga de window (a diferencia de las
// funciones, que sí). Se pasa por la función pública de verdad, con
// prompt() sustituido, en vez de intentar tocar el estado interno.
window.prompt = () => 'Agustín';
await window.cambiarNombre();
// re-render directo: ya estábamos en #/buscar, así que reasignar el mismo
// hash no dispara hashchange y no repintaría
window.renderizarBuscar('');
await esperar(80);
const conNombre = doc.getElementById('contenido-buscar').textContent;
const hora = new Date().getHours();
const esperado = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
console.log('  con nombre, saluda:', conNombre.includes('Agustín') ? 'OK ("' + conNombre.slice(0, 40).trim() + '...")' : 'FALLO: no aparece el nombre');
if (!conNombre.includes('Agustín')) fallos++;
console.log('  saludo acorde a la hora (' + esperado + '):', conNombre.includes(esperado) ? 'OK' : 'FALLO');
if (!conNombre.includes(esperado)) fallos++;

if (errores.length) { console.log('\nERRORES EN CONSOLA:'); errores.forEach(e => console.log('  ' + e)); }

console.log('\n=== ' + (fallos ? fallos + ' FALLOS' : 'TODO OK') + ' ===');
dom.window.close();
process.exit(fallos ? 1 : 0);
