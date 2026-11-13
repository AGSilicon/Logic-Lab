# LogicLab

A free, open-source, browser-based digital logic laboratory. LogicLab is designed for students to build circuits from basic gates and reuse their own circuits hierarchically.

## Current starter implementation

- React + TypeScript + Vite
- macOS-inspired light/dark workspace
- Component palette: input, output, NAND, AND, OR, NOT, NOR, XOR, XNOR, clock
- Circuit data model and JSON-compatible project structure
- Basic combinational logic evaluator
- Local project save
- Initial component inspector and connection workflow

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build

```bash
npm run build
npm run preview
```

## Architecture

- `src/engine`: framework-independent circuit types, gate evaluation and simulation
- `src/storage`: persistence adapters
- `src/ui`: React workspace and visual components

## Planned milestones

1. Complete interactive SVG editor: drag/move, port-to-port orthogonal wiring, fan-out, junctions, deletion and undo/redo.
2. Stable graph/net model and validation.
3. Hierarchical subcircuits with interface pins, recursive simulation and reusable component library.
4. Clock engine: manual/automatic stepping, rising/falling edge events, high/low level-sensitive latches.
5. Truth tables, timing traces and project import/export.
6. GitHub authentication and student-owned private repository storage.

## Storage and security

This starter saves projects locally in the browser. GitHub sign-in and cloud sync are **not implemented yet**. Do not put GitHub OAuth secrets or access tokens in frontend code. The planned integration uses a GitHub App and a server-side token exchange through a free-tier worker, with narrowly scoped repository permissions.

## License

MIT. See `LICENSE`.
