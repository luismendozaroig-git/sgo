import { pyg, usd } from '../lib/format'
export const CATS = ['Materiales', 'Mano de Obra', 'Maquinarias']
// Cada módulo de catálogo se define aquí: tabla, columnas y campos del formulario.
export const cruds = rate => ({
  clients: {
    table: 'sgo_clients', one: 'cliente',
    cols: [{ k: 'name', l: 'Nombre' }, { k: 'ruc', l: 'RUC' }, { k: 'contact', l: 'Contacto' }, { k: 'phone', l: 'Teléfono' }, { k: 'email', l: 'Correo' }],
    fields: [{ name: 'name', label: 'Nombre / Razón Social', required: true, wide: true }, { name: 'ruc', label: 'RUC' }, { name: 'contact', label: 'Contacto' },
      { name: 'phone', label: 'Teléfono' }, { name: 'email', label: 'Correo', type: 'email' }, { name: 'address', label: 'Dirección', wide: true }]
  },
  suppliers: {
    table: 'sgo_suppliers', one: 'proveedor', chips: CATS,
    cols: [{ k: 'name', l: 'Razón Social' }, { k: 'ruc', l: 'RUC' }, { k: 'category', l: 'Categoría' }, { k: 'contact', l: 'Contacto' }, { k: 'phone', l: 'Teléfono' }, { k: 'status', l: 'Estado' }],
    fields: [{ name: 'name', label: 'Razón Social', required: true, wide: true }, { name: 'ruc', label: 'RUC' }, { name: 'category', label: 'Categoría', type: 'select', options: CATS },
      { name: 'contact', label: 'Persona de contacto' }, { name: 'phone', label: 'Teléfono' }, { name: 'email', label: 'Correo', type: 'email' },
      { name: 'status', label: 'Estado', type: 'select', options: ['Activo', 'Inactivo'] }]
  },
  insumos: {
    table: 'sgo_insumos', one: 'insumo', chips: CATS, order: 'code',
    cols: [{ k: 'code', l: 'Código' }, { k: 'name', l: 'Descripción' }, { k: 'category', l: 'Categoría' }, { k: 'unit', l: 'Unidad' },
      { k: 'price_pyg', l: 'Precio ₲', num: true, f: r => pyg(r.price_pyg) }, { k: 'usd', l: 'USD', num: true, f: r => usd(r.price_pyg / rate) }, { k: 'price_updated', l: 'Actualizado' }],
    fields: [{ name: 'code', label: 'Código' }, { name: 'name', label: 'Descripción', required: true }, { name: 'category', label: 'Categoría', type: 'select', options: CATS },
      { name: 'unit', label: 'Unidad (bolsa, kg, m3, jornal…)' }, { name: 'price_pyg', label: 'Precio unitario (₲)', type: 'number' }]
  }
})
