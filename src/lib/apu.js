// Costo de un rubro APU con los precios ACTUALES de los insumos (se recalcula solo al cambiar un precio).
export function apuCost(apu, insumosById) {
  const direct = (apu.items || []).reduce((s, it) => s + (Number(it.yield) || 0) * (Number(insumosById[it.insumo_id]?.price_pyg) || 0), 0)
  const ind = direct * (Number(apu.indirects_pct) || 0) / 100
  const profit = (direct + ind) * (Number(apu.profit_pct) || 0) / 100
  return { direct, ind, profit, total: direct + ind + profit }
}
