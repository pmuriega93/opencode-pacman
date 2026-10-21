# SPEC 01 — Cuatro fantasmas con comportamientos distintos

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-10-21
> **Objetivo:** Cuatro fantasmas con IA propia persiguen a Pacman por el laberinto, y uno de ellos lo hace de forma agresiva y directa.

## Scope

**In:**

- Cuatro fantasmas en partida, cada uno con un tipo (`kind`) y una IA propia.
- Un fantasma agresivo (`blinky`) que alcanza a Pacman por la ruta más corta real del laberinto.
- Tres comportamientos distintos adicionales: emboscada por delante, interceptación por vectores y deambular errático.
- Cálculo de rutas por BFS sobre la cuadrícula, con prioridad clásica al empatar.
- Media vuelta permitida en cualquier celda, no solo en callejones.
- Velocidad propia por fantasma.
- Color propio por fantasma, ligado a su tipo y no a su posición en el array.

**Out of scope (para futuros specs):**

- Modo asustado, power pellets y reglas de comer fantasmas.
- Cualquier otra IA: huida, acecho, frightened o de dispersión.
- Leyenda con nombres en el HUD y siluetas distintas por fantasma.
- Cambios en el laberinto, niveles, puntuación, vidas o audio.
- Controles táctiles, móvil, multipantalla.
- Tests automatizados o tooling nuevo (el repo no tiene `package.json`).

## Modelo de datos

```js
// src/js/maze.js
// Los 4 arrancan dentro de la pen (filas 13-15, cols 11-16).
// La puerta (fila 12, cols 13-14) es transitable para fantasmas.
const GHOST_STARTS = [
  { x: 13, y: 14, kind: "blinky" }, // agresivo: persigue directo a Pacman
  { x: 14, y: 14, kind: "pinky" }, // emboscada: 4 celdas por delante de Pacman
  { x: 11, y: 14, kind: "inky" }, // intercepción: vector desde Blinky
  { x: 16, y: 14, kind: "clyde" }, // errático: huye si está cerca
];
```

```js
// src/js/game.js
const GHOST_SPEEDS = {
  blinky: 0.125, // 1/8 celda/frame — agresivo, a la misma velocidad que Pacman
  pinky: 0.1, // 1/10 celda/frame
  inky: 0.1,
  clyde: 0.1,
};

// Desempate del arcade: arriba > izquierda > abajo > derecha.
const DIR_PRIORITY = ["up", "left", "down", "right"];
const PINKY_LOOKAHEAD = 4; // celdas por delante de Pacman
const INKY_LOOKAHEAD = 2; // celdas por delante de Pacman
const CLYDE_SCATTER_DISTANCE = 8; // en celdas (distancia euclídea)
```

```js
// src/js/render.js
// El color pasa a depender del tipo, no del índice del array.
const GHOST_COLORS = {
  blinky: "#ff0000", // rojo
  pinky: "#ffb8ff", // rosa
  inky: "#00ffff", // cian
  clyde: "#ffb852", // naranja
};
```

Firmas nuevas en `src/js/game.js`:

```js
// Celda objetivo de un fantasma según su tipo. Devuelve { x, y }.
function ghostTarget( game, ghost )

// Primer paso (dirección) de la ruta más corta desde (sx,sy) hasta (tx,ty).
// Devuelve null si no hay ruta. Los fantasmas atraviesan la puerta (valor 3).
function firstStepTowards( grid, sx, sy, tx, ty )
```

Reglas de decisión (en `decideGhost`, solo cuando el fantasma está centrado en una celda):

1. `target = ghostTarget( game, ghost )`.
2. Si el objetivo **es la celda actual** del fantasma (caso de Clyde cerca): se mueve por la primera dirección válida según `DIR_PRIORITY`. Deambula.
3. Si no: `dir = firstStepTowards(...)`. Si no hay ruta, se reintenta con la celda de Pacman; si tampoco hay ruta, se mantiene la dirección actual.
4. La media vuelta está permitida siempre: BFS no excluye la dirección opuesta.

Objetivos por tipo:

