import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTable } from '../hooks/useTable'

export default function Crud({ cfg, canEdit, canDelete, toast }) {
  const { rows, loading } = useTable(cfg.table, cfg.order)
  const [q, setQ] = useState('')
  const [chip, setChip] = useState('')
  const [edit, setEdit] = useState(null) // null = cerrado · {} = nuevo · fila = editar

  const list = useMemo(() => rows.filter(r =>
    (!chip || r.category === chip) && Object.values(r).join(' ').toLowerCase().includes(q.toLowerCase())), [rows, q, chip])

  const save = async e => {
    e.preventDefault()
    const v = Object.fromEntries(new FormData(e.target))
    cfg.fields.forEach(f => { v[f.name] = f.type === 'number' ? Number(v[f.name]) || 0 : (v[f.name] || null) })
    if (cfg.table === 'sgo_insumos') v.price_updated = new Date().toISOString().slice(0, 10)
    const { error } = edit.id ? await supabase.from(cfg.table).update(v).eq('id', edit.id) : await supabase.from(cfg.table).insert(v)
    if (error) return toast(error.code === '23505' ? 'Ya existe un registro con ese código' : error.message, true)
    setEdit(null); toast('Guardado')
  }
  const del = async r => {
    if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return
    const { error } = await supabase.from(cfg.table).delete().eq('id', r.id)
    toast(error ? error.message : 'Eliminado', !!error)
  }
  const chipCls = on => 'btn ' + (on ? 'btn-dark' : 'border border-slate-200 bg-white hover:bg-slate-50')

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="inp max-w-xs" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
        {cfg.chips && <>
          <button className={chipCls(!chip)} onClick={() => setChip('')}>Todos</button>
          {cfg.chips.map(c => <button key={c} className={chipCls(chip === c)} onClick={() => setChip(c)}>{c}</button>)}
        </>}
        {canEdit && <button className="btn btn-dark ml-auto flex items-center gap-1.5" onClick={() => setEdit({})}><Plus size={16} />Nuevo {cfg.one}</button>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>{cfg.cols.map(c => <th key={c.k} className={'px-4 py-3 ' + (c.num ? 'text-right' : '')}>{c.l}</th>)}<th /></tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                {cfg.cols.map(c => <td key={c.k} className={'whitespace-nowrap px-4 py-3 ' + (c.num ? 'text-right tabular-nums' : '')}>{c.f ? c.f(r) : (r[c.k] ?? '—')}</td>)}
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {canEdit && <button title="Editar" className="rounded p-2 text-slate-500 hover:bg-slate-100" onClick={() => setEdit(r)}><Pencil size={15} /></button>}
                  {canDelete && <button title="Eliminar" className="rounded p-2 text-rose-500 hover:bg-rose-50" onClick={() => del(r)}><Trash2 size={15} /></button>}
                </td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={9} className="p-10 text-center text-slate-400">{loading ? 'Cargando…' : 'Sin registros'}</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <form onSubmit={save} className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-semibold">{edit.id ? 'Editar' : 'Nuevo'} {cfg.one}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {cfg.fields.map(f => (
                <label key={f.name} className={'block ' + (f.wide ? 'sm:col-span-2' : '')}>
                  <span className="mb-1 block text-xs font-medium text-slate-500">{f.label}</span>
                  {f.type === 'select'
                    ? <select className="inp" name={f.name} defaultValue={edit[f.name] ?? (f.blank ? '' : f.options[0])}>{f.blank && <option value="">— Sin asignar —</option>}{f.options.map(o => typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.v} value={o.v}>{o.l}</option>)}</select>
                    : <input className="inp" name={f.name} type={f.type || 'text'} step="any" required={f.required} defaultValue={edit[f.name] ?? ''} />}
                </label>
              ))}
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
