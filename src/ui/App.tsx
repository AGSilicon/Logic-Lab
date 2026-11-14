import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { Activity, BookOpen, CircuitBoard, Clock3, Download, FolderOpen, Github, Grid2X2, Moon, Plus, Save, Search, Settings2, Sun, Undo2, Redo2, ZoomIn, ZoomOut, Trash2, Upload, Play, Pause, StepForward, Copy, Layers, Maximize2, PanelLeft, PanelRight } from 'lucide-react'
import { createProject, makeComponent } from '../engine/project'
import { simulateProject, updateSequentialState } from '../engine/simulate'
import { isValidProject, loadProjects, saveProject } from '../storage/local'
import type { Component, GateKind, LogicValue, Project, Wire } from '../engine/types'
import { beginGithubLogin, connectRepository, getGithubProjects, getGithubState, getPrivateRepositories, logoutGithub, saveGithubProject } from '../api/github'
import type { ConnectedRepository, GithubState } from '../api/github'

const groups: { title: string; kinds: GateKind[] }[] = [
  { title: 'PINS', kinds: ['INPUT', 'OUTPUT'] },
  { title: 'LOGIC GATES', kinds: ['NAND', 'AND', 'OR', 'NOT', 'NOR', 'XOR', 'XNOR'] },
  { title: 'SEQUENTIAL', kinds: ['DFF', 'LATCH'] },
  { title: 'TIMING', kinds: ['CLOCK'] }
]
const titleFor = (kind: GateKind) => ({ INPUT:'Input pin', OUTPUT:'Output pin', CLOCK:'Clock', DFF:'D flip-flop', LATCH:'D latch' } as Record<string,string>)[kind] ?? `${kind} gate`
const W = 112, H = 72
type View = { x: number; y: number; w: number; h: number }
type History = { circuits: Project['circuits']; inputValues: Project['inputValues']; sequentialState: Project['sequentialState'] }

