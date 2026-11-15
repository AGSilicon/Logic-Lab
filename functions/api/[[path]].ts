interface Env {
  APP_ORIGIN: string
  GITHUB_APP_CLIENT_ID: string
  GITHUB_APP_CLIENT_SECRET: string
  GITHUB_APP_SLUG: string
  SESSION_ENCRYPTION_KEY: string
}

interface ConnectedRepository {
  id: number
  owner: string
  name: string
  fullName: string
  defaultBranch: string
  private: true
}

interface Session {
  login: string
  avatarUrl: string
  accessToken: string
  expiresAt: number
  repository: ConnectedRepository | null
}

interface PagesContext {
  request: Request
  env: Env
}

type PagesFunction = (context: PagesContext) => Response | Promise<Response>

const SESSION_COOKIE = 'logiclab_session'
const STATE_COOKIE = 'logiclab_oauth_state'
const GITHUB_API = 'https://api.github.com'
const GITHUB_API_VERSION = '2026-03-10'
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60
const PROJECT_DIRECTORY = 'logiclab-projects'
const MAX_PROJECT_BYTES = 900_000

export const onRequest: PagesFunction = async ({ request, env }) => {
  const url = new URL(request.url)
  try {
    if (url.pathname === '/api/auth/login' && request.method === 'GET') return startLogin(env)
    if (url.pathname === '/api/auth/callback' && request.method === 'GET') return finishLogin(request, env)
    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      requireSameOrigin(request, env)
      const response = json({ ok: true })
      response.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE))
      return response
    }
    if (url.pathname === '/api/session' && request.method === 'GET') return getSessionResponse(request, env)

    const session = await readSession(request, env)
    if (!session) return json({ error: 'Sign in with GitHub to continue.' }, 401)

    if (url.pathname === '/api/repositories' && request.method === 'GET') {
      return json({ repositories: await listPrivateRepositories(session) })
    }

    if (url.pathname === '/api/repository' && request.method === 'POST') {
      requireSameOrigin(request, env)
      const body = await readJson(request)
      const repositoryId = Number(body.repositoryId)
      if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) return json({ error: 'Choose a valid repository.' }, 400)
      const repository = (await listPrivateRepositories(session)).find(repo => repo.id === repositoryId)
      if (!repository) return json({ error: 'That private repository is not available to this GitHub App.' }, 403)
      return json({ repository }, 200, { 'Set-Cookie': await sessionCookie({ ...session, repository }, env) })
    }

    const projectMatch = url.pathname.match(/^\/api\/projects(?:\/([a-zA-Z0-9_-]{1,100}))?$/)
    if (projectMatch && url.pathname === '/api/projects' && request.method === 'GET') {
      requireConnectedRepository(session)
      return json({ projects: await loadProjects(session) })
    }
    if (projectMatch && projectMatch[1] && request.method === 'PUT') {
      requireSameOrigin(request, env)
      requireConnectedRepository(session)
      return saveProject(request, session, projectMatch[1])
    }

    return json({ error: 'Not found.' }, 404)
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status)
    return json({ error: 'The GitHub request failed. Your local project is still available.' }, 502)
  }
}

function startLogin(env: Env) {
  requireConfiguration(env)
  const state = crypto.randomUUID()
  const target = new URL('https://github.com/login/oauth/authorize')
  target.searchParams.set('client_id', env.GITHUB_APP_CLIENT_ID)
  target.searchParams.set('redirect_uri', `${siteOrigin(env)}/api/auth/callback`)
  target.searchParams.set('state', state)
  return redirect(target.toString(), [cookie(STATE_COOKIE, state, 600)])
}

