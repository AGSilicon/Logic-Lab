import type { Project } from '../engine/types'
const KEY = 'logiclab.projects.v1'

/**
 * Validate imported/local project data before it enters the editor.
 * Limits protect the UI from malformed or unexpectedly huge project files.
 */
export function isValidProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const p = value as Partial<Project>
  const idPattern = /^[a-zA-Z0-9_-]{1,100}$/
  if (p.schemaVersion !== 1 || typeof p.id !== 'string' || !idPattern.test(p.id)) return false
  if (typeof p.name !== 'string' || p.name.length > 100) return false
  if (typeof p.activeCircuitId !== 'string' || !idPattern.test(p.activeCircuitId)) return false
  if (!Array.isArray(p.circuits) || p.circuits.length < 1 || p.circuits.length > 100) return false
  if (!p.circuits.some(c => c && c.id === p.activeCircuitId)) return false
  if (!p.inputValues || typeof p.inputValues !== 'object' || Array.isArray(p.inputValues)) return false
  if (!p.sequentialState || typeof p.sequentialState !== 'object' || Array.isArray(p.sequentialState)) return false
  if (p.clockLevel !== 0 && p.clockLevel !== 1) return false

  const componentIds = new Set<string>()
  for (const circuit of p.circuits) {
    if (!circuit || typeof circuit.id !== 'string' || !idPattern.test(circuit.id)) return false
    if (typeof circuit.name !== 'string' || circuit.name.length > 100) return false
    if (!Array.isArray(circuit.components) || circuit.components.length > 500) return false
    if (!Array.isArray(circuit.wires) || circuit.wires.length > 1500) return false
    const ids = new Set(circuit.components.map(component => component?.id))
    if (ids.size !== circuit.components.length) return false
    for (const component of circuit.components) {
      if (!component || typeof component.id !== 'string' || !idPattern.test(component.id)) return false
      if (typeof component.kind !== 'string' || component.kind.length > 20) return false
      if (typeof component.label !== 'string' || component.label.length > 80) return false
      if (!Number.isFinite(component.x) || !Number.isFinite(component.y)
        || Math.abs(component.x) > 1_000_000 || Math.abs(component.y) > 1_000_000) return false
      if (!Array.isArray(component.inputs) || component.inputs.length > 16
        || !Array.isArray(component.outputs) || component.outputs.length > 16) return false
      for (const port of [...component.inputs, ...component.outputs]) {
        if (!port || typeof port.id !== 'string' || port.id.length > 40
          || typeof port.name !== 'string' || port.name.length > 40
          || (port.direction !== 'input' && port.direction !== 'output')
          || !Number.isInteger(port.bitWidth) || port.bitWidth < 1 || port.bitWidth > 32) return false
      }
    }
    for (const wire of circuit.wires) {
      if (!wire || typeof wire.id !== 'string' || !idPattern.test(wire.id)) return false
      const from = circuit.components.find(component => component.id === wire.from?.componentId)
      const to = circuit.components.find(component => component.id === wire.to?.componentId)
      if (!from?.outputs.some(port => port.id === wire.from.portId)
        || !to?.inputs.some(port => port.id === wire.to.portId)) return false
    }
  }
  return true
}

export function loadProjects(): Project[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(value) ? value.filter(isValidProject) : []
  } catch {
    return []
  }
}

export function saveProject(project: Project) {
  const all = loadProjects().filter(p => p.id !== project.id)
  localStorage.setItem(KEY, JSON.stringify([{ ...project, updatedAt: new Date().toISOString() }, ...all]))
}