| Tipo     | Objetivo                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| `blinky` | Celda de Pacman. Persecución directa por la ruta más corta.                                                      |
| `pinky`  | 4 celdas por delante de Pacman en su dirección actual (recortado a los límites del laberinto).                   |
| `inky`   | Punto `base + (base - celdaDeBlinky)`, donde `base` son 2 celdas por delante de Pacman. Recortado a los límites. |
| `clyde`  | Celda de Pacman si la distancia euclídea supera 8 celdas; su propia celda si no.                                 |

Restricción de diseño: **las velocidades deben ser 1/N de celda por frame** (aquí 1/8 y 1/10). El motor decide la dirección cuando la posición queda centrada en la celda; una velocidad como 0.11 nunca alinea y el fantasma se sale del laberinto.

## Plan de implementación

1. **`src/js/maze.js`** — sustituir `GHOST_STARTS` por las 4 entradas con `kind`. Prueba manual: al abrir el juego aparecen 4 fantasmas dentro de la pen (hasta el paso 3 se mueven al azar, porque el código actual solo conoce `hunter`).
2. **`src/js/game.js`** — añadir `GHOST_SPEEDS`, `DIR_PRIORITY`, las constantes de comportamiento y la función `ghostTarget()`. Sin tocar la decisión todavía. Prueba manual: el juego arranca igual y sin errores en consola.
3. **`src/js/game.js`** — añadir `firstStepTowards()` (BFS con vecinos expandidos en orden `DIR_PRIORITY` y con el enlace del túnel en la fila 14) y reescribir `decideGhost()` con las reglas 1-4. Prueba manual: Blinky persigue a Pacman y los otros 3 se distinguen entre sí.
4. **`src/js/game.js`** — aplicar `GHOST_SPEEDS[ kind ]` en `createGame()` y comprobar que `resetPositions()` devuelve los 4 a su celda de inicio conservando su velocidad. Prueba manual: Blinky avanza más rápido; al perder una vida, los 4 vuelven a la pen.
5. **`src/js/render.js`** — sustituir el array `GHOST_COLORS` por el mapa por `kind` y usarlo en `draw()`. Prueba manual: los 4 fantasmas salen en rojo, rosa, cian y naranja.
6. **Verificación manual final** — recorrer la lista de criterios de aceptación en el navegador.

## Criterios de aceptación

- [ ] Al abrir `src/index.html` no hay errores en la consola del navegador.
- [ ] `createGame()` devuelve `game.ghosts` con 4 elementos, uno de cada tipo (`blinky`, `pinky`, `inky`, `clyde`).
- [ ] Los 4 fantasmas aparecen dentro de la pen y salen de ella sin quedarse bloqueados.
- [ ] Cada fantasma conserva su color y los 4 colores son distintos (rojo, rosa, cian, naranja).
- [ ] Blinky acorta la ruta: con Pacman quieto en una celda abierta, la distancia en celdas entre Blinky y Pacman disminuye en cada cruce.
- [ ] Pinky se interpone 4 celdas por delante de Pacman en la dirección en la que Pacman mira.
- [ ] Inky apunta al punto que resulta de duplicar el vector desde Blinky hasta 2 celdas por delante de Pacman.
- [ ] Clyde persigue a Pacman mientras está a más de 8 celdas y deja de perseguirlo al acercarse a 8 celdas o menos.
- [ ] Un fantasma puede invertir su dirección en una celda normal, no solo en un callejón.
- [ ] Blinky se mueve más rápido que los otros 3 (0.125 frente a 0.1 celdas/frame).
- [ ] Al perder una vida, los 4 fantasmas vuelven a su celda de inicio en la pen y Pacman a (13, 23).
- [ ] Ningún fantasma atraviesa paredes ni se sale del laberinto, y el túnel (fila 14) mantiene la conexión izquierda-derecha.
- [ ] La partida se puede ganar: se pueden comer todos los puntos y el estado pasa a `won`.

## Decisiones

