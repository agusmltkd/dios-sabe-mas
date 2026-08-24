// Reproduce el fallo real: la primera descarga de contenido falla (red
// floja justo al instalar, el worker con un arranque en frío...), se
// recupera con "Reintentar", y el onboarding tiene que seguir pudiendo
// aparecer en esa misma sesión. Antes no pasaba: el chequeo de onboarding
// solo corría en el camino feliz de arrancar(), nunca en reintentarCarga().
// En una PWA instalada que iOS reanuda en vez de recargar de cero cada
// vez, eso podía significar que no saliera jamás para quien tuviera mala
// suerte justo al instalar.
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
import 'fake-indexeddb/auto';

const datos = fs.readFileSync('oraciones.json', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

let intentos = 0;
const errores = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errores.push('jsdomError: ' + e.message));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://agusmltkd.github.io/dios-sabe-mas/index.html',
  virtualConsole: vc,
  beforeParse(w) {
    w.indexedDB = globalThis.indexedDB;
    w.IDBKeyRange = globalThis.IDBKeyRange;
    w.fetch = async () => {
      intentos++;
      if (intentos === 1) throw new TypeError('Failed to fetch'); // primer intento: falla
      return { ok: true, status: 200, text: async () => datos, json: async () => JSON.parse(datos) };
    };
    w.matchMedia = q => ({
      matches: false, media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    });
    w.scrollTo = () => {};
    Object.defineProperty(w.navigator, 'onLine', { value: true, configurable: true });
  },
});

const { window } = dom;
const doc = window.document;
const esperar = ms => new Promise(r => setTimeout(r, ms));
let fallos = 0;

await esperar(1500);

console.log('--- PRIMER INTENTO (falla) ---');
let visibles = [...doc.querySelectorAll('.pantalla.mostrar')].map(s => s.id);
console.log('  pantalla:', visibles.join(',') || '(ninguna)');
if (visibles[0] !== 'p-error') { console.log('  FALLO: debería mostrar la pantalla de error'); fallos++; }

console.log('\n--- REINTENTAR (ahora sí responde) ---');
await window.reintentarCarga();
await esperar(300);

visibles = [...doc.querySelectorAll('.pantalla.mostrar')].map(s => s.id);
console.log('  pantalla:', visibles.join(',') || '(ninguna)');
if (visibles[0] === 'p-error') { console.log('  FALLO: sigue en la pantalla de error'); fallos++; }

const overlay = doc.getElementById('overlay-entrada');
const onboardingVisible = overlay && !overlay.hasAttribute('hidden');
console.log('  onboarding aparece tras recuperarse:', onboardingVisible ? 'OK' : 'FALLO: sigue oculto para siempre');
if (!onboardingVisible) fallos++;

if (errores.length) { console.log('\nERRORES EN CONSOLA:'); errores.forEach(e => console.log('  ' + e)); }

console.log('\n=== ' + (fallos ? fallos + ' FALLOS' : 'TODO OK') + ' ===');
dom.window.close();
process.exit(fallos ? 1 : 0);
