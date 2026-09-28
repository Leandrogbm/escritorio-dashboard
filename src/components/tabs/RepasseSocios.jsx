import React, { useEffect, useMemo, useState } from "react";
import { Users, Save } from "lucide-react";
import Card from "../Card.jsx";
import KpiCard from "../KpiCard.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../lib/format.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { supabase } from "../../lib/supabaseClient.js";

// Repasse de honorários aos sócios: divide a base do mês (honorários "Pago" com vencimento
// no mês, mesmo critério de regime de caixa do "Caixa do mês" — ver CaixaErp.jsx) por
// percentual configurado em repasse_socios. Sem linha configurada ainda, divide igual entre
// os sócios atuais (default só de exibição, nada gravado até salvar).
export default function RepasseSocios({ orgId, mes, honorarios }) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: socios } = useSupabaseTable("profiles", { select: "id,nome,role", orderBy: "nome", ascending: true, eq: orgEq });
  const sociosAtivos = useMemo(() => socios.filter((p) => p.role === "socio"), [socios]);
  const { data: repasses, refresh } = useSupabaseTable("repasse_socios", { select: "profile_id,percentual", orderBy: "profile_id", eq: orgEq });

  const configurado = repasses.length > 0;
  const [percentuais, setPercentuais] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (configurado) {
      setPercentuais(Object.fromEntries(repasses.map((r) => [r.profile_id, String(r.percentual)])));
    } else if (sociosAtivos.length > 0) {
      const igual = (100 / sociosAtivos.length).toFixed(2);
      setPercentuais(Object.fromEntries(sociosAtivos.map((s) => [s.id, igual])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configurado, repasses, sociosAtivos.length]);

  const baseMes = useMemo(
    () => honorarios.filter((h) => h.status === "Pago" && h.vencimento?.slice(0, 7) === mes).reduce((s, h) => s + Number(h.valor), 0),
    [honorarios, mes]
  );

  const soma = sociosAtivos.reduce((s, p) => s + (Number(percentuais[p.id]) || 0), 0);
  const somaOk = Math.abs(soma - 100) < 0.01;

  const salvar = async () => {
    setErro(null);
    if (!somaOk) { setErro(`A soma dos percentuais precisa ser 100% (está em ${soma.toFixed(2)}%).`); return; }
    setSalvando(true);
    const linhas = sociosAtivos.map((s) => ({ org_id: orgId, profile_id: s.id, percentual: Number(percentuais[s.id]) || 0 }));
    const { error } = await supabase.from("repasse_socios").upsert(linhas, { onConflict: "org_id,profile_id" });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    await refresh();
  };

  if (sociosAtivos.length === 0) {
    return <Card><p className="text-sm" style={{ color: COLORS.slate }}>Nenhum sócio cadastrado ainda (cargo "Sócio" em Equipe).</p></Card>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <KpiCard icon={Users} tone="brass" label="Base do mês (honorários pagos)" value={BRL(baseMes)} valueColor={baseMes ? COLORS.brass : COLORS.slate} />
        <KpiCard
          icon={Save}
          tone={somaOk ? "success" : "wine"}
          label="Soma dos percentuais"
          value={`${soma.toFixed(2)}%`}
          valueColor={somaOk ? COLORS.success : COLORS.wine}
          caption={somaOk ? "Pronto pra salvar" : "Precisa somar 100%"}
        />
      </div>

      {!configurado && (
        <p className="text-sm mb-3" style={{ color: COLORS.slate }}>
          Ainda não configurado — mostrando divisão padrão em partes iguais entre os {sociosAtivos.length} sócio(s).
        </p>
      )}

      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Sócio</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>%</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Valor do repasse</th>
              </tr>
            </thead>
            <tbody>
              {sociosAtivos.map((s) => {
                const pct = Number(percentuais[s.id]) || 0;
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                    <td className="px-4 py-3" style={{ color: COLORS.ink, fontWeight: 600 }}>{s.nome}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={percentuais[s.id] ?? ""}
                        onChange={(e) => setPercentuais((p) => ({ ...p, [s.id]: e.target.value }))}
                        className="w-24 px-2 py-1 rounded-md text-sm"
                        style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}
                      />
                    </td>
                    <td className="px-4 py-3" style={{ color: COLORS.ink }}>{BRL(baseMes * pct / 100)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {erro && <p className="text-sm mt-3" style={{ color: COLORS.wine }}>{erro}</p>}

      <button
        onClick={salvar}
        disabled={salvando}
        className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold mt-4"
        style={{ background: COLORS.ink, color: "#fff", opacity: salvando ? 0.6 : 1 }}
      >
        <Save size={14} /> {salvando ? "Salvando..." : "Salvar percentuais"}
      </button>
    </div>
  );
}
