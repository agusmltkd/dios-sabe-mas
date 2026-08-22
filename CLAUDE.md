# Dios sabe más — app del devocionario

PWA para consultar las 300 oraciones del devocionario **Dios sabe más** de
Ignacio del Rey, para tenerlas a mano en el móvil sin cargar con el libro.

---

## Estado

Maqueta visual terminada (18 pantallas). El contenido **no está digitalizado
todavía**: el pipeline de OCR está escrito pero sin ejecutar. No existe aún la
PWA real, solo el mockup estático.

Siguiente paso: fotografiar el índice del libro y ejecutar `digitalizar.py indice`.

---

## Contexto que condiciona todo lo demás

**El libro está publicado por una editorial.** En un contrato de edición
estándar el autor cede los derechos de explotación, normalmente incluida la
modalidad digital y las obras derivadas — y una app lo es. Aunque el autor dé
su permiso personal, publicar puede depender de la editorial.

Consecuencias prácticas, que no se negocian:

- **Repo privado siempre.** El JSON con las 300 oraciones no puede acabar en
  un GitHub Pages público. Si se despliega la PWA para enseñarla, el HTML
  puede ser público pero el contenido se importa aparte a IndexedDB.
- Digitalizar el libro para uso propio entra en copia privada (art. 31.2 LPI).
  Distribuirlo, no.
- Para la prueba con la primera persona que lo valore: build recortada de
  25-30 oraciones, o usarla en el móvil del autor del proyecto con ella
  delante. No un JSON completo en el teléfono de otra persona.
- El botón **"Comprar el libro"** y la atribución obligatoria al compartir no
  son adorno: son el argumento de que la app empuja hacia el papel en vez de
  canibalizarlo. No quitarlos.

### Plan de aproximación

1. Maqueta → validación con una amiga que conoce el libro (feedback abierto,
   todo: concepto, diseño, si la usaría).
2. Conversación con el autor. Preguntarle **qué firmó**: si cedió el digital,
   por cuántos años, en exclusiva.
3. Si hay vía libre, hablar con la editorial. Modelo previsto: **de pago**.

---

## El libro

- **Título:** Dios sabe más
- **Autor:** Ignacio del Rey, párroco de San Miguel Arcángel y San Francisco
  de Asís, Morón de la Frontera
- Presentado en la sede en Sevilla de la Fundación Caja Rural del Sur, agosto
  de 2026. Muy reciente: **no hay EPUB**, hay que hacer OCR.
- 300 oraciones numeradas, agrupadas en capítulos por tipo.
- Tiene **índice temático** y una **presentación del autor y la obra**.
- Los títulos empiezan siempre por "Para…".
- La cubierta fotografiada pone "Nada queda fuera de la mirada / PADRE".
  **Pendiente de aclarar** si PADRE es un volumen, una parte del libro o un
  capítulo. Hasta saberlo, no usar PADRE como marca de la app.

### Cómo se usa en papel (informa el diseño)

Se busca por el índice y por páginas marcadas. La necesidad real es
consultar una oración concreta **en mitad del día, sin el libro cerca**.

---

## Sistema visual

Todo sale del objeto físico. No inventar paleta.

```
--tinta        #3E5A67   azul pizarra de la cubierta
--tinta-honda  #294351   fondo del modo noche
--tinta-suave  #7D97A3   secundario, numerales
--papel        #FBF8F2   blanco cálido de la página
--papel-hueso  #F3EDE1   hojas inferiores, chips
--crema        #EFE2C6   crema del título de cubierta
--linea        rgba(62,90,103,.16)
--fondo        #0E1418   fondo del documento de presentación
```

**Tipografía:** `Sacramento` para numerales y títulos de oración (equivale a
la manuscrita del libro), `Jost` 200/300/400 para el resto (geométrica ligera,
equivale al cuerpo impreso). Van **incrustadas en base64** en el HTML: el
contenedor no tiene acceso a fonts.googleapis.com, y así el fichero funciona
sin internet. Se sacan de npm (`@fontsource/jost`, `@fontsource/sacramento`),
que sí está permitido.

**Elemento firma: la barra vertical.** Es el separador que el libro imprime
entre el número y el texto de cada oración. En la app se reutiliza como:
indicador de progreso en la pantalla de lectura (se llena al bajar), viñeta en
las listas, y regla de las secciones. No sustituirla por un scrollbar normal.

Interlineado ancho y cuerpo ligero, imitando la composición del papel, para
que quien conoce el libro reconozca la página.

---

## Decisiones de producto ya tomadas

- **Lo primero es el buscador, no un menú.** Quien abre la app trae algo
  concreto encima.
- **Índice por capítulos del libro**, no por número de página. Se conserva la
  numeración del papel para poder decir "la 57" y entenderse.
