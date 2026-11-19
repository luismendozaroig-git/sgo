import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTable } from '../hooks/useTable'
import { pyg } from '../lib/format'

const ESTADOS = ['En Proceso', 'Finalizada', 'Pausada']
const BADGE = { 'En Proceso': 'bg-sky-50 text-sky-700', Finalizada: 'bg-emerald-50 text-emerald-700', Pausada: 'bg-amber-50 text-amber-700' }

export default function Obras({ canEdit, canDelete, toast }) {
  const { rows: obras, loading } = useTable('sgo_obras')
  const { rows: clientes } = useTable('sgo_clients', 'name')
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState(null)
  const [edit, setEdit] = useState(null) // null = cerrado · {} = nueva · fila = editar

  const list = useMemo(() => obras.filter(o => (o.name + o.code + (o.supervisor || '')).toLowerCase().includes(q.toLowerCase())), [obras, q])
  useEffect(() => { if (!selId && obras.length) setSelId(obras[0].id) }, [obras, selId])
  const sel = obras.find(o => o.id === selId)
  const cliente = id => clientes.find(c => c.id === id)?.name || 'Sin cliente'

  const save = async e => {
    e.preventDefault()
    const v = Object.fromEntries(new FormData(e.target))
    ;['budget_pyg', 'planned_progress', 'real_progress'].forEach(k => { v[k] = Number(v[k]) || 0 })
    ;['lat', 'lng'].forEach(k => { v[k] = v[k] === '' ? null : Number(v[k]) })
    ;['client_id', 'start_date', 'end_date', 'address', 'supervisor'].forEach(k => { v[k] = v[k] || null })
    v.executed_pyg = Math.round(v.budget_pyg * v.real_progress / 100)
    const { error } = edit.id ? await supabase.from('sgo_obras').update(v).eq('id', edit.id) : await supabase.from('sgo_obras').insert(v)
    if (error) return toast(error.code === '23505' ? 'Ya existe una obra con ese código' : error.message, true)
    setEdit(null); toast('Obra guardada')
  }
  const del = async o => {
    if (!confirm('¿Eliminar la obra "' + o.name + '" con sus presupuestos y certificados? No se puede deshacer.')) return
    const { error } = await supabase.from('sgo_obras').delete().eq('id', o.id)
    if (!error) setSelId(null)
    toast(error ? error.message : 'Obra eliminada', !!error)
  }
  const nuevoCodigo = 'OB-' + new Date().getFullYear() + '-' + String(obras.length + 1).padStart(2, '0')
  const campo = (l, n, t = 'text', wide = false, req = false) => (
    <label key={n} className={'block ' + (wide ? 'sm:col-span-2' : '')}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{l}</span>
      <input className="inp" name={n} type={t} step="any" required={req} defaultValue={edit[n] ?? (n === 'code' && !edit.id ? nuevoCodigo : '')} />
    </label>
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="inp max-w-xs" placeholder="Buscar obra…" value={q} onChange={e => setQ(e.target.value)} />
        {canEdit && <button className="btn btn-dark ml-auto flex items-center gap-1.5" onClick={() => setEdit({ lat: -25.2822, lng: -57.6014, status: 'En Proceso' })}><Plus size={16} />Nueva obra</button>}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-3">
          {list.map(o => (
            <div key={o.id} onClick={() => setSelId(o.id)} className={'cursor-pointer rounded-xl border bg-white p-4 transition hover:border-slate-300 ' + (selId === o.id ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-sm font-semibold">{o.name}</p><p className="text-xs text-slate-400">{o.code} · {cliente(o.client_id)}</p></div>
                <span className={'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ' + BADGE[o.status]}>{o.status}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 flex-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-500" style={{ width: o.real_progress + '%' }} /></div>
                <span className="text-xs font-medium">{Number(o.real_progress)}%</span>
                <span className="text-xs text-slate-500">{pyg(o.budget_pyg)}</span>
              </div>
            </div>
          ))}
          {!list.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">{loading ? 'Cargando…' : 'Todavía no hay obras'}</p>}
        </div>

        <div className="lg:col-span-2">
          <div className="overflow-hidden lg:sticky lg:top-32 rounded-xl border border-slate-200 bg-white">
            {sel ? <>
              {sel.lat != null && sel.lng != null
                ? <iframe title="Mapa" className="h-64 w-full border-0" loading="lazy" src={`https://maps.google.com/maps?q=${sel.lat},${sel.lng}&z=15&output=embed`} />
                : <div className="grid h-40 place-items-center bg-slate-50 text-sm text-slate-400"><MapPin /> Sin coordenadas</div>}
              <div className="space-y-1 p-4 text-sm">
                <p className="font-semibold">{sel.name}</p>
                <p className="text-slate-500">{sel.address || 'Sin dirección'}</p>
                <p className="text-xs text-slate-400">Responsable: {sel.supervisor || '—'} · {sel.start_date || '?'} → {sel.end_date || '?'}</p>
                <p className="text-xs text-slate-400">Avance real {Number(sel.real_progress)}% · planificado {Number(sel.planned_progress)}% · ejecutado {pyg(sel.executed_pyg)}</p>
                <div className="flex flex-wrap gap-2 pt-3">
                  {sel.lat != null && <a className="btn flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${sel.lat},${sel.lng}`}><ExternalLink size={14} />Abrir en Google Maps</a>}
                  {canEdit && <button className="btn flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50" onClick={() => setEdit(sel)}><Pencil size={14} />Editar</button>}
                  {canDelete && <button className="btn flex items-center gap-1.5 text-rose-600 hover:bg-rose-50" onClick={() => del(sel)}><Trash2 size={14} />Eliminar</button>}
                </div>
              </div>
            </> : <p className="p-10 text-center text-sm text-slate-400">Selecciona una obra para ver su ubicación</p>}
          </div>
        </div>
      </div>

      {edit && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={save} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-semibold">{edit.id ? 'Editar obra' : 'Nueva obra'}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {campo('Código de obra', 'code', 'text', false, true)}
              {campo('Nombre', 'name', 'text', false, true)}
              <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Cliente</span>
                <select className="inp" name="client_id" defaultValue={edit.client_id || ''}><option value="">— Sin cliente —</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Estado</span>
                <select className="inp" name="status" defaultValue={edit.status || 'En Proceso'}>{ESTADOS.map(s => <option key={s}>{s}</option>)}</select></label>
              {campo('Dirección', 'address', 'text', true, false)}
              {campo('Latitud', 'lat', 'number', false, false)}
              {campo('Longitud', 'lng', 'number', false, false)}
              {campo('Presupuesto contratado (₲)', 'budget_pyg', 'number', false, false)}
              {campo('Supervisor / Residente', 'supervisor', 'text', false, false)}
              {campo('Fecha de inicio', 'start_date', 'date', false, false)}
              {campo('Fecha de fin', 'end_date', 'date', false, false)}
              {campo('Avance planificado (%)', 'planned_progress', 'number', false, false)}
              {campo('Avance real (%)', 'real_progress', 'number', false, false)}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" className="btn hover:bg-slate-100" onClick={() => setEdit(null)}>Cancelar</button>
              <button className="btn btn-dark">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
