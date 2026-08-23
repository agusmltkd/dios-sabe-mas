#!/usr/bin/env python3
"""
generar_iconos.py — Icono de la PWA.

Intento de recrear a mano (sin el fichero original) el logo que se decidió
para la app: el trazo "↑ = +" en blanco sobre el azul del proyecto. Al no
tener el fichero real, esto es una versión limpia con líneas gruesas de
cabo redondeado — no lleva la textura de pincel del original. Si el
fichero real llega en algún momento, este script se sustituye por uno que
simplemente reescale ese PNG/SVG a los tamaños de abajo.

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

TINTA = (62, 90, 103, 255)        # --tinta, el azul del proyecto
BLANCO = (255, 255, 255, 255)
DEST = Path("iconos")
DEST.mkdir(exist_ok=True)


def trazo(draw: ImageDraw.ImageDraw, p1, p2, ancho: float, color):
    """Línea gruesa con los dos cabos redondeados, para que parezca un
    trazo de pincel y no un segmento con las puntas cuadradas."""
    draw.line([p1, p2], fill=color, width=round(ancho))
    r = ancho / 2
    for (x, y) in (p1, p2):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


def marca(tamano: int, escala: float = 0.62) -> Image.Image:
    """↑ = + centrados, en blanco, sobre un cuadrado redondeado en tinta.
    `escala` es cuánto del ANCHO del lienzo ocupa la fila entera de los 3
    símbolos (más pequeño para la variante maskable, que Android recorta
    en círculo)."""
    img = Image.new("RGBA", (tamano, tamano), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, tamano - 1, tamano - 1],
                         radius=tamano * 0.18, fill=TINTA)

    cy = tamano / 2
    ancho_fila = tamano * escala     # ancho total de los 3 glifos + huecos
    gw = ancho_fila / 4              # ancho de cada glifo (3 glifos + 2 huecos de gw/2)
    hueco = gw / 2
    paso = gw + hueco                # distancia centro a centro

    alto = tamano * 0.36             # alto de cada glifo (independiente del ancho)
    medio = alto / 2
    ancho_trazo = gw * 0.26

    cx0 = tamano / 2 - paso          # centro del primer glifo (↑)
    cx1 = tamano / 2                 # centro del segundo (=)
    cx2 = tamano / 2 + paso          # centro del tercero (+)

    # ↑ — tallo más punta en V
    x = cx0
    trazo(d, (x, cy + medio), (x, cy - medio * 0.25), ancho_trazo, BLANCO)
    trazo(d, (x, cy - medio), (x - gw * 0.5, cy - medio * 0.15), ancho_trazo, BLANCO)
    trazo(d, (x, cy - medio), (x + gw * 0.5, cy - medio * 0.15), ancho_trazo, BLANCO)

    # = — dos líneas horizontales
    x = cx1
    y1 = cy - medio * 0.42
    y2 = cy + medio * 0.42
    trazo(d, (x - gw / 2, y1), (x + gw / 2, y1), ancho_trazo, BLANCO)
    trazo(d, (x - gw / 2, y2), (x + gw / 2, y2), ancho_trazo, BLANCO)

    # + — cruz
    x = cx2
    trazo(d, (x, cy - medio), (x, cy + medio), ancho_trazo, BLANCO)
    trazo(d, (x - gw / 2, cy), (x + gw / 2, cy), ancho_trazo, BLANCO)

    return img


def opaco(tamano: int, escala: float = 0.62) -> Image.Image:
    """Igual, pero sin esquinas redondeadas ni transparencia (apple-touch-
    icon: iOS le pone su propio marco y no quiere alfa)."""
    con_alfa = marca(tamano, escala)
    fondo = Image.new("RGB", (tamano, tamano), TINTA[:3])
    fondo.paste(con_alfa, (0, 0), con_alfa)
    return fondo


# iconos normales
marca(192, escala=0.60).save(DEST / "icon-192.png")
marca(512, escala=0.60).save(DEST / "icon-512.png")

# maskable: Android recorta hasta un círculo inscrito, así que la fila de
# símbolos tiene que caber en la zona segura central (~80% del lienzo)
marca(512, escala=0.42).save(DEST / "icon-maskable-512.png")

# apple-touch-icon: opaco, iOS redondea el propio
opaco(180, escala=0.60).save(DEST / "apple-touch-icon.png")

# favicon pequeño: trazo relativamente más grueso para que no desaparezca
marca(48, escala=0.66).save(DEST / "favicon.png")

print(f"5 iconos -> {DEST}/")