async function finishLogin(request: Request, env: Env) {
  requireConfiguration(env)
  const url = new URL(request.url)
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  if (!state || state !== readCookie(request, STATE_COOKIE) || !code || url.searchParams.has('error')) {
    return redirect(`${siteOrigin(env)}/?github=cancelled`, [clearCookie(STATE_COOKIE)])
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_APP_CLIENT_ID,
      client_secret: env.GITHUB_APP_CLIENT_SECRET,
      code,
      redirect_uri: `${siteOrigin(env)}/api/auth/callback`,
    }),
  })
  const tokenBody = await tokenResponse.json() as { access_token?: string; expires_in?: number; error?: string }
  if (!tokenResponse.ok || !tokenBody.access_token) throw new ApiError('GitHub sign-in could not be completed.', 502)

  const profile = await githubFetch<{ login: string; avatar_url: string }>('/user', tokenBody.access_token)
  if (!profile.login || !profile.avatar_url) throw new ApiError('GitHub did not return a usable account profile.', 502)
  const expiresAt = Math.floor(Date.now() / 1000) + Math.min(tokenBody.expires_in ?? SESSION_LIFETIME_SECONDS, SESSION_LIFETIME_SECONDS)
  const signedIn: Session = { login: profile.login, avatarUrl: profile.avatar_url, accessToken: tokenBody.access_token, expiresAt, repository: null }
  return redirect(`${siteOrigin(env)}/?github=connected`, [await sessionCookie(signedIn, env), clearCookie(STATE_COOKIE)])
}

async function getSessionResponse(request: Request, env: Env) {
  const appInstallUrl = env.GITHUB_APP_SLUG
    ? `https://github.com/apps/${encodeURIComponent(env.GITHUB_APP_SLUG)}/installations/new`
    : null
  const session = await readSession(request, env)
  return json({
    configured: isConfigured(env),
    user: session ? { login: session.login, avatarUrl: session.avatarUrl, repository: session.repository } : null,
    appInstallUrl,
  })
}

async function listPrivateRepositories(session: Session): Promise<ConnectedRepository[]> {
  const installations = await githubFetch<{ installations?: Array<{ id: number; account?: { login?: string } }> }>(
    '/user/installations?per_page=100', session.accessToken,
  )
  const repositories: ConnectedRepository[] = []
  for (const installation of installations.installations ?? []) {
    if (installation.account?.login?.toLowerCase() !== session.login.toLowerCase()) continue
    const response = await githubFetch<{ repositories?: Array<{ id: number; name: string; full_name: string; private: boolean; default_branch: string; owner: { login: string } }> }>(
      `/user/installations/${installation.id}/repositories?per_page=100`, session.accessToken,
    )
    for (const repository of response.repositories ?? []) {
      if (!repository.private || repository.owner.login.toLowerCase() !== session.login.toLowerCase()) continue
      repositories.push({
        id: repository.id,
        owner: repository.owner.login,
        name: repository.name,
        fullName: repository.full_name,
        defaultBranch: repository.default_branch,
        private: true,
      })
    }
  }
  return repositories
}

async function loadProjects(session: Session) {
  const repository = requireConnectedRepository(session)
  const contents = await githubFetchOrNotFound<Array<{ name: string; path: string; type: string }>>(
    `/repos/${repository.owner}/${repository.name}/contents/${PROJECT_DIRECTORY}?ref=${encodeURIComponent(repository.defaultBranch)}`,
    session.accessToken,
  )
  if (!contents) return []
  const files = contents.filter(file => file.type === 'file' && /^[a-zA-Z0-9_-]{1,100}\.logiclab\.json$/.test(file.name)).slice(0, 50)
  const projects = await Promise.all(files.map(async file => {
    const result = await githubFetch<{ content: string; encoding: string }>(
      `/repos/${repository.owner}/${repository.name}/contents/${file.path}?ref=${encodeURIComponent(repository.defaultBranch)}`,
      session.accessToken,
    )
    if (result.encoding !== 'base64') return null
    try {
      const project: unknown = JSON.parse(decodeBase64Utf8(result.content))
      return isValidProject(project) ? project : null
    } catch {
      return null
    }
  }))
  return projects.filter(Boolean)
}

