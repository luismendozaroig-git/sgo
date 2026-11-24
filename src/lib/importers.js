import { supabase } from './supabase'
import { CATS } from '../views/cruds'

// Importadores de Excel. Cada uno recibe las filas (sin encabezado) y los datos actuales (ctx); devuelve un mensaje de resultado.
const txt = v => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim())
const norm = v => String(v ?? '').trim().toLowerCase()
const entero = v => (typeof v === 'number' ? Math.round(v) : Number(String(v ?? '').replace(/\D/g, ''))) || 0
const coord = v => { const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')); return v === null || v === '' || v === undefined || Number.isNaN(n) ? null : n }
const pct = v => Math.min(100, Math.max(0, Number(String(v ?? '').replace(',', '.')) || 0))
const cat = v => CATS.find(c => norm(c) === norm(v)) || null
const hoy = () => new Date().toISOString().slice(0, 10)
const fecha = v => {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim(), m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}
const need = rows => { if (!rows.length) throw new Error('No se encontraron filas válidas. Revisa que el archivo use la plantilla.'); return rows }
const fail = error => { if (error) throw new Error(error.message) }
const ins = async (table, data) => fail((await supabase.from(table).insert(data)).error)
const ups = async (table, data) => fail((await supabase.from(table).upsert([...new Map(data.map(d => [d.code, d])).values()], { onConflict: 'code' })).error)
// Crea los registros que faltan (por nombre) y devuelve {nombre → id}
const crearFaltantes = async (table, existentes, nombres, extra = () => ({})) => {
  const ids = Object.fromEntries(existentes.map(x => [norm(x.name), x.id]))
  const faltan = [...new Map(nombres.filter(n => n && !ids[norm(n)]).map(n => [norm(n), n])).values()]
  if (faltan.length) {
    const { data, error } = await supabase.from(table).insert(faltan.map(name => ({ name, ...extra(name) }))).select('id,name')
    fail(error); data.forEach(x => { ids[norm(x.name)] = x.id })
  }
  return { ids, creados: faltan.length }
}

export const IMPORTS = {
  clients: {
    label: 'Clientes', file: 'plantilla-clientes.xlsx', desc: 'Nombre, RUC, contacto, teléfono, correo y dirección. Los que ya existen (por nombre) se omiten.',
    run: async (rows, ctx) => {
      const todo = need(rows.filter(r => r[0])), vistos = new Set(ctx.clients.map(c => norm(c.name))), nuevos = []
      todo.forEach(r => { if (vistos.has(norm(r[0]))) return; vistos.add(norm(r[0])); nuevos.push({ name: txt(r[0]), ruc: txt(r[1]), contact: txt(r[2]), phone: txt(r[3]), email: txt(r[4]), address: txt(r[5]) }) })
      if (nuevos.length) await ins('sgo_clients', nuevos)
      return `${nuevos.length} cliente(s) nuevo(s)` + (todo.length > nuevos.length ? ` · ${todo.length - nuevos.length} omitido(s) por ya existir` : '')
    }
  },
  suppliers: {
    label: 'Proveedores', file: 'plantilla-proveedores.xlsx', desc: 'Razón social, RUC, categoría, contacto, teléfono, correo y estado. Los que ya existen (por nombre) se omiten.',
    run: async (rows, ctx) => {
      const todo = need(rows.filter(r => r[0])), vistos = new Set(ctx.suppliers.map(s => norm(s.name))), nuevos = []
      todo.forEach(r => { if (vistos.has(norm(r[0]))) return; vistos.add(norm(r[0])); nuevos.push({ name: txt(r[0]), ruc: txt(r[1]), category: cat(r[2]), contact: txt(r[3]), phone: txt(r[4]), email: txt(r[5]), status: norm(r[6]) === 'inactivo' ? 'Inactivo' : 'Activo' }) })
      if (nuevos.length) await ins('sgo_suppliers', nuevos)
      return `${nuevos.length} proveedor(es) nuevo(s)` + (todo.length > nuevos.length ? ` · ${todo.length - nuevos.length} omitido(s) por ya existir` : '')
    }
  },
  insumos: {
    label: 'Insumos', file: 'plantilla-insumos.xlsx', desc: 'Código, descripción, categoría, unidad, precio y proveedor. Si el código ya existe, se actualiza el precio. Si el proveedor no existe, se crea.',
    run: async (rows, ctx) => {
      const todo = need(rows.filter(r => r[1]))
      const { ids, creados } = await crearFaltantes('sgo_suppliers', ctx.suppliers, todo.map(r => txt(r[5])), () => ({}))
      const filas = todo.map(r => ({ code: txt(r[0]), name: txt(r[1]), category: cat(r[2]), unit: txt(r[3]), price_pyg: entero(r[4]), supplier_id: r[5] ? ids[norm(r[5])] : null, price_updated: hoy() }))
      const con = filas.filter(f => f.code), sin = filas.filter(f => !f.code), existentes = new Set(ctx.insumos.map(i => i.code))
      if (con.length) await ups('sgo_insumos', con)
      if (sin.length) await ins('sgo_insumos', sin)
      const act = con.filter(f => existentes.has(f.code)).length
      return `${filas.length - act} insumo(s) nuevo(s) · ${act} actualizado(s)` + (creados ? ` · ${creados} proveedor(es) creado(s)` : '')
    }
  },
  apu: {
    label: 'Análisis APU', file: 'plantilla-apu.xlsx', desc: 'Una fila por insumo de cada rubro. El código de insumo debe existir en el paso 3. Si el rubro ya existe, se reemplaza su composición.',
    run: async (rows, ctx) => {
      const porCodigo = Object.fromEntries(ctx.insumos.filter(i => i.code).map(i => [norm(i.code), i.id]))
      const rubros = {}, faltan = new Set()
      need(rows.filter(r => r[0] && r[1])).forEach(([code, desc, unit, ind, util, icode, rend]) => {
        const k = String(code).trim()
        const R = rubros[k] ||= { code: k, description: txt(desc), unit: txt(unit), indirects_pct: Number(ind) || 0, profit_pct: Number(util) || 0, items: [] }
        if (!icode) return
        const id = porCodigo[norm(icode)]
        if (id) R.items.push({ insumo_id: id, yield: Number(rend) || 0 }); else faltan.add(String(icode).trim())
      })
      const lista = Object.values(rubros)
      await ups('sgo_apu', lista)
      return `${lista.length} rubro(s) importado(s)` + (faltan.size ? ` · Insumos no encontrados (omitidos): ${[...faltan].slice(0, 8).join(', ')}` : '')
    }
  },
  obras: {
    label: 'Obras', file: 'plantilla-obras.xlsx', desc: 'Código, nombre, cliente, dirección, coordenadas, presupuesto, estado, supervisor, fechas y avances. Si el código existe, la obra se actualiza. Si el cliente no existe, se crea.',
    run: async (rows, ctx) => {
      const todo = need(rows.filter(r => r[1]))
      const { ids, creados } = await crearFaltantes('sgo_clients', ctx.clients, todo.map(r => txt(r[2])))
      const usados = new Set(ctx.obras.map(o => o.code)), anio = new Date().getFullYear()
      let n = ctx.obras.length, nuevas = 0
      const lista = todo.map(r => {
        let code = txt(r[0]) || ''
        while (!code) { n++; const c = 'OB-' + anio + '-' + String(n).padStart(2, '0'); if (!usados.has(c)) code = c }
        if (!usados.has(code)) nuevas++
        usados.add(code)
        const status = ['En Proceso', 'Finalizada', 'Pausada'].find(s => norm(s) === norm(r[7])) || 'En Proceso'
        const budget = entero(r[6]), real = pct(r[12])
        return { code, name: txt(r[1]), client_id: r[2] ? ids[norm(r[2])] : null, address: txt(r[3]), lat: coord(r[4]), lng: coord(r[5]), budget_pyg: budget, status,
          supervisor: txt(r[8]), start_date: fecha(r[9]), end_date: fecha(r[10]), planned_progress: pct(r[11]), real_progress: real, executed_pyg: Math.round(budget * real / 100) }
      })
      await ups('sgo_obras', lista)
      return `${nuevas} obra(s) nueva(s) · ${lista.length - nuevas} actualizada(s)` + (creados ? ` · ${creados} cliente(s) creado(s)` : '')
    }
  }
}
