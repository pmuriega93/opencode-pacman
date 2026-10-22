# SPEC 03 — Power pellets: Pacman puede comer fantasmas

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-21
> **Objetivo:** Cuatro power pellets en los vértices del rectángulo interior del laberinto que hacen comestibles a los fantasmas durante 5 segundos, y cada fantasma comido vuelve a la pen inmovilizado y parpadeando durante 1 segundo.

## Scope

**In:**

- Cuatro power pellets, uno en cada vértice del rectángulo interior jugable: `(1,1)`, `(26,1)`, `(1,29)`, `(26,29)`.
- Un pellet comido abre una ventana de **5 segundos** (tiempo real) en la que Pacman puede comerse a los fantasmas.
- Comer un fantasma **no cuesta una vida**: el fantasma desaparece de esa celda.
- El fantasma comido reaparece en su celda de inicio dentro de la pen y se queda **inmovilizado 1 segundo**.
- Mientras está inmovilizado, **parpadea**: desaparece y reaparece cada ~150 ms.
- Pasados los 1 segundos, el fantasma vuelve a la normalidad (`status: "active"`) y su IA lo saca de la pen por la puerta.
- Los pellets se dibujan como círculos grandes pulsantes, distintos de los dots.
- Los pellets **cuentan para la victoria**: hay que comerse los 4 para ganar la partida.

**Out of scope (para futuros specs):**

- Modo asustado / frightened real: los fantasmas no cambian de color, no huyen y no dan media vuelta.
- Puntos por comer pellets o por comer fantasmas.
- Indicador en el HUD del tiempo que queda de efecto, ni contador de pellets.
- Que los pellets reaparezcan al perder una vida.
- Patrones de dispersión (scatter) y ciclo de direcciones del arcade.
- Cambios en el laberinto fuera de esas 4 celdas, en los niveles, en la puntuación, en las vidas o en el audio.
- Controles táctiles, móvil, multipantalla.
- Tests automatizados o tooling nuevo (el repo no tiene `package.json`).

## Modelo de datos

```js
// src/js/maze.js
// Nuevo valor de celda: 4 = power pellet (se escribe 'o' en MAZE_STR).
// Vértices del rectángulo interior jugable; el borde del laberinto es pared.
const POWER_PELLETS = [
  { x: 1, y: 1 },
  { x: 26, y: 1 },
  { x: 1, y: 29 },
  { x: 26, y: 29 },
];
```

```js
// src/js/game.js
const PELLET_EFFECT_MS = 5000; // ventana en la que los fantasmas son comestibles
const GHOST_FROZEN_MS = 1000; // tiempo que el fantasma comido pasa inmovilizado en la pen
```

Estado de partida (campo nuevo en `createGame()`):

```js
{
  // ... campos actuales: state, score, lives, dotsRemaining, grid, startedAt, pacman, ghosts
  pelletEffectUntil: null, // performance.now() hasta el que los fantasmas son comestibles
}
```

Cada fantasma de `game.ghosts` gana un valor nuevo de `status` y un campo:

```js
{
  // ... campos actuales: x, y, dir, speed, kind, status, bobDir, releaseAt
  status: "waiting" | "active" | "frozen", // frozen = comido, inmovilizado en la pen
  frozenUntil: null, // instante real (performance.now()) hasta el que sigue inmovilizado
}
```

Reglas:

- `dotsRemaining` cuenta también los pellets (celdas con valor 4): hay que comer los 4 para ganar.
- Al entrar Pacman en una celda con valor 4: la celda pasa a 0, `dotsRemaining--` y `pelletEffectUntil = performance.now() + PELLET_EFFECT_MS`. Cada pellet comido renueva la ventana completa.
- Un fantasma es comestible mientras `performance.now() < game.pelletEffectUntil`.
- Al tocar un fantasma comestible: no se pierde vida. El fantasma vuelve a su celda de inicio de la pen (`GHOST_STARTS[i]`), `status = "frozen"` y `frozenUntil = performance.now() + GHOST_FROZEN_MS`.
- Un fantasma `frozen` no se mueve, no usa la IA y no entra en la secuencia de salida de SPEC 02. Al cumplirse `frozenUntil` pasa a `active` (ya está centrado en una celda, así que la IA decide la dirección de salida por la puerta).
- `armGhostRelease()` (SPEC 02) sigue reiniciando el estado de salida al perder una vida: un fantasma congelado pasa a `waiting` como los demás.
- El valor 4 no es pared: los fantasmas pueden pasar por encima de los pellets sin comerlos (como en el arcade).