- **Sí:** arquetipos del original (`blinky`, `pinky`, `inky`, `clyde`). Cada uno aporta un comportamiento claramente distinto y reconocible.
- **No:** un único cazador más tres variantes improvisadas. Menos carácter y peor diferenciación en juego.
- **Sí:** ruta más corta real por BFS para calcular el paso.
- **No:** elegir la dirección que más reduce la distancia a ojo. Produce oscilaciones en pasillos, callejones sin salida y un bucle infinito de entrar y salir de la pen.
- **No:** la tabla de prioridades pura del arcade sin mirar el objetivo. El fantasma "agresivo" no podría perseguir de verdad.
- **Sí:** todos los fantasmas dentro de la pen; salen por la puerta porque la ruta más corta hacia Pacman la incluye.
- **No:** liberación escalonada por contador de puntos. Es una mecánica que no se ha pedido.
- **No:** el agresivo fuera de la pen. No aporta al objetivo y complica el reinicio.
- **Sí:** media vuelta permitida siempre.
- **No:** mantener la restricción de invertir solo en callejones. Con 4 fantasmas la persecución se volvía predecible.
- **Sí:** Blinky a 0.125 celdas/frame y el resto a 0.1.
- **No:** 0.11 para el agresivo. No es múltiplo de 1/N, el fantasma nunca queda centrado en una celda y se sale del laberinto.
- **Sí:** desempate por prioridad clásica arriba > izquierda > abajo > derecha.
- **No:** desempate aleatorio. Rompería el carácter de Clyde, que quedaría indistinguible del resto.
- **Sí:** Clyde con distancia euclídea y umbral de 8 celdas, como en el original.
- **No:** Clyde con distancia Manhattan. Cambia en qué momento deja de perseguir y no coincide con el original.
- **Sí:** nombres solo internos (`kind`), sin leyenda en el HUD.
- **No:** leyenda en el HUD y siluetas distintas. El color basta para distinguirlos y el HUD queda limpio.
- **Sí:** el color se liga al `kind` y no al índice del array.
- **No:** overlay de depuración con los objetivos. La verificación es manual.
- **No:** tests automatizados. El repo no tiene `package.json` ni toolchain (`AGENTS.md`).
- **Sí:** la IA vive en `src/js/game.js`.
- **No:** archivo nuevo `ghosts.js`. El orden de carga de scripts es significativo y `AGENTS.md` lo fija.
- **No:** reproducir el bug del original de Pinky (4 arriba y 4 a la izquierda cuando Pacman mira arriba). Es un comportamiento no intencionado.

## Riesgos

| Riesgo                                                                                           | Mitigación                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Un fantasma con velocidad que no es 1/N deja de alinearse con las celdas y se sale del laberinto | Las velocidades del spec son 1/8 y 1/10. La restricción queda documentada en el propio spec y en los comentarios de `game.js`.                |
| El objetivo de Inky cae en una pared o fuera del laberinto                                       | Se recorta a los límites y, si la celda no es transitable, se usa la celda de Pacman como objetivo.                                           |
| Clyde, con objetivo en su propia celda, no tendría ruta y se quedaría parado                     | Regla explícita: cuando el objetivo es su propia celda, elige la primera dirección válida por prioridad clásica. Deambula.                    |
| La pen es un callejón sin salida: un fantasma podría quedarse dentro                             | La ruta más corta desde la pen hasta Pacman sale por la puerta (fila 12) porque es la única conexión; el objetivo se recalcula en cada cruce. |
| 4 fantasmas con el agresivo a la misma velocidad que Pacman hacen la partida muy difícil         | Es el objetivo pedido. Si al jugar resulta injugable, la velocidad de Blinky o las vidas se ajustan en un spec aparte.                        |

## Lo que **no** entra en este spec

- Modo asustado, power pellets, puntos por comer fantasmas.
- Cualquier otra IA que no sea la de estos 4 tipos.
- Leyenda de nombres en el HUD, siluetas distintas, animaciones propias.
- Cambios en el laberinto, en los niveles, en la puntuación o en las vidas.
- Controles táctiles, versión móvil, audio.
- Cualquier infraestructura de tests o build.

Cada uno de esos, si aterriza, va en su propio spec.
