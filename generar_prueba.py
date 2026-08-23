#!/usr/bin/env python3
"""
generar_prueba.py — Genera oraciones.json de PRUEBA para poder usar la PWA
antes de tener el libro digitalizado.

No sustituye a digitalizar.py. Es solo un banco de datos de mentira con la
misma forma exacta que producirá el pipeline real (mismo esquema, mismos
campos), para poder construir y probar la app (buscador, índice, lectura,
guardadas...) sin haber fotografiado todavía una sola página.

Contenido de este banco de pruebas:

- 9 entradas con número y título REALES, tal como aparecen ya en
  dios-sabe-mas-pantallas.html (la maqueta ya los usa, así que no son
  contenido nuevo). El capítulo y la página de las que no se veían en la
  maqueta (12, 14, 88) son una estimación razonada, no un dato confirmado.
- El resto son entradas FICTICIAS (número, título y cuerpo inventados por
  Claude, marcadas con "ficticio": true) solo para tener volumen con el que
  probar capítulos, búsqueda e índice. No pretenden ser oraciones reales del
  libro.
- El cuerpo de TODAS las entradas es texto de relleno a propósito, igual que
  ya hace la maqueta con las suyas.

Al ejecutar el pipeline real (`digitalizar.py`), este fichero se sustituye
sin más por el oraciones.json de verdad.

Uso:
    python generar_prueba.py        # -> oraciones.json
"""

import json
import re
import unicodedata
from datetime import date
from pathlib import Path

ORACIONES = Path("oraciones.json")

# Sube esto a mano cada vez que cambie el contenido. La app compara esta
# cadena con la que ya tiene guardada: si difiere, se baja el contenido
# nuevo; si coincide, no gasta datos. También se enseña en Ajustes, para
# saber qué versión tiene alguien cuando diga "a mí no me sale eso".
VERSION_CONTENIDO = "prueba-1"

RELLENO = [
    "[Texto de prueba: aquí irá el cuerpo real de la página del libro, "
    "obtenido con digitalizar.py.]",
    "Este párrafo es solo de relleno para comprobar que las tarjetas, el "
    "buscador y la pantalla de lectura funcionan con un texto de un largo "
    "razonable.",
    "Cuando llegue el contenido real, este fichero de prueba se sustituye "
    "entero por el oraciones.json que genera el pipeline.",
]

# (n, titulo, capitulo, pagina, ficticio)
ENTRADAS = [
    # -- reales, ya usadas en la maqueta --
    (14, "Para un día que me viene grande", "Cada día", 25, False),
    (55, "Para aceptar lo que no elegí", "Vida interior", 62, False),
    (56, "Para el silencio que me incomoda", "Vida interior", 63, False),
    (57, "Para cuando me obsesiono con un error cometido", "Vida interior", 64, False),
    (58, "Para abandonar deseos insanos", "Vida interior", 64, False),
    (59, "Para iniciar una tarea difícil", "Vida interior", 65, False),
    (60, "Para no depender del reconocimiento", "Vida interior", 66, False),
    (12, "Antes de una conversación difícil", "Los otros", 145, False),
    (88, "Para el agotamiento del trabajo", "El trabajo", 195, False),

    # -- ficticias, solo para tener volumen que indexar y buscar --
    (201, "Para el primer café del día", "Cada día", 21, True),
    (202, "Para cuando se me hace tarde", "Cada día", 40, True),
    (210, "Para la herida que no cicatriza", "La herida", 105, True),
    (211, "Para cuando me cuesta perdonarme", "La herida", 118, True),
    (212, "Para el rencor que no suelto", "La herida", 130, True),
    (220, "Para quien me hizo daño", "Los otros", 150, True),
    (221, "Para la amistad que se enfría", "Los otros", 170, True),
    (230, "Para el primer día en un trabajo nuevo", "El trabajo", 183, True),
    (231, "Para cuando el esfuerzo no se nota", "El trabajo", 205, True),
    (240, "Para la sala de espera", "La enfermedad", 218, True),
    (241, "Para quien cuida a un enfermo", "La enfermedad", 228, True),
    (242, "Para antes de una operación", "La enfermedad", 240, True),
    (250, "Para el que se ha ido", "La despedida", 249, True),
    (251, "Para un aniversario difícil", "La despedida", 260, True),
    (252, "Para cuando falta alguien en la mesa", "La despedida", 272, True),
    (260, "Para un día que salió bien", "Gratitud", 278, True),
    (261, "Para lo que no supe agradecer a tiempo", "Gratitud", 300, True),
]

# orden real de los capítulos tal como aparecen en el índice del libro
ORDEN_CAPITULOS = [
    "Cada día", "Vida interior", "La herida", "Los otros",
    "El trabajo", "La enfermedad", "La despedida", "Gratitud",
]


def normalizar(s: str) -> str:
    """Minúsculas, sin tildes, sin puntuación. Igual que en digitalizar.py,
    para que busqueda se calcule exactamente con la misma regla."""
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ ]+", " ", s).strip()


def construir():
    salida = []
    for n, titulo, capitulo, pagina, ficticio in sorted(ENTRADAS):
        parrafos = list(RELLENO) if not ficticio else [
            f"[Oración de prueba nº{n}, inventada para probar la app. "
            "No es contenido del libro.]",
        ] + RELLENO[1:]
        o = {
            "n": n,
            "titulo": titulo,
            "parrafos": parrafos,
            "pagina": pagina,
            "capitulo": capitulo,
            "completa": True,
            "ficticio": ficticio,
        }
        o["busqueda"] = normalizar(titulo + " " + " ".join(parrafos))
        salida.append(o)

    payload = {
        "version": VERSION_CONTENIDO,
        "fecha": date.today().isoformat(),
        "oraciones": salida,
    }
    ORACIONES.write_text(json.dumps(payload, ensure_ascii=False, indent=2),
                         encoding="utf-8")

    reales = sum(1 for o in salida if not o["ficticio"])
    print(f"{len(salida)} oraciones de prueba -> {ORACIONES} "
          f"({reales} reales, {len(salida) - reales} ficticias)")
    print(f"Versión del contenido: {VERSION_CONTENIDO} · {payload['fecha']}")
    print(f"Capítulos: {', '.join(ORDEN_CAPITULOS)}")


if __name__ == "__main__":
    construir()
