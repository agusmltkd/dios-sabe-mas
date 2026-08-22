#!/usr/bin/env python3
"""
digitalizar.py — Devocionario en papel -> JSON estructurado.

Tres pasos, en este orden:

    python digitalizar.py indice   fotos_indice/     # -> manifiesto.json
    python digitalizar.py paginas  fotos_paginas/    # -> oraciones.json
    python digitalizar.py validar                    # -> informe en pantalla

El manifiesto se saca del índice del libro y es la verdad de referencia:
300 títulos con su página y su capítulo. Todo lo que salga del paso 2 se
contrasta contra él.

Requiere:  pip install anthropic pillow
           export ANTHROPIC_API_KEY=...
"""

import base64
import io
import json
import os
import re
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

from PIL import Image
from anthropic import Anthropic

MODELO = "claude-sonnet-4-6"
LADO_MAX = 1600          # px; suficiente para OCR y no dispara el coste
MANIFIESTO = Path("manifiesto.json")
ORACIONES = Path("oraciones.json")

cliente = Anthropic()


# --------------------------------------------------------------------------
# utilidades
# --------------------------------------------------------------------------

def preparar(ruta: Path) -> dict:
    """Reescala y devuelve el bloque de imagen para la API."""
    img = Image.open(ruta)
    img = img.convert("RGB")
    if max(img.size) > LADO_MAX:
        factor = LADO_MAX / max(img.size)
        img = img.resize((int(img.width * factor), int(img.height * factor)),
                         Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88)
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": "image/jpeg",
            "data": base64.standard_b64encode(buf.getvalue()).decode(),
        },
    }


def pedir_json(bloques, sistema: str, max_tokens: int = 8000):
    """Llama al modelo y parsea la respuesta como JSON."""
    r = cliente.messages.create(
        model=MODELO,
        max_tokens=max_tokens,
        system=sistema,
        messages=[{"role": "user", "content": bloques}],
    )
    texto = "".join(b.text for b in r.content if b.type == "text").strip()
    texto = re.sub(r"^```(?:json)?|```$", "", texto, flags=re.M).strip()
    return json.loads(texto)


def normalizar(s: str) -> str:
    """Minúsculas, sin tildes, sin puntuación. Para comparar y para buscar."""
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ ]+", " ", s).strip()


def parecido(a: str, b: str) -> float:
    return SequenceMatcher(None, normalizar(a), normalizar(b)).ratio()


def fotos(carpeta: str):
    exts = {".jpg", ".jpeg", ".png", ".heic", ".webp"}
    return sorted(p for p in Path(carpeta).iterdir() if p.suffix.lower() in exts)


# --------------------------------------------------------------------------
# paso 1 — el índice
# --------------------------------------------------------------------------

SISTEMA_INDICE = """Estás transcribiendo el índice de un devocionario en español.

Devuelve SOLO un array JSON, sin preámbulo y sin ```. Cada elemento:
{"n": 57, "titulo": "Para cuando me obsesiono con un error cometido",
 "capitulo": "Vida interior", "pagina": 64}

Reglas:
- "n" es el número de la oración tal como aparece impreso.
- "titulo" literal, respetando tildes y mayúsculas. Sin el "..." final si lo hay.
- "capitulo" es el encabezado de sección bajo el que está esa entrada.
  Si la página de índice no muestra encabezado, pon null.
- Si una línea está cortada o ilegible, inclúyela igualmente con
  "duda": true y transcribe lo que se lea.
- No inventes entradas que no veas."""


def paso_indice(carpeta):
    entradas = []
    for f in fotos(carpeta):
        print(f"  índice: {f.name}", flush=True)
        try:
            entradas += pedir_json([preparar(f),
                                    {"type": "text", "text": "Transcribe este índice."}],
                                   SISTEMA_INDICE)
        except Exception as e:
            print(f"    !! fallo en {f.name}: {e}")

    # arrastrar el capítulo hacia abajo cuando la página no lo repetía
    actual = None
    for e in sorted(entradas, key=lambda x: x.get("n", 0)):
        if e.get("capitulo"):
            actual = e["capitulo"]
        else:
            e["capitulo"] = actual

    entradas.sort(key=lambda x: x.get("n", 0))
    MANIFIESTO.write_text(json.dumps(entradas, ensure_ascii=False, indent=2),
                          encoding="utf-8")

    nums = [e["n"] for e in entradas]
    faltan = sorted(set(range(1, max(nums) + 1)) - set(nums)) if nums else []
    print(f"\n{len(entradas)} entradas -> {MANIFIESTO}")
    if faltan:
        print(f"OJO, no aparecen: {faltan}")
    dudas = [e["n"] for e in entradas if e.get("duda")]
    if dudas:
        print(f"Revisa a mano: {dudas}")


# --------------------------------------------------------------------------
# paso 2 — las páginas
# --------------------------------------------------------------------------

