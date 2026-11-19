import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTable } from '../hooks/useTable'
import { pyg } from '../lib/format'

export default function Ejecucion({ canEdit, canDelete, toast }) {
  const { rows: obras } = useTable('sgo_obras')
  const { rows: pagos } = useTable('sgo_payments')
  const activas = obras.filter(o => o.status === 'En Proceso')
  const [sid, setSid] = useState('')
  const o = obras.find(x => x.id === (sid || activas[0]?.id))
  const [pct, setPct] = useState(null)
  useEffect(() => setPct(null), [o?.id])
  if (!o) return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center text-sm text-slate-400">No hay obras en proceso. Crea una en “Obras y Mapa”.</p>

  const cur = pct ?? Number(o.real_progress)
  const mios = pagos.filter(p => p.obra_id === o.id)
  const guardarAvance = async () => {
    const { error } = await supabase.from('sgo_obras').update({ real_progress: cur, executed_pyg: Math.round(Number(o.budget_pyg) * cur / 100) }).eq('id', o.id)
    toast(error ? error.message : 'Avance guardado', !!error); if (!error) setPct(null)
  }
  const emitir = async e => {
    e.preventDefault()
    const v = Object.fromEntries(new FormData(e.target))
    const { error } = await supabase.from('sgo_payments').insert({ obra_id: o.id, concept: v.concept, amount_pyg: Number(v.amount) || 0, date: v.date || undefined })
    if (error) return toast(error.message, true)
    e.target.reset(); toast('Certificado emitido')
  }
  const alternar = async p => {
    const { error } = await supabase.from('sgo_payments').update({ status: p.status === 'Pendiente' ? 'Cobrado' : 'Pendiente' }).eq('id', p.id)
    if (error) toast(error.message, true)
  }
  const borrar = async p => {
    if (!confirm('¿Eliminar este certificado?')) return
    const { error } = await supabase.from('sgo_payments').delete().eq('id', p.id)
    if (error) toast(error.message, true)
  }

  return (
    <div className="space-y-4">
      <select className="inp max-w-sm" value={o.id} onChange={e => setSid(e.target.value)}>{activas.map(x => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-end justify-between"><h2 className="text-sm font-semibold">Avance físico real</h2><span className="text-3xl font-semibold text-amber-600">{cur}%</span></div>
        <input type="range" min="0" max="100" step="1" disabled={!canEdit} value={cur} onChange={e => setPct(Number(e.target.value))} className="mt-3 w-full accent-amber-500" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span>Planificado {Number(o.planned_progress)}% · Ejecutado: <b className="text-slate-800">{pyg(Math.round(Number(o.budget_pyg) * cur / 100))}</b> de {pyg(o.budget_pyg)}</span>
          {canEdit && <button className="btn btn-dark" disabled={pct === null} onClick={guardarAvance}>Guardar avance</button>}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold">Certificados de avance de obra</h2>
        {canEdit && (
          <form onSubmit={emitir} className="grid gap-2 border-b border-slate-100 p-4 sm:grid-cols-5">
            <input className="inp sm:col-span-2" name="concept" placeholder="Concepto (ej. Certificado N° 1)" required />
            <input className="inp" name="amount" type="number" placeholder="Monto ₲" required />
            <input className="inp" name="date" type="date" />
            <button className="btn btn-dark flex items-center justify-center gap-1.5"><Plus size={16} />Emitir</button>
          </form>
        )}
        {mios.map(p => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-sm last:border-0">
            <div><p className="font-medium">{p.concept}</p><p className="text-xs text-slate-400">{p.date}</p></div>
            <div className="flex items-center gap-3">
              <span className="tabular-nums">{pyg(p.amount_pyg)}</span>
              <button disabled={!canEdit} onClick={() => alternar(p)} className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + (p.status === 'Cobrado' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{p.status}</button>
              {canDelete && <button className="rounded p-1 text-rose-500 hover:bg-rose-50" onClick={() => borrar(p)}><Trash2 size={14} /></button>}
            </div>
          </div>
        ))}
        {!mios.length && <p className="p-8 text-center text-sm text-slate-400">Sin certificados para esta obra</p>}
      </div>
    </div>
  )
}
