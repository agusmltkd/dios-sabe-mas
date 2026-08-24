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
- logo-apertura: para la pantalla de apertura (splash), NO como icono —
  reescalado sin recorte ni margen extra, más ligero que el original
  (1MB de PNG en cada apertura de la app sería demasiado), con la paleta
  reducida porque el motivo es casi bicolor y así pesa una cuarta parte.

Genera:
    iconos/icon-192.png
    iconos/icon-512.png
    iconos/icon-maskable-512.png
    iconos/apple-touch-icon.png
    iconos/favicon.png
    iconos/logo-apertura.png

Uso:
    python generar_iconos.py
"""

from pathlib import Path
from PIL import Image

FUENTE = Path("iconos/logo.png")
DEST = Path("iconos")


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

# apertura: el logo entero, sin recorte de icono — se ve en pantalla
# completa "incrustado" en el fondo de la splash, no como un icono flotando
origen = Image.open(FUENTE).convert("RGB")
apertura = origen.resize((480, 480), Image.LANCZOS).quantize(colors=48, method=Image.MEDIANCUT)
apertura.save(DEST / "logo-apertura.png", optimize=True)

print(f"6 ficheros -> {DEST}/ (fuente: {FUENTE})")
