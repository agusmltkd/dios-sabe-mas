// Primera apertura SIN red y sin nada en IndexedDB: debe salir la pantalla
// de error con el botón de reintentar, nunca una pantalla en blanco.
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
import 'fake-indexeddb/auto';

const html = fs.readFileSync('index.html', 'utf8');
const vc = new VirtualConsole();  // silenciado a propósito: aquí se espera fallo

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://agusmltkd.github.io/dios-sabe-mas/index.html',
  virtualConsole: vc,
  beforeParse(w) {
    w.indexedDB = globalThis.indexedDB;
    w.IDBKeyRange = globalThis.IDBKeyRange;
    w.fetch = async () => { throw new TypeError('Failed to fetch'); };
    w.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    w.scrollTo = () => {};
    Object.defineProperty(w.navigator, 'onLine', { value: false, configurable: true });
  },
});

const { window } = dom;
await new Promise(r => setTimeout(r, 1500));
const doc = window.document;

const visibles = [...doc.querySelectorAll('.pantalla.mostrar')].map(s => s.id);
console.log('pantallas visibles:', visibles.length ? visibles : '(NINGUNA -> blanco)');

let fallos = 0;
if (!visibles.length) { console.log('FALLO: pantalla en blanco'); fallos++; }
if (visibles[0] !== 'p-error') { console.log('FALLO: deberia salir p-error, salio', visibles[0]); fallos++; }

const detalle = doc.getElementById('detalle-error').textContent.trim();
console.log('mensaje:', detalle);
if (!detalle) { console.log('FALLO: sin mensaje explicativo'); fallos++; }
if (!/sin conexi/i.test(detalle)) { console.log('FALLO: no explica que es falta de red'); fallos++; }

const btn = doc.querySelector('#p-error .boton');
console.log('boton reintentar:', btn ? btn.textContent.trim() : '(no hay)');
if (!btn) { console.log('FALLO: sin boton de reintentar'); fallos++; }

console.log('\n=== ' + (fallos ? fallos + ' FALLOS' : 'TODO OK') + ' ===');
dom.window.close();
process.exit(fallos ? 1 : 0);
