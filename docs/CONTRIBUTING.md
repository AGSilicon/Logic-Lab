# Contributing to LogicLab

## Before changing code
1. Read `ARCHITECTURE.md`.
2. Read the relevant data model and simulation contract.
3. Check `ROADMAP.md` and existing issues.
4. Keep the change focused and backwards-compatible where possible.

## Required for a new gate
- Add the kind to `GateKind`.
- Define port count and labels.
- Add the truth-table/evaluation rule.
- Add unit tests for all input combinations.
- Add the gate to the component palette.
- Update the gate reference documentation.

## Required for a new sequential component
- Define state representation.
- Define clock/enable/reset semantics explicitly.
- Document timing behaviour.
- Add edge/level and hold tests.
- Ensure all next-state values are committed simultaneously.

## Documentation rule
Every exported engine function, non-obvious algorithm, serialized field and architectural change must be documented. Update `docs/DECISIONS.md` when changing a foundational decision and `docs/ROADMAP.md` when implementation status changes.

## Pull requests
Include:
- Problem statement
- Design/architecture impact
- Screenshots or short recording for UI changes
- Tests run
- Documentation updates
- Known limitations