async function saveProject(request: Request, session: Session, id: string) {
  const body = await readJson(request)
  if (!isValidProject(body) || body.id !== id) return json({ error: 'This LogicLab project file is invalid.' }, 400)
  const text = JSON.stringify(body, null, 2)
  const bytes = new TextEncoder().encode(text)
  if (bytes.byteLength > MAX_PROJECT_BYTES) return json({ error: 'This project is too large to save to GitHub.' }, 413)

  const repository = requireConnectedRepository(session)
  const path = `${PROJECT_DIRECTORY}/${id}.logiclab.json`
  const endpoint = `/repos/${repository.owner}/${repository.name}/contents/${path}`
  const existing = await githubFetchOrNotFound<{ sha: string }>(`${endpoint}?ref=${encodeURIComponent(repository.defaultBranch)}`, session.accessToken)
  const name = body.name.replace(/[\r\n]/g, ' ').slice(0, 80)
  const saved = await githubFetch<{ commit?: { html_url?: string } }>(endpoint, session.accessToken, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Save LogicLab project: ${name}`,
      content: encodeBase64Utf8(text),
      ...(existing ? { sha: existing.sha } : {}),
      branch: repository.defaultBranch,
    }),
  })
  return json({ savedAt: new Date().toISOString(), commitUrl: saved.commit?.html_url ?? null })
}

function isValidProject(value: unknown): value is { id: string; name: string; schemaVersion: number; [key: string]: unknown } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const project = value as Record<string, any>
  const idPattern = /^[a-zA-Z0-9_-]{1,100}$/
  if (project.schemaVersion !== 1 || typeof project.id !== 'string' || !idPattern.test(project.id)) return false
  if (typeof project.name !== 'string' || project.name.length > 100
    || typeof project.activeCircuitId !== 'string' || !idPattern.test(project.activeCircuitId)) return false
  if (!Array.isArray(project.circuits) || project.circuits.length < 1 || project.circuits.length > 100) return false
  if (!project.circuits.some((circuit: any) => circuit && circuit.id === project.activeCircuitId)) return false
  if (!project.inputValues || typeof project.inputValues !== 'object' || Array.isArray(project.inputValues)
    || !project.sequentialState || typeof project.sequentialState !== 'object' || Array.isArray(project.sequentialState)) return false
  if (project.clockLevel !== 0 && project.clockLevel !== 1) return false

  for (const circuit of project.circuits) {
    if (!circuit || typeof circuit.id !== 'string' || !idPattern.test(circuit.id)
      || typeof circuit.name !== 'string' || circuit.name.length > 100
      || !Array.isArray(circuit.components) || circuit.components.length > 500
      || !Array.isArray(circuit.wires) || circuit.wires.length > 1500) return false
    const componentIds = new Set<string>()
    for (const component of circuit.components) {
      if (!component || typeof component.id !== 'string' || !idPattern.test(component.id)
        || componentIds.has(component.id) || typeof component.kind !== 'string'
        || component.kind.length > 20 || typeof component.label !== 'string'
        || component.label.length > 80 || !Number.isFinite(component.x)
        || !Number.isFinite(component.y) || Math.abs(component.x) > 1_000_000
        || Math.abs(component.y) > 1_000_000
        || !Array.isArray(component.inputs) || component.inputs.length > 16
        || !Array.isArray(component.outputs) || component.outputs.length > 16) return false
      componentIds.add(component.id)
      for (const port of [...component.inputs, ...component.outputs]) {
        if (!port || typeof port.id !== 'string' || port.id.length > 40
          || typeof port.name !== 'string' || port.name.length > 40
          || !['input', 'output'].includes(port.direction)
          || !Number.isInteger(port.bitWidth) || port.bitWidth < 1 || port.bitWidth > 32) return false
      }
    }
    for (const wire of circuit.wires) {
      if (!wire || typeof wire.id !== 'string' || !idPattern.test(wire.id)) return false
      const from = circuit.components.find((component: any) => component.id === wire.from?.componentId)
      const to = circuit.components.find((component: any) => component.id === wire.to?.componentId)
      if (!from?.outputs.some((port: any) => port.id === wire.from.portId)
        || !to?.inputs.some((port: any) => port.id === wire.to.portId)) return false
    }
  }
  return true
}

async function readSession(request: Request, env: Env): Promise<Session | null> {
  const value = readCookie(request, SESSION_COOKIE)
  if (!value || !env.SESSION_ENCRYPTION_KEY) return null
  try {
    const bytes = decodeBase64Url(value)
    const iv = bytes.slice(0, 12)
    const ciphertext = bytes.slice(12)
    const key = await crypto.subtle.importKey('raw', sessionKeyBytes(env), 'AES-GCM', false, ['decrypt'])
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    const session = JSON.parse(new TextDecoder().decode(plaintext)) as Session
    if (!session.accessToken || !session.login || session.expiresAt <= Date.now() / 1000) return null
    return session
  } catch {
    return null
  }
}

async function sessionCookie(session: Session, env: Env) {
  const key = await crypto.subtle.importKey('raw', sessionKeyBytes(env), 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(session)))
  const payload = new Uint8Array(iv.length + ciphertext.byteLength)
  payload.set(iv)
  payload.set(new Uint8Array(ciphertext), iv.length)
  const maxAge = Math.max(0, session.expiresAt - Math.floor(Date.now() / 1000))
  return `${SESSION_COOKIE}=${encodeBase64Url(payload)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`
}

async function githubFetch<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/vnd.github+json')
  headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('X-GitHub-Api-Version', GITHUB_API_VERSION)
  if (init.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers,
  })
  if (!response.ok) {
    if (response.status === 401) throw new ApiError('Your GitHub session expired. Sign in again to continue.', 401)
    if (response.status === 409 || response.status === 422) throw new ApiError('GitHub could not save this project. Reload the project and try again.', 409)
    throw new ApiError('GitHub could not complete this request. Check the repository access and try again.', response.status === 403 ? 403 : 502)
  }
  return await response.json() as T
}

async function githubFetchOrNotFound<T>(path: string, accessToken: string): Promise<T | null> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
  })
  if (response.status === 404) return null
  if (!response.ok) {
    if (response.status === 401) throw new ApiError('Your GitHub session expired. Sign in again to continue.', 401)
    throw new ApiError('GitHub could not read this repository. Check that the app still has access.', response.status === 403 ? 403 : 502)
  }
  return await response.json() as T
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const length = Number(request.headers.get('content-length') || 0)
  if (length > MAX_PROJECT_BYTES) throw new ApiError('The request is too large.', 413)
  try {
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > MAX_PROJECT_BYTES) throw new ApiError('The request is too large.', 413)
    const value: unknown = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid JSON')
    return value as Record<string, any>
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('Send a valid JSON request.', 400)
  }
}

function requireConnectedRepository(session: Session) {
  if (!session.repository || !session.repository.private) throw new ApiError('Connect one of your private repositories first.', 409)
  return session.repository
}

function requireSameOrigin(request: Request, env: Env) {
  if (request.headers.get('Origin') !== siteOrigin(env)) throw new ApiError('The request origin is not allowed.', 403)
}

function requireConfiguration(env: Env) {
  if (!isConfigured(env)) throw new ApiError('GitHub sign-in is not configured yet.', 503)
}

function isConfigured(env: Env) {
  if (!env.APP_ORIGIN || !env.GITHUB_APP_CLIENT_ID || !env.GITHUB_APP_CLIENT_SECRET || !env.GITHUB_APP_SLUG || !env.SESSION_ENCRYPTION_KEY) return false
  try {
    const origin = new URL(env.APP_ORIGIN)
    return origin.origin === env.APP_ORIGIN.replace(/\/$/, '') && decodeBase64(env.SESSION_ENCRYPTION_KEY).byteLength === 32
  } catch {
    return false
  }
}

function siteOrigin(env: Env) {
  try {
    return new URL(env.APP_ORIGIN).origin
  } catch {
    throw new ApiError('The app origin is not configured.', 503)
  }
}

function readCookie(request: Request, name: string) {
  return (request.headers.get('Cookie') ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? null
}

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`
}

function clearCookie(name: string) {
  return `${name}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`
}

function redirect(location: string, cookies: string[]) {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' })
  for (const value of cookies) headers.append('Set-Cookie', value)
  return new Response(null, { status: 302, headers })
}

function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8')
  responseHeaders.set('Cache-Control', 'no-store')
  responseHeaders.set('X-Content-Type-Options', 'nosniff')
  responseHeaders.set('Referrer-Policy', 'no-referrer')
  return new Response(JSON.stringify(value), { status, headers: responseHeaders })
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), character => character.charCodeAt(0))
}

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function decodeBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function sessionKeyBytes(env: Env) {
  const bytes = decodeBase64(env.SESSION_ENCRYPTION_KEY)
  if (bytes.byteLength !== 32) throw new ApiError('The session encryption key must decode to 32 bytes.', 503)
  return bytes
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}
