import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { CarFront, Gauge, Wrench, Wallet, LogOut, ShieldCheck, CircleAlert, Plus, CalendarClock } from 'lucide-react'

const vehiclesSeed = [
  { id: 'elantra-2013', year: 2013, model: 'Hyundai Elantra GLS', plate: 'HBN7218', mileage: 105340 },
  { id: 'elantra-2016', year: 2016, model: 'Hyundai Elantra Limited', plate: 'JDE3768', mileage: 150678 },
]

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('No se pudo iniciar sesión. Verifica tus credenciales.')
    else onLogin()
    setBusy(false)
  }
  return <main className="login-wrap"><form className="login-card" onSubmit={submit}>
    <div className="brand-mark"><CarFront size={27}/></div><p className="eyebrow">AUTO CONTROL</p>
    <h1>Control de mantenimiento</h1><p className="muted">Acceso privado para administrar tus vehículos.</p>
    <label>Correo administrador<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu correo"/></label>
    <label>Contraseña<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>
    {error && <p className="error">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Ingresando…':'Iniciar sesión'}</button>
    <p className="tiny"><ShieldCheck size={14}/> Acceso protegido mediante Supabase Auth</p>
  </form></main>
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState([])
  const [vehicles, setVehicles] = useState(vehiclesSeed)
  const [dbError, setDbError] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let active = true
    async function load() {
      const { data: vs, error: ve } = await supabase.from('vehicles').select('*').order('year')
      if (ve) { setDbError('No se pudieron cargar los vehículos. Revisa que hayas ejecutado el SQL de configuración.'); }
      else if (active && vs?.length) setVehicles(vs)
      const { data: rs, error: re } = await supabase.from('maintenance_records').select('*').order('service_date', {ascending:false}).limit(100)
      if (!re && active) setRecords(rs || [])
    }
    load()
    return () => { active = false }
  }, [session])

  if (!isSupabaseConfigured) return <main className="setup-wrap"><div className="setup-card"><div className="brand-mark"><CarFront/></div><p className="eyebrow">AUTO CONTROL · FASE 1</p><h1>Proyecto preparado</h1><p>El código inicial está listo. Para habilitar el acceso privado, configura Supabase siguiendo el archivo <b>README.md</b> y crea tu archivo <code>.env</code>.</p><div className="notice"><CircleAlert size={18}/> No agregues contraseñas ni claves secretas al repositorio. Solo se utiliza la clave publicable/anon con políticas RLS activadas.</div><ol><li>Crea el proyecto en Supabase.</li><li>Ejecuta <code>supabase/schema.sql</code> en SQL Editor.</li><li>Crea tu usuario administrador en Authentication.</li><li>Copia URL y clave publicable a <code>.env</code>.</li><li>Ejecuta <code>npm install</code> y <code>npm run dev</code>.</li></ol></div></main>
  if (loading) return <div className="loading">Cargando Auto Control…</div>
  if (!session) return <Login onLogin={()=>{}} />

  const total = records.reduce((sum,r)=>sum + Number(r.total_cost || 0),0)
  return <div className="app-shell">
    <aside className="sidebar"><div className="side-brand"><div className="brand-mark"><CarFront/></div><div><b>Auto Control</b><small>HYUNDAI GARAGE</small></div></div>
      <nav><span className="nav-label">GENERAL</span><a className="active"><Gauge size={17}/> Dashboard</a><a><CarFront size={17}/> Mis vehículos</a><a><Wrench size={17}/> Mantenimiento</a><a><CalendarClock size={17}/> Recordatorios</a><a><Wallet size={17}/> Gastos y reportes</a></nav>
      <div className="sidebar-bottom"><ShieldCheck size={16}/> Sesión privada<button onClick={()=>supabase.auth.signOut()} className="logout"><LogOut size={16}/> Cerrar sesión</button></div>
    </aside>
    <main className="main"><header><div><p className="eyebrow">PANEL DE CONTROL</p><h1>Resumen general</h1><p className="muted">Estado de tus dos Hyundai Elantra</p></div><div className="header-actions"><span className="secure"><span/> Conexión privada</span><button className="primary" onClick={()=>alert('El formulario de registro de servicios se implementará en la siguiente fase.')}><Plus size={17}/> Nuevo servicio</button></div></header>
      {dbError && <div className="notice warning"><CircleAlert size={18}/>{dbError}</div>}
      <section className="stats"><article className="stat"><span>VEHÍCULOS</span><strong>{vehicles.length}</strong><small>Registrados</small></article><article className="stat"><span>SERVICIOS REGISTRADOS</span><strong>{records.length}</strong><small>Historial disponible</small></article><article className="stat"><span>INVERSIÓN REGISTRADA</span><strong> L. {total.toLocaleString('es-HN',{maximumFractionDigits:2})}</strong><small>Según registros cargados</small></article></section>
      <section className="section-head"><div><h2>Mis vehículos</h2><p className="muted">Kilometraje expresado en millas</p></div></section>
      <section className="vehicle-grid">{vehicles.map(v=><article className="vehicle-card" key={v.id}><div className="vehicle-top"><div className="car-icon"><CarFront size={25}/></div><span className="year-tag">{v.year}</span></div><h3>{v.model || 'Hyundai Elantra'}</h3><p className="muted">Placa {v.plate}</p><div className="mileage"><Gauge size={17}/><strong>{Number(v.current_mileage ?? v.mileage ?? 0).toLocaleString('en-US')}</strong><span>millas</span></div><div className="card-foot"><span>Control individual</span><span className="status-dot">Activo</span></div></article>)}</section>
      <section className="section-head"><div><h2>Actividad reciente</h2><p className="muted">Últimos movimientos guardados</p></div></section>
      <div className="empty-state">{records.length ? <div className="record-list">{records.slice(0,6).map(r=><div className="record-row" key={r.id}><Wrench size={17}/><div><b>{r.description}</b><small>{r.service_date} · {r.category}</small></div><strong>L. {Number(r.total_cost||0).toLocaleString('es-HN')}</strong></div>)}</div> : <><Wrench size={27}/><b>Aún no hay servicios en la base de datos</b><span>Cuando registres mantenimientos, aparecerán aquí.</span></>}</div>
    </main>
  </div>
}
export default App
