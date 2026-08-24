#!/usr/bin/env python3
"""
generar_iconos.py — Recorta y reescala el logo real a los tamaños de la PWA.

Parte de iconos/logo.png (el trazo "↑ = +" de pincel, cuadrado, fondo
azul a sangre). Ese fichero es la fuente; este script no dibuja nada, solo
lo reescala y le añade el margen que necesita cada uso:

- Iconos normales: poco margen, el trazo se ve grande y seguro.
- Maskable (Android): el logo original tiene solo ~3.5% de margen
  horizontal, y Android recorta en círculo — con eso se comería la punta
  de la flecha y el brazo derecho del "+". Se encoge más para dejar sitio.
- apple-touch-icon: igual que el normal, pero forzado a RGB opaco (iOS no
  quiere canal alfa).
- logo-marca: para la pantalla de apertura (splash) y cualquier sitio
  donde el logo tenga que fundirse con el fondo real de la app en vez de
  llevar su propio recuadro azul — el trazo se recorta a transparencia
  real (el azul de fondo de logo.png desaparece, queda solo el blanco con
  su alfa), así encaja con cualquier color de fondo, no solo con el suyo.
  Requiere numpy (`pip install numpy`), solo para esto.

Genera:
    iconos/icon-192.png
    iconos/icon-512.png
    iconos/icon-maskable-512.png
    iconos/apple-touch-icon.png
    iconos/favicon.png
    iconos/logo-marca.png

Uso:
    python generar_iconos.py
"""

from pathlib import Path
from PIL import Image
import numpy as np

FUENTE = Path("iconos/logo.png")
DEST = Path("iconos")


def recortar_a_transparencia(tamano: int) -> Image.Image:
    """El logo es blanco sobre un azul sólido. Proyecta cada píxel sobre la
    recta fondo->blanco: cuánto se acerca a blanco es el alfa, y el color de
    salida es blanco puro siempre — así el degradado de los bordes con
    antialiasing se conserva sin arrastrar nada del azul original."""
    origen = Image.open(FUENTE).convert("RGB").resize((tamano, tamano), Image.LANCZOS)
    arr = np.asarray(origen, dtype=np.float64)

    fondo = np.array([float(c) for c in origen.getpixel((2, 2))])
    blanco = np.array([255.0, 255.0, 255.0])
    vec = blanco - fondo
    t = np.clip(((arr - fondo) @ vec) / float(np.dot(vec, vec)), 0.0, 1.0)

    alfa = (t * 255).astype(np.uint8)
    rgb = np.full_like(arr, 255, dtype=np.uint8)
    return Image.fromarray(np.dstack([rgb, alfa]), mode="RGBA")


def procesar(tamano: int, escala: float) -> Image.Image:
    """Reescala el logo entero (con su propio fondo) a `tamano * escala` y
    lo centra sobre un lienzo `tamano`x`tamano` del mismo azul de fondo —
    así el encogimiento añade margen sin que se note la costura."""
    origen = Image.open(FUENTE).convert("RGB")
    fondo = origen.getpixel((2, 2))  # color de fondo, de una esquina

    lienzo = Image.new("RGB", (tamano, tamano), fondo)
    lado = round(tamano * escala)
    logo = origen.resize((lado, lado), Image.LANCZOS)
    offset = (tamano - lado) // 2
    lienzo.paste(logo, (offset, offset))
    return lienzo


if not FUENTE.exists():
    raise SystemExit(f"Falta {FUENTE} — pon ahí el logo cuadrado antes de ejecutar esto.")

DEST.mkdir(exist_ok=True)

# iconos normales: margen modesto, el trazo se ve grande
procesar(192, escala=0.90).save(DEST / "icon-192.png")
procesar(512, escala=0.90).save(DEST / "icon-512.png")

# maskable: mucho más margen, para que el círculo de recorte de Android
# no se coma la punta de la flecha ni el brazo del "+"
procesar(512, escala=0.75).save(DEST / "icon-maskable-512.png")

# apple-touch-icon: mismo tratamiento que el normal, ya sale en RGB opaco
procesar(180, escala=0.90).save(DEST / "apple-touch-icon.png")

# favicon: algo menos de margen, para que el trazo no se pierda a 48px
procesar(48, escala=0.94).save(DEST / "favicon.png")

# marca: transparencia real, para fundirse con el fondo de verdad de la
# app (--tinta-honda) en vez de llevar su propio recuadro azul encima
recortar_a_transparencia(480).save(DEST / "logo-marca.png", optimize=True)

print(f"6 ficheros -> {DEST}/ (fuente: {FUENTE})")
