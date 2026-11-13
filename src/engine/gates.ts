import type { GateKind, LogicValue } from './types'

export function evaluateGate(kind: GateKind, values: LogicValue[]): LogicValue {
  if (values.length === 0 || values.some(v => v === 'X')) return 'X'
  const bits = values as (0 | 1)[]
  const all = bits.every(v => v === 1)
  const any = bits.some(v => v === 1)
  switch (kind) {
    case 'NAND': return all ? 0 : 1
    case 'AND': return all ? 1 : 0
    case 'OR': return any ? 1 : 0
    case 'NOT': return bits[0] === 1 ? 0 : 1
    case 'NOR': return any ? 0 : 1
    case 'XOR': return bits.reduce<number>((a, b) => a ^ b, 0) as 0 | 1
    case 'XNOR': return bits.reduce<number>((a, b) => a ^ b, 0) === 0 ? 1 : 0
    default: return 'X'
  }
}
