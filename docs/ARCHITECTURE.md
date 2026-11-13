# LogicLab architecture

## 1. Design goals

1. Browser-first and free to self-host.
2. Circuit data is independent of React and the visual editor.
3. Every project is serializable and portable.
4. Student-created circuits can become reusable hierarchical components.
5. The simulation engine is deterministic and testable without a browser.
6. Persistence providers are adapters; local storage remains the offline fallback.

## 2. High-level architecture

```text
React application (src/ui)
        |
        +-- Workspace / panels / SVG editor
        |
        v
Project state and commands
        |
        +-- History (undo/redo)
        +-- Persistence adapter (src/storage)
        |
        v
Circuit model (src/engine/types.ts)
        |
        +-- Components and ports
        +-- Wires and nets
        +-- Circuit definitions / hierarchy
        |
        v
Simulation engine (src/engine)
        |
        +-- Combinational evaluator
        +-- Sequential state
        +-- Clock transitions
        +-- Hierarchical evaluation
```

## 3. Layer responsibilities

### UI layer
Owns rendering, pointer/keyboard interactions, selection, collapsible panels, viewport and user feedback. It must not implement gate truth tables.

### Command/state layer
Owns project edits. All edits should eventually pass through named commands (add component, move component, connect ports, remove wire, rename block). Commands are the correct location for validation and undo/redo.

### Circuit model
Defines the stable serialized representation. Use IDs rather than array positions for component, port, circuit and wire references.

### Simulation engine
Consumes circuit definitions and explicit input/state values and returns signal values and diagnostics. It must not read the DOM, localStorage or React state directly.

### Storage
Local JSON/browser persistence is the first provider. GitHub sync will be a separate adapter and must never be required to use the editor.

## 4. Runtime data flow

1. A user changes an input or edits a connection.
2. The project model is updated through an edit command.
3. The simulator receives the active circuit, inputs, state and clock level.
4. The simulator evaluates combinational dependencies and produces signal values.
5. The UI paints output pins and wires from the result.
6. Save serializes the project model, not SVG markup.

## 5. Coordinate system and viewport

The editor uses SVG world coordinates. Component positions are snapped to a 20-unit grid. The SVG `viewBox` is the camera: changing its origin pans; changing its width/height zooms. Pointer coordinates must be transformed through `getScreenCTM().inverse()` before they are applied to world coordinates.

Wire geometry is rendered orthogonally (horizontal/vertical segments). The current starter uses a midpoint route. A future router should use grid-based obstacle avoidance and explicit junction/net objects.

## 6. Hierarchical circuit contract

A custom component references a circuit definition by `customCircuitId`. It has external input/output ports that map to the child circuit's declared interface. The child circuit remains stored once in `Project.circuits`; instances reference it by ID. The editor can open a custom block by double-clicking it and return to the parent using the breadcrumb.

Never copy the child circuit's internal gates into each instance. This preserves one source of truth and allows opening/editing the definition. Before enabling nested hierarchy in production, add cycle detection and explicit boundary-pin objects.

## 7. Security and deployment

- Never place GitHub client secrets, private keys or long-lived access tokens in browser code.
- Use a server-side OAuth exchange and narrowly scoped GitHub App permissions.
- The editor must remain usable without an account.
- Do not promise unlimited free hosting; free provider tiers have limits.
