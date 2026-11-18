export const pyg = n => '₲ ' + Math.round(Number(n) || 0).toLocaleString('es-PY')
export const usd = n => '$ ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
