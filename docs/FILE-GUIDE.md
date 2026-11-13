# Source file guide

This guide explains where a future maintainer should make a change. Keep this file updated whenever files are added, removed or responsibilities change.

## Application entry points

| File | Responsibility |
|---|---|
| `index.html` | Browser document shell, title and root mount point |
| `src/main.tsx` | React entry point; mounts `App` and global stylesheet |
| `src/ui/App.tsx` | Main workspace composition, editor interactions, project state, viewport, clock controls and project import/export |
| `src/ui/styles.css` | Design tokens, light/dark theme, panels, canvas, component visuals and responsive layout |

## Engine modules

| File | Responsibility | Main API |
|---|---|---|
| `src/engine/types.ts` | Canonical TypeScript data contracts | `LogicValue`, `Component`, `Port`, `Wire`, `CircuitDefinition`, `Project` |
| `src/engine/gates.ts` | Pure Boolean gate evaluation | `evaluateGate(kind, values)` |
| `src/engine/project.ts` | Default project and component construction | `makeComponent(kind, x, y)`, `createProject()` |
| `src/engine/simulate.ts` | Combinational evaluation, custom block evaluation and sequential state transitions | `simulateCircuit(...)`, `updateSequentialState(...)`, `simulateProject(project)` |
| `src/engine/gates.test.ts` | Unit tests for truth tables, unknown values and initial sequential transitions | Vitest test suite |

## Storage

| File | Responsibility |
|---|---|
| `src/storage/local.ts` | Local browser persistence adapter. The UI should use this adapter rather than calling `localStorage` directly. |

## Main UI interaction functions in `App.tsx`

- `commit`: records a project snapshot and applies a project mutation.
- `updateCircuit`: updates the active circuit's components and wires.
- `add`: inserts a standard component at the viewport center.
- `addCustom`: inserts an instance referencing a saved circuit definition.
- `save`: writes the project to local browser storage.
- `exportProject`: downloads a portable `.logiclab.json` file.
- `importProject`: validates the basic schema and loads a project file.
- `undo` / `redo`: restores project snapshots.
- `point` / `pointFromClient`: convert browser pointer coordinates to SVG world coordinates.
- `onCanvasPointerDown` / `onCanvasPointerMove` / `onCanvasPointerUp`: pan and drag handling.
- `zoomAt`: zooms around the pointer location.
- `startDrag`: begins moving a component.
- `clickPort`: starts or completes an output-to-input wire connection.
- `removeSelected`: removes a component and its attached wires.
- `tickClock`: advances the clock and commits sequential state.
- `saveAsReusable`: stores the current circuit as a library definition and creates an instance in a new main circuit.
- `openCustom` / `returnToParent`: navigate into and out of a reusable circuit definition.
- `duplicateSelected`: duplicates the selected component with fresh IDs.

## Change workflow

1. Identify the layer responsible for the change.
2. Update the TypeScript data contract first if the serialized model changes.
3. Update engine behaviour independently from UI rendering.
4. Add or update tests.
5. Update `ARCHITECTURE.md`, `CIRCUIT-DATA-MODEL.md` or `SIMULATION.md` as applicable.
6. Update `ROADMAP.md` and this guide.
7. Run `npm test` and `npm run build`.