Funciones nuevas en `src/js/game.js`:

```js
// ¿Está abierta la ventana de efecto de los pellets?
function isGhostEdible( game )

// Pacman se come un fantasma comestible: vuelve a la pen y queda congelado 1 s.
function eatGhost( game, g )

// Los fantasmas congelados cuyo frozenUntil ya pasó vuelven a estar active.
function updateFrozenGhosts( game )
```

En `src/js/render.js`:

```js
const BLINK_MS = 150; // periodo del parpadeo del fantasma inmovilizado
function drawPowerPellets( ctx, grid, frame ) // círculo grande pulsante
```

`drawGhost()` recibe el instante actual (`performance.now()`) y, si el fantasma está `frozen`, solo lo dibuja en la mitad "encendida" de cada periodo de `BLINK_MS`.

## Plan de implementación

1. **`src/js/maze.js`** — añadir el valor de celda 4 y el carácter `'o'` en `parseTile()`, poner `'o'` en las 4 celdas del rectángulo interior de `MAZE_STR` (filas 1 y 29, columnas 1 y 26) y exportar `POWER_PELLETS`. Prueba manual: el juego arranca sin errores y esas 4 celdas tienen valor 4 (aún no se dibujan: parecen huecos).
2. **`src/js/render.js`** — añadir `drawPowerPellets()` (círculo grande pulsante) y llamarla en `draw()`. Prueba manual: se ven 4 círculos grandes pulsantes en las esquinas, distintos de los dots.
3. **`src/js/game.js`** — añadir `PELLET_EFFECT_MS` y `GHOST_FROZEN_MS`, el campo `pelletEffectUntil` en `createGame()`, contar los pellets en `dotsRemaining` y comer el pellet en `movePacman()` (celda a 0, `dotsRemaining--`, `pelletEffectUntil = now + PELLET_EFFECT_MS`). Prueba manual: Pacman come el pellet, desaparece del laberinto y el contador de puntos baja en 1; todavía no cambia nada en los fantasmas.
4. **`src/js/game.js`** — añadir `isGhostEdible()` y la rama de colisión: si el fantasma es comestible, `eatGhost()` (vuelve a `GHOST_STARTS[i]`, `status = 'frozen'`, `frozenUntil = now + GHOST_FROZEN_MS`) y se sale del bucle sin perder vida. Prueba manual: tras comer un pellet, tocar un fantasma no cuesta vida y el fantasma desaparece de la celda.
5. **`src/js/game.js`** — `moveGhost()` no mueve a los fantasmas `frozen` y `updateFrozenGhosts()` los devuelve a `active` cuando se cumple `frozenUntil`. Prueba manual: el fantasma comido se queda quieto en la pen 1 s y luego sale a perseguir.
6. **`src/js/render.js`** — parpadeo del fantasma `frozen` (visible/invisible cada `BLINK_MS` con `performance.now()`). Prueba manual: el fantasma congelado parpadea dentro de la pen.
7. **Verificación manual final** — recorrer la lista de criterios de aceptación en el navegador.

## Criterios de aceptación

- [x] Al abrir `src/index.html` no hay errores en la consola del navegador.
- [x] El laberinto tiene exactamente 4 power pellets, en `(1,1)`, `(26,1)`, `(1,29)` y `(26,29)`, y los 4 son alcanzables por Pacman.
- [x] Los pellets se dibujan como círculos grandes pulsantes, visualmente distintos de los dots.
- [x] Al comer un pellet, desaparece del laberinto (no vuelve a aparecer) y `dotsRemaining` baja en 1.
- [x] Al comer un pellet, los 4 fantasmas son comestibles durante 5 s (medido con `performance.now()`).
- [x] Comer un segundo pellet con el efecto ya activo renueva la ventana completa de 5 s.
- [x] Al tocar un fantasma comestible, Pacman se lo come: no pierde vida y el fantasma desaparece de esa celda.
- [x] El fantasma comido reaparece en su celda de inicio dentro de la pen.
- [x] El fantasma comido no se mueve durante 1 segundo.
- [x] Mientras está inmovilizado, el fantasma parpadea (desaparece y reaparece cada ~150 ms).
- [x] Pasados los 1 s, el fantasma vuelve a la normalidad: `status = "active"` y su IA lo saca de la pen por la puerta.
- [x] Transcurridos los 5 s del efecto, los fantasmas vuelven a ser peligrosos: tocar uno cuesta una vida.
- [x] Los fantasmas conservan su color y su IA; no hay estado asustado (no cambian de color, no huyen, no dan media vuelta).
- [x] Los pellets cuentan para la victoria: solo se gana después de comerse los 4.
- [x] Al perder una vida, los 4 fantasmas vuelven a la pen y se repite la salida escalonada de SPEC 02.
- [x] `src/js/main.js` no se modifica.

