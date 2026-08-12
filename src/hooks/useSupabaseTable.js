import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

// CRUD genérico reaproveitado por toda aba: useSupabaseTable("clientes") →
// { data, loading, error, insert, update, remove, refresh }.
// `select` deixa customizar joins (ex.: "*, cliente:clientes(nome)"); `orderBy` define ordenação.
export function useSupabaseTable(table, { select = "*", orderBy = "created_at", ascending = false } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: rows, error: err } = await supabase.from(table).select(select).order(orderBy, { ascending });
    setData(rows ?? []);
    setError(err?.message ?? null);
    setLoading(false);
  }, [table, select, orderBy, ascending]);

  useEffect(() => { refresh(); }, [refresh]);

  const insert = async (values) => {
    const { error: err } = await supabase.from(table).insert(values);
    if (err) throw err;
    await refresh();
  };
  const update = async (id, values) => {
    const { error: err } = await supabase.from(table).update(values).eq("id", id);
    if (err) throw err;
    await refresh();
  };
  const remove = async (id) => {
    const { error: err } = await supabase.from(table).delete().eq("id", id);
    if (err) throw err;
    await refresh();
  };

  return { data, loading, error, insert, update, remove, refresh };
}
