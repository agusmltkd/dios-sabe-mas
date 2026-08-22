#!/usr/bin/env python3
"""
generar_iconos.py — Icono provisional de la PWA.

No hay todavía un logo diseñado para la app, así que este script dibuja un
icono mínimo con el único elemento de marca que el proyecto ya tiene
decidido: la barra vertical del libro (ver CLAUDE.md, "Elemento firma"),
en tinta sobre crema. Es un marcador de posición fácil de tirar el día que
haya un icono de verdad — basta con sustituir los PNG en iconos/.

Genera:
    iconos/icon-192.png            (cualquier uso)
    iconos/icon-512.png            (cualquier uso)
    iconos/icon-maskable-512.png   (con margen de seguridad para Android)
    iconos/apple-touch-icon.png    (180x180, fondo opaco, sin transparencia)
    iconos/favicon.png             (48x48, para la pestaña del navegador)

Uso:
    python generar_iconos.py
"""

from pathlib import Path
from PIL import Image, ImageDraw

TINTA = (62, 90, 103, 255)        # --tinta
CREMA = (239, 226, 198, 255)      # --crema
DEST = Path("iconos")
DEST.mkdir(exist_ok=True)


def barra(tamano: int, radio_esquina: float, alto_barra: float, ancho_barra: float) -> Image.Image:
    """Cuadrado redondeado en tinta con la barra vertical en crema, centrada."""
    img = Image.new("RGBA", (tamano, tamano), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, tamano - 1, tamano - 1],
                         radius=tamano * radio_esquina, fill=TINTA)
    bw = tamano * ancho_barra
    bh = tamano * alto_barra
    x0 = (tamano - bw) / 2
    y0 = (tamano - bh) / 2
    d.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], radius=bw / 2, fill=CREMA)
    return img


def opaco(tamano: int, alto_barra: float, ancho_barra: float) -> Image.Image:
    """Igual, pero sin esquinas redondeadas ni transparencia (apple-touch-icon:
    iOS le pone su propio marco y no quiere alfa)."""
    img = Image.new("RGB", (tamano, tamano), TINTA[:3])
    d = ImageDraw.Draw(img)
    bw = tamano * ancho_barra
    bh = tamano * alto_barra
    x0 = (tamano - bw) / 2
    y0 = (tamano - bh) / 2
    d.rounded_rectangle([x0, y0, x0 + bw, y0 + bh], radius=bw / 2, fill=CREMA)
    return img


# iconos normales: esquina suave, barra ocupa buena parte del alto
barra(192, radio_esquina=0.18, alto_barra=0.56, ancho_barra=0.16).save(DEST / "icon-192.png")
barra(512, radio_esquina=0.18, alto_barra=0.56, ancho_barra=0.16).save(DEST / "icon-512.png")

# maskable: Android recorta hasta un círculo inscrito, así que el contenido
# tiene que caber en la zona segura central (~80% del lienzo)
barra(512, radio_esquina=0, alto_barra=0.42, ancho_barra=0.12).save(DEST / "icon-maskable-512.png")

# apple-touch-icon: opaco, iOS redondea el propio
opaco(180, alto_barra=0.5, ancho_barra=0.15).save(DEST / "apple-touch-icon.png")

# favicon pequeño: barra un poco más gruesa para que no desaparezca a 16-32px
barra(48, radio_esquina=0.22, alto_barra=0.6, ancho_barra=0.22).save(DEST / "favicon.png")

print(f"5 iconos -> {DEST}/")
