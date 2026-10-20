# AGENTS.md

Vanilla JS Pac-Man clone (HTML/CSS/JS, no framework, no toolchain). The repo exists to practice **spec-driven development**, per `README.md`.

## Running

- No build, no `package.json`, no test/lint/typecheck commands — do not invent any.
- Run by opening `src/index.html` in a browser (plain `<script>` tags, no modules, no fetch — `file://` works; a static server also works).

## Architecture

- Entry point: `src/index.html`. Script load order is significant and must stay:
  `maze.js` → `game.js` → `render.js` → `main.js`
- Files communicate via **globals exported on `window`** (bottom of each file: `MAZE`, `createGame`, `update`, `draw`, ...). There are no ES modules or imports — adding `import`/`export` or `type="module"` would break this.
  - `maze.js`: static 28×31 level data as 31 strings, parsed to a numeric grid. `MAZE` is pristine and must never be mutated; `createGame()` copies it to `game.grid` each match.
  - `game.js`: state and rules; depends on `maze.js` globals.
  - `render.js`: canvas drawing; reads `game.grid` (not `MAZE`) so eaten dots render.
  - `main.js`: game loop, keyboard, overlay screens; wires the other three.
- Canvas is fixed at 560×620 with `TILE = 20` px (`render.js`).

## Spec-driven workflow

- Specs live in `specs/NN-slug.md` (folder may not exist yet). Installed skills: `spec` (writes the spec, no code) and `spec-impl` (implements it) — see `.agents/skills/` and `skills-lock.json`.
- `spec-impl` **creates a git branch per spec by default** (controlled by `specs/.spec-config.yml` `AutoCreateBranch`). Current branch is `master`.
- Follow `spec` → `spec-impl` for new features instead of coding directly; specs are numbered sequentially, starting at `01-`.

## Conventions

- Comments and UI strings are in **Spanish**; keep new ones consistent.
