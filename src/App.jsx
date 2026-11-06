import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import * as XLSX from 'xlsx'
import { CarFront, Gauge, Wrench, Wallet, LogOut, ShieldCheck, CircleAlert, Plus, CalendarClock, LayoutDashboard, Pencil, Trash2, X, Save, ArrowLeft } from 'lucide-react'

const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
const blankVehicle = { year: new Date().getFullYear(), model: '', plate: '', current_mileage: '', mileage_unit: 'millas', image_url: '' }
const blankService = { vehicle_id: '', service_date: today(), mileage: '', category: 'Cambio de aceite', description: '', brand_reference: '', quantity: '', parts_cost: '0', labor_cost: '0', provider: '', next_service_date: '', next_service_mileage: '', status: 'Realizado', notes: '' }
const money = n => Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('No se pudo iniciar sesión. Verifica tus credenciales.')
    setBusy(false)
  }
  return <main className="login-wrap"><form className="login-card" onSubmit={submit}>
    <div className="brand-mark"><CarFront size={27}/></div><p className="eyebrow">AUTO CONTROL</p><h1>Control de mantenimiento</h1><p className="muted">Acceso privado para administrar tus vehículos.</p>
    <label>Correo administrador<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu correo"/></label>
    <label>Contraseña<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>
    {error && <p className="error">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Ingresando…':'Iniciar sesión'}</button><p className="tiny"><ShieldCheck size={14}/> Acceso protegido mediante Supabase Auth</p>
  </form></main>
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [records, setRecords] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [dbError, setDbError] = useState('')
  const [notice, setNotice] = useState('')
  const [view, setView] = useState('dashboard')
  const [modal, setModal] = useState('')
  const [editing, setEditing] = useState(null)
  const [vehicleForm, setVehicleForm] = useState(blankVehicle)
  const [serviceForm, setServiceForm] = useState(blankService)
  const [vehicleImage, setVehicleImage] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importBusy, setImportBusy] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  async function loadData() {
    if (!session) return
    setDbError('')
    const [v, r] = await Promise.all([
      supabase.from('vehicles').select('*').order('year'),
      (async () => {
        const all = []
        let start = 0
        while (true) {
          const page = await supabase.from('maintenance_records').select('*').order('service_date', { ascending: false }).range(start, start + 999)
          if (page.error) return { data: null, error: page.error }
          all.push(...(page.data || []))
          if (!page.data || page.data.length < 1000) break
          start += 1000
        }
        return { data: all, error: null }
      })()
    ])
    if (v.error) setDbError('Error al cargar vehículos: ' + v.error.message)
    else setVehicles(v.data || [])
    if (r.error) setDbError(prev => [prev, 'Error al cargar mantenimientos: ' + r.error.message].filter(Boolean).join(' | '))
    else setRecords(r.data || [])
  }
  useEffect(() => { if (session) loadData() }, [session])

  const total = useMemo(() => records.reduce((sum, r) => sum + Number(r.total_cost || 0), 0), [records])
  const vehicleName = id => vehicles.find(v => v.id === id)?.model || 'Vehículo'
  const notify = message => { setNotice(message); window.setTimeout(() => setNotice(''), 4500) }

  function openVehicle(vehicle = null) {
    setEditing(vehicle)
    setVehicleForm(vehicle ? { year: vehicle.year, model: vehicle.model, plate: vehicle.plate || '', current_mileage: vehicle.current_mileage ?? 0, mileage_unit: vehicle.mileage_unit || 'millas', image_url: vehicle.image_url || '' } : blankVehicle)
    setVehicleImage(null)
    setModal('vehicle')
  }
  function openService(record = null) {
    setEditing(record)
    setServiceForm(record ? {
      vehicle_id: record.vehicle_id, service_date: record.service_date, mileage: record.mileage ?? '',
      category: record.category, description: record.description, brand_reference: record.brand_reference || '',
      quantity: record.quantity ?? '', parts_cost: record.parts_cost ?? 0, labor_cost: record.labor_cost ?? 0,
      provider: record.provider || '', next_service_date: record.next_service_date || '',
      next_service_mileage: record.next_service_mileage ?? '', status: record.status || 'Realizado', notes: record.notes || ''
    } : { ...blankService, vehicle_id: vehicles[0]?.id || '' })
    setModal('service')
  }
  const closeModal = () => { if (!busy) { setModal(''); setEditing(null) } }

  async function saveVehicle(e) {
    e.preventDefault(); setBusy(true); setDbError('')
    let imageUrl = vehicleForm.image_url || null
    if (vehicleImage) {
      const ext = (vehicleImage.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`
      const uploaded = await supabase.storage.from('vehicle-images').upload(path, vehicleImage, { upsert: false, contentType: vehicleImage.type })
      if (uploaded.error) { notify('No se pudo subir la fotografía: ' + uploaded.error.message); setBusy(false); return }
      imageUrl = supabase.storage.from('vehicle-images').getPublicUrl(path).data.publicUrl
    }
    const payload = { owner_id: session.user.id, year: Number(vehicleForm.year), model: vehicleForm.model.trim(), plate: vehicleForm.plate.trim() || null, current_mileage: Number(vehicleForm.current_mileage || 0), mileage_unit: vehicleForm.mileage_unit, image_url: imageUrl }
    const result = editing
      ? await supabase.from('vehicles').update({ ...payload, owner_id: undefined }).eq('id', editing.id).select().single()
      : await supabase.from('vehicles').insert(payload).select().single()
    if (result.error) notify('No se pudo guardar el vehículo: ' + result.error.message)
    else { notify(editing ? 'Vehículo actualizado.' : 'Vehículo registrado.'); setModal(''); await loadData() }
    setBusy(false)
  }
  async function deleteVehicle(vehicle) {
    if (!window.confirm('¿Eliminar ' + vehicle.model + '? También se eliminarán sus mantenimientos asociados.')) return
    setBusy(true)
    const { error } = await supabase.from('vehicles').delete().eq('id', vehicle.id)
    if (error) notify('No se pudo eliminar: ' + error.message)
    else { notify('Vehículo eliminado.'); await loadData() }
    setBusy(false)
  }
  async function saveService(e) {
    e.preventDefault(); setBusy(true)
    const payload = {
      owner_id: session.user.id, vehicle_id: serviceForm.vehicle_id, service_date: serviceForm.service_date,
      mileage: serviceForm.mileage === '' ? null : Number(serviceForm.mileage), category: serviceForm.category,
      description: serviceForm.description.trim(), brand_reference: serviceForm.brand_reference.trim() || null,
      quantity: serviceForm.quantity === '' ? null : Number(serviceForm.quantity),
      parts_cost: Number(serviceForm.parts_cost || 0), labor_cost: Number(serviceForm.labor_cost || 0),
      provider: serviceForm.provider.trim() || null, next_service_date: serviceForm.next_service_date || null,
      next_service_mileage: serviceForm.next_service_mileage === '' ? null : Number(serviceForm.next_service_mileage),
      status: serviceForm.status, notes: serviceForm.notes.trim() || null
    }
    const result = editing
      ? await supabase.from('maintenance_records').update({ ...payload, owner_id: undefined }).eq('id', editing.id).select().single()
      : await supabase.from('maintenance_records').insert(payload).select().single()
    if (result.error) notify('No se pudo guardar el mantenimiento: ' + result.error.message)
    else {
      if (payload.mileage !== null && payload.status === 'Realizado') {
        const v = vehicles.find(x => x.id === payload.vehicle_id)
        if (v && payload.mileage > Number(v.current_mileage || 0)) await supabase.from('vehicles').update({ current_mileage: payload.mileage }).eq('id', v.id)
      }
      notify(editing ? 'Mantenimiento actualizado.' : 'Mantenimiento registrado.')
      setModal(''); await loadData()
    }
    setBusy(false)
  }
  async function deleteService(record) {
    if (!window.confirm('¿Eliminar este registro de mantenimiento?')) return
    setBusy(true)
    const { error } = await supabase.from('maintenance_records').delete().eq('id', record.id)
    if (error) notify('No se pudo eliminar: ' + error.message)
    else { notify('Registro eliminado.'); await loadData() }
    setBusy(false)
  }

  async function importWorkbookData(rows) {
    const vehicleRows = rows.vehicles || []
    const serviceRows = rows.maintenance || []
    const vehicleMap = new Map(vehicles.map(v => [String(v.plate || `${v.year}| ${v.model}`).trim().toLowerCase(), v.id]))
    let addedVehicles = 0, addedServices = 0, errors = []
    for (const row of vehicleRows) {
      const model = String(row.model || row.modelo || row.vehiculo || '').trim()
      const year = Number(row.year || row.anio || row.año)
      if (!model || !year) { errors.push('Vehículo omitido: falta modelo o año.'); continue }
      const plate = String(row.plate || row.placa || '').trim() || null
      const key = String(plate || `${year}| ${model}`).toLowerCase()
      if (vehicleMap.has(key)) continue
      const payload = { owner_id: session.user.id, year, model, plate, current_mileage: Number(row.current_mileage || row.kilometraje_actual || row.kilometraje || 0), mileage_unit: String(row.mileage_unit || row.unidad || 'millas').toLowerCase().includes('km') ? 'kilometros' : 'millas', image_url: row.image_url || null }
      const result = await supabase.from('vehicles').insert(payload).select().single()
      if (result.error) errors.push(`Vehículo ${model}: ${result.error.message}`)
      else { vehicleMap.set(key, result.data.id); addedVehicles++ }
    }
    const { data: currentVehicles } = await supabase.from('vehicles').select('*')
    const findVehicle = row => {
      const plate = String(row.plate || row.placa || '').trim().toLowerCase()
      const model = String(row.model || row.modelo || row.vehiculo || '').trim().toLowerCase()
      const year = Number(row.year || row.anio || row.año || 0)
      return (currentVehicles || []).find(v => plate && String(v.plate || '').toLowerCase() === plate) || (currentVehicles || []).find(v => model && v.model.toLowerCase() === model && (!year || Number(v.year) === year))
    }
    for (const row of serviceRows) {
      const vehicle = findVehicle(row)
      if (!vehicle) { errors.push('Mantenimiento omitido: no coincide con un vehículo registrado (' + (row.model || row.modelo || row.vehiculo || 'sin identificar') + ').'); continue }
      const rawServiceDate = row.service_date || row.fecha || row.fecha_servicio
      const serviceDate = rawServiceDate instanceof Date ? rawServiceDate.toISOString().slice(0,10) : String(rawServiceDate || '').slice(0,10)
      const description = String(row.description || row.descripcion || row.servicio || '').trim()
      if (!serviceDate || !description) { errors.push('Mantenimiento omitido: falta fecha o descripción.'); continue }
      const payload = { owner_id: session.user.id, vehicle_id: vehicle.id, service_date: String(serviceDate).slice(0,10), mileage: Number(row.mileage || row.kilometraje) || null, category: String(row.category || row.categoria || 'Otro'), description, brand_reference: row.brand_reference || row.referencia || null, quantity: Number(row.quantity || row.cantidad) || null, parts_cost: Number(row.parts_cost || row.costo_repuestos || row.repuestos || 0), labor_cost: Number(row.labor_cost || row.mano_obra || 0), provider: row.provider || row.proveedor || row.taller || null, next_service_date: row.next_service_date || row.proxima_fecha || null, next_service_mileage: Number(row.next_service_mileage || row.proximo_kilometraje) || null, status: ['Realizado','Pendiente','Cancelado'].includes(row.status || row.estado) ? (row.status || row.estado) : 'Realizado', notes: row.notes || row.notas || null }
      const result = await supabase.from('maintenance_records').insert(payload)
      if (result.error) errors.push(`Servicio ${description}: ${result.error.message}`)
      else addedServices++
    }
    await loadData()
    notify(`Importación finalizada: ${addedVehicles} vehículos y ${addedServices} mantenimientos. ${errors.length ? errors.length + ' observaciones; revisa el detalle.' : ''}`)
    return errors
  }

  if (!isSupabaseConfigured) return <main className="setup-wrap"><div className="setup-card"><div className="brand-mark"><CarFront/></div><p className="eyebrow">AUTO CONTROL</p><h1>Configuración pendiente</h1><p>Revisa las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en GitHub Actions.</p></div></main>
  if (loading) return <div className="loading">Cargando Auto Control…</div>
  if (!session) return <Login/>

  const nav = [
    ['dashboard', 'Dashboard', LayoutDashboard], ['vehicles', 'Mis vehículos', CarFront],
    ['maintenance', 'Mantenimiento', Wrench], ['reminders', 'Recordatorios', CalendarClock], ['reports', 'Gastos y reportes', Wallet], ['data', 'Importar / Exportar', Wallet]
  ]
  const upcoming = records.filter(r => r.next_service_date || r.next_service_mileage).sort((a,b) => (a.next_service_date || '9999').localeCompare(b.next_service_date || '9999'))
  return <div className="app-shell">
    <aside className="sidebar"><div className="side-brand"><div className="brand-mark"><CarFront/></div><div><b>Auto Control</b><small>HYUNDAI GARAGE</small></div></div>
      <nav><span className="nav-label">GENERAL</span>{nav.map(([id,label,Icon]) => <button key={id} className={view === id ? 'nav-link active' : 'nav-link'} onClick={() => setView(id)}><Icon size={17}/>{label}</button>)}</nav>
      <div className="sidebar-bottom"><ShieldCheck size={16}/> Sesión privada<button onClick={() => supabase.auth.signOut()} className="logout"><LogOut size={16}/> Cerrar sesión</button></div>
    </aside>
    <main className="main">
      <header><div><p className="eyebrow">AUTO CONTROL · HYUNDAI GARAGE</p><h1>{nav.find(x => x[0] === view)?.[1] || 'Dashboard'}</h1><p className="muted">Administración de vehículos y mantenimiento</p></div><div className="header-actions"><span className="secure"><span/> Conexión privada</span>{view === 'vehicles' ? <button className="primary" onClick={() => openVehicle()}><Plus size={17}/> Nuevo vehículo</button> : view === 'maintenance' || view === 'dashboard' ? <button className="primary" onClick={() => openService()}><Plus size={17}/> Nuevo servicio</button> : null}</div></header>
      {dbError && <div className="notice warning"><CircleAlert size={18}/>{dbError}</div>}
      {notice && <div className="toast">{notice}</div>}

      {view === 'dashboard' && <>
        <section className="stats"><article className="stat"><span>VEHÍCULOS</span><strong>{vehicles.length}</strong><small>Registrados</small></article><article className="stat"><span>SERVICIOS REGISTRADOS</span><strong>{records.length}</strong><small>Historial disponible</small></article><article className="stat"><span>INVERSIÓN REGISTRADA</span><strong>L. {money(total)}</strong><small>Según registros cargados</small></article></section>
        <section className="section-head"><div><h2>Mis vehículos</h2><p className="muted">Kilometraje según unidad de cada vehículo</p></div><button className="secondary" onClick={() => setView('vehicles')}>Administrar vehículos</button></section>
        <section className="vehicle-grid">{vehicles.map(v => <VehicleCard key={v.id} vehicle={v} onEdit={() => openVehicle(v)} onDelete={() => deleteVehicle(v)}/>)}</section>
        <section className="section-head"><div><h2>Actividad reciente</h2><p className="muted">Últimos movimientos guardados</p></div><button className="secondary" onClick={() => setView('maintenance')}>Ver historial</button></section>
        <ServiceTable records={records.slice(0,5)} vehicleName={vehicleName} onEdit={openService} onDelete={deleteService}/>
      </>}

      {view === 'vehicles' && <><div className="section-head"><div><h2>Vehículos registrados</h2><p className="muted">Agrega, modifica o elimina tus vehículos.</p></div></div>{vehicles.length ? <section className="vehicle-grid">{vehicles.map(v => <VehicleCard key={v.id} vehicle={v} onEdit={() => openVehicle(v)} onDelete={() => deleteVehicle(v)}/>)}</section> : <Empty text="Aún no hay vehículos registrados."/>}</>}

      {view === 'maintenance' && <><div className="section-head"><div><h2>Historial de mantenimiento</h2><p className="muted">Servicios, repuestos, mano de obra y costos.</p></div></div>{records.length ? <ServiceTable records={records} vehicleName={vehicleName} onEdit={openService} onDelete={deleteService}/> : <Empty text="Todavía no hay servicios. Usa Nuevo servicio para registrar el primero."/>}</>}

      {view === 'reminders' && <><div className="section-head"><div><h2>Próximos mantenimientos</h2><p className="muted">Recordatorios definidos al registrar cada servicio.</p></div></div>{upcoming.length ? <div className="table-wrap"><table><thead><tr><th>Vehículo</th><th>Servicio</th><th>Próxima fecha</th><th>Próximo kilometraje</th><th>Estado</th></tr></thead><tbody>{upcoming.map(r => <tr key={r.id}><td>{vehicleName(r.vehicle_id)}</td><td>{r.description}</td><td>{r.next_service_date || '—'}</td><td>{r.next_service_mileage ? Number(r.next_service_mileage).toLocaleString('en-US') : '—'}</td><td><span className="status-pill">{r.status}</span></td></tr>)}</tbody></table></div> : <Empty text="No hay recordatorios. Define próxima fecha o kilometraje en un servicio."/>}</>}

      {view === 'data' && <DataTools vehicles={vehicles} records={records} onImport={async (data)=>{setImportBusy(true);try{return await importWorkbookData(data)}finally{setImportBusy(false)}}} importBusy={importBusy} />}
      {view === 'reports' && <><section className="stats"><article className="stat"><span>INVERSIÓN TOTAL</span><strong>L. {money(total)}</strong><small>Todos los registros</small></article><article className="stat"><span>SERVICIOS</span><strong>{records.length}</strong><small>Historial acumulado</small></article><article className="stat"><span>PROMEDIO POR SERVICIO</span><strong>L. {money(records.length ? total / records.length : 0)}</strong><small>Costos registrados</small></article></section><div className="section-head"><div><h2>Gastos por vehículo</h2></div></div><div className="table-wrap"><table><thead><tr><th>Vehículo</th><th>Servicios</th><th>Inversión</th></tr></thead><tbody>{vehicles.map(v => { const rs = records.filter(r => r.vehicle_id === v.id); return <tr key={v.id}><td>{v.model}</td><td>{rs.length}</td><td>L. {money(rs.reduce((s,r) => s + Number(r.total_cost || 0),0))}</td></tr> })}</tbody></table></div></>}
    </main>

    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeModal() }}><section className="modal-card"><div className="modal-head"><div><p className="eyebrow">{editing ? 'EDITAR REGISTRO' : 'NUEVO REGISTRO'}</p><h2>{modal === 'vehicle' ? (editing ? 'Editar vehículo' : 'Registrar vehículo') : (editing ? 'Editar mantenimiento' : 'Registrar mantenimiento')}</h2></div><button className="icon-button" onClick={closeModal}><X/></button></div>
      {modal === 'vehicle' ? <form onSubmit={saveVehicle} className="data-form">
        <label>Año<input type="number" min="1980" max="2100" required value={vehicleForm.year} onChange={e=>setVehicleForm({...vehicleForm,year:e.target.value})}/></label>
        <label>Marca y modelo<input required value={vehicleForm.model} onChange={e=>setVehicleForm({...vehicleForm,model:e.target.value})} placeholder="Hyundai Elantra GLS"/></label>
        <label>Placa<input value={vehicleForm.plate} onChange={e=>setVehicleForm({...vehicleForm,plate:e.target.value.toUpperCase()})}/></label>
        <label>Kilometraje actual<input type="number" min="0" required value={vehicleForm.current_mileage} onChange={e=>setVehicleForm({...vehicleForm,current_mileage:e.target.value})}/></label>
        <label>Unidad<select value={vehicleForm.mileage_unit} onChange={e=>setVehicleForm({...vehicleForm,mileage_unit:e.target.value})}><option value="millas">Millas</option><option value="kilometros">Kilómetros</option></select></label>
        <label className="wide">Fotografía del vehículo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setVehicleImage(e.target.files?.[0] || null)}/><small className="muted">JPG, PNG o WebP. Máximo recomendado: 5 MB.</small></label>
        {(vehicleImage || vehicleForm.image_url) && <div className="vehicle-image-preview wide"><img src={vehicleImage ? URL.createObjectURL(vehicleImage) : vehicleForm.image_url} alt="Vista previa del vehículo"/><button type="button" className="danger-ghost" onClick={()=>{setVehicleImage(null);setVehicleForm({...vehicleForm,image_url:''})}}>Quitar fotografía</button></div>}
        <div className="form-actions"><button type="button" className="secondary" onClick={closeModal}>Cancelar</button><button className="primary" disabled={busy}><Save size={16}/>{busy?'Guardando…':'Guardar vehículo'}</button></div>
      </form> : <form onSubmit={saveService} className="data-form">
        <label>Vehículo<select required value={serviceForm.vehicle_id} onChange={e=>setServiceForm({...serviceForm,vehicle_id:e.target.value})}><option value="">Selecciona vehículo</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.year} · {v.model} · {v.plate}</option>)}</select></label>
        <label>Fecha del servicio<input type="date" required value={serviceForm.service_date} onChange={e=>setServiceForm({...serviceForm,service_date:e.target.value})}/></label>
        <label>Kilometraje al servicio<input type="number" min="0" value={serviceForm.mileage} onChange={e=>setServiceForm({...serviceForm,mileage:e.target.value})}/></label>
        <label>Categoría<select value={serviceForm.category} onChange={e=>setServiceForm({...serviceForm,category:e.target.value})}>{['Cambio de aceite','Filtros','Frenos','Llantas','Motor','Transmisión','Suspensión','Sistema eléctrico','Refrigeración','Aire acondicionado','Inspección general','Otro'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="wide">Descripción<input required value={serviceForm.description} onChange={e=>setServiceForm({...serviceForm,description:e.target.value})} placeholder="Ej. Cambio de aceite y filtro"/></label>
        <label>Marca / referencia<input value={serviceForm.brand_reference} onChange={e=>setServiceForm({...serviceForm,brand_reference:e.target.value})}/></label>
        <label>Cantidad<input type="number" min="0" step="0.01" value={serviceForm.quantity} onChange={e=>setServiceForm({...serviceForm,quantity:e.target.value})}/></label>
        <label>Costo de repuestos (L.)<input type="number" min="0" step="0.01" value={serviceForm.parts_cost} onChange={e=>setServiceForm({...serviceForm,parts_cost:e.target.value})}/></label>
        <label>Mano de obra (L.)<input type="number" min="0" step="0.01" value={serviceForm.labor_cost} onChange={e=>setServiceForm({...serviceForm,labor_cost:e.target.value})}/></label>
        <label>Proveedor / taller<input value={serviceForm.provider} onChange={e=>setServiceForm({...serviceForm,provider:e.target.value})}/></label>
        <label>Estado<select value={serviceForm.status} onChange={e=>setServiceForm({...serviceForm,status:e.target.value})}><option>Realizado</option><option>Pendiente</option><option>Cancelado</option></select></label>
        <label>Próxima fecha<input type="date" value={serviceForm.next_service_date} onChange={e=>setServiceForm({...serviceForm,next_service_date:e.target.value})}/></label>
        <label>Próximo kilometraje<input type="number" min="0" value={serviceForm.next_service_mileage} onChange={e=>setServiceForm({...serviceForm,next_service_mileage:e.target.value})}/></label>
        <label className="wide">Notas<textarea rows="3" value={serviceForm.notes} onChange={e=>setServiceForm({...serviceForm,notes:e.target.value})}/></label>
        <div className="form-total">Total calculado: <strong>L. {money(Number(serviceForm.parts_cost || 0) + Number(serviceForm.labor_cost || 0))}</strong></div>
        <div className="form-actions"><button type="button" className="secondary" onClick={closeModal}>Cancelar</button><button className="primary" disabled={busy || !vehicles.length}><Save size={16}/>{busy?'Guardando…':'Guardar mantenimiento'}</button></div>
      </form>}
    </section></div>}
  </div>
}

function DataTools({ vehicles, records, onImport, importBusy }) {
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState('')
  function exportExcel() {
    const wb = XLSX.utils.book_new()
    const vehicleRows = vehicles.map(v=>({year:v.year,model:v.model,plate:v.plate,current_mileage:v.current_mileage,mileage_unit:v.mileage_unit,image_url:v.image_url || ''}))
    const serviceRows = records.map(r=>{const v=vehicles.find(x=>x.id===r.vehicle_id);return {service_date:r.service_date,year:v?.year || '',model:v?.model || '',plate:v?.plate || '',mileage:r.mileage,category:r.category,description:r.description,brand_reference:r.brand_reference,quantity:r.quantity,parts_cost:r.parts_cost,labor_cost:r.labor_cost,provider:r.provider,next_service_date:r.next_service_date,next_service_mileage:r.next_service_mileage,status:r.status,notes:r.notes}})
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(vehicleRows.length?vehicleRows:[{year:'',model:'',plate:'',current_mileage:'',mileage_unit:'millas'}]),'Vehiculos')
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(serviceRows.length?serviceRows:[{service_date:'',year:'',model:'',plate:'',mileage:'',category:'',description:'',parts_cost:0,labor_cost:0}]),'Mantenimientos')
    XLSX.writeFile(wb,'Auto_Control_Respaldo.xlsx')
  }
  function downloadTemplate() {
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{year:2013,model:'Hyundai Elantra GLS',plate:'HBN7218',current_mileage:105340,mileage_unit:'millas'}]),'Vehiculos')
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{service_date:'2026-01-15',year:2013,model:'Hyundai Elantra GLS',plate:'HBN7218',mileage:105000,category:'Cambio de aceite',description:'Aceite y filtro',brand_reference:'5W-20',quantity:5,parts_cost:1200,labor_cost:200,provider:'Taller',next_service_date:'2026-07-15',next_service_mileage:110000,status:'Realizado',notes:''}]),'Mantenimientos')
    XLSX.writeFile(wb,'Plantilla_Auto_Control.xlsx')
  }
  async function readFile(file) {
    setError('');setParsed(null);setFileName(file?.name || '')
    if(!file)return
    try{
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true})
      const pick=(names)=>{const name=wb.SheetNames.find(s=>names.includes(s.toLowerCase()));return name?XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:''}):[]}
      const vehicleRows=pick(['vehiculos','vehículos','vehicles'])
      const serviceRows=pick(['mantenimientos','maintenance','servicios'])
      if(!vehicleRows.length&&!serviceRows.length)throw new Error('No encontré hojas llamadas Vehiculos y/o Mantenimientos. Descarga la plantilla para ver el formato.')
      setParsed({vehicles:vehicleRows,maintenance:serviceRows})
    }catch(e){setError(e.message || 'No se pudo leer el archivo.')}
  }
  return <section className="data-tools">
    <div className="section-head"><div><h2>Respaldo e intercambio de datos</h2><p className="muted">Excel compatible con hojas de vehículos y mantenimientos.</p></div></div>
    <div className="data-tools-grid">
      <article className="stat"><h3>Exportar información</h3><p className="muted">Descarga todos los vehículos y su historial en un solo libro Excel.</p><button className="primary" onClick={exportExcel}>Exportar Excel</button></article>
      <article className="stat"><h3>Plantilla de importación</h3><p className="muted">Utiliza esta plantilla para organizar tus registros antes de cargarlos.</p><button className="secondary" onClick={downloadTemplate}>Descargar plantilla</button></article>
    </div>
    <article className="stat import-panel"><h3>Importar desde Excel</h3><p className="muted">Selecciona un archivo .xlsx, .xls o .csv. Primero revisaremos las hojas y cantidades; después podrás confirmar la carga.</p>
      <label className="file-picker">Archivo Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={e=>readFile(e.target.files?.[0])}/></label>
      {fileName&&<p className="tiny">{fileName}</p>}{error&&<p className="error">{error}</p>}
      {parsed&&<div className="import-preview"><b>Vista previa detectada</b><p>{parsed.vehicles.length} vehículos · {parsed.maintenance.length} mantenimientos</p><p className="muted">Los vehículos existentes se omitirán si coinciden por placa o por año y modelo. Los mantenimientos se agregarán como nuevos registros.</p><button className="primary" disabled={importBusy} onClick={async()=>{const errs=await onImport(parsed);setError(errs?.slice(0,8).join(' ')+(errs?.length>8?' …':''));setParsed(null)}}>{importBusy?'Importando…':'Confirmar importación'}</button></div>}
    </article>
    <div className="notice"><CircleAlert size={18}/>Antes de importar, descarga un respaldo. La importación agrega registros; no elimina ni sobrescribe mantenimientos existentes. Verifica los datos para evitar duplicados.</div>
  </section>
}

function VehicleCard({ vehicle, onEdit, onDelete }) {
  return <article className="vehicle-card"><div className="vehicle-photo">{vehicle.image_url ? <img src={vehicle.image_url} alt={vehicle.model}/> : <div className="car-icon"><CarFront size={30}/></div>}<span className="year-tag">{vehicle.year}</span></div><h3>{vehicle.model}</h3><p className="muted">Placa {vehicle.plate || 'No indicada'}</p><div className="mileage"><Gauge size={17}/><strong>{Number(vehicle.current_mileage || 0).toLocaleString('en-US')}</strong><span>{vehicle.mileage_unit || 'millas'}</span></div><div className="card-foot"><span>Control individual</span><span className="status-dot">Activo</span></div><div className="card-actions"><button className="secondary" onClick={onEdit}><Pencil size={14}/> Editar</button><button className="danger-ghost" onClick={onDelete}><Trash2 size={14}/> Eliminar</button></div></article>
}
function ServiceTable({ records, vehicleName, onEdit, onDelete }) {
  if (!records.length) return <Empty text="No hay registros de mantenimiento."/>
  return <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Vehículo</th><th>Servicio</th><th>Kilometraje</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{records.map(r=><tr key={r.id}><td>{r.service_date}</td><td>{vehicleName(r.vehicle_id)}</td><td><b>{r.description}</b><small className="table-sub">{r.category}</small></td><td>{r.mileage ? Number(r.mileage).toLocaleString('en-US') : '—'}</td><td>L. {money(r.total_cost)}</td><td><span className="status-pill">{r.status}</span></td><td><div className="table-actions"><button className="icon-button" title="Editar" onClick={()=>onEdit(r)}><Pencil size={15}/></button><button className="icon-button danger" title="Eliminar" onClick={()=>onDelete(r)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>
}
function Empty({ text }) { return <div className="empty-state"><Wrench size={27}/><b>{text}</b></div> }
export default App
