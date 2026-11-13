# Architecture decision records

## ADR-001: Browser-first application
**Status:** Accepted

Use React, TypeScript and Vite for a browser-based tool. This is familiar, deployable as static assets and keeps the simulation local to the student's device.

## ADR-002: SVG circuit canvas
**Status:** Accepted for Phase 1

Use SVG for gates, ports, wires and the grid. SVG gives precise vector geometry, hit targets and a straightforward camera based on `viewBox`. Re-evaluate if very large circuits cause rendering bottlenecks.

## ADR-003: Orthogonal wiring
**Status:** Accepted

Use horizontal/vertical wire segments snapped to a 20-unit grid. Future routing should avoid component obstacles and model branches as nets/junctions.

## ADR-004: Hierarchical reusable circuits
**Status:** Accepted as target data model

A reusable component references a stored circuit definition by ID. Instances do not duplicate the implementation. Editing a definition should update all instances.

## ADR-005: Three-state logic
**Status:** Accepted

Use `0`, `1`, and `X`. Unknown/floating signals must be visible to learners and must not be coerced to zero.

## ADR-006: Student-owned storage
**Status:** Accepted

Local storage and JSON export/import are always available. GitHub sync is optional and should use student-owned private repositories with narrowly scoped authorization. Never store OAuth secrets in frontend code.

## ADR-007: Free/open-source core
**Status:** Accepted

MIT license. The core editor and simulator must not depend on a paid API. Hosting and OAuth providers may impose free-tier limits.
