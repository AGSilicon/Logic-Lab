import type { CircuitDefinition, Component, LogicValue, Project } from './types'
import { evaluateGate } from './gates'

export interface SimulationResult {
  values: Record<string, LogicValue>
  errors: string[]
  outputs: Record<string, LogicValue>
}
const signalKey = (componentId: string, portId: string) => `${componentId}:${portId}`

/**
 * Deterministic event-free combinational evaluation.
 * Sequential components expose their stored state; updateSequentialState()
 * is called only by explicit clock transitions or level-sensitive evaluation.
 */
export function simulateCircuit(
  circuit: CircuitDefinition,
  inputValues: Record<string, LogicValue> = {},
  state: Record<string, LogicValue> = {},
  clockLevel: 0 | 1,
  library: CircuitDefinition[] = [],
  depth = 0
): SimulationResult {
  const values: Record<string, LogicValue> = {}
  const errors: string[] = []
  if (depth > 24) return { values, errors: ['Hierarchical circuit depth exceeds 24 levels. Check for recursive custom components.'], outputs: {} }

  inputValues ??= {}
  state ??= {}

  for (const c of circuit.components) {
    if (c.kind === 'INPUT') values[signalKey(c.id, c.outputs[0]?.id ?? 'out')] = inputValues[c.id] ?? c.initialValue ?? 0
    if (c.kind === 'CLOCK') values[signalKey(c.id, c.outputs[0]?.id ?? 'out')] = clockLevel
    if (c.kind === 'DFF' || c.kind === 'LATCH') values[signalKey(c.id, c.outputs[0]?.id ?? 'out')] = state[c.id] ?? 0
  }

  const pending = new Set(circuit.components.filter(c => !['INPUT', 'OUTPUT', 'CLOCK', 'DFF', 'LATCH'].includes(c.kind)).map(c => c.id))
  let progressed = true
  let passes = 0
  while (pending.size && progressed && passes < circuit.components.length + 2) {
    progressed = false
    passes++
    for (const c of circuit.components) {
      if (!pending.has(c.id)) continue
      const incoming = c.inputs.map(p => {
        const w = circuit.wires.find(w => w.to.componentId === c.id && w.to.portId === p.id)
        return w ? values[signalKey(w.from.componentId, w.from.portId)] : undefined
      })
      if (incoming.some(v => v === undefined)) continue
      let out: LogicValue = 'X'
      let customOutputs: LogicValue[] | undefined
      if (c.kind === 'CUSTOM' && c.customCircuitId) {
        const child = library.find(x => x.id === c.customCircuitId)
        if (!child) errors.push(`Missing custom circuit definition for "${c.label}".`)
        else {
          const childInputs: Record<string, LogicValue> = {}
          child.components.filter(x => x.kind === 'INPUT').forEach((pin, i) => { childInputs[pin.id] = incoming[i] ?? 'X' })
          const childResult = simulateCircuit(child, childInputs, state, clockLevel, library, depth + 1)
          const outputPins = child.components.filter(x => x.kind === 'OUTPUT')
          customOutputs = outputPins.map(pin => childResult.outputs[pin.id] ?? 'X')
          out = customOutputs[0] ?? 'X'
          errors.push(...childResult.errors)
        }
      } else out = evaluateGate(c.kind, incoming as LogicValue[])
      const op = c.outputs[0]
      if (op) values[signalKey(c.id, op.id)] = out
      if (customOutputs) c.outputs.forEach((port, i) => { values[signalKey(c.id, port.id)] = customOutputs![i] ?? 'X' })
      pending.delete(c.id)
      progressed = true
    }
  }
  if (pending.size) errors.push('Some signals are unresolved. Check disconnected inputs or combinational feedback loops.')

  const outputs: Record<string, LogicValue> = {}
  for (const c of circuit.components.filter(x => x.kind === 'OUTPUT')) {
    const wire = circuit.wires.find(w => w.to.componentId === c.id)
    outputs[c.id] = wire ? values[signalKey(wire.from.componentId, wire.from.portId)] ?? 'X' : 'X'
  }
  return { values, errors: [...new Set(errors)], outputs }
}

export function updateSequentialState(
  circuit: CircuitDefinition,
  inputValues: Record<string, LogicValue>,
  state: Record<string, LogicValue>,
  previousClock: 0 | 1,
  nextClock: 0 | 1
): Record<string, LogicValue> {
  const next = { ...state }
  const before = simulateCircuit(circuit, inputValues, state, previousClock)
  const after = simulateCircuit(circuit, inputValues, state, nextClock)
  for (const c of circuit.components) {
    if (c.kind !== 'DFF' && c.kind !== 'LATCH') continue
    const dataWire = c.inputs[0] && circuit.wires.find(w => w.to.componentId === c.id && w.to.portId === c.inputs[0].id)
    const controlWire = c.inputs[1] && circuit.wires.find(w => w.to.componentId === c.id && w.to.portId === c.inputs[1].id)
    const data = dataWire ? before.values[signalKey(dataWire.from.componentId, dataWire.from.portId)] ?? 'X' : 'X'
    const oldControl = controlWire ? before.values[signalKey(controlWire.from.componentId, controlWire.from.portId)] ?? 'X' : previousClock
    const newControl = controlWire ? after.values[signalKey(controlWire.from.componentId, controlWire.from.portId)] ?? 'X' : nextClock
    if (c.kind === 'DFF') {
      const edge = c.activeEdge ?? 'rising'
      const triggered = edge === 'rising' ? oldControl === 0 && newControl === 1 : oldControl === 1 && newControl === 0
      if (triggered) next[c.id] = data
    } else {
      const active = (c.activeEdge ?? 'high') === 'high' ? newControl === 1 : newControl === 0
      const latchData = dataWire ? after.values[signalKey(dataWire.from.componentId, dataWire.from.portId)] ?? 'X' : 'X'
      if (active) next[c.id] = latchData
    }
  }
  return next
}

export function simulateProject(project: Project) {
  const circuits = Array.isArray(project?.circuits) ? project.circuits : []
  const circuit = circuits.find(c => c.id === project.activeCircuitId) ?? circuits[0]
  if (!circuit) {
    return { values: {} as Record<string, LogicValue>, outputs: {} as Record<string, LogicValue>, errors: ['No valid circuit is available in this project. Create a new circuit or import a valid project.'] }
  }
  return simulateCircuit(
    circuit,
    project.inputValues ?? {},
    project.sequentialState ?? {},
    project.clockLevel === 1 ? 1 : 0,
    circuits.filter(c => c?.isLibrary)
  )
}
