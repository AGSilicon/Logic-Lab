export interface ConnectedRepository {
  id: number
  owner: string
  name: string
  fullName: string
  defaultBranch: string
  private: true
}

export interface GithubSession {
  login: string
  avatarUrl: string
  repository: ConnectedRepository | null
}

export interface GithubState {
  configured: boolean
  user: GithubSession | null
  appInstallUrl: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`)
  return body as T
}

export function getGithubState() {
  return request<GithubState>('/session')
}

export function beginGithubLogin() {
  window.location.assign('/api/auth/login')
}

export function getPrivateRepositories() {
  return request<{ repositories: ConnectedRepository[] }>('/repositories')
}

export function connectRepository(repositoryId: number) {
  return request<{ repository: ConnectedRepository }>('/repository', {
    method: 'POST',
    body: JSON.stringify({ repositoryId }),
  })
}

export function getGithubProjects() {
  return request<{ projects: unknown[] }>('/projects')
}

export function saveGithubProject(project: Project) {
  return request<{ savedAt: string; commitUrl: string | null }>(`/projects/${encodeURIComponent(project.id)}`, {
    method: 'PUT',
    body: JSON.stringify(project),
  })
}

export function logoutGithub() {
  return request<{ ok: true }>('/auth/logout', { method: 'POST' })
}
import type { Project } from '../engine/types'

