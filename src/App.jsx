import { useEffect, useState } from 'react'
import { Calculator, DollarSign, FileText, HardHat, LayoutDashboard, LogOut, MapPin, Settings, TrendingUp, Truck, Users, Database } from 'lucide-react'
import { supabase } from './lib/supabase'
import { useTable } from './hooks/useTable'
import Dashboard from './views/Dashboard.jsx'
import Crud from './views/Crud.jsx'
import Obras from './views/Obras.jsx'
import APU from './views/APU.jsx'
import Configuracion from './views/Configuracion.jsx'
import Presupuestos from './views/Presupuestos.jsx'
import Ejecucion from './views/Ejecucion.jsx'
import { cruds } from './views/cruds.js'

const NAV = [
  ['dashboard', 'Dashboard', LayoutDashboard], ['obras', 'Obras y Mapa', MapPin], ['suppliers', 'Proveedores', Truck], ['clients', 'Clientes', Users],
  ['insumos', 'Precios de Insumos', DollarSign], ['apu', 'Análisis APU', Calculator], ['budgets', 'Presupuestos', FileText],
  ['execution', 'Ejecución y Avances', TrendingUp], ['config', 'Configuración', Settings]
]

function Login({ toast }) {
  const [up, setUp] = useState(false)
  const submit = async e => {
    e.preventDefault()
    const v = Object.fromEntries(new FormData(e.target))
    const { data, error } = up
      ? await supabase.auth.signUp({ email: v.email, password: v.password, options: { data: { name: v.name } } })
      : await supabase.auth.signInWithPassword({ email: v.email, password: v.password })
    if (error) return toast(error.message, true)
    if (up && !data.session) toast('Cuenta creada. Revisa tu correo para confirmarla.')
  }
  return (
    <div className="grid min-h-screen place-items-center bg-slate-900 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-2 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500 text-slate-900"><HardHat size={22} /></div>
          <div><h1 className="font-semibold leading-tight">SGO</h1><p className="text-xs text-slate-500">Sistema de Gestión de Obras</p></div>
        </div>
        {up && <input className="inp" name="name" placeholder="Nombre completo" required />}
        <input className="inp" name="email" type="email" placeholder="Correo" required />
        <input className="inp" name="password" type="password" placeholder="Contraseña (mínimo 6 caracteres)" minLength={6} required />
        <button className="btn btn-dark w-full">{up ? 'Crear cuenta' : 'Ingresar'}</button>
        <p className="text-center text-xs text-slate-500">{up ? '¿Ya tienes cuenta?' : '¿Primera vez?'}{' '}
          <button type="button" className="font-medium text-slate-900 underline" onClick={() => setUp(!up)}>{up ? 'Ingresar' : 'Crear cuenta'}</button></p>
      </form>
    </div>
  )
}

function Main({ session, toast }) {
  const [view, setView] = useState('dashboard')
  const [me, setMe] = useState(null)
  const [live, setLive] = useState(false)
  const { rows: cfgRows } = useTable('sgo_config')
  const cfg = cfgRows[0] || {}

  useEffect(() => {
    supabase.from('sgo_users').select('*').eq('id', session.user.id).single().then(({ data }) => setMe(data))
    const ch = supabase.channel('sgo-estado').subscribe(s => setLive(s === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(ch) }
  }, [session.user.id])

  const role = me?.role || 'Consultas'
  const canEdit = role !== 'Consultas', canDelete = role === 'Admin'
  const catalogs = cruds(Number(cfg.usd_rate) || 7500)
  const cur = NAV.find(n => n[0] === view)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500 text-slate-900"><HardHat size={18} /></div>
            <span className="font-semibold">{cfg.company_name || 'SGO'}</span>
            <span className={'hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:flex ' + (live ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300')}>
              <Database size={12} />{live ? 'Supabase Conectado (Realtime)' : 'Sincronizando…'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="text-right"><p className="font-medium">{me?.name || session.user.email}</p><p className="text-amber-400">{role}</p></div>
            <button title="Cerrar sesión" className="rounded-lg p-2 hover:bg-slate-800" onClick={() => supabase.auth.signOut()}><LogOut size={16} /></button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-800 bg-slate-800/60 px-3">
          {NAV.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setView(id)} className={'flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ' + (view === id ? 'border-amber-400 text-amber-300' : 'border-transparent text-slate-300 hover:text-white')}>
              <Icon size={16} />{label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">{cur[1]}</h1>
        {view === 'dashboard' ? <Dashboard />
          : view === 'obras' ? <Obras canEdit={canEdit} canDelete={canDelete} toast={toast} />
          : view === 'budgets' ? <Presupuestos canEdit={canEdit} canDelete={canDelete} toast={toast} />
          : view === 'config' ? <Configuracion isAdmin={role === 'Admin'} canEdit={canEdit} me={me} live={live} toast={toast} />
          : view === 'apu' ? <APU canEdit={canEdit} canDelete={canDelete} toast={toast} />
          : view === 'execution' ? <Ejecucion canEdit={canEdit} canDelete={canDelete} toast={toast} />
          : catalogs[view] ? <Crud key={view} cfg={catalogs[view]} canEdit={canEdit} canDelete={canDelete} toast={toast} />
          : <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center"><p className="font-medium">{cur[1]}</p><p className="mt-1 text-sm text-slate-400">Módulo en desarrollo — próxima etapa</p></div>}
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [msg, setMsg] = useState(null)
  const toast = (text, err = false) => { setMsg({ text, err }); setTimeout(() => setMsg(null), 3500) }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="grid min-h-screen place-items-center text-sm text-slate-400">Cargando…</div>
  return (
    <>
      {session ? <Main session={session} toast={toast} /> : <Login toast={toast} />}
      {msg && <div className={'fixed bottom-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ' + (msg.err ? 'bg-rose-600' : 'bg-slate-900')}>{msg.text}</div>}
    </>
  )
}
