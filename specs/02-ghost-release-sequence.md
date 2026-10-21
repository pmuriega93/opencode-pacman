# SPEC 02 — Salida escalonada de los fantasmas

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-21
> **Objetivo:** Blinky sale de la pen de inmediato y Pinky, Inky y Clyde salen de uno en uno, con un segundo de espera entre cada uno.

## Scope

**In:**

- Secuencia de salida escalonada al empezar la partida: Blinky (agresivo) sale de inmediato, Pinky a los 1 s, Inky a los 2 s y Clyde a los 3 s.
- Los fantasmas que aún no han salido se quedan dentro de la pen rebotando verticalmente.
- La secuencia se repite cuando Pacman pierde una vida: Blinky vuelve a salir primero y los otros 3 se liberan de nuevo a los 1 s, 2 s y 3 s.
- La cuenta atrás solo corre mientras la partida está en estado `playing`.

**Out of scope (para futuros specs):**

- Modo asustado, power pellets y puntos por comer fantasmas.
- Patrones de dispersión (scatter) y ciclo de direcciones del arcade.
- Cualquier señal visual de la cuenta atrás (contador, parpadeo, aviso en el HUD).
- Cambios en el laberinto, en los niveles, en la puntuación, en las vidas o en el audio.
- Controles táctiles, móvil, multipantalla.
- Tests automatizados o tooling nuevo (el repo no tiene `package.json`).

## Modelo de datos

```js
// src/js/maze.js
// Interior de la pen: filas 13-15, cols 11-16 (6x3), todas transitables.
// El rebote vertical usa solo top y bottom.
const PEN_BOUNDS = { top: 13, bottom: 15, left: 11, right: 16 };
```

```js
// src/js/game.js
// Retardo de salida por tipo, en milisegundos reales desde el inicio de la partida.
const GHOST_RELEASE_DELAYS = {
  blinky: 0, // agresivo: sale en el primer frame
  pinky: 1000, // emboscada: 1 s
  inky: 2000, // intercepción: 2 s
  clyde: 3000, // errático: 3 s
};
```

Cada fantasma de `game.ghosts` gana tres campos:

```js
{
  // ... campos actuales: x, y, dir, speed, kind
  status: "waiting" | "active", // waiting = dentro de la pen, esperando su turno
  bobDir: 1 | -1, // sentido del rebote vertical mientras espera
  releaseAt: <ms>, // instante real (performance.now()) en que se libera
}
```

Y el estado de partida gana un campo:

```js
// src/js/game.js — dentro de createGame()
startedAt: null, // performance.now() al empezar la partida; null = reloj sin arrancar
```

Reglas:

- Los 4 fantasmas empiezan con `status: "waiting"`, incluido Blinky.
- `releaseAt = startedAt + GHOST_RELEASE_DELAYS[ kind ]`.
- La liberación se comprueba una vez por frame dentro de `update()`: si `performance.now() >= g.releaseAt`, el fantasma pasa a `"active"`.
- Al liberarse, el fantasma se ajusta al centro de su celda (`Math.round`) para que la IA decida la dirección en esa celda.
- Mientras `status === "waiting"` el fantasma no usa la IA: rebota dentro de la pen.
- El rebote mantiene `x` fija en su celda de inicio y mueve `y` entre `PEN_BOUNDS.top` (13) y `PEN_BOUNDS.bottom` (15), invirtiendo el sentido al llegar al límite. `dir` refleja el sentido (`up`/`down`) para que los ojos miren al lado correcto.
- `startedAt` vale `null` en `createGame()` y se asigna en el primer `update()` de la partida, es decir, cuando el estado pasa a `playing`.

Funciones nuevas en `src/js/game.js`:

```js
// Rearma la secuencia de salida: fija el reloj y el turno de cada fantasma.
function armGhostRelease( game )

// Pasa a "active" los fantasmas cuyo instante de liberación ya ha pasado.
function updateGhostReleases( game )

// Rebote vertical del fantasma en espera dentro de la pen.
function bobGhost( game, g )
```

`resetPositions()` sigue devolviendo a cada fantasma a su celda de inicio; el estado de salida (`status`, `bobDir`, `releaseAt`) lo reinicia `armGhostRelease()`, que se llama en el mismo `update()` en el que se detecta la pérdida de vida.

## Plan de implementación

1. **`src/js/maze.js`** — añadir `PEN_BOUNDS` y exportarlo en `window`. Prueba manual: el juego arranca igual y sin errores en consola.
2. **`src/js/game.js`** — añadir `GHOST_RELEASE_DELAYS`, los campos `status`/`bobDir`/`releaseAt` de cada fantasma y `startedAt` en el estado de partida. Prueba manual: el juego arranca igual y los 4 fantasmas se comportan como hasta ahora (el `status` todavía no se consulta).
3. **`src/js/game.js`** — añadir `armGhostRelease()` y `updateGhostReleases()`, llamarlas desde `update()` y rearmar en la rama de pérdida de vida. Prueba manual: Blinky sale de inmediato y los otros 3 se quedan quietos dentro de la pen.
4. **`src/js/game.js`** — añadir `bobGhost()` y usarla en `moveGhost()` cuando `status === "waiting"`; ajustar a centro de celda en el momento de la liberación. Prueba manual: los 3 en espera rebotan entre las filas 13 y 15 y salen de uno en uno.
5. **Verificación manual final** — recorrer la lista de criterios de aceptación en el navegador.

