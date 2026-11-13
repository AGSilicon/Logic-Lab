# LogicLab roadmap

Status labels: **Implemented (starter)**, **In progress**, **Planned**, **Not implemented**.

## Phase 1A — Workspace foundation
- [x] React + TypeScript + Vite
- [x] macOS-inspired light/dark layout
- [x] Component palette and inspector
- [x] SVG grid canvas
- [x] Zoom controls and wheel zoom
- [x] Basic pan gesture
- [x] Drag components
- [x] Output-to-input connection gesture
- [x] Orthogonal wire rendering
- [x] Basic combinational gate evaluator
- [x] Local save and JSON import/export
- [x] Basic truth table panel
- [ ] Automated unit tests and verified production build
- [ ] Full undo/redo coverage for every interaction

## Phase 1B — Reliable editor
- [ ] Dedicated command model for every edit
- [ ] Robust keyboard shortcuts and accessibility
- [ ] Multi-select, align, distribute and group
- [ ] Wire branch/junction editing and fan-out
- [ ] Obstacle-avoiding orthogonal router
- [ ] Signal conflict and multi-driver diagnostics
- [ ] Autosave, recovery and project list
- [ ] Import schema validation and migrations

## Phase 1C — Sequential and reusable logic
- [ ] Verify DFF rising/falling edge behaviour
- [ ] Verify active-high/active-low latch behaviour
- [ ] Simultaneous next-state commit
- [ ] Reset and enable pins
- [ ] Timing diagram/waveform viewer
- [ ] Reusable circuit interface pins
- [ ] Nested custom circuit evaluation
- [ ] Hierarchy browser and open-definition action
- [ ] Detect recursive hierarchy

## Phase 1D — Student account and publishing
- [ ] GitHub App authentication
- [ ] Student-owned private repository
- [ ] Token exchange on server-side worker
- [ ] Sync conflict handling and revision history
- [ ] Share/export public examples
- [ ] Documentation and classroom exercises

## Release criteria

A Phase 1 release is ready only after:
1. `npm run build` succeeds on Windows and Linux.
2. Automated tests cover every gate and clock behaviour.
3. A student can create, save, close, reopen and export a project.
4. A reusable circuit can be instantiated without copying its internal gates.
5. Invalid connections and unknown signals are clearly explained.
6. GitHub sync is optional and does not block offline use.
