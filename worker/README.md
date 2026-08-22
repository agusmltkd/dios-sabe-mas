# worker/ — servir oraciones.json fuera del repo público

Este worker existe por una sola razón: el repo de GitHub es público (para
que GitHub Pages sea gratis), pero `oraciones.json` no puede vivir ahí.
Este worker lo sirve desde un KV de Cloudflare aparte, sin pasar por git.

No hace falta cuenta de pago: el plan gratuito de Cloudflare Workers y de
KV sobra de largo para esto (300 oraciones son un JSON de unos pocos KB).

## 1. Instalar wrangler y entrar con tu cuenta de Cloudflare

No hace falta instalar nada global, `npx` ya lo resuelve:

```bash
cd worker
npx wrangler login
```

Abre el navegador para autenticarte. Si no tienes cuenta de Cloudflare
todavía, créala en ese mismo paso (gratis).

## 2. Crear el KV donde viven los datos

```bash
npx wrangler kv namespace create ORACIONES_KV
```

Esto imprime algo como:

```
[[kv_namespaces]]
binding = "ORACIONES_KV"
id = "a1b2c3d4..."
```

Copia ese `id` y pégalo en `wrangler.toml`, sustituyendo
`REEMPLAZA-CON-EL-ID-DEL-KV`.

## 3. Decir qué orígenes pueden pedir los datos

Abre `oraciones-worker.js` y cambia `ORIGENES_PERMITIDOS`: sustituye
`https://REEMPLAZA-TU-USUARIO.github.io` por tu URL real de GitHub Pages
(la sabrás en cuanto actives Pages en el repo — normalmente
`https://<tu-usuario>.github.io/<nombre-del-repo>`, pero el origen para
CORS es solo el esquema+host, sin la ruta: `https://<tu-usuario>.github.io`).

## 4. Desplegar el worker

```bash
npx wrangler deploy
```

Te da la URL del worker, algo como
`https://dios-sabe-mas-datos.<tu-subdominio>.workers.dev`.
Guárdala: hay que pegarla en `index.html` (constante `WORKER_ORACIONES_URL`,
al principio del `<script>`), en la ruta `/oraciones.json`.

## 5. Subir los datos al KV

Desde la raíz del proyecto (no desde `worker/`), con el `oraciones.json`
que genera `generar_prueba.py` (o, más adelante, el real):

```bash
cd ..
python generar_prueba.py
npx wrangler kv key put "oraciones.json" --path=oraciones.json \
  --binding=ORACIONES_KV --remote --config=worker/wrangler.toml
```

Si `wrangler` se queja de la sintaxis exacta de `kv key put` (cambia entre
versiones), mira `npx wrangler kv key put --help` — el comando en sí no
cambia, solo algún nombre de flag.

## 6. Comprobar que responde

```bash
curl -H "Origin: https://<tu-usuario>.github.io" \
  https://dios-sabe-mas-datos.<tu-subdominio>.workers.dev/oraciones.json
```

Debería devolver el JSON completo con la cabecera `Access-Control-Allow-Origin`
puesta a tu origen.

## Actualizar el contenido más adelante

Repite el paso 5 cada vez que `oraciones.json` cambie (nuevo lote del
pipeline real, correcciones, etc.). No hace falta volver a desplegar el
worker si solo cambian los datos, solo el KV.

## Sobre el nivel de privacidad real

Este worker no pide login: cualquiera que descubra la URL puede leer el
JSON. Es la misma politica que "cualquiera con el enlace" que se decidió
para la propia app — coherente, pero no es una barrera real. Si en algún
momento hace falta cerrarlo a gente concreta (por ejemplo, al meter el
contenido real de las 300 oraciones), la vía más simple es poner
Cloudflare Access delante de este worker (gratis hasta 50 usuarios,
login por email con código de un solo uso).
