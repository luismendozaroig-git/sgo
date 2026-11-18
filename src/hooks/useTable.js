import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Carga una tabla y se actualiza sola cuando alguien (PC o celular) cambia un dato (Supabase Realtime).
export function useTable(table, order = 'created_at') {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    const { data } = await supabase.from(table).select('*').order(order, { ascending: false })
    if (data) setRows(data)
    setLoading(false)
  }, [table, order])
  useEffect(() => {
    load()
    const ch = supabase.channel('rt-' + table + Math.random().toString(36).slice(2, 7))
      .on('postgres_changes', { event: '*', schema: 'public', table }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, table])
  return { rows, loading }
}
