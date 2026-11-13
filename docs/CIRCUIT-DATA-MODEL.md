# Circuit and project data model

## Project

A project is a portable JSON document with `schemaVersion`, project identity, active circuit ID, circuit definitions, input values, sequential state and clock level.

## Component

A component has:
- Stable `id`
- `kind`
- User-facing `label`
- World coordinates `x` and `y`
- Input and output port arrays
- Optional state/configuration, such as initial value, active edge or custom circuit reference

## Port

Ports have stable IDs, a direction, a display name and bit width. Phase 1 uses 1-bit signals only. Future bus support should preserve `bitWidth` and add explicit width validation.

## Wire

A wire connects one output port to one input port using component and port IDs. The current model treats each wire as a directed connection. A future net model should represent fan-out as one source net with multiple sinks, rather than treating each branch as a separate electrical wire.

## Circuit definition

A circuit is a named collection of components and wires. A reusable circuit is marked as a library definition and referenced by custom components through `customCircuitId`.

## Compatibility

- Increment `schemaVersion` for breaking serialized format changes.
- Provide migration functions from every supported prior schema version.
- Never silently discard unknown component kinds during import.
- Keep JSON import validation separate from rendering.
- Use stable IDs; never depend on array order as identity.

## Example (illustrative)

```json
{
  "schemaVersion": 1,
  "id": "project-id",
  "name": "NAND experiment",
  "activeCircuitId": "circuit-id",
  "circuits": [],
  "inputValues": {},
  "sequentialState": {},
  "clockLevel": 0,
  "updatedAt": "2026-11-14T00:00:00.000Z"
}
```
