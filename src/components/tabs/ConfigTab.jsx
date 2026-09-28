import React, { useEffect, useState } from "react";
import { Settings, ShieldCheck, Plug, ChevronDown, Bell } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import { COLORS } from "../../lib/theme.js";
import { ROLES, MODULES } from "../../config/permissions.js";
import ApiKeysSection from "../ApiKeysSection.jsx";
import IntegracoesSection from "../IntegracoesSection.jsx";
import { supabase } from "../../lib/supabaseClient.js";

// Toggle de opt-in dos lembretes automáticos de cobrança por e-mail (ver Edge Function
// cobranca-lembretes). ConfigTab só é alcançável por admin/sócio (Sidebar.jsx já filtra).
function LembretesCobrancaSection({ orgId }) {
  const [ligado, setLigado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase.from("organizations").select("lembretes_cobranca").eq("id", orgId).single();
      setLigado(!!data?.lembretes_cobranca);
      setCarregando(false);
    })();
  }, [orgId]);

  const alternar = async () => {
    setSalvando(true);
    const novo = !ligado;
    const { error } = await supabase.from("organizations").update({ lembretes_cobranca: novo }).eq("id", orgId);
    setSalvando(false);
    if (error) return alert(error.message);
    setLigado(novo);
  };

  if (carregando) return null;
  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <Bell size={17} color={COLORS.brass} />
          <span>
            <span className="block text-sm font-semibold" style={{ color: COLORS.ink }}>Lembretes de cobrança</span>
            <span className="block text-xs" style={{ color: COLORS.slate }}>
              E-mail automático pro cliente 3 dias antes do vencimento, no dia e 3 dias depois de cada honorário em aberto, com Pix copia-e-cola se configurado em Minha Empresa.
            </span>
          </span>
        </span>
        <button
          onClick={alternar}
          disabled={salvando}
          className="w-10 h-6 rounded-full relative shrink-0"
          style={{ background: ligado ? COLORS.success : COLORS.line }}
          aria-label={ligado ? "Desligar lembretes de cobrança" : "Ligar lembretes de cobrança"}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
            style={{ left: ligado ? 18 : 2 }}
          />
        </button>
      </div>
    </Card>
  );
}

// API pública e Integrações são uso raro (maioria dos escritórios nunca mexe nisso) — vinham
// sempre abertas ocupando a tela toda. Recolhidas por padrão, mesmo gesto de clicar-pra-abrir
// que os itens de dentro de IntegracoesSection (D4Sign/Escavador/Trello) já usam.
function SecaoRecolhivel({ icon: Icon, titulo, subtitulo, children }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Card className="mt-4 !p-0 overflow-hidden">
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex items-center gap-2.5">
          <Icon size={17} color={COLORS.brass} />
          <span>
            <span className="block text-sm font-semibold" style={{ color: COLORS.ink }}>{titulo}</span>
            <span className="block text-xs" style={{ color: COLORS.slate }}>{subtitulo}</span>
          </span>
        </span>
        <ChevronDown size={18} color={COLORS.slate} style={{ transform: aberto ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
      </button>
      {aberto && <div className="px-5 pb-5" style={{ borderTop: `1px solid ${COLORS.line}` }}>{children}</div>}
    </Card>
  );
}

export default function ConfigTab({ permissions, togglePermission, orgId }) {
  return (
    <div>
      <SectionTitle icon={Settings} title="Configurações" subtitle="Defina quais abas cada perfil enxerga no dashboard" />
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: COLORS.ink }}>
              <th className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>PERFIL</th>
              {MODULES.map((m) => (
                <th key={m.key} className="text-center px-3 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{m.label.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.filter((r) => r.key !== "admin").map((r, i) => (
              <tr key={r.key} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                <td className="px-4 py-3 font-medium" style={{ color: COLORS.ink }}>{r.label}</td>
                {MODULES.map((m) => {
                  const checked = permissions[r.key].includes(m.key);
                  return (
                    <td key={m.key} className="text-center px-3 py-3">
                      <button
                        onClick={() => togglePermission(r.key, m.key)}
                        className="w-5 h-5 rounded inline-flex items-center justify-center"
                        style={{
                          border: `1.5px solid ${checked ? COLORS.success : COLORS.slate}`,
                          background: checked ? COLORS.success : "transparent",
                        }}
                        aria-label={`${checked ? "Remover" : "Conceder"} acesso de ${r.label} a ${m.label}`}
                      >
                        {checked && <ShieldCheck size={13} color="#fff" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
      <p className="text-xs mt-3" style={{ color: COLORS.slate }}>
        O perfil Administrador(a) sempre enxerga todos os módulos e não pode ser restringido por aqui.
      </p>

      {/* ponytail: API pública segurada a pedido do usuário — tabela api_keys e a Edge
          Function api-gateway continuam intactas, só a UI some. Reativar: tirar o "false &&". */}
      {false && <ApiKeysSection orgId={orgId} />}

      <LembretesCobrancaSection orgId={orgId} />

      <SecaoRecolhivel icon={Plug} titulo="Integrações" subtitulo="D4Sign, Escavador, Trello — clique no nome pra ver os campos">
        <IntegracoesSection orgId={orgId} />
      </SecaoRecolhivel>
    </div>
  );
}