SISTEMA_PAGINAS = """Estás transcribiendo páginas de un devocionario en español.

Cada oración lleva un número grande manuscrito, un título manuscrito que
empieza por "Para", una barra vertical de separación y el cuerpo en varios
párrafos. En una misma página puede haber más de una oración, y una oración
puede continuar en la página siguiente.

Devuelve SOLO un array JSON, sin preámbulo y sin ```. Cada elemento:
{"n": 57,
 "titulo": "Para cuando me obsesiono con un error cometido",
 "parrafos": ["...", "...", "..."],
 "pagina": 64,
 "completa": true}

Reglas:
- Un elemento por oración, no por página.
- "parrafos": el cuerpo separado tal como está impreso. Sin el título dentro.
- "completa": false si el texto se corta al final de la imagen y sigue después.
- Respeta tildes, comas y mayúsculas exactamente. No corrijas el estilo del
  autor ni reformules nada.
- Si en la imagen se transparenta el texto de la cara opuesta de la hoja,
  ignóralo.
- Si un fragmento es ilegible, escribe [ilegible] en su sitio.
- No inventes texto para rellenar."""


def paso_paginas(carpeta):
    archivos = fotos(carpeta)
    salida, i = [], 0
    # de dos en dos y con solape de una, para no perder oraciones a caballo
    while i < len(archivos):
        lote = archivos[i:i + 2]
        print(f"  páginas: {', '.join(f.name for f in lote)}", flush=True)
        bloques = [preparar(f) for f in lote]
        bloques.append({"type": "text",
                        "text": "Transcribe las oraciones de estas páginas."})
        try:
            salida += pedir_json(bloques, SISTEMA_PAGINAS)
        except Exception as e:
            print(f"    !! fallo: {e}")
        i += 1 if len(lote) == 2 else 2

    # unir trozos de la misma oración y quedarse con la versión más larga
    porn = {}
    for o in salida:
        n = o.get("n")
        if n is None:
            continue
        if n not in porn:
            porn[n] = o
        else:
            viejo = porn[n]
            if not viejo.get("completa"):
                nuevos = [p for p in o["parrafos"] if p not in viejo["parrafos"]]
                viejo["parrafos"] += nuevos
                viejo["completa"] = o.get("completa", True)
            elif len(" ".join(o["parrafos"])) > len(" ".join(viejo["parrafos"])):
                porn[n] = o

    final = [porn[k] for k in sorted(porn)]
    for o in final:
        o["busqueda"] = normalizar(o["titulo"] + " " + " ".join(o["parrafos"]))

    ORACIONES.write_text(json.dumps(final, ensure_ascii=False, indent=2),
                         encoding="utf-8")
    print(f"\n{len(final)} oraciones -> {ORACIONES}")


# --------------------------------------------------------------------------
# paso 3 — validar contra el manifiesto
# --------------------------------------------------------------------------

def paso_validar():
    if not (MANIFIESTO.exists() and ORACIONES.exists()):
        sys.exit("Faltan manifiesto.json u oraciones.json.")

    man = {e["n"]: e for e in json.loads(MANIFIESTO.read_text(encoding="utf-8"))}
    ora = {o["n"]: o for o in json.loads(ORACIONES.read_text(encoding="utf-8"))}

    print(f"Manifiesto: {len(man)}   Transcritas: {len(ora)}\n")

    faltan = sorted(set(man) - set(ora))
    sobran = sorted(set(ora) - set(man))
    if faltan:
        print("NO TRANSCRITAS (vuelve a fotografiar su página):")
        for n in faltan:
            print(f"  {n:>3}  p.{man[n].get('pagina','?')}  {man[n]['titulo']}")
        print()
    if sobran:
        print(f"No están en el índice: {sobran}\n")

    problemas = []
    for n, o in sorted(ora.items()):
        cuerpo = " ".join(o["parrafos"])
        if n in man and parecido(o["titulo"], man[n]["titulo"]) < 0.85:
            problemas.append((n, f"título distinto del índice: «{o['titulo']}»"))
        if len(cuerpo.split()) < 25:
            problemas.append((n, f"cuerpo muy corto ({len(cuerpo.split())} palabras)"))
        if "[ilegible]" in cuerpo:
            problemas.append((n, "contiene [ilegible]"))
        if not o.get("completa", True):
            problemas.append((n, "quedó marcada como incompleta"))
        if len(o["parrafos"]) < 2:
            problemas.append((n, "un solo párrafo, revisa el troceado"))

    if problemas:
        print("A REVISAR A OJO:")
        for n, m in problemas:
            print(f"  {n:>3}  {m}")
    else:
        print("Sin incidencias.")

    # enriquecer con capítulo y página del índice
    for n, o in ora.items():
        if n in man:
            o["capitulo"] = man[n].get("capitulo")
            o.setdefault("pagina", man[n].get("pagina"))
    ORACIONES.write_text(
        json.dumps([ora[k] for k in sorted(ora)], ensure_ascii=False, indent=2),
        encoding="utf-8")

    revisar = len(faltan) + len({n for n, _ in problemas})
    print(f"\nDe {len(man)} oraciones, tienes que mirar {revisar} a mano.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    modo = sys.argv[1]
    if modo == "indice":
        paso_indice(sys.argv[2])
    elif modo == "paginas":
        paso_paginas(sys.argv[2])
    elif modo == "validar":
        paso_validar()
    else:
        sys.exit(__doc__)
