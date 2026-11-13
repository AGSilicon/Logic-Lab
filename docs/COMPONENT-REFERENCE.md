# Component reference

| Component | Inputs | Outputs | Notes |
|---|---:|---:|---|
| Input pin | 0 | 1 | User-controlled 0/1 source |
| Output pin | 1 | 0 | Displays driven signal |
| NAND | 2+ | 1 | NOT(A AND B) |
| AND | 2+ | 1 | A AND B |
| OR | 2+ | 1 | A OR B |
| NOT | 1 | 1 | Inverts input |
| NOR | 2+ | 1 | NOT(A OR B) |
| XOR | 2 | 1 | 1 when inputs differ |
| XNOR | 2 | 1 | 1 when inputs match |
| Clock | 0 | 1 | Clock-level source |
| D flip-flop | D + clock semantics | Q | Edge-triggered storage |
| D latch | D + enable semantics | Q | Level-sensitive storage |
| Custom circuit | Declared interface | Declared interface | References a reusable circuit definition |

The current UI starter configures two-input versions of the combinational gates. Multi-input configuration is a planned editor feature.
