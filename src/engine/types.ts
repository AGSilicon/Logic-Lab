export type LogicValue = 0 | 1 | 'X'
export type GateKind =
  | 'INPUT' | 'OUTPUT' | 'NAND' | 'AND' | 'OR' | 'NOT' | 'NOR'
  | 'XOR' | 'XNOR' | 'CLOCK' | 'DFF' | 'LATCH' | 'CUSTOM'
export type PortDirection = 'input' | 'output'

export interface Port {
  id: string
  name: string
  direction: PortDirection
  bitWidth: number
}

export interface Component {
  id: string
  kind: GateKind
  label: string
  x: number
  y: number
  inputs: Port[]
  outputs: Port[]
  initialValue?: LogicValue
  customCircuitId?: string
  clockMode?: 'edge' | 'level'
  activeEdge?: 'rising' | 'falling' | 'high' | 'low'
}

export interface Wire {
  id: string
  from: { componentId: string; portId: string }
  to: { componentId: string; portId: string }
}

export interface CircuitDefinition {
  id: string
  name: string
  inputs: Port[]
  outputs: Port[]
  components: Component[]
  wires: Wire[]
  isLibrary?: boolean
}

export interface Project {
  schemaVersion: 1
  id: string
  name: string
  activeCircuitId: string
  circuits: CircuitDefinition[]
  inputValues: Record<string, LogicValue>
  sequentialState: Record<string, LogicValue>
  clockLevel: 0 | 1
  updatedAt: string
}