export default function App() {
  const [project, setProject] = useState<Project>(() => { const saved = loadProjects()[0]; return saved && isValidProject(saved) ? saved : createProject() })
  const [selected, setSelected] = useState<string | null>(null)
  const [dark, setDark] = useState(false)
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const [view, setView] = useState<View>({ x: 0, y: 0, w: 1600, h: 1000 })
  const [wireStart, setWireStart] = useState<{ componentId: string; portId: string } | null>(null)
  const [status, setStatus] = useState('Local workspace')
  const [clockRunning, setClockRunning] = useState(false)
  const [clockHz, setClockHz] = useState(1)
  const [clockMode, setClockMode] = useState<'manual'|'automatic'>('manual')
  const [history, setHistory] = useState<History[]>([])
  const [future, setFuture] = useState<History[]>([])
  const [showTruth, setShowTruth] = useState(false)
  const [showLibrary, setShowLibrary] = useState(true)
  const [showInspector, setShowInspector] = useState(true)
  const [circuitStack, setCircuitStack] = useState<string[]>([])
  const [githubState, setGithubState] = useState<GithubState>({ configured: false, user: null, appInstallUrl: null })
  const [githubDialog, setGithubDialog] = useState<'repositories' | 'projects' | null>(null)
  const [githubRepositories, setGithubRepositories] = useState<ConnectedRepository[]>([])
  const [githubProjects, setGithubProjects] = useState<Project[]>([])
  const [githubError, setGithubError] = useState('')
  const [githubBusy, setGithubBusy] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const panRef = useRef<{ x: number; y: number; view: View } | null>(null)
  const circuit = project.circuits.find(c => c.id === project.activeCircuitId)!
  const simulation = useMemo(() => simulateProject(project), [project])
  const selectedComponent = circuit.components.find(c => c.id === selected)

  useEffect(() => {
    let active = true
    getGithubState().then(result => {
      if (!active) return
      setGithubState(result)
      const resultParam = new URLSearchParams(window.location.search).get('github')
      if (resultParam === 'connected') setStatus(`Signed in as @${result.user?.login ?? 'GitHub user'}`)
      if (resultParam === 'cancelled') setStatus('GitHub sign-in was cancelled')
      if (resultParam) window.history.replaceState({}, '', window.location.pathname)
    }).catch(() => {
      if (active) setGithubState({ configured: false, user: null, appInstallUrl: null })
    })
    return () => { active = false }
  }, [])

  // Local autosave is deliberately independent of GitHub sign-in and cloud availability.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveProject(project)
      setStatus(current => current === 'Unsaved changes' ? 'Auto-saved locally' : current)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [project])

  // Global editor shortcuts; typing inside form fields is left untouched.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (typing) return
      if (event.key === 'Escape') { setWireStart(null); setSelected(null) }
      if (event.key === 'Delete' || event.key === 'Backspace') { if (selected) { event.preventDefault(); removeSelected() } }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undo() }
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) { event.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function snapshot(p: Project): History { return { circuits: p.circuits, inputValues: p.inputValues, sequentialState: p.sequentialState } }
  function commit(mutator: (p: Project) => Project) {
    // Keep state updater callbacks pure: history is captured from the current render,
    // while the project transformation itself remains a functional update.
    setHistory(h => [...h.slice(-49), snapshot(project)])
    setFuture([])
    setProject(p => {
      const next = mutator(p)
      const active = next.circuits.find(c => c.id === next.activeCircuitId)
      // Re-evaluate transparent latches after data or wiring edits while their enable level is active.
      const sequentialState = active
        ? updateSequentialState(active, next.inputValues, next.sequentialState, next.clockLevel, next.clockLevel)
        : next.sequentialState
      return { ...next, sequentialState, updatedAt: new Date().toISOString() }
    })
    setStatus('Unsaved changes')
  }
  function updateCircuit(mutator: (components: Component[], wires: Wire[]) => { components: Component[]; wires: Wire[] }) {
    commit(p => ({ ...p, circuits: p.circuits.map(c => c.id === p.activeCircuitId ? { ...c, ...mutator(c.components, c.wires) } : c) }))
  }
  function add(kind: GateKind) {
    const c = makeComponent(kind, view.x + view.w/2 - W/2, view.y + view.h/2 - H/2)
    updateCircuit((components,wires)=>({components:[...components,c],wires}))
    setSelected(c.id)
  }
  function addCustom(definition: Project['circuits'][number]) {
    const c: Component = {
      id: crypto.randomUUID(), kind: 'CUSTOM', label: definition.name,
      x: snap(view.x + view.w/2 - W/2), y: snap(view.y + view.h/2 - H/2),
      customCircuitId: definition.id,
      inputs: definition.components.filter(x=>x.kind==='INPUT').map((_,i)=>({id:`in${i}`,name:`IN${i+1}`,direction:'input' as const,bitWidth:1})),
      outputs: definition.components.filter(x=>x.kind==='OUTPUT').map((_,i)=>({id:`out${i}`,name:`OUT${i+1}`,direction:'output' as const,bitWidth:1}))
    }
    updateCircuit((components,wires)=>({components:[...components,c],wires}))
    setSelected(c.id)
  }
  function openCustom(definitionId: string) {
    const definition = project.circuits.find(c=>c.id===definitionId && c.isLibrary)
    if (!definition) return
    setCircuitStack(stack=>[...stack,circuit.id])
    setProject(p=>({...p,activeCircuitId:definitionId}))
    setSelected(null); setWireStart(null); setStatus(`Editing reusable circuit: ${definition.name}`)
  }
  function returnToParent() {
    const parent = circuitStack[circuitStack.length-1]
    if (!parent) return
    setCircuitStack(stack=>stack.slice(0,-1))
    setProject(p=>({...p,activeCircuitId:parent}))
    setSelected(null); setWireStart(null)
  }
  function save() {
    saveProject(project)
    const repository = githubState.user?.repository
    if (!repository) { setStatus('Saved on this device'); return }
    setGithubBusy(true)
    setGithubError('')
    setStatus(`Saving to ${repository.name} on GitHub…`)
    saveGithubProject(project)
      .then(() => setStatus(`Saved locally and to ${repository.fullName}`))
      .catch(error => {
        setGithubError(error instanceof Error ? error.message : 'GitHub save failed.')
        setStatus('Saved locally; GitHub save failed')
      })
      .finally(() => setGithubBusy(false))
  }

  async function openRepositoryPicker() {
    if (!githubState.user) {
      if (githubState.configured) beginGithubLogin()
      else setGithubError('GitHub sign-in is not configured on the server yet.')
      return
    }
    setGithubDialog('repositories')
    setGithubBusy(true)
    setGithubError('')
    try {
      const result = await getPrivateRepositories()
      setGithubRepositories(result.repositories)
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : 'Could not load your private repositories.')
    } finally {
      setGithubBusy(false)
    }
  }

  async function chooseRepository(repository: ConnectedRepository) {
    setGithubBusy(true)
    setGithubError('')
    try {
      const result = await connectRepository(repository.id)
      setGithubState(current => ({ ...current, user: current.user ? { ...current.user, repository: result.repository } : null }))
      setGithubDialog(null)
      setStatus(`GitHub storage connected: ${result.repository.fullName}`)
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : 'Could not connect this repository.')
    } finally {
      setGithubBusy(false)
    }
  }

  async function openGithubProjects() {
    setGithubDialog('projects')
    setGithubBusy(true)
    setGithubError('')
    try {
      const result = await getGithubProjects()
      setGithubProjects(result.projects.filter(isValidProject))
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : 'Could not load projects from GitHub.')
    } finally {
      setGithubBusy(false)
    }
  }

  function loadGithubProject(remoteProject: Project) {
    setProject(remoteProject)
    saveProject(remoteProject)
    setSelected(null)
    setCircuitStack([])
    setGithubDialog(null)
    setStatus(`Loaded from ${githubState.user?.repository?.fullName ?? 'GitHub'}`)
  }

  async function signOutGithub() {
    setGithubBusy(true)
    try {
      await logoutGithub()
      setGithubState(current => ({ ...current, user: null }))
      setGithubDialog(null)
      setStatus('Signed out of GitHub; local projects are still available')
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : 'Could not sign out.')
    } finally {
      setGithubBusy(false)
    }
  }
  function exportProject() {
    const blob = new Blob([JSON.stringify(project,null,2)], { type:'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href=url; a.download=`${project.name.replace(/[^a-z0-9-_]/gi,'_') || 'logiclab-project'}.logiclab.json`; a.click(); URL.revokeObjectURL(url)
  }
  function importProject(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { try {
      const p = JSON.parse(String(reader.result)) as Project
      if (!isValidProject(p)) throw new Error('Unsupported or invalid LogicLab project file. Please export a fresh project from a current LogicLab version.')
      setProject(p); setSelected(null); setCircuitStack([]); setStatus('Project imported')
    } catch(e) { alert(e instanceof Error ? e.message : 'Could not import project.') } }
    reader.readAsText(file)
  }
  function undo() {
    if (!history.length) return
    const previous = history[history.length - 1]
    setHistory(history.slice(0, -1))
    setFuture([snapshot(project), ...future])
    setProject(p => ({ ...p, ...previous }))
    setStatus('Undo')
  }
  function redo() {
    if (!future.length) return
    const next = future[0]
    setFuture(future.slice(1))
    setHistory([...history, snapshot(project)])
    setProject(p => ({ ...p, ...next }))
    setStatus('Redo')
  }
  function point(evt: ReactPointerEvent<SVGSVGElement>) {
    const pt = svgRef.current!.createSVGPoint(); pt.x=evt.clientX; pt.y=evt.clientY
    const matrix = svgRef.current!.getScreenCTM()
    if (!matrix) return {x:0,y:0}
    const p=pt.matrixTransform(matrix.inverse()); return {x:p.x,y:p.y}
  }
  function onCanvasPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button === 1 || e.button === 2 || e.altKey) {
      const p=point(e); panRef.current={x:e.clientX,y:e.clientY,view}; e.currentTarget.setPointerCapture(e.pointerId); return
    }
    if (e.target === e.currentTarget || (e.target as Element).classList.contains('canvas-background')) {
      setSelected(null); setWireStart(null)
    }
  }
  function onCanvasPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current) {
      const p=point(e); const {id,dx,dy}=dragRef.current
      setProject(old=>({...old,circuits:old.circuits.map(c=>c.id===old.activeCircuitId?{...c,components:c.components.map(n=>n.id===id?{...n,x:snap(p.x-dx),y:snap(p.y-dy)}:n)}:c)}))
      setStatus('Unsaved changes'); return
    }
    if (panRef.current) {
      const scale=view.w/svgRef.current!.clientWidth
      const dx=(e.clientX-panRef.current.x)*scale, dy=(e.clientY-panRef.current.y)*scale
      setView({...panRef.current.view,x:panRef.current.view.x-dx,y:panRef.current.view.y-dy})
    }
  }
  function onCanvasPointerUp() { dragRef.current=null; panRef.current=null }
  function zoomAt(e: ReactWheelEvent<SVGSVGElement>) {
    e.preventDefault()
    const factor=e.deltaY<0?0.88:1.14
    setView(v=>{const p=pointFromClient(e.clientX,e.clientY); const nw=Math.max(350,Math.min(3200,v.w*factor)), nh=v.h*nw/v.w; const rx=(p.x-v.x)/v.w, ry=(p.y-v.y)/v.h; return {x:p.x-rx*nw,y:p.y-ry*nh,w:nw,h:nh}})
  }
  function pointFromClient(cx:number,cy:number) {
    const svg=svgRef.current;if(!svg)return {x:view.x+view.w/2,y:view.y+view.h/2}
    const pt=svg.createSVGPoint();pt.x=cx;pt.y=cy;const m=svg.getScreenCTM();return m?pt.matrixTransform(m.inverse()):{x:0,y:0}
  }
  function startDrag(e: ReactPointerEvent<SVGGElement>, c: Component) {
    if(e.button !== 0 || wireStart)return
    e.stopPropagation();setSelected(c.id);setHistory(h=>[...h.slice(-49),snapshot(project)]);setFuture([])
    const p=pointFromClient(e.clientX,e.clientY);dragRef.current={id:c.id,dx:p.x-c.x,dy:p.y-c.y}
    ;(e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId)
  }
  function clickPort(e: ReactMouseEvent, c: Component, portId: string, direction: 'input'|'output') {
    e.stopPropagation()
    if(direction==='output') { setWireStart({componentId:c.id,portId});setSelected(c.id);return }
    if(!wireStart) { setSelected(c.id);return }
    if(wireStart.componentId===c.id) {setWireStart(null);return}
    const exists=circuit.wires.some(w=>w.to.componentId===c.id&&w.to.portId===portId)
    if(exists) { setWireStart(null); alert('This input already has a driver. Remove its existing wire first.'); return }
    const newWire:Wire={id:crypto.randomUUID(),from:wireStart,to:{componentId:c.id,portId}}
    updateCircuit((cs,ws)=>({components:cs,wires:[...ws,newWire]}))
    setWireStart(null);setSelected(c.id)
  }
  function removeSelected() {
    if(!selected)return
    updateCircuit((cs,ws)=>({components:cs.filter(c=>c.id!==selected),wires:ws.filter(w=>w.from.componentId!==selected&&w.to.componentId!==selected)}))
    setSelected(null)
  }
  function toggleInput(id:string) {
    commit(p=>({...p,inputValues:{...p.inputValues,[id]:(p.inputValues[id]??0)===0?1:0}}))
  }
  function tickClock() {
    commit(p=>{const next=(p.clockLevel===0?1:0) as 0|1;const nextState=updateSequentialState(circuitFor(p),p.inputValues,p.sequentialState,p.clockLevel,next);return {...p,clockLevel:next,sequentialState:nextState}})
  }
  function circuitFor(p:Project){return p.circuits.find(c=>c.id===p.activeCircuitId)!}
  useEffect(()=>{if(!clockRunning||clockMode!=='automatic')return;const id=window.setInterval(tickClock,1000/(clockHz*2));return()=>window.clearInterval(id)},[clockRunning,clockMode,clockHz,project])
  function saveAsReusable() {
    if(circuit.isLibrary) { alert('You are editing a reusable component. Use Save to update its definition; existing instances reference this same definition.'); return }
    if(!circuit.components.some(c=>c.kind==='INPUT')||!circuit.components.some(c=>c.kind==='OUTPUT')) {alert('Add at least one Input pin and one Output pin before saving a reusable circuit.');return}
    const name=window.prompt('Name this reusable circuit',circuit.name==='Main Circuit'?'My logic block':circuit.name)
    if(!name)return
    const libraryId=crypto.randomUUID()
    const library={...circuit,id:libraryId,name,components:circuit.components.map(c=>({...c,id:crypto.randomUUID()})),wires:[] as Wire[],isLibrary:true}
    const idMap=new Map(circuit.components.map((c,i)=>[c.id,library.components[i].id]))
    library.wires=circuit.wires.map(w=>({...w,id:crypto.randomUUID(),from:{...w.from,componentId:idMap.get(w.from.componentId)!},to:{...w.to,componentId:idMap.get(w.to.componentId)!}}))
    const mainId=crypto.randomUUID()
    const main={id:mainId,name:'Main Circuit',inputs:[],outputs:[],components:[],wires:[]}
    commit(p=>({...p,circuits:[...p.circuits.filter(c=>c.id!==p.activeCircuitId),library,main],activeCircuitId:mainId}))
    const custom:Component={id:crypto.randomUUID(),kind:'CUSTOM',label:name,x:650,y:350,customCircuitId:libraryId,inputs:library.components.filter(c=>c.kind==='INPUT').map((_,i)=>({id:`in${i}`,name:`IN${i+1}`,direction:'input' as const,bitWidth:1})),outputs:library.components.filter(c=>c.kind==='OUTPUT').map((_,i)=>({id:`out${i}`,name:`OUT${i+1}`,direction:'output' as const,bitWidth:1}))}
    setCircuitStack([])
    setTimeout(()=>setProject(p=>({...p,circuits:p.circuits.map(c=>c.id===mainId?{...c,components:[custom]}:c)})),0)
    setSelected(custom.id)
  }
  function duplicateSelected() {
    if(!selectedComponent)return
    const c={...selectedComponent,id:crypto.randomUUID(),x:selectedComponent.x+40,y:selectedComponent.y+40,inputs:selectedComponent.inputs.map(p=>({...p,id:crypto.randomUUID()})),outputs:selectedComponent.outputs.map(p=>({...p,id:crypto.randomUUID()}))}
    updateCircuit((cs,ws)=>({components:[...cs,c],wires:ws}));setSelected(c.id)
  }
  const filtered=groups.map(g=>({...g,kinds:g.kinds.filter(k=>titleFor(k).toLowerCase().includes(query.toLowerCase()))}))
  const editorColumns = showLibrary && showInspector ? '205px minmax(350px,1fr) 220px' : showLibrary ? '205px minmax(350px,1fr)' : showInspector ? 'minmax(350px,1fr) 220px' : 'minmax(350px,1fr)'
  const truthRows=useMemo(()=>{
    const pins=circuit.components.filter(c=>c.kind==='INPUT')
    if(pins.length>8)return []
    return Array.from({length:2**pins.length},(_,n)=>{const vals={...project.inputValues};pins.forEach((p,i)=>{vals[p.id]=((n>>(pins.length-i-1))&1) as LogicValue});const r=simulateProject({...project,inputValues:vals});return {inputs:pins.map(p=>vals[p.id]),outputs:circuit.components.filter(c=>c.kind==='OUTPUT').map(c=>r.outputs[c.id]??'X')}})
  },[circuit,project])

  return <div className={dark?'app dark':'app'}>
    <header className="titlebar">
      <div className="traffic"><i/><i/><i/></div>
      <div className="brand"><span className="brand-mark"><CircuitBoard size={17}/></span><b>LogicLab</b><span className="muted">/ Digital Laboratory</span></div>
      <div className="title-actions"><span className="save-status"><span className="status-dot"/>{status}</span>{githubState.user?<button className="account-btn" onClick={openRepositoryPicker} title="Manage GitHub storage"><img src={githubState.user.avatarUrl} alt=""/><span>@{githubState.user.login}</span></button>:<button className="secondary-btn" disabled={!githubState.configured} onClick={beginGithubLogin} title={githubState.configured?'Sign in with GitHub':'GitHub sign-in is not configured on the server yet'}><Github size={15}/> Sign in with GitHub</button>}<button className="icon-btn" onClick={()=>setDark(!dark)} title="Toggle theme">{dark?<Sun size={16}/>:<Moon size={16}/>}</button><button className="primary-btn" onClick={save} disabled={githubBusy}><Save size={15}/> Save</button></div>
    </header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="side-label">WORKSPACE</div>
        <button className="nav active"><Grid2X2 size={16}/> Circuit editor</button>
        <button className="nav" onClick={()=>{const all=loadProjects();if(all.length){setProject(all[0]);setStatus('Loaded saved project')}}}><FolderOpen size={16}/> Load saved</button>
        <button className="nav" onClick={saveAsReusable}><Layers size={16}/> Save as component</button>
        <div className="side-label section-label">LEARN</div>
        <button className="nav" onClick={()=>setShowTruth(v=>!v)}><Activity size={16}/> Truth table</button>
        <button className="nav"><BookOpen size={16}/> Documentation</button>
        <div className="sidebar-bottom">
          <div className="github-card"><Github size={17}/><div><b>{githubState.user ? `@${githubState.user.login}` : 'GitHub storage'}</b><small>{githubState.user?.repository?.fullName ?? (githubState.user ? 'Connect a private repo' : githubState.configured ? 'Sign in to sync projects' : 'Server setup required')}</small></div><span className="online-dot"/></div>
          {githubState.user && !githubState.user.repository && <button className="nav" onClick={openRepositoryPicker}><Github size={16}/> Connect private repo</button>}
          {githubState.user?.repository && <><button className="nav" onClick={openGithubProjects}><FolderOpen size={16}/> Open from GitHub</button><button className="nav" onClick={openRepositoryPicker}><Settings2 size={16}/> Change repository</button><button className="nav" onClick={signOutGithub}><Github size={16}/> Sign out</button></>}
          <a className="nav follow-link" href="https://github.com/AGSilicon" target="_blank" rel="noreferrer"><Github size={16}/> Follow @AGSilicon</a>
          <button className="nav"><Settings2 size={16}/> Preferences</button>
        </div>
      </aside>
      <main className="main">
        <div className="projectbar"><div><div className="eyebrow">CIRCUIT WORKSPACE</div><input className="project-name" value={project.name} onChange={e=>setProject({...project,name:e.target.value})}/><div className="subline">{circuit.name} <span>·</span> {circuit.components.length} components <span>·</span> {circuit.wires.length} wires {circuitStack.length>0&&<button className="back-link" onClick={returnToParent}>← Back to parent circuit</button>}</div></div>
          <div className="project-tools"><button className="icon-btn" onClick={()=>setShowLibrary(v=>!v)} title="Toggle component library"><PanelLeft size={16}/></button><button className="icon-btn" onClick={()=>setShowInspector(v=>!v)} title="Toggle inspector"><PanelRight size={16}/></button><span className="tool-divider"/><button className="icon-btn" disabled={!history.length} onClick={undo} title="Undo"><Undo2 size={16}/></button><button className="icon-btn" disabled={!future.length} onClick={redo} title="Redo"><Redo2 size={16}/></button><span className="tool-divider"/><button className="icon-btn" onClick={()=>setView(v=>({...v,w:Math.min(3200,v.w*1.2),h:v.h*1.2}))}><ZoomOut size={16}/></button><span className="zoom-label">{Math.round(1600/view.w*100)}%</span><button className="icon-btn" onClick={()=>setView(v=>({...v,w:Math.max(350,v.w/1.2),h:v.h/1.2}))}><ZoomIn size={16}/></button><button className="icon-btn" onClick={()=>setView({x:0,y:0,w:1600,h:1000})} title="Fit/reset view"><Maximize2 size={16}/></button><button className="icon-btn" onClick={exportProject} title="Export project"><Download size={16}/></button><label className="icon-btn upload-btn" title="Import project"><Upload size={16}/><input type="file" accept=".json,.logiclab.json,application/json" onChange={e=>importProject(e.target.files?.[0])}/></label></div>
        </div>
        <div className="editor" style={{gridTemplateColumns:editorColumns}}>
          {showLibrary&&<aside className="components-panel">
            <div className="panel-heading">Components <span className="count">{groups.reduce((n,g)=>n+g.kinds.length,0)}</span></div>
            <div className="searchbox"><Search size={14}/><input placeholder="Find a component..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
            {filtered.map(group=>group.kinds.length>0&&<section className="palette-group" key={group.title}><div className="group-title">{group.title}</div>{group.kinds.map(kind=><button className="component-item" key={kind} onClick={()=>add(kind)}><span className="component-symbol">{kind==='INPUT'?'IN':kind==='OUTPUT'?'OUT':kind==='CLOCK'?'CLK':kind}</span><span>{titleFor(kind)}</span><Plus size={13}/></button>)}</section>)}
            {project.circuits.some(c=>c.isLibrary)&&<section className="palette-group"><div className="group-title">MY REUSABLE CIRCUITS</div>{project.circuits.filter(c=>c.isLibrary).map(def=><button className="component-item" key={def.id} onClick={()=>addCustom(def)}><span className="component-symbol">SUB</span><span>{def.name}</span><Plus size={13}/></button>)}</section>}
            <div className="panel-note">Click a component to add it. Drag components on the canvas. Click an output port, then an input port to wire them.</div>
          </aside>}
          <section className="canvas-wrap">
            <div className="canvas-top"><span><span className="live-dot"/> LIVE SIMULATION</span><span>INFINITE GRID · ORTHOGONAL WIRES</span></div>
            <svg ref={svgRef} className="canvas" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={onCanvasPointerUp} onPointerCancel={onCanvasPointerUp} onWheel={zoomAt} onContextMenu={e=>e.preventDefault()}>
              <defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="translate(0 0)"><circle cx="1" cy="1" r=".9" className="grid-dot"/></pattern><pattern id="majorGrid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" className="major-grid-line" fill="none"/></pattern></defs>
              <rect x={view.x-5000} y={view.y-5000} width={view.w+10000} height={view.h+10000} fill="url(#grid)" className="canvas-background"/>
              <rect x={view.x-5000} y={view.y-5000} width={view.w+10000} height={view.h+10000} fill="url(#majorGrid)" className="canvas-background"/>
              {circuit.wires.map(w=>{const a=circuit.components.find(c=>c.id===w.from.componentId),b=circuit.components.find(c=>c.id===w.to.componentId);if(!a||!b)return null;const inputIndex=b.inputs.findIndex(p=>p.id===w.to.portId), outputIndex=a.outputs.findIndex(p=>p.id===w.from.portId);const x1=a.x+W,y1=a.y+H/2+(outputIndex-(a.outputs.length-1)/2)*13,x2=b.x,y2=b.y+H/2+(inputIndex-(b.inputs.length-1)/2)*13,m=Math.round((x1+x2)/2/20)*20;const val=simulation.values[`${a.id}:${w.from.portId}`];return <g key={w.id}><path d={`M${x1} ${y1} H${m} V${y2} H${x2}`} className={`wire ${val===1?'wire-high':val===0?'wire-low':''}`} onClick={e=>{e.stopPropagation();updateCircuit((cs,ws)=>({components:cs,wires:ws.filter(x=>x.id!==w.id)}))}}/><circle cx={m} cy={y1} r="2.7" className="junction"/></g>})}
              {circuit.components.map(c=><g key={c.id} transform={`translate(${c.x},${c.y})`} onPointerDown={e=>startDrag(e,c)} onClick={e=>{e.stopPropagation();setSelected(c.id)}} onDoubleClick={e=>{e.stopPropagation();if(c.kind==='CUSTOM'&&c.customCircuitId)openCustom(c.customCircuitId)}} className="node">
                <rect width={W} height={H} rx="11" className={selected===c.id?'node-body selected':'node-body'}/>
                <text x={W/2} y="27" textAnchor="middle" className="node-type">{c.kind}</text><text x={W/2} y="45" textAnchor="middle" className="node-label">{c.label}</text>
                {c.inputs.map((p,i)=><g key={p.id} onPointerDown={e=>e.stopPropagation()} onClick={e=>clickPort(e,c,p.id,'input')} className="port-hit"><circle cx="0" cy={H/2+i*13-(c.inputs.length-1)*6.5} r="10" className="port-hit-area"/><circle cx="0" cy={H/2+i*13-(c.inputs.length-1)*6.5} r="4.5" className="port input-port"/></g>)}
                {c.outputs.map((p,i)=><g key={p.id} onPointerDown={e=>e.stopPropagation()} onClick={e=>clickPort(e,c,p.id,'output')} className="port-hit"><circle cx={W} cy={H/2+i*13-(c.outputs.length-1)*6.5} r="10" className="port-hit-area"/><circle cx={W} cy={H/2+i*13-(c.outputs.length-1)*6.5} r="4.5" className="port output-port"/></g>)}
                {c.kind==='INPUT'&&<text x={W/2} y="62" textAnchor="middle" className="node-value">{project.inputValues[c.id]??0}</text>}
                {c.kind==='OUTPUT'&&<text x={W/2} y="62" textAnchor="middle" className="node-value">{simulation.outputs[c.id]??'X'}</text>}
                {c.kind==='DFF'&&<text x={W/2} y="62" textAnchor="middle" className="node-value">Q={project.sequentialState[c.id]??0}</text>}
                {c.kind==='LATCH'&&<text x={W/2} y="62" textAnchor="middle" className="node-value">Q={project.sequentialState[c.id]??0}</text>}
              </g>)}
              {wireStart&&<text x={view.x+view.w/2} y={view.y+view.h-35} textAnchor="middle" className="wire-instruction">Select an input port to complete the connection · Esc to cancel</text>}
              {circuit.components.length===0&&<text x={view.x+view.w/2} y={view.y+view.h/2} textAnchor="middle" className="empty-text">Your canvas is ready. Add a component from the left panel.</text>}
            </svg>
            <div className="canvas-hint">{wireStart?'Choose a destination input port · Esc cancels':'Drag to move · Scroll to zoom · Middle/right-drag to pan · Click a wire to remove it'}</div>
          </section>
          {showInspector&&<aside className="inspector">
            <div className="panel-heading">Inspector</div>
            {selectedComponent?<><div className="selected-card"><div className="selected-icon">{selectedComponent.kind}</div><div><b>{selectedComponent.label}</b><small>{titleFor(selectedComponent.kind)}</small></div></div>
              <label className="field-label">Component label</label><input className="field" value={selectedComponent.label} onChange={e=>commit(p=>({...p,circuits:p.circuits.map(c=>c.id===p.activeCircuitId?{...c,components:c.components.map(n=>n.id===selected?{...n,label:e.target.value}:n)}:c)}))}/>
              {selectedComponent.kind==='INPUT'&&<><label className="field-label">Logic state</label><div className="toggle-row"><button className={(project.inputValues[selectedComponent.id]??0)===0?'logic-toggle on':'logic-toggle'} onClick={()=>commit(p=>({...p,inputValues:{...p.inputValues,[selectedComponent.id]:0}}))}>0 · LOW</button><button className={project.inputValues[selectedComponent.id]===1?'logic-toggle on':'logic-toggle'} onClick={()=>commit(p=>({...p,inputValues:{...p.inputValues,[selectedComponent.id]:1}}))}>1 · HIGH</button></div></>}
              {(selectedComponent.kind==='DFF'||selectedComponent.kind==='LATCH')&&<><label className="field-label">Trigger behaviour</label><select className="field" value={selectedComponent.activeEdge??(selectedComponent.kind==='DFF'?'rising':'high')} onChange={e=>updateCircuit((cs,ws)=>({components:cs.map(c=>c.id===selected?{...c,activeEdge:e.target.value as Component['activeEdge']}:c),wires:ws}))}>{(selectedComponent.kind==='DFF'?[['rising','Rising edge'],['falling','Falling edge']]:[['high','Active high'],['low','Active low']]).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></>}
              <label className="field-label">Position</label><div className="position-row"><input className="field" value={`X: ${Math.round(selectedComponent.x)}`} readOnly/><input className="field" value={`Y: ${Math.round(selectedComponent.y)}`} readOnly/></div>
              <button className="secondary-btn" onClick={duplicateSelected}><Copy size={13}/> Duplicate component</button><button className="danger-btn" onClick={removeSelected}><Trash2 size={13}/> Delete component</button>
            </>:<div className="inspector-empty"><Settings2 size={25}/><b>No selection</b><span>Select a component on the canvas to inspect its properties.</span></div>}
            <div className="inspector-bottom"><div className="side-label">SIMULATION STATUS</div>{simulation.errors.length?<span className="error-text">{simulation.errors[0]}</span>:<span className="ok-text">● No unresolved logic errors</span>}</div>
          </aside>}
        </div>
        <div className="bottom-panel">
          <div className="bottom-row"><div className="bottom-title"><Activity size={15}/> Simulation & timing <span className="console-pill">READY</span></div><div className="clock-controls"><Clock3 size={14}/><select value={clockMode} onChange={e=>setClockMode(e.target.value as 'manual'|'automatic')}><option value="manual">Manual clock</option><option value="automatic">Automatic clock</option></select><select value={clockHz} onChange={e=>setClockHz(Number(e.target.value))}><option value={1}>1 Hz</option><option value={2}>2 Hz</option><option value={5}>5 Hz</option><option value={10}>10 Hz</option></select><button className="icon-btn" onClick={()=>setClockRunning(v=>!v)} title={clockRunning?'Pause clock':'Start clock'}>{clockRunning?<Pause size={14}/>:<Play size={14}/>}</button><button className="icon-btn" onClick={tickClock} title="Single clock transition"><StepForward size={14}/></button><span className="clock-level">CLK {project.clockLevel}</span></div></div>
          <div className="console-content"><span className="console-time">{new Date().toLocaleTimeString()}</span><span>{simulation.errors.length?simulation.errors[0]:'Logic engine ready · 1-bit signals · X = unknown/unconnected'}</span><button className="text-button" onClick={()=>setShowTruth(v=>!v)}>{showTruth?'Hide':'Show'} truth table</button></div>
          {showTruth&&<div className="truth-wrap"><table className="truth-table"><thead><tr>{circuit.components.filter(c=>c.kind==='INPUT').map(c=><th key={c.id}>{c.label}</th>)}{circuit.components.filter(c=>c.kind==='OUTPUT').map(c=><th key={c.id}>{c.label}</th>)}</tr></thead><tbody>{truthRows.map((r,i)=><tr key={i}>{r.inputs.map((v,j)=><td key={j}>{v}</td>)}{r.outputs.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table>{circuit.components.filter(c=>c.kind==='INPUT').length>8&&<p>Truth table generation is limited to 8 inputs.</p>}</div>}
        </div>
      </main>
    </div>
    {githubDialog && <div className="dialog-scrim" onMouseDown={event=>{if(event.target===event.currentTarget)setGithubDialog(null)}}>
      <section className="github-dialog" role="dialog" aria-modal="true" aria-labelledby="github-dialog-title">
        <div className="dialog-heading"><div><div className="eyebrow">GITHUB STORAGE</div><h2 id="github-dialog-title">{githubDialog==='repositories'?'Choose a private repository':'Your saved projects'}</h2></div><button className="icon-btn" onClick={()=>setGithubDialog(null)} aria-label="Close">×</button></div>
        {githubError && <p className="github-error" role="alert">{githubError}</p>}
        {githubBusy && <p className="github-help">Loading from GitHub…</p>}
        {githubDialog==='repositories' && <>
          <p className="github-help">LogicLab can access only private repositories where you installed its GitHub App. Choose one owned by your signed-in account.</p>
          {githubRepositories.map(repository=><button className="github-choice" key={repository.id} disabled={githubBusy} onClick={()=>chooseRepository(repository)}><span><b>{repository.fullName}</b><small>Private repository · {repository.defaultBranch}</small></span><span>Connect</span></button>)}
          {!githubBusy && githubRepositories.length===0 && <div className="github-empty"><b>No private repositories available</b><span>Create a private repository, then install the LogicLab GitHub App and grant it access to that repository only.</span>{githubState.appInstallUrl && <a className="secondary-btn" href={githubState.appInstallUrl} target="_blank" rel="noreferrer">Install / configure GitHub App</a>}</div>}
          {githubState.user && <button className="text-button dialog-signout" onClick={signOutGithub} disabled={githubBusy}>Sign out of @{githubState.user.login}</button>}
        </>}
        {githubDialog==='projects' && <>
          <p className="github-help">Projects are stored as JSON files in your connected private repository. Saves appear in that repository’s commit history.</p>
          {githubProjects.map(remoteProject=><button className="github-choice" key={remoteProject.id} onClick={()=>loadGithubProject(remoteProject)}><span><b>{remoteProject.name}</b><small>Updated {new Date(remoteProject.updatedAt).toLocaleString()}</small></span><span>Open</span></button>)}
          {!githubBusy && githubProjects.length===0 && <div className="github-empty"><b>No saved LogicLab projects yet</b><span>Use Save in the top bar to save this project to GitHub.</span></div>}
        </>}
      </section>
    </div>}
  </div>
}
function snap(v:number){return Math.round(v/20)*20}
