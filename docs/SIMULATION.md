# Simulation model

## Logic values

Phase 1 uses three values:
- `0`: logic low
- `1`: logic high
- `X`: unknown, disconnected, or unresolved

Unknown is not the same as low. A floating input must not silently become zero.

## Combinational evaluation

1. Seed input pin values.
2. Seed clock outputs.
3. Seed stateful outputs from the stored state.
4. Evaluate gates when all required input signals are available.
5. Repeat until no more gates can be evaluated.
6. Report unresolved components, disconnected inputs and loops.
7. Read output pins from their driving wires.

A production evaluator should use a dependency graph/topological order or event queue rather than repeated full scans. It should also define behaviour for feedback loops and multiple drivers.

## Gate truth tables

| A | B | NAND | AND | OR | XOR | XNOR | NOR |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 1 | 0 | 0 | 0 | 1 | 1 |
| 0 | 1 | 1 | 0 | 1 | 1 | 0 | 0 |
| 1 | 0 | 1 | 0 | 1 | 1 | 0 | 0 |
| 1 | 1 | 0 | 1 | 1 | 0 | 1 | 0 |

NOT: `0 -> 1`, `1 -> 0`.

## Sequential logic

Sequential state must not be updated during ordinary combinational evaluation.

### Edge-triggered D flip-flop
- Rising edge: capture D when clock transitions 0 to 1.
- Falling edge: capture D when clock transitions 1 to 0.
- Between active edges, retain Q.

### Level-sensitive D latch
- Active-high: Q follows D while clock/enable is high; otherwise holds.
- Active-low: Q follows D while clock/enable is low; otherwise holds.

## Clock engine requirements

The full implementation should separate:
- Manual transition
- Automatic periodic transition
- Single-step transition
- Reset
- Edge detection
- Level-sensitive transparency

A clock transition must compute all next sequential values from the same pre-transition state and commit them simultaneously. This avoids ordering-dependent behaviour in multi-register circuits.

## Validation required before production

- Exhaustive truth table tests for every gate
- Rising/falling edge DFF tests
- High/low latch tests
- Two-register simultaneous update test
- Missing input and combinational loop tests
- Nested custom circuit tests