## Decisiones

- **Sí:** pellets en `(1,1)`, `(26,1)`, `(1,29)`, `(26,29)`: los vértices del rectángulo interior jugable.
- **No:** las esquinas literales del grid `((0,0)`, `(27,0)`, `(0,30)`, `(27,30))`. Son celdas de pared con las 4 vecinas de pared: Pacman nunca podría comerlas.
- **No:** las posiciones del arcade `(1,6)`, `(26,6)`, `(1,26)`, `(26,26)`. No son los vértices del rectángulo.
- **Sí:** ventana de 5 s en tiempo real con `performance.now()`.
- **No:** contador de frames. En un monitor de 120 Hz, 300 frames son 2,5 s reales.
- **Sí:** cada pellet comido renueva la ventana completa de 5 s.
- **No:** frightened con color azul, huida o media vuelta de los fantasmas. El enunciado lo deja fuera y obligaría a cambiar el objetivo de la IA.
- **Sí:** el fantasma comido vuelve a su propia celda de inicio de la pen.
- **Sí:** 1 s de inmovilización total: no rebota, no usa la IA.
- **Sí:** al cumplirse el 1 s, el fantasma pasa a `active` y su IA lo saca de la pen.
- **No:** repetir la salida escalonada de SPEC 02 tras comer un fantasma. El enunciado pide solo 1 s de inmovilización.
- **Sí:** parpadeo visible/invisible cada ~150 ms.
- **No:** alternar entre color normal y blanco. "Parpadeando" se lee mejor como aparecer/desaparecer.
- **Sí:** sin puntos por pellet ni por fantasma.
- **No:** 50 por pellet y 200/400/800/1600 por fantasma (arcade). El enunciado dice que con poder comerlos basta.
- **Sí:** los pellets cuentan en `dotsRemaining` (ganar exige comerlos).
- **Sí:** los pellets se dibujan como círculo grande pulsante.
- **Sí:** representación propia en el grid (valor 4, carácter `'o'`).
- **No:** lista de pellets aparte en `game`. El grid ya guarda qué se ha comido; una lista paralela obligaría a sincronizarla.
- **Sí:** la lógica vive en `src/js/game.js` y el dibujo en `src/js/render.js`.
- **No:** archivo nuevo ni cambios en `src/js/main.js`. El orden de carga de scripts es significativo (`AGENTS.md`).

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un pellet encerrado por paredes sería inaccesible                                           | Se eligieron los vértices del rectángulo interior, los 4 alcanzables por los pasillos de las columnas 1 y 26.                                    |
| Al rearmar el laberinto, 4 dots pasan a ser pellets y cambia el total de puntos             | `dotsRemaining` se recalcula en `createGame()` contando los valores 2 y 4; la victoria sigue funcionando.                                        |
| El fantasma congelado, al volver a `active`, podría quedarse encerrado en la pen            | La IA usa BFS y la ruta más corta desde la pen sale por la puerta (fila 12, cols 13-14). Es el mismo caso de los fantasmas liberados en SPEC 02. |
| La ventana de 5 s se mide en tiempo real: con la pestaña oculta el efecto expira sin verse  | Se acepta, igual que la secuencia de salida de SPEC 02.                                                                                          |
| El parpadeo depende de `performance.now()` y `draw()` se ejecuta también fuera de `playing` | Solo es cosmético: en los menús no hay fantasmas congelados.                                                                                     |

## Lo que **no** entra en este spec

- Modo asustado / frightened de verdad (color, huida, media vuelta).
- Puntos por comer pellets o por comer fantasmas.
- HUD con el tiempo restante del efecto o contador de pellets.
- Reaparición de los pellets al perder una vida.
- Patrones de dispersión (scatter) y ciclo de direcciones del arcade.
- Cambios en el laberinto fuera de las 4 celdas del rectángulo interior, en los niveles, en la puntuación, en las vidas o en el audio.
- Controles táctiles, versión móvil, multipantalla.
- Cualquier infraestructura de tests o build.

Cada uno de esos, si aterriza, va en su propio spec.
