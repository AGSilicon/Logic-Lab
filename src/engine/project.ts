import type { CircuitDefinition, Component, GateKind, Port, Project } from './types'

const makePort = (id: string, name: string, direction: 'input' | 'output'): Port => ({ id, name, direction, bitWidth: 1 })
export function makeComponent(kind: GateKind, x: number, y: number): Component {
  const id = crypto.randomUUID()
  const inputCount = kind === 'NOT' || kind === 'OUTPUT' ? 1 : kind === 'DFF' || kind === 'LATCH' ? 2 : ['INPUT', 'CLOCK'].includes(kind) ? 0 : 2
  const outputCount = kind === 'OUTPUT' ? 0 : 1
  return {
    id, kind, label: kind === 'INPUT' ? 'Input' : kind === 'OUTPUT' ? 'Output' : kind,
    x, y,
    inputs: Array.from({ length: inputCount }, (_, i) => makePort(`in${i}`, kind === 'DFF' || kind === 'LATCH' ? ['D', kind === 'DFF' ? 'CLK' : 'EN'][i] : inputCount === 1 ? 'A' : ['A', 'B'][i], 'input')),
    outputs: Array.from({ length: outputCount }, () => makePort('out', 'Y', 'output')),
    ...(kind === 'INPUT' ? { initialValue: 0 as const } : {}),
    ...(kind === 'DFF' ? { activeEdge: 'rising' as const } : {}),
    ...(kind === 'LATCH' ? { activeEdge: 'high' as const } : {})
  }
}
export function createProject(): Project {
  const circuit: CircuitDefinition = { id: crypto.randomUUID(), name: 'Main Circuit', inputs: [], outputs: [], components: [], wires: [] }
  return { schemaVersion: 1, id: crypto.randomUUID(), name: 'Untitled Circuit', activeCircuitId: circuit.id, circuits: [circuit], inputValues: {}, sequentialState: {}, clockLevel: 0, updatedAt: new Date().toISOString() }
}
