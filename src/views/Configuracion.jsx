import { useState } from 'react'
import { supabase, SUPABASE_URL } from '../lib/supabase'
import { useTable } from '../hooks/useTable'
import readXlsxFile from 'read-excel-file'
import { Download, Upload } from 'lucide-react'
import { IMPORTS } from '../lib/importers'

const TABS = [['gen', 'Datos e Impuestos'], ['sync', 'Sincronización Nube'], ['pdf', 'Diseño PDF'], ['users', 'Usuarios y Roles'], ['import', 'Importación de datos']]
const Card = ({ children }) => <div className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6">{children}</div>
const fld = (l, n, v, t = 'text', wide = false) => (
  <label key={n} className={'block ' + (wide ? 'sm:col-span-2' : '')}><span className="mb-1 block text-xs font-medium text-slate-500">{l}</span>
    <input className="inp" name={n} type={t} step="any" defaultValue={v ?? ''} /></label>
)

export default function Configuracion({ isAdmin, canEdit, me, live, toast }) {
  const [tab, setTab] = useState('gen')
  const { rows } = useTable('sgo_config')
  const { rows: users } = useTable('sgo_users')
  const { rows: clients } = useTable('sgo_clients')
  const { rows: suppliers } = useTable('sgo_suppliers')
  const { rows: insumos } = useTable('sgo_insumos')
  const { rows: apus } = useTable('sgo_apu')
  const { rows: obras } = useTable('sgo_obras')
  const cfg = rows[0]
  const [res, setRes] = useState({})
  if (!cfg) return <p className="text-sm text-slate-400">Cargando…</p>
  const year = String(new Date().getFullYear())

  const saveCfg = async patch => {
    const { error } = await supabase.from('sgo_config').update(patch).eq('id', 1)
    toast(error ? error.message : 'Configuración guardada', !!error)
  }
  const form = fn => e => { e.preventDefault(); fn(Object.fromEntries(new FormData(e.target))) }
  const uploadLogo = e => {
    const f = e.target.files[0]; if (!f) return
    if (f.size > 200 * 1024) return toast('El logo debe pesar menos de 200 KB', true)
    const r = new FileReader(); r.onload = () => saveCfg({ logo_url: r.result }); r.readAsDataURL(f)
  }
  const patchUser = async (u, patch) => {
    const { error } = await supabase.from('sgo_users').update(patch).eq('id', u.id)
    if (error) toast(error.message, true)
  }
  const ctx = { clients, suppliers, insumos, apus, obras }
  const counts = { clients: clients.length, suppliers: suppliers.length, insumos: insumos.length, apu: apus.length, obras: obras.length }
  const subir = async (k, e) => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    setRes(r => ({ ...r, [k]: { text: 'Procesando…' } }))
    try {
      const rows = (await readXlsxFile(f)).slice(1) // se omite la fila de encabezado
      const text = await IMPORTS[k].run(rows, ctx)
      setRes(r => ({ ...r, [k]: { text } })); toast('Importación terminada')
    } catch (err) { setRes(r => ({ ...r, [k]: { text: 'No se pudo importar: ' + err.message, err: true } })) }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ' + (tab === id ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800')}>{l}</button>)}
      </div>
      {!isAdmin && ['gen', 'pdf', 'users'].includes(tab) && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">Solo el Administrador puede modificar esta sección.</p>}

      {tab === 'gen' && <Card><form key={cfg.updated_at} onSubmit={form(v => saveCfg({
        company_name: v.company_name, ruc: v.ruc || null, address: v.address || null, phone: v.phone || null, email: v.email || null,
        vat_rate: Number(v.vat_rate) || 0, usd_rate: Number(v.usd_rate) || 7500, budget_start: { ...cfg.budget_start, [year]: Number(v.start) || 1 } }))}>
        <fieldset disabled={!isAdmin} className="grid gap-3 sm:grid-cols-2">
          {fld('Nombre de la empresa', 'company_name', cfg.company_name, 'text', true)}{fld('RUC', 'ruc', cfg.ruc)}{fld('Teléfono', 'phone', cfg.phone)}
          {fld('Correo', 'email', cfg.email, 'email')}{fld('Dirección', 'address', cfg.address)}
          {fld('IVA (%)', 'vat_rate', cfg.vat_rate, 'number')}{fld('Cotización USD → ₲', 'usd_rate', cfg.usd_rate, 'number')}
          {fld(`Primer N° de presupuesto de ${year}`, 'start', cfg.budget_start?.[year] || 1, 'number')}
        </fieldset>
        {isAdmin && <div className="mt-4 flex justify-end"><button className="btn btn-dark">Guardar cambios</button></div>}
      </form></Card>}

      {tab === 'sync' && <Card><div className="space-y-3 text-sm">
        <p className="flex items-center gap-2"><span className={'h-2.5 w-2.5 rounded-full ' + (live ? 'bg-emerald-500' : 'bg-amber-500')} /><b>{live ? 'Conectado en tiempo real' : 'Sincronizando…'}</b></p>
        <p><span className="text-slate-500">Proyecto Supabase:</span> {SUPABASE_URL.replace('https://', '')}</p>
        <p><span className="text-slate-500">Sesión:</span> {me?.email}</p>
        <p className="text-slate-500">Los datos se guardan en la nube: lo que cambies en la PC aparece al instante en el celular, y viceversa. La conexión ya viene configurada en el sistema, no hay que cargar claves.</p>
      </div></Card>}

      {tab === 'pdf' && <Card><div className="space-y-4">
        <div className="flex items-center gap-4">{cfg.logo_url ? <img src={cfg.logo_url} alt="Logo" className="h-16 rounded border border-slate-200 p-1" /> : <div className="grid h-16 w-24 place-items-center rounded border border-dashed border-slate-300 text-xs text-slate-400">Sin logo</div>}
          {isAdmin && <div className="space-x-2"><label className="btn cursor-pointer border border-slate-200 hover:bg-slate-50">Subir logo<input type="file" accept="image/png,image/jpeg" className="hidden" onChange={uploadLogo} /></label>
            {cfg.logo_url && <button className="btn text-rose-600 hover:bg-rose-50" onClick={() => saveCfg({ logo_url: null })}>Quitar</button>}</div>}</div>
        <form key={cfg.updated_at} onSubmit={form(v => saveCfg({ pdf_header_title: v.title, pdf_footer_terms: v.terms }))} className="space-y-3">
          <fieldset disabled={!isAdmin} className="space-y-3">
            {fld('Título del encabezado', 'title', cfg.pdf_header_title)}
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Condiciones comerciales (pie del PDF)</span><textarea className="inp h-32" name="terms" defaultValue={cfg.pdf_footer_terms || ''} /></label>
          </fieldset>
          {isAdmin && <div className="flex justify-end"><button className="btn btn-dark">Guardar diseño</button></div>}
        </form>
      </div></Card>}

      {tab === 'users' && <Card><p className="mb-3 text-sm text-slate-500">Cada persona se registra con “Crear cuenta” en la pantalla de ingreso y aparece aquí como <b>Consultas</b>. El Administrador le asigna el perfil que corresponde.</p>
        <div className="divide-y divide-slate-100">{users.map(u => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <div><p className="font-medium">{u.name}</p><p className="text-xs text-slate-400">{u.email}</p></div>
            <div className="flex items-center gap-3">
              <select className="inp !w-auto" value={u.role} disabled={!isAdmin || u.id === me?.id} onChange={e => patchUser(u, { role: e.target.value })}>{['Admin', 'Editor', 'Consultas'].map(r => <option key={r}>{r}</option>)}</select>
              <label className="flex items-center gap-1.5 text-xs text-slate-500"><input type="checkbox" checked={u.active} disabled={!isAdmin || u.id === me?.id} onChange={e => patchUser(u, { active: e.target.checked })} />Activo</label>
            </div></div>))}
          {!users.length && <p className="py-6 text-center text-slate-400">Sin usuarios visibles</p>}</div></Card>}

      {tab === 'import' && <div className="max-w-3xl space-y-3">
        <p className="text-sm text-slate-500">Carga tus datos desde Excel siguiendo el orden de arriba hacia abajo, porque cada paso usa datos del anterior. En cada uno: descarga la plantilla, complétala y súbela.</p>
        {Object.entries(IMPORTS).map(([k, T], i) => (
          <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{T.label} <span className="font-normal text-slate-400">· {counts[k]} registrados</span></p><p className="text-xs text-slate-500">{T.desc}</p></div>
              <a href={'/plantillas/' + T.file} download className="btn flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50"><Download size={14} />Plantilla</a>
              {canEdit && <label className="btn btn-dark flex cursor-pointer items-center gap-1.5"><Upload size={14} />Subir Excel<input type="file" accept=".xlsx" className="hidden" onChange={e => subir(k, e)} /></label>}
            </div>
            {res[k] && <p className={'mt-3 rounded-lg p-2.5 text-xs ' + (res[k].err ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>{res[k].text}</p>}
          </div>
        ))}
        <p className="text-xs text-slate-400">Los presupuestos antiguos se importan desde el módulo Presupuestos, porque primero eliges la obra y revisas el borrador.</p>
      </div>}
    </div>
  )
}
