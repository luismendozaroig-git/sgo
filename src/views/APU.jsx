import { useMemo, useState } from 'react'
import { FileSpreadsheet, Plus, Trash2 } from 'lucide-react'
import readXlsxFile from 'read-excel-file'
import { supabase } from '../lib/supabase'
import { useTable } from '../hooks/useTable'
import { apuCost } from '../lib/apu'
import { pyg } from '../lib/format'

export default function APU({ canEdit, canDelete, toast }) {
  const { rows: apus } = useTable('sgo_apu', 'code')
  const { rows: insumos } = useTable('sgo_insumos', 'code')
  const [d, setD] = useState(null) // rubro que se está viendo o editando
  const [q, setQ] = useState('')
  const map = useMemo(() => Object.fromEntries(insumos.map(i => [i.id, i])), [insumos])
  const c = d ? apuCost(d, map) : null
  const set = patch => setD({ ...d, ...patch })
  const setItem = (i, patch) => set({ items: d.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) })

  const save = async () => {
    if (!d.description?.trim()) return toast('Falta la descripción del rubro', true)
    const { id, created_at, updated_at, ...v } = d
    v.code = v.code || null
    v.indirects_pct = Number(v.indirects_pct) || 0
    v.profit_pct = Number(v.profit_pct) || 0
    v.items = v.items.map(it => ({ insumo_id: it.insumo_id, yield: Number(it.yield) || 0 }))
    const { error } = id ? await supabase.from('sgo_apu').update(v).eq('id', id) : await supabase.from('sgo_apu').insert(v)
    if (error) return toast(error.code === '23505' ? 'Ya existe un rubro con ese código' : error.message, true)
    setD(null); toast('Rubro guardado')
  }
  const del = async () => {
    if (!confirm('¿Eliminar este rubro?')) return
    const { error } = await supabase.from('sgo_apu').delete().eq('id', d.id)
    if (!error) setD(null)
    toast(error ? error.message : 'Rubro eliminado', !!error)
  }
  const importar = async e => {
    const f = e.target.files[0]; e.target.value = ''
    if (!f) return
    try {
      const rows = (await readXlsxFile(f)).slice(1) // se omite la fila de encabezado
      const porCodigo = Object.fromEntries(insumos.filter(i => i.code).map(i => [String(i.code).trim().toUpperCase(), i.id]))
      const rubros = {}, faltan = new Set()
      rows.forEach(([code, desc, unit, ind, util, icode, rend]) => {
        if (!code || !desc) return
        const k = String(code).trim()
        const R = rubros[k] ||= { code: k, description: String(desc).trim(), unit: unit ? String(unit).trim() : null, indirects_pct: Number(ind) || 0, profit_pct: Number(util) || 0, items: [] }
        if (!icode) return
        const id = porCodigo[String(icode).trim().toUpperCase()]
        if (id) R.items.push({ insumo_id: id, yield: Number(rend) || 0 }); else faltan.add(String(icode).trim())
      })
      const lista = Object.values(rubros)
      if (!lista.length) return toast('No se encontraron rubros en el archivo. Revisa que use la plantilla.', true)
      const { error } = await supabase.from('sgo_apu').upsert(lista, { onConflict: 'code' })
      if (error) return toast(error.message, true)
      toast(lista.length + ' rubro(s) importado(s)' + (faltan.size ? '. Insumos no encontrados: ' + [...faltan].slice(0, 6).join(', ') : ''), faltan.size > 0)
    } catch (err) { toast('No se pudo leer el Excel: ' + err.message, true) }
  }
  const nuevo = () => setD({ code: 'APU-' + String(apus.length + 1).padStart(2, '0'), description: '', unit: 'm3', items: [], indirects_pct: 10, profit_pct: 10 })
  const list = apus.filter(a => (a.code + a.description).toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <div className="mb-3 flex gap-2">
          <input className="inp" placeholder="Buscar rubro…" value={q} onChange={e => setQ(e.target.value)} />
          {canEdit && <button className="btn btn-dark flex shrink-0 items-center gap-1.5" onClick={nuevo}><Plus size={16} />Nuevo</button>}
          {canEdit && <label title="Importar desde Excel" className="btn flex shrink-0 cursor-pointer items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50"><FileSpreadsheet size={16} />Excel<input type="file" accept=".xlsx" className="hidden" onChange={importar} /></label>}
        </div>
        {canEdit && <p className="mb-2 text-xs text-slate-400">¿Tienes tus APU en Excel? <a className="underline" href="/plantillas/plantilla-apu.xlsx" download>Descarga la plantilla</a></p>}
        <div className="space-y-2">
          {list.map(a => (
            <div key={a.id} onClick={() => setD({ ...a, items: a.items || [] })} className={'cursor-pointer rounded-xl border bg-white p-4 hover:border-slate-300 ' + (d?.id === a.id ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200')}>
              <p className="text-sm font-semibold">{a.description}</p>
              <p className="mt-0.5 flex justify-between text-xs text-slate-400"><span>{a.code} · por {a.unit}</span><span className="font-medium text-slate-700">{pyg(apuCost(a, map).total)}</span></p>
            </div>
          ))}
          {!list.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">Todavía no hay rubros</p>}
        </div>
      </div>

      <div className="lg:col-span-3">
        {!d ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-16 text-center text-sm text-slate-400">Selecciona un rubro o crea uno nuevo</p> : (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Código</span><input className="inp" disabled={!canEdit} value={d.code || ''} onChange={e => set({ code: e.target.value })} /></label>
              <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-slate-500">Descripción del rubro</span><input className="inp" disabled={!canEdit} value={d.description} onChange={e => set({ description: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Unidad</span><input className="inp" disabled={!canEdit} value={d.unit || ''} onChange={e => set({ unit: e.target.value })} /></label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500"><tr><th className="px-3 py-2">Insumo</th><th className="px-3 py-2">Unid.</th><th className="px-3 py-2 text-right">Precio</th><th className="px-3 py-2">Rendimiento</th><th className="px-3 py-2 text-right">Subtotal</th><th /></tr></thead>
                <tbody>
                  {d.items.map((it, i) => { const ins = map[it.insumo_id]; return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2">{ins?.name || <span className="text-rose-500">Insumo eliminado</span>}</td>
                      <td className="px-3 py-2 text-slate-500">{ins?.unit}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pyg(ins?.price_pyg)}</td>
                      <td className="px-3 py-2"><input className="inp !w-24 !py-1" type="number" step="any" disabled={!canEdit} value={it.yield} onChange={e => setItem(i, { yield: e.target.value })} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{pyg((Number(it.yield) || 0) * (Number(ins?.price_pyg) || 0))}</td>
                      <td className="px-3 py-2 text-right">{canEdit && <button className="rounded p-1 text-rose-500 hover:bg-rose-50" onClick={() => set({ items: d.items.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}</td>
                    </tr>) })}
                  {!d.items.length && <tr><td colSpan={6} className="p-5 text-center text-slate-400">Agrega insumos al rubro</td></tr>}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <select className="inp" value="" onChange={e => e.target.value && set({ items: [...d.items, { insumo_id: e.target.value, yield: 1 }] })}>
                <option value="">+ Agregar insumo del catálogo…</option>
                {insumos.map(i => <option key={i.id} value={i.id}>{i.code} · {i.name} ({i.unit})</option>)}
              </select>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Gastos indirectos (%)</span><input className="inp" type="number" step="any" disabled={!canEdit} value={d.indirects_pct} onChange={e => set({ indirects_pct: e.target.value })} /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-slate-500">Utilidad / beneficio (%)</span><input className="inp" type="number" step="any" disabled={!canEdit} value={d.profit_pct} onChange={e => set({ profit_pct: e.target.value })} /></label>
            </div>
            <div className="space-y-1 rounded-lg bg-slate-50 p-4 text-sm">
              <p className="flex justify-between"><span className="text-slate-500">Costo directo</span><span className="tabular-nums">{pyg(c.direct)}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Gastos indirectos</span><span className="tabular-nums">{pyg(c.ind)}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Utilidad</span><span className="tabular-nums">{pyg(c.profit)}</span></p>
              <p className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><span>Precio unitario final / {d.unit}</span><span className="tabular-nums text-amber-600">{pyg(c.total)}</span></p>
            </div>
            <div className="flex justify-between gap-2">
              <div>{canDelete && d.id && <button className="btn flex items-center gap-1.5 text-rose-600 hover:bg-rose-50" onClick={del}><Trash2 size={14} />Eliminar</button>}</div>
              <div className="flex gap-2"><button className="btn hover:bg-slate-100" onClick={() => setD(null)}>{canEdit ? 'Cancelar' : 'Cerrar'}</button>{canEdit && <button className="btn btn-dark" onClick={save}>Guardar rubro</button>}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
