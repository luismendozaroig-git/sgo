import { useState } from 'react'
import { useTable } from '../hooks/useTable'
import { pyg } from '../lib/format'

const ESTADOS = ['Todas', 'En Proceso', 'Finalizada', 'Pausada']
const Kpi = ({ l, v, s }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5">
    <p className="text-xs font-medium text-slate-500">{l}</p>
    <p className="mt-1 text-2xl font-semibold tracking-tight">{v}</p>
    <p className="mt-0.5 text-xs text-slate-400">{s}</p>
  </div>
)

export default function Dashboard() {
  const { rows: obras } = useTable('sgo_obras')
  const { rows: pagos } = useTable('sgo_payments')
  const [f, setF] = useState('Todas')
  const l = obras.filter(o => f === 'Todas' || o.status === f)
  const sum = k => l.reduce((s, o) => s + Number(o[k] || 0), 0)
  const pres = sum('budget_pyg'), ejec = sum('executed_pyg')
  const avg = l.length ? Math.round(l.reduce((s, o) => s + Number(o.real_progress), 0) / l.length) : 0
  const pend = pagos.filter(p => p.status === 'Pendiente')
  const porCobrar = pend.reduce((s, p) => s + Number(p.amount_pyg), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {ESTADOS.map(e => <button key={e} onClick={() => setF(e)} className={'btn ' + (f === e ? 'btn-dark' : 'border border-slate-200 bg-white hover:bg-slate-50')}>{e}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi l="Obras" v={l.length} s={f === 'Todas' ? 'Total registradas' : f} />
        <Kpi l="Presupuestado" v={pyg(pres)} s="Monto acumulado" />
        <Kpi l="Ejecutado" v={pyg(ejec)} s={(pres ? Math.round(ejec / pres * 100) : 0) + '% del presupuesto'} />
        <Kpi l="Avance físico" v={avg + '%'} s="Promedio real" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold">Estado y desviación de obras</h2>
        {l.map(o => {
          const dev = Math.round(o.real_progress - o.planned_progress)
          return (
            <div key={o.id} className="flex flex-col gap-2 border-b border-slate-100 px-5 py-3.5 last:border-0 sm:flex-row sm:items-center sm:gap-6">
              <div className="min-w-0 sm:w-64"><p className="truncate text-sm font-medium">{o.name}</p><p className="text-xs text-slate-400">{o.code} · {o.status}</p></div>
              <div className="flex-1">
                <div className="relative h-2 rounded-full bg-slate-100">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-amber-500" style={{ width: o.real_progress + '%' }} />
                  <div className="absolute -top-0.5 h-3 w-0.5 bg-slate-500" style={{ left: o.planned_progress + '%' }} />
                </div>
                <p className="mt-1 text-xs text-slate-500">Real {o.real_progress}% · Planificado {o.planned_progress}%</p>
              </div>
              <span className={'w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ' + (dev >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>{dev >= 0 ? 'Adelanto ' : 'Retraso '}{Math.abs(dev)}%</span>
            </div>
          )
        })}
        {!l.length && <p className="p-8 text-center text-sm text-slate-400">Todavía no hay obras. El módulo Obras es el próximo.</p>}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h2 className="text-sm font-semibold">Certificados pendientes de cobro</h2><span className="text-sm font-semibold text-amber-600">{pyg(porCobrar)}</span></div>
        {pend.map(p => <div key={p.id} className="flex justify-between border-b border-slate-100 px-5 py-3 text-sm last:border-0"><span>{p.concept}</span><span className="tabular-nums">{pyg(p.amount_pyg)}</span></div>)}
        {!pend.length && <p className="p-6 text-center text-sm text-slate-400">Sin certificados pendientes</p>}
      </div>
    </div>
  )
}
