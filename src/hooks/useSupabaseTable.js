import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

// CRUD genérico reaproveitado por toda aba: useSupabaseTable("clientes") →
// { data, loading, error, insert, update, remove, refresh }.
// `select` deixa customizar joins (ex.: "*, cliente:clientes(nome)"); `orderBy` define ordenação.
// `eq`: [coluna, valor] opcional — usado pelo inspetor de suporte do platform admin, que
// não tem org_id próprio (RLS libera todas as orgs pra ele) e precisa filtrar manualmente
// pra uma empresa por vez.
export function useSupabaseTable(table, { select = "*", orderBy = "created_at", ascending = false, eq } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(table).select(select).order(orderBy, { ascending });
    if (eq) query = query.eq(eq[0], eq[1]);
    const { data: rows, error: err } = await query;
    setData(rows ?? []);
    setError(err?.message ?? null);
    setLoading(false);
  }, [table, select, orderBy, ascending, eq?.[0], eq?.[1]]);

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