## Criterios de aceptación

- [x] Al abrir `src/index.html` no hay errores en la consola del navegador.
- [x] Al pulsar Start, Blinky sale de la pen en el primer frame de la partida y los otros 3 siguen dentro de ella.
- [x] Pinky sale de la pen 1 segundo después del inicio de la partida (±1 frame).
- [x] Inky sale de la pen 2 segundos después del inicio de la partida (±1 frame).
- [x] Clyde sale de la pen 3 segundos después del inicio de la partida (±1 frame).
- [x] Los 3 fantasmas en espera rebotan verticalmente entre las filas 13 y 15 y no salen de la pen mientras esperan.
- [x] Al perder una vida, los 4 vuelven a la pen y la secuencia se repite: Blinky sale de inmediato, Pinky a los 1 s, Inky a los 2 s y Clyde a los 3 s.
- [x] La secuencia solo avanza con la partida en estado `playing`: en la pantalla de inicio ningún fantasma se libera.
- [x] Ningún fantasma atraviesa paredes ni se sale del laberinto, ni durante la espera ni en el instante de su liberación.
- [x] Los 4 fantasmas conservan su color y su IA (blinky agresivo, pinky emboscada, inky intercepción, clyde errático).
- [x] La partida se puede ganar: se pueden comer todos los puntos y el estado pasa a `won`.
- [x] `src/js/render.js` y `src/js/main.js` no se modifican.

## Decisiones

- **Sí:** salida escalonada pinky → inky → clyde, con 1 s entre cada una desde el inicio de la partida.
- **No:** los 3 a la vez tras 1 s de espera. «Progresivamente» pide escalonado y el arcade libera de uno en uno.
- **Sí:** Blinky arranca dentro de la pen y sale de inmediato (retardo 0).
- **No:** Blinky fuera de la pen desde el arranque. Obliga a cambiar `GHOST_STARTS` y el reinicio sin ganar nada.
- **Sí:** el retardo se mide con `performance.now()` (tiempo real).
- **No:** contador de frames. En un monitor de 120 Hz, 60 frames son medio segundo real.
- **Sí:** la secuencia se repite tras perder una vida.
- **No:** que los 4 salgan a la vez tras la muerte. Elimina la tregua para reubicarse.
- **Sí:** rebote vertical entre las filas 13 y 15 con `x` fija.
- **No:** rebote horizontal por la fila 14. Es la fila del túnel y no se parece al arcade.
- **Sí:** el fantasma se ajusta al centro de su celda al liberarse.
- **No:** dejarlo en la posición fraccionaria del rebote. Podría empujarlo contra una pared en la primera celda.
- **Sí:** sin señal visual de la cuenta atrás.
- **No:** parpadeo o contador en el HUD. Obliga a tocar `render.js` y el jugador ya deduce la espera del movimiento.
- **Sí:** la lógica de liberación vive en `src/js/game.js`.
- **No:** archivo nuevo `ghosts.js` ni cambios en `main.js`. El orden de carga de scripts es significativo (`AGENTS.md`) y `update()` ya recibe el estado de partida.
- **Sí:** `startedAt` arranca en `null` y se fija en el primer `update()`.
- **No:** arrancar el reloj en `createGame()`. `main.js` crea el juego al cargar la página, así que el reloj ya habría avanzado antes de que el jugador pulse Start.
- **No:** modo asustado, power pellets, frightened ni ninguna otra mecánica de arcade.

## Riesgos

| Riesgo                                                                                                                                                       | Mitigación                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Un fantasma liberado a mitad del rebote queda fuera del centro de una celda y puede chocar con una pared                                                     | Al liberarse se ajusta al centro de la celda (`Math.round`) y la IA decide la dirección en esa celda, con `canMove` validando el paso. |
| La IA podría dejar a un fantasma encerrado dentro de la pen si su objetivo no fuese alcanzable                                                               | Se mantiene el BFS de SPEC 01: desde la pen, la ruta más corta hasta Pacman sale por la puerta (fila 12, cols 13-14).                  |
| Si la pestaña queda oculta, `requestAnimationFrame` se detiene pero el reloj real sigue corriendo: al volver se liberarían de golpe los fantasmas pendientes | Se acepta: es la consecuencia de medir en tiempo real. Si molesta, pausar el reloj con `document.visibilitychange` en un spec aparte.  |
| El rebote se mueve por frames, así que en un monitor de 120 Hz va el doble de rápido que en uno de 60 Hz                                                     | Es cosmético y no afecta a la secuencia de liberación, que sí es en tiempo real.                                                       |

## Lo que **no** entra en este spec

- Modo asustado, power pellets, puntos por comer fantasmas.
- Patrones de dispersión (scatter) y el ciclo de direcciones del arcade.
- Contador o aviso en el HUD del tiempo que falta para cada salida.
- Cambios en el laberinto, en los niveles, en la puntuación, en las vidas o en el audio.
- Controles táctiles, versión móvil, multipantalla.
- Cualquier infraestructura de tests o build.

Cada uno de esos, si aterriza, va en su propio spec.
