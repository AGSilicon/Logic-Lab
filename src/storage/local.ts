import type { Project } from '../engine/types'
const KEY = 'logiclab.projects.v1'

/** Validate the minimum project contract before allowing persisted data into React. */
export function isValidProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<Project>
  return p.schemaVersion === 1
    && typeof p.id === 'string'
    && typeof p.name === 'string'
    && typeof p.activeCircuitId === 'string'
    && Array.isArray(p.circuits)
    && p.circuits.some(c => c && c.id === p.activeCircuitId && Array.isArray(c.components) && Array.isArray(c.wires))
    && p.inputValues !== null && typeof p.inputValues === 'object'
    && p.sequentialState !== null && typeof p.sequentialState === 'object'
    && (p.clockLevel === 0 || p.clockLevel === 1)
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
