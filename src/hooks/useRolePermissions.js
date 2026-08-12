import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { ROLES } from "../config/permissions.js";

// Substitui o antigo DEFAULT_PERMISSIONS (useState local) pela tabela role_permissions.
// Mesmo shape { role: [moduleKey, ...] } que ConfigTab.jsx já espera — ConfigTab não muda.
export function useRolePermissions(orgId) {
  const [permissions, setPermissions] = useState(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("role_permissions").select("role, module").eq("org_id", orgId);
    const byRole = Object.fromEntries(ROLES.map((r) => [r.key, []]));
    for (const row of data ?? []) byRole[row.role]?.push(row.module);
    setPermissions(byRole);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const togglePermission = async (role, moduleKey) => {
    const has = permissions?.[role]?.includes(moduleKey);
    // update otimista, revalida com o banco em seguida
    setPermissions((prev) => ({
      ...prev,
      [role]: has ? prev[role].filter((k) => k !== moduleKey) : [...prev[role], moduleKey],
    }));
    if (has) {
      await supabase.from("role_permissions").delete().match({ org_id: orgId, role, module: moduleKey });
    } else {
      await supabase.from("role_permissions").insert({ org_id: orgId, role, module: moduleKey });
    }
    load();
  };

  return { permissions, togglePermission, loading: permissions === null };
}
