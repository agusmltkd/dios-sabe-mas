# Dios sabe más

PWA para consultar las 300 oraciones del devocionario *Dios sabe más* de
Ignacio del Rey, para tenerlas a mano en el móvil sin cargar con el libro.

Contexto completo del proyecto (por qué existe, qué decisiones de producto
ya están tomadas, qué queda pendiente con la editorial): **[CLAUDE.md](CLAUDE.md)**.

## Estado

Build de prueba funcional, con datos de relleno (ver [`generar_prueba.py`](generar_prueba.py)).
El libro todavía no está digitalizado — eso lo hace [`digitalizar.py`](digitalizar.py)
cuando haya fotos del índice y las páginas.

## Por qué este repo es público pero el contenido no

Este repo puede ser público porque **no contiene ni una sola oración real
del libro**. `oraciones.json` está en `.gitignore` a propósito: en local se
genera con datos de prueba, y en la versión desplegada la sirve un worker
de Cloudflare aparte, fuera de git. Detalle completo en
[`worker/README.md`](worker/README.md).

Cuando llegue el contenido real del libro, esa misma separación es la que
lo mantiene fuera del repo — no hace falta cambiar nada de la arquitectura.

## Probarla en local

```bash
python generar_prueba.py   # genera oraciones.json de prueba
```

Luego doble clic en `iniciar-servidor.bat` (Windows) o:

```bash
python -m http.server 8080
```

y abre `http://localhost:8080/`.

## Desplegada

- **App** (HTML/CSS/JS, sin contenido): GitHub Pages, desde este mismo repo.
- **Datos**: worker de Cloudflare — ver [`worker/README.md`](worker/README.md)
  para desplegarlo y para el enlace real una vez exista.

## Ficheros

| Fichero | Qué es |
|---|---|
| `index.html` | La app entera — HTML, CSS y JS en un fichero, fuentes incrustadas |
| `sw.js` | Service worker (offline) |
| `manifest.webmanifest` | Manifest de la PWA |
| `iconos/` | Icono provisional (placeholder, fácil de sustituir) |
| `worker/` | Worker de Cloudflare que sirve `oraciones.json` fuera del repo |
| `digitalizar.py` | Pipeline OCR: índice, páginas, validación |
| `generar_prueba.py` | Genera un `oraciones.json` de prueba (datos de relleno) |
| `generar_iconos.py` | Genera los iconos provisionales |
| `iniciar-servidor.bat` | Sirve la app en local, en esta red y en localhost |
| `dios-sabe-mas-pantallas.html` / `.pdf` | Maqueta visual original, 18 pantallas |