- **Búsqueda sin tildes ni mayúsculas**, sobre título + cuerpo, con un campo
  `busqueda` precalculado. 300 entradas: un `filter()` basta, no hace falta
  motor de búsqueda.
- **Sin resultados reencamina en vez de disculparse**: del hecho concreto
  ("hipoteca") al sentimiento ("agobio"), que es como está escrito el libro.
- **Modo noche** con los dos colores de la cubierta invertidos. Muchas de
  estas oraciones se rezan a última hora.
- **Compartir manda texto, no imagen**, siempre con título y autor pegados.
  La imagen para redes queda apuntada para más adelante.
- **Sin cuentas ni sincronización.** Todo local, offline, como el libro.
- **Wake Lock** ("pantalla siempre encendida") en ajustes: barato y de lo que
  más se agradece rezando.
- Alcance v1: **solo lectura** más guardadas. Notas y diario de oración,
  después.

### Notificaciones — decidido: NO en la demo

El deseo era "todos los días a las 22, dame esta oración". Una PWA en iOS **no
puede** hacerlo: no hay Notification Triggers API y no puede despertarse sola.
Alternativas evaluadas: push desde un Worker de Cloudflare con cron (funciona
en iOS 16.4+ solo si está instalada en pantalla de inicio, pero exige servidor
y guardar suscripciones), o un `.ics` recurrente.

**Decisión: no implementarlo.** Se anota como "requiere app nativa" y se usa
como argumento el día que se discuta la App Store.

---

## Plan técnico

**v1: PWA**, un solo fichero, desplegada en privado. App Store se valorará
después, y solo si la editorial da luz verde.

### Pipeline de digitalización — `digitalizar.py`

Tres pasos, en este orden. El orden importa.

```bash
python digitalizar.py indice   fotos_indice/     # -> manifiesto.json
python digitalizar.py paginas  fotos_paginas/    # -> oraciones.json
python digitalizar.py validar                    # -> informe
```

**El índice va primero y es la clave del diseño.** Las páginas de índice dan
los 300 títulos con su página y su capítulo: ese manifiesto es la verdad de
referencia contra la que se valida todo lo demás. Si el OCR se salta la 147 o
parte la 208 en dos, salta en la validación en vez de descubrirse meses después.
Y las categorías las da el autor, no hay que inventarlas.

Detalles no obvios del script:

- Las páginas van **de dos en dos avanzando de una en una**, para no perder
  oraciones que quedan a caballo entre dos páginas. El deduplicado por número
  las reensambla usando el flag `completa`.
- Al prompt se le dice explícitamente que **ignore la transparencia** del
  texto de la cara opuesta de la hoja. Sin ese aviso el modelo mete frases
  fantasma; el papel del libro transparenta bastante.
- Se le prohíbe corregir el estilo del autor o rellenar huecos: los
  fragmentos ilegibles se marcan `[ilegible]` y salen en la validación.
- Fotos con Adobe Scan o vFlat, que corrigen la curvatura del lomo. No
  escáner plano.
- Coste estimado: unas 200 llamadas, del orden de 3-6 €.

### Esquema de datos

```json
{
  "n": 59,
  "titulo": "Para iniciar una tarea difícil",
  "parrafos": ["...", "..."],
  "pagina": 65,
  "capitulo": "Vida interior",
  "completa": true,
  "busqueda": "para iniciar una tarea dificil dios de mi vida ante..."
}
```

---

## Ficheros

| Fichero | Qué es |
|---|---|
| `digitalizar.py` | Pipeline OCR: índice, páginas, validación |
| `plantilla.html` | Fuente de la maqueta, con `/*FUENTES*/` como marcador |
| `construir.py` | Incrusta las fuentes en base64 y genera HTML + PDF |
| `dios-sabe-mas-pantallas.html` | Maqueta final, 18 pantallas, autocontenida |
| `dios-sabe-mas-pantallas.pdf` | 9 páginas A4 apaisadas, para enseñar |
| `fuentes/` | Paquetes de @fontsource descargados de npm |

`construir.py` usa Playwright con Chromium para imprimir a PDF. En impresión
la galería pasa a flexbox con `justify-content:center` (con grid las filas
incompletas no se centran) y salto de página cada 4 pantallas.

Los cuerpos de las oraciones en la maqueta son **texto de relleno a
propósito**. Los títulos, la numeración y los datos del autor son reales:
así se enseña la forma sin haber distribuido contenido.

---

## Preguntas abiertas

- ¿Qué es "PADRE" en la cubierta?
- ¿Cuántos capítulos tiene exactamente el índice? De eso depende si la
  navegación cabe en una pantalla o necesita acordeón.
- ¿Qué cedió el autor a la editorial?
- Precio y modelo de distribución si sale adelante.
