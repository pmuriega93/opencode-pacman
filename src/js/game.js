// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame (valor por defecto)

// Velocidad por tipo de fantasma. Deben ser 1/N de celda por frame: el motor
// decide la direccion solo cuando la posicion queda centrada en la celda, y
// una velocidad como 0.11 nunca alinea y saca al fantasma del laberinto.
const GHOST_SPEEDS = {
  blinky: 0.125, // 1/8 celda/frame - agresivo, a la misma velocidad que Pacman
  pinky: 0.1,    // 1/10 celda/frame
  inky: 0.1,     // 1/10 celda/frame
  clyde: 0.1,    // 1/10 celda/frame
};

// Retardo de salida por tipo de fantasma, en milisegundos reales desde el
// inicio de la partida. Blinky sale en el primer frame; los demas, de uno en uno.
const GHOST_RELEASE_DELAYS = {
  blinky: 0,    // agresivo: sale en el primer frame
  pinky: 1000,  // emboscada: 1 s
  inky: 2000,   // intercepcion: 2 s
  clyde: 3000,  // erratico: 3 s
};

// Desempate del arcade: arriba > izquierda > abajo > derecha.
const DIR_PRIORITY = [ 'up', 'left', 'down', 'right' ];
const PINKY_LOOKAHEAD = 4;        // celdas por delante de Pacman
const INKY_LOOKAHEAD = 2;         // celdas por delante de Pacman
const CLYDE_SCATTER_DISTANCE = 8; // en celdas (distancia euclidea)

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    // Reloj de la secuencia de salida: performance.now() al empezar la partida.
    // null = reloj sin arrancar.
    startedAt: null,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEEDS[ g.kind ] || GHOST_SPEED,
      kind: g.kind,
      // Estado de salida: los 4 esperan su turno, incluido Blinky.
      status: 'waiting', // waiting = dentro de la pen, esperando su turno
      bobDir: 1,         // sentido del rebote vertical mientras espera
      releaseAt: null,   // instante real (performance.now()) en que se libera
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function clamp( v, min, max ) {
  return Math.max( min, Math.min( max, v ) );
}

// Celda en la que se encuentra Pacman.
function pacmanCell( game ) {
  const p = game.pacman;
  return { x: Math.round( p.x ), y: Math.round( p.y ) };
}

// Celda 'steps' celdas por delante de Pacman, recortada a los limites.
function aheadOfPacman( game, steps ) {
  const d = DIRS[ game.pacman.dir ] || { x: 0, y: 0 };
  const grid = game.grid;
  const base = pacmanCell( game );
  return {
    x: clamp( base.x + d.x * steps, 0, grid[ 0 ].length - 1 ),
    y: clamp( base.y + d.y * steps, 0, grid.length - 1 ),
  };
}

// El objetivo de Inky puede caer en una pared -> se usa la celda de Pacman.
function safeTarget( game, cell ) {
  if ( !isWall( game.grid, cell.x, cell.y, 'ghost' ) ) return cell;
  return pacmanCell( game );
}

// Celda objetivo de un fantasma segun su tipo. Devuelve { x, y }.
function ghostTarget( game, ghost ) {
  const pac = pacmanCell( game );

  switch ( ghost.kind ) {
    case 'pinky': {
      // Emboscada: 4 celdas por delante de Pacman.
      return aheadOfPacman( game, PINKY_LOOKAHEAD );
    }
    case 'inky': {
      // Intercepcion: duplica el vector Blinky -> (2 celdas por delante de Pacman).
      const base = aheadOfPacman( game, INKY_LOOKAHEAD );
      const blinky = game.ghosts.find( ( g ) => g.kind === 'blinky' );
      const b = blinky
        ? { x: Math.round( blinky.x ), y: Math.round( blinky.y ) }
        : pac;
      const grid = game.grid;
      const cell = {
        x: clamp( base.x + ( base.x - b.x ), 0, grid[ 0 ].length - 1 ),
        y: clamp( base.y + ( base.y - b.y ), 0, grid.length - 1 ),
      };
      return safeTarget( game, cell );
    }
    case 'clyde': {
      // Erratico: persigue de lejos, deambula cuando se acerca.
      const dx = ghost.x - pac.x;
      const dy = ghost.y - pac.y;
      const dist = Math.sqrt( dx * dx + dy * dy );
      if ( dist > CLYDE_SCATTER_DISTANCE ) return pac;
      return { x: Math.round( ghost.x ), y: Math.round( ghost.y ) };
    }
    case 'blinky':
    default:
      // Agresivo: la celda de Pacman.
      return pac;
  }
}

// Primer paso (direccion) de la ruta mas corta desde (sx,sy) hasta (tx,ty).
// Devuelve null si no hay ruta. Los fantasmas atraviesan la puerta (valor 3).
// La media vuelta no se excluye: la ruta mas corta puede pasar por detras.
function firstStepTowards( grid, sx, sy, tx, ty ) {
  const W = grid[ 0 ].length;
  const H = grid.length;
  const key = ( x, y ) => x + ',' + y;
  const startKey = key( sx, sy );

  if ( startKey === key( tx, ty ) ) return null;

  // prev: celda -> { from, dir } (direccion usada para llegar a esa celda).
  const prev = new Map();
  const queue = [ { x: sx, y: sy } ];

  while ( queue.length ) {
    const cur = queue.shift();
    for ( const dir of DIR_PRIORITY ) {
      const d = DIRS[ dir ];
      let nx = cur.x + d.x;
      let ny = cur.y + d.y;
      // Tunel: la fila 14 une el borde izquierdo con el derecho.
      if ( ny === TUNNEL_ROW ) {
        if ( nx < 0 ) nx = W - 1;
        else if ( nx >= W ) nx = 0;
      }
      if ( nx < 0 || nx >= W || ny < 0 || ny >= H ) continue;
      if ( grid[ ny ][ nx ] === 1 ) continue; // pared
      const k = key( nx, ny );
      if ( k === startKey || prev.has( k ) ) continue;
      prev.set( k, { from: key( cur.x, cur.y ), dir } );
      if ( nx === tx && ny === ty ) {
        // Reconstruir: el primer paso es la direccion de la celda vecina al inicio.
        let step = k;
        while ( prev.get( step ).from !== startKey ) {
          step = prev.get( step ).from;
        }
        return prev.get( step ).dir;
      }
      queue.push( { x: nx, y: ny } );
    }
  }

  return null;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const sx = Math.round( g.x );
  const sy = Math.round( g.y );
  const target = ghostTarget( game, g );

  // Regla 2: el objetivo es la celda actual -> deambula por la primera
  // direccion valida segun la prioridad clasica.
  if ( target.x === sx && target.y === sy ) {
    for ( const dir of DIR_PRIORITY ) {
      if ( canMove( grid, sx, sy, dir, 'ghost' ) ) {
        g.dir = dir;
        return;
      }
    }
    return; // sin salida: se mantiene la direccion actual
  }

  // Regla 3: primer paso de la ruta mas corta al objetivo.
  let dir = firstStepTowards( grid, sx, sy, target.x, target.y );
  if ( !dir ) {
    // Sin ruta: se reintenta con la celda de Pacman.
    const pac = pacmanCell( game );
    dir = firstStepTowards( grid, sx, sy, pac.x, pac.y );
  }
  // Si tampoco hay ruta, se mantiene la direccion actual.
  if ( dir ) g.dir = dir;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    // La velocidad por tipo se conserva: no se toca aqui.
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
