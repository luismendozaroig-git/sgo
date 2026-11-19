import { useMemo, useState } from 'react'
import { Check, Plus, Printer, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTable } from '../hooks/useTable'
import { apuCost } from '../lib/apu'
import { pyg, usd } from '../lib/format'

const BADGE = { Borrador: 'bg-amber-50 text-amber-700', Aprobado: 'bg-emerald-50 text-emerald-700' }
const today = () => new Date().toISOString().slice(0, 10)

export default function Presupuestos({ canEdit, canDelete, toast }) {
  const { rows: buds } = useTable('sgo_budgets')
  const { rows: obras } = useTable('sgo_obras', 'name')
  const { rows: apus } = useTable('sgo_apu', 'code')
  const { rows: insumos } = useTable('sgo_insumos')
  const { rows: clientes } = useTable('sgo_clients')
  const { rows: cfgR } = useTable('sgo_config')
  const cfg = cfgR[0] || {}
  const [d, setD] = useState(null)
  const [pdf, setPdf] = useState(false)
  const imap = useMemo(() => Object.fromEntries(insumos.map(i => [i.id, i])), [insumos])
  const amap = useMemo(() => Object.fromEntries(apus.map(a => [a.id, a])), [apus])

  // Borrador: los rubros del catálogo APU usan el precio vigente. Aprobado: precio congelado.
  const priceOf = (it, st) => (st === 'Borrador' && it.source === 'APU' && amap[it.apu_id] ? Math.round(apuCost(amap[it.apu_id], imap).total) : Number(it.unit_price) || 0)
  const subOf = b => (b.items || []).reduce((s, it) => s + (Number(it.quantity) || 0) * priceOf(it, b.status), 0)
  const totalOf = b => subOf(b) * (1 + (Number(b.vat_rate) || 0) / 100)
  const obraName = id => obras.find(o => o.id === id)?.name || '—'

  const nuevo = () => {
    const y = new Date().getFullYear(), pre = `PRES-${y}-`
    const seqs = buds.filter(b => b.number?.startsWith(pre)).map(b => parseInt(b.number.slice(pre.length)) || 0)
    const n = Math.max((Number(cfg.budget_start?.[y]) || 1) - 1, ...seqs) + 1
    setD({ number: pre + String(n).padStart(3, '0'), obra_id: '', date: today(), validity_days: 30, vat_rate: cfg.vat_rate ?? 10, items: [], status: 'Borrador' })
  }
  const set = p => setD({ ...d, ...p })
  const setItem = (i, p) => set({ items: d.items.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const addApu = id => { const a = amap[id]; if (a) set({ items: [...d.items, { source: 'APU', apu_id: id, rubro: a.code, description: a.description, unit: a.unit, quantity: 1, unit_price: 0 }] }) }
  const addLibre = () => set({ items: [...d.items, { source: 'LIBRE', rubro: '', description: '', unit: 'gl', quantity: 1, unit_price: 0 }] })

  const save = async (status = d.status) => {
    if (!d.obra_id) return toast('Selecciona la obra', true)
    const { id, created_at, updated_at, ...v } = d
    v.status = status
    v.vat_rate = Number(v.vat_rate) || 0
    v.validity_days = Number(v.validity_days) || 0
    v.items = d.items.map(it => ({ ...it, quantity: Number(it.quantity) || 0, unit_price: priceOf(it, d.status) }))
    const { error } = id ? await supabase.from('sgo_budgets').update(v).eq('id', id) : await supabase.from('sgo_budgets').insert(v)
    if (error) return toast(error.code === '23505' ? 'Ese número de presupuesto ya existe' : error.message, true)
    setD(null); toast(status === 'Aprobado' ? 'Presupuesto aprobado: precios congelados' : 'Presupuesto guardado')
  }
  const aprobar = () => { if (confirm('Al aprobar se congelan los precios y ya no se podrá editar. ¿Continuar?')) save('Aprobado') }
  const del = async b => {
    if (!confirm('¿Eliminar el presupuesto ' + b.number + '?')) return
    const { error } = await supabase.from('sgo_budgets').delete().eq('id', b.id)
    if (!error) setD(null)
    toast(error ? error.message : 'Presupuesto eliminado', !!error)
  }

  if (!d) return (
    <div>
      {canEdit && <div className="mb-4 flex"><button className="btn btn-dark ml-auto flex items-center gap-1.5" onClick={nuevo}><Plus size={16} />Nuevo presupuesto</button></div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500"><tr><th className="px-4 py-3">Número</th><th className="px-4 py-3">Obra</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Total (IVA incl.)</th></tr></thead>
          <tbody>
            {buds.map(b => (
              <tr key={b.id} onClick={() => setD({ ...b, items: b.items || [] })} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{b.number}</td><td className="px-4 py-3">{obraName(b.obra_id)}</td><td className="px-4 py-3">{b.date}</td>
                <td className="px-4 py-3"><span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + BADGE[b.status]}>{b.status}</span></td>
                <td className="px-4 py-3 text-right tabular-nums">{pyg(totalOf(b))}</td>
              </tr>
            ))}
            {!buds.length && <tr><td colSpan={5} className="p-10 text-center text-slate-400">Todavía no hay presupuestos</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )

  const edit = canEdit && d.status === 'Borrador'
  const sub = subOf(d), vat = sub * (Number(d.vat_rate) || 0) / 100, total = sub + vat
  const obra = obras.find(o => o.id === d.obra_id), cli = clientes.find(c => c.id === obra?.client_id)
  const cell = 'inp !py-1 disabled:border-transparent disabled:bg-transparent'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{d.number}</h2><span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + BADGE[d.status]}>{d.status}</span></div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-slate-500">Obra</span>
            <select className="inp" disabled={!edit} value={d.obra_id || ''} onChange={e => set({ obra_id: e.target.value })}><option value="">— Seleccionar —</option>{obras.map(o => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Fecha</span><input className="inp" type="date" disabled={!edit} value={d.date || ''} onChange={e => set({ date: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Validez (días)</span><input className="inp" type="number" disabled={!edit} value={d.validity_days} onChange={e => set({ validity_days: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">IVA (%)</span><input className="inp" type="number" disabled={!edit} value={d.vat_rate} onChange={e => set({ vat_rate: e.target.value })} /></label>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500"><tr><th className="px-3 py-2">Rubro</th><th className="px-3 py-2">Descripción</th><th className="px-3 py-2">Unid.</th><th className="px-3 py-2">Cantidad</th><th className="px-3 py-2 text-right">P. unitario</th><th className="px-3 py-2 text-right">Subtotal</th><th /></tr></thead>
          <tbody>
            {d.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-1.5"><input className={cell + ' !w-20'} disabled={!edit} value={it.rubro} onChange={e => setItem(i, { rubro: e.target.value })} /></td>
                <td className="px-3 py-1.5"><input className={cell + ' min-w-[14rem]'} disabled={!edit} value={it.description} onChange={e => setItem(i, { description: e.target.value })} /></td>
                <td className="px-3 py-1.5"><input className={cell + ' !w-16'} disabled={!edit} value={it.unit} onChange={e => setItem(i, { unit: e.target.value })} /></td>
                <td className="px-3 py-1.5"><input className={cell + ' !w-24'} type="number" step="any" disabled={!edit} value={it.quantity} onChange={e => setItem(i, { quantity: e.target.value })} /></td>
                <td className="px-3 py-1.5 text-right">{it.source === 'APU' || !edit ? <span className="tabular-nums">{pyg(priceOf(it, d.status))}</span> : <input className={cell + ' !w-32 text-right'} type="number" step="any" value={it.unit_price} onChange={e => setItem(i, { unit_price: e.target.value })} />}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{pyg((Number(it.quantity) || 0) * priceOf(it, d.status))}</td>
                <td className="px-3 py-1.5 text-right">{edit && <button className="rounded p-1 text-rose-500 hover:bg-rose-50" onClick={() => set({ items: d.items.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
            {!d.items.length && <tr><td colSpan={7} className="p-8 text-center text-slate-400">Agrega rubros del catálogo APU o ítems libres</td></tr>}
          </tbody>
        </table>
        {edit && <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
          <select className="inp max-w-xs" value="" onChange={e => addApu(e.target.value)}><option value="">+ Rubro del catálogo APU…</option>{apus.map(a => <option key={a.id} value={a.id}>{a.code} · {a.description}</option>)}</select>
          <button className="btn border border-slate-200 hover:bg-slate-50" onClick={addLibre}>+ Ítem libre</button>
        </div>}
      </div>

      <div className="ml-auto w-full max-w-sm space-y-1 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <p className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums">{pyg(sub)}</span></p>
        <p className="flex justify-between"><span className="text-slate-500">IVA ({Number(d.vat_rate) || 0}%)</span><span className="tabular-nums">{pyg(vat)}</span></p>
        <p className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><span>Total general</span><span className="tabular-nums text-amber-600">{pyg(total)}</span></p>
        <p className="text-right text-xs text-slate-400">≈ {usd(total / (Number(cfg.usd_rate) || 7500))}</p>
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <div>{canDelete && d.id && <button className="btn flex items-center gap-1.5 text-rose-600 hover:bg-rose-50" onClick={() => del(d)}><Trash2 size={14} />Eliminar</button>}</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn hover:bg-slate-100" onClick={() => setD(null)}>{edit ? 'Cancelar' : 'Volver'}</button>
          {d.id && <button className="btn flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50" onClick={() => setPdf(true)}><Printer size={14} />Vista PDF</button>}
          {edit && <button className="btn border border-slate-200 hover:bg-slate-50" onClick={() => save()}>Guardar borrador</button>}
          {edit && d.id && <button className="btn flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={aprobar}><Check size={14} />Aprobar</button>}
        </div>
      </div>

      {pdf && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/60 p-4 print:static print:bg-white print:p-0">
          <div className="mx-auto mb-3 flex max-w-3xl justify-end gap-2 print:hidden"><button className="btn bg-white hover:bg-slate-100" onClick={() => setPdf(false)}>Cerrar</button><button className="btn bg-amber-500 text-slate-900 hover:bg-amber-400" onClick={() => window.print()}>Imprimir / Guardar PDF</button></div>
          <div id="print-area" className="mx-auto max-w-3xl bg-white p-10 text-[13px] text-slate-800 shadow-xl">
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
              <div className="flex items-center gap-3">{cfg.logo_url && <img src={cfg.logo_url} alt="" className="h-14" />}<div><p className="text-lg font-bold">{cfg.company_name}</p><p className="text-xs text-slate-500">RUC {cfg.ruc} · {cfg.address}</p></div></div>
              <div className="text-right"><p className="font-bold">{d.number}</p><p className="text-xs text-slate-500">Fecha {d.date} · Validez {d.validity_days} días</p></div>
            </div>
            <p className="my-4 text-center text-base font-bold tracking-wide">{cfg.pdf_header_title}</p>
            <p><b>Obra:</b> {obra?.name} {obra?.address ? '· ' + obra.address : ''}</p>
            <p className="mb-4"><b>Cliente:</b> {cli?.name || '—'}</p>
            <table className="w-full border-collapse text-xs">
              <thead><tr className="bg-slate-100 text-left"><th className="border p-1.5">Ítem</th><th className="border p-1.5">Descripción</th><th className="border p-1.5">Unid.</th><th className="border p-1.5 text-right">Cant.</th><th className="border p-1.5 text-right">P. unit.</th><th className="border p-1.5 text-right">Subtotal</th></tr></thead>
              <tbody>{d.items.map((it, i) => <tr key={i}><td className="border p-1.5">{it.rubro || i + 1}</td><td className="border p-1.5">{it.description}</td><td className="border p-1.5">{it.unit}</td><td className="border p-1.5 text-right">{Number(it.quantity)}</td><td className="border p-1.5 text-right">{pyg(priceOf(it, d.status))}</td><td className="border p-1.5 text-right">{pyg((Number(it.quantity) || 0) * priceOf(it, d.status))}</td></tr>)}</tbody>
            </table>
            <div className="ml-auto mt-3 w-64 space-y-0.5 text-right"><p>Subtotal: {pyg(sub)}</p><p>IVA ({Number(d.vat_rate) || 0}%): {pyg(vat)}</p><p className="text-sm font-bold">TOTAL: {pyg(total)}</p></div>
            <p className="mt-6 whitespace-pre-line text-xs text-slate-600"><b>Condiciones comerciales</b>{'\n'}{cfg.pdf_footer_terms}</p>
            <div className="mt-16 flex justify-between text-xs"><div className="w-56 border-t border-slate-800 pt-1 text-center">Por la empresa</div><div className="w-56 border-t border-slate-800 pt-1 text-center">Conformidad del cliente</div></div>
          </div>
        </div>
      )}
    </div>
  )
}
