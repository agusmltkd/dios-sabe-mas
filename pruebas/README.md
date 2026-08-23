# pruebas/ — que la app no vuelva a arrancar en blanco

Dos veces se desplegó una versión que en el móvil abría mostrando solo la
barra de navegación y nada más. Las dos veces el fallo era el mismo: una
excepción durante el arranque dejaba todas las `.pantalla` en
`display:none`, y no había forma de verlo sin un móvil delante.

Estas pruebas cargan `index.html` de verdad en un DOM headless, con
IndexedDB simulado, y comprueban que **siempre se pinta algo**.

## Ejecutar

```bash
npm install --no-save jsdom fake-indexeddb
node pruebas/arranque.mjs          # con datos y con red
node pruebas/arranque-sin-red.mjs  # primera apertura sin red
```

Ambas salen con código 0 si todo va bien, 1 si algo falla. Antes de
desplegar, que pasen las dos.

Hace falta que exista `oraciones.json` en la raíz (`python generar_prueba.py`).

## Qué comprueban

`arranque.mjs`:

- Arranca con **exactamente una** pantalla visible, y no es la de error.
- Los chips y la oración del día se pintan de verdad.
- Se navega a índice, buscar, leer, guardadas y ajustes, y cada ruta
  enseña su pantalla.
- El enlace corto `#/o/59` abre la oración 59.
- Escribir "57" en el buscador encuentra la 57 (entrar por número).
- Las versiones de app y de contenido salen en Ajustes.

`arranque-sin-red.mjs`:

- Sin nada en IndexedDB y con la descarga fallando, sale la pantalla de
  error con el botón de reintentar y un mensaje que explica que falta
  conexión — **nunca** una pantalla en blanco.

## Lo que NO cubren

Son jsdom, no un navegador real: no comprueban maquetación, ni el service
worker, ni los gestos táctiles, ni nada de iOS (safe areas, standalone).
Eso sigue habiendo que mirarlo en el móvil.
