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

  // semSelect: pula o .select() (RETURNING) — necessário quando a visibilidade da linha
  // recém-criada pode depender de uma escrita SEGUINTE (ex.: processo confidencial só fica
  // visível pro criador depois que processo_responsaveis ganha a linha dele). Com RETURNING,
  // a policy de select roda ainda dentro do INSERT e a linha "não visível ainda" derruba o
  // insert inteiro com "new row violates row-level security policy" — mesmo já tendo passado
  // no WITH CHECK do insert. Sem `select()`, o insert não depende de reler a linha de volta.
  const insert = async (values, { semSelect = false } = {}) => {
    // eq=["org_id", X]: contexto de organização explícito (usado pelo platform admin
    // operando em empresa alheia — set_org_id() só respeita org_id explícito vindo dele).
    // Sem isso, um insert dentro do "Entrar" de outra empresa cairia na empresa do próprio
    // platform admin.
    const comOrg = eq?.[0] === "org_id"
      ? (Array.isArray(values) ? values.map((v) => ({ ...v, org_id: eq[1] })) : { ...values, org_id: eq[1] })
      : values;
    let query = supabase.from(table).insert(comOrg);
    if (!semSelect) query = query.select();
    const { data, error: err } = await query;
    if (err) throw err;
    await refresh();
    return data;
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
