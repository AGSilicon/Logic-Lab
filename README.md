# LogicLab

A free, open-source, browser-based digital logic laboratory. LogicLab is designed for students to build circuits from basic gates and reuse their own circuits hierarchically.

## Current starter implementation

- React + TypeScript + Vite
- macOS-inspired light/dark workspace
- Component palette: input, output, NAND, AND, OR, NOT, NOR, XOR, XNOR, clock
- Circuit data model and JSON-compatible project structure
- Combinational and sequential logic simulation
- Interactive SVG editor with hierarchy, undo/redo, and truth tables
- Local autosave and project JSON import/export
- Optional GitHub App sign-in and private repository saves (requires deployment setup)

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

## Publish with Cloudflare Pages

Connect this repository to a Cloudflare Pages project. Use `npm run build` as the build command and `dist` as the output directory. Pages Functions under `functions/` provide the same-origin GitHub API. See [GitHub storage setup](docs/GITHUB-STORAGE.md) before enabling sign-in.

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
6. Configure the GitHub App and Cloudflare secrets for student-owned private repository storage.

## Storage and security

Projects always autosave in the browser and can be exported or imported as JSON. Optional GitHub saves use a GitHub App and server-side OAuth exchange. Students choose a private repository where the app is installed; GitHub tokens remain encrypted in an HttpOnly cookie and are never exposed to frontend JavaScript. The cloud feature remains unavailable until the GitHub App and Cloudflare environment variables are configured. Never put GitHub secrets in frontend code.

## License

MIT. See `LICENSE`.
