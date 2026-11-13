# Development guide

## Requirements

- Node.js 20 or later
- npm
- VS Code recommended
- Git

## Install and run (Windows CMD)

```cmd
npm install
npm run dev
```

## Rollup native binary blocked by Windows Application Control

Some managed Windows environments block native `.node` binaries. This project can use the WebAssembly Rollup package alias in `package.json`:

```json
"overrides": {
  "vite": {
    "rollup": "npm:@rollup/wasm-node"
  }
}
```

If changing this override after dependencies were installed, remove `node_modules` and `package-lock.json`, then run `npm install` again. This avoids asking users to disable Windows security. If another policy blocks WASM or scripts, ask the device administrator to approve the toolchain.

## Scripts

- `npm run dev`: local development server
- `npm run build`: TypeScript check and production build
- `npm run preview`: preview production output locally

## Code conventions

- Strict TypeScript.
- Keep domain types in `src/engine/types.ts`.
- Keep gate truth tables in `src/engine/gates.ts`.
- Keep simulation pure: inputs in, results out.
- Keep browser storage in `src/storage`.
- UI components should not contain gate equations.
- Give exported functions doc comments when their contract is non-obvious.
- Add tests whenever a gate, port, wire or timing rule changes.

## Debug checklist

1. Check browser console.
2. Check project JSON export.
3. Confirm port IDs and wire endpoints.
4. Verify no gate has an unconnected required input.
5. Reproduce the issue with a minimal circuit.
6. Add a regression test before changing the engine.


## Editor shortcuts

- `Ctrl/Cmd + S`: save locally
- `Ctrl/Cmd + Z`: undo
- `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`: redo
- `Delete` / `Backspace`: delete selected component
- `Escape`: cancel pending wire or clear selection
- Mouse wheel: zoom toward pointer
- Middle/right mouse drag: pan

## Tests

```cmd
npm test
```

The current engine tests cover core gate truth-table behaviour, unknown propagation, and initial DFF/latch transition semantics. Expand these tests whenever the simulator adds gates, reset/enable controls, hierarchy or timing rules.

## Blank-screen diagnostics

LogicLab wraps the React workspace in an error boundary. If a runtime exception occurs, the page should show its message and stack rather than a blank white screen. Persisted projects are validated before loading; invalid or older localStorage records are ignored rather than crashing the workspace. Export important student work regularly as `.logiclab.json` files.
