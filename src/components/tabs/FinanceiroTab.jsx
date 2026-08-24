import React, { useMemo, useRef, useState } from "react";
import { DollarSign, Plus, X, Upload, Wallet } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import StatusPicker from "../StatusPicker.jsx";
import RowActions from "../RowActions.jsx";
import RecordFormModal from "../RecordFormModal.jsx";
import SearchInput from "../SearchInput.jsx";
import ImportarExtratoModal from "./ImportarExtratoModal.jsx";
import ClienteBell from "../ClienteBell.jsx";
import { COLORS } from "../../lib/theme.js";
import { BRL } from "../../data/mockData.js";
import { useSupabaseTable } from "../../hooks/useSupabaseTable.js";
import { useEscClose } from "../../hooks/useEscClose.js";
import { supabase } from "../../lib/supabaseClient.js";

const STATUS_OPTIONS = [
  { value: "Em aberto", label: "Em aberto" },
  { value: "Vencido", label: "Vencido" },
  { value: "Pago", label: "Pago" },
];

// Um mês certinho depois — cai no mesmo dia do mês seguinte. Meses com menos dias que o
// vencimento original "estouram" pro mês seguinte (ex.: 31/jan + 1 mês = 03/mar), efeito
// nativo do Date; aceitável aqui, ajustar manualmente se cair num vencimento raro assim.
function addMonths(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

const hojeStr = new Date().toISOString().slice(0, 10);
const mesAtual = hojeStr.slice(0, 7);
const estaAtrasado = (h) => h.status === "Vencido" || (h.status === "Em aberto" && h.vencimento < hojeStr);

export default function FinanceiroTab({ orgId } = {}) {
  const orgEq = orgId ? ["org_id", orgId] : undefined;
  const { data: honorarios, loading, insert, update, remove, refresh } = useSupabaseTable("honorarios", {
    select: "*, cliente:clientes(id,nome,tipo)", eq: orgEq,
  });
  const { data: clientes } = useSupabaseTable("clientes", { select: "id,nome,tipo", orderBy: "nome", ascending: true, eq: orgEq });
  const { data: processos } = useSupabaseTable("processos", { select: "id,numero,area,cliente_id", orderBy: "numero", ascending: true, eq: orgEq });
  const { data: orgRows } = useSupabaseTable("organizations", { select: "asaas_token", eq: orgId ? ["id", orgId] : undefined });
  // ponytail: Asaas construído e testado, mas segurado em back log a pedido do usuário —
  // não subir pro cliente ainda (ver ROADMAP-comparativo.md). "&& false" esconde o botão
  // sem tirar o resto do código; reativar removendo o "&& false".
  const asaasConectado = !!orgRows[0]?.asaas_token && false;
  const [gerandoCobranca, setGerandoCobranca] = useState(null); // id do honorário sendo gerado
  const [erroCobranca, setErroCobranca] = useState("");

  const gerarCobrancaAsaas = async (honorarioId) => {
    setGerandoCobranca(honorarioId);
    setErroCobranca("");
    const { data, error } = await supabase.functions.invoke("asaas-criar-cobranca", { body: { honorarioId } });
    setGerandoCobranca(null);
    if (error) {
      setErroCobranca((await error.context?.json?.().catch(() => null))?.error ?? error.message);
      return;
    }
    await refresh();
    window.open(data.invoiceUrl, "_blank");
  };
  const { data: notificacoesTodas, refresh: refreshNotificacoesPagamento } = useSupabaseTable("notificacoes", { select: "id, tipo, honorario_id, titulo, texto", eq: orgEq });
  // Notificação não guarda cliente_id direto — só honorario_id — então casa pelo mapa
  // honorario→cliente que já vem de `honorarios` (join que já buscamos de qualquer jeito).
  const notificacoesPorCliente = useMemo(() => {
    const honorarioParaCliente = new Map(honorarios.map((h) => [h.id, h.cliente?.id]));
    const map = new Map();
    for (const n of notificacoesTodas) {
      if (n.tipo !== "pagamento_possivel") continue;
      const clienteId = honorarioParaCliente.get(n.honorario_id);
      if (!clienteId) continue;
      if (!map.has(clienteId)) map.set(clienteId, []);
      map.get(clienteId).push(n);
    }
    return map;
  }, [notificacoesTodas, honorarios]);
  const [editing, setEditing] = useState(null); // {} = novo (do topo), {cliente_id} = novo já com cliente, {...} = editando
  const [selecionado, setSelecionado] = useState(null); // cliente_id aberto no painel de detalhe
  const [busca, setBusca] = useState("");
  const [arquivoExtrato, setArquivoExtrato] = useState(null); // File escolhido — abre o toast de resultado
  const fileInputRef = useRef(null);
  useEscClose(() => setSelecionado(null), !!selecionado);

  // Seletor de arquivo dispara direto no clique do botão (dentro do próprio handler, gesto
  // síncrono do usuário) — sem popup no meio pra escolher de novo, e funciona no Safari/iOS,
  // que exige o seletor nativo aberto no mesmo tick do clique real.
  const escolherArquivoExtrato = () => fileInputRef.current?.click();
  const arquivoExtratoEscolhido = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (file) setArquivoExtrato(file);
  };

  // Resumo por cliente — PF mostra como "parcelas", PJ como "mensalidade", mas o dado é o
  // mesmo (uma linha em honorarios por cobrança); só muda o texto na hora de criar/exibir.
  const porCliente = useMemo(() => {
    const map = new Map(clientes.map((c) => [c.id, { ...c, total: 0, recebido: 0, pendente: 0, atrasado: 0, itens: [] }]));
    for (const h of honorarios) {
      const c = map.get(h.cliente?.id);
      if (!c) continue;
      c.total += h.valor;
      c.itens.push(h);
      if (h.status === "Pago") c.recebido += h.valor;
      else if (estaAtrasado(h)) c.atrasado += h.valor;
      else c.pendente += h.valor;
    }
    return [...map.values()];
  }, [clientes, honorarios]);

  const clienteAberto = porCliente.find((c) => c.id === selecionado) ?? null;
  const porClienteFiltrado = porCliente.filter((c) => c.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  const faturamentoMes = honorarios.filter((h) => h.vencimento?.slice(0, 7) === mesAtual).reduce((s, h) => s + h.valor, 0);
  const recebidoMes = honorarios.filter((h) => h.vencimento?.slice(0, 7) === mesAtual && h.status === "Pago").reduce((s, h) => s + h.valor, 0);
  const pendenteMes = honorarios.filter((h) => h.vencimento?.slice(0, 7) === mesAtual && h.status === "Em aberto").reduce((s, h) => s + h.valor, 0);
  const atrasadosTodos = honorarios.filter(estaAtrasado);
  const totalAtrasado = atrasadosTodos.reduce((s, h) => s + h.valor, 0);

  const clienteParaForm = editing?.cliente_id ? clientes.find((c) => c.id === editing.cliente_id) : null;
  const ehPJ = clienteParaForm?.tipo === "PJ";

  const processosDoCliente = editing?.cliente_id ? processos.filter((p) => p.cliente_id === editing.cliente_id) : [];

  const fields = useMemo(() => {
    const base = [
      { key: "cliente_id", label: "Cliente", type: "select", options: clientes.map((c) => ({ value: c.id, label: `${c.nome} (${c.tipo})` })) },
      // ponytail: campo "Processo" (rentabilidade por área) construído mas em back log a
      // pedido do usuário — escondido do form até o gráfico voltar a aparecer na Visão
      // Executiva. Coluna honorarios.processo_id continua existindo, só não é preenchida
      // por aqui enquanto isso.
      { key: "valor", label: editing?.id ? "Valor (R$)" : ehPJ ? "Valor da mensalidade (R$)" : "Valor de cada parcela (R$)", type: "number" },
      { key: "vencimento", label: editing?.id ? "Vencimento" : "Vencimento da 1ª cobrança", type: "date" },
    ];
    if (!editing?.id) {
      base.push({
        key: "parcelas",
        label: ehPJ ? "Gerar quantos meses de mensalidade de uma vez?" : "Repetir mensalmente por quantas parcelas? (1 = cobrança única)",
        type: "number", optional: true,
      });
    }
    base.push({ key: "status", label: "Situação", type: "select", options: STATUS_OPTIONS });
    return base;
  }, [clientes, editing, ehPJ, processosDoCliente]);

  const salvar = ({ parcelas, ...values }) => {
    if (editing?.id) return update(editing.id, values);
    const n = Math.min(120, Math.max(1, parseInt(parcelas, 10) || 1)); // teto de 10 anos
    const linhas = n === 1 ? values : Array.from({ length: n }, (_, i) => ({ ...values, vencimento: addMonths(values.vencimento, i) }));
    return insert(linhas).then(() => setSelecionado((s) => s ?? values.cliente_id));
  };

  return (
    <div>
      <SectionTitle
        icon={DollarSign}
        title="Financeiro"
        subtitle="Faturamento por cliente — parcelas (PF) e mensalidades (PJ)"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar cliente..." />
            <button onClick={escolherArquivoExtrato} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
              <Upload size={14} /> Importar extrato
            </button>
            <input ref={fileInputRef} type="file" accept=".ofx,.csv,.txt,.pdf,image/*" className="hidden" onChange={arquivoExtratoEscolhido} />
            <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
              <Plus size={14} /> Novo
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Faturamento do mês</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.ink }}>{BRL(faturamentoMes)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Recebido no mês</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.success }}>{BRL(recebidoMes)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Pendente no mês</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.brass }}>{BRL(pendenteMes)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide" style={{ color: COLORS.slate }}>Em atraso (total)</p>
          <p className="text-2xl mt-1" style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, color: COLORS.wine }}>{BRL(totalAtrasado)}</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.slate }}>{atrasadosTodos.length} cobrança(s) atrasada(s)</p>
        </Card>
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: COLORS.ink }}>
              {["Cliente", "Tipo", "Total", "Recebido", "Pendente", "Atrasado"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && porClienteFiltrado.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm" style={{ color: COLORS.slate }}>{busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</td></tr>
            )}
            {porClienteFiltrado.map((c, i) => (
              <tr key={c.id} onClick={() => setSelecionado(c.id)} className="cursor-pointer"
                style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                <td className="px-4 py-3" style={{ color: COLORS.ink, fontWeight: 600 }}>
                  <div className="flex items-center gap-1.5">
                    {c.nome}
                    <ClienteBell notificacoes={notificacoesPorCliente.get(c.id) ?? []} onMudou={() => { refreshNotificacoesPagamento(); refresh(); }} />
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.tipo}</td>
                <td className="px-4 py-3" style={{ color: COLORS.ink }}>{BRL(c.total)}</td>
                <td className="px-4 py-3" style={{ color: COLORS.success }}>{BRL(c.recebido)}</td>
                <td className="px-4 py-3" style={{ color: COLORS.brass }}>{BRL(c.pendente)}</td>
                <td className="px-4 py-3" style={{ color: c.atrasado ? COLORS.wine : COLORS.slate }}>{BRL(c.atrasado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      {clienteAberto && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelecionado(null)}>
          <div className="w-full max-w-lg h-full overflow-y-auto p-6" style={{ background: COLORS.paper, borderLeft: `1px solid ${COLORS.line}`, boxShadow: "-20px 0 48px rgba(22,35,59,0.18)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p style={{ fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 18, color: COLORS.ink }}>{clienteAberto.nome}</p>
                <p className="text-xs" style={{ color: COLORS.slate }}>{clienteAberto.tipo === "PJ" ? "Mensalidade fixa" : "Parcelas"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing({ cliente_id: clienteAberto.id })} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff" }}>
                  <Plus size={14} /> {clienteAberto.tipo === "PJ" ? "Mensalidade" : "Parcela"}
                </button>
                <button onClick={() => setSelecionado(null)} className="p-2 rounded hover:opacity-70" style={{ color: COLORS.slate }}><X size={18} /></button>
              </div>
            </div>

            {erroCobranca && <p className="text-xs mb-3" style={{ color: COLORS.wine }}>{erroCobranca}</p>}

            <Card className="overflow-hidden !p-0">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr><th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>VALOR</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>VENCIMENTO</th>
                    <th className="text-left px-4 py-2 font-medium" style={{ color: COLORS.slate, fontSize: 11 }}>SITUAÇÃO</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clienteAberto.itens.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-4 text-center" style={{ color: COLORS.slate }}>Nenhuma cobrança ainda.</td></tr>
                  )}
                  {[...clienteAberto.itens].sort((a, b) => a.vencimento.localeCompare(b.vencimento)).map((h) => (
                    <tr key={h.id} style={{ borderTop: `1px solid ${COLORS.line}` }}>
                      <td className="px-4 py-2 font-semibold" style={{ color: COLORS.ink }}>{BRL(h.valor)}</td>
                      <td className="px-4 py-2" style={{ color: COLORS.slate }}>{new Date(`${h.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <StatusPicker
                          value={h.status}
                          options={STATUS_OPTIONS.map((s) => s.value)}
                          tone={{ "Em aberto": estaAtrasado(h) ? "urgent" : "warn", Vencido: "urgent", Pago: "ok" }}
                          onChange={(status) => update(h.id, { status })}
                        />
                        {asaasConectado && h.status !== "Pago" && (
                          h.asaas_invoice_url ? (
                            <a href={h.asaas_invoice_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs underline mt-1" style={{ color: COLORS.brass }}>
                              <Wallet size={11} /> Ver cobrança Asaas
                            </a>
                          ) : (
                            <button onClick={() => gerarCobrancaAsaas(h.id)} disabled={gerandoCobranca === h.id} className="flex items-center gap-1 text-xs underline mt-1" style={{ color: COLORS.brass, opacity: gerandoCobranca === h.id ? 0.5 : 1 }}>
                              <Wallet size={11} /> {gerandoCobranca === h.id ? "Gerando..." : "Gerar cobrança Asaas"}
                            </button>
                          )
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <RowActions
                          onEdit={() => setEditing({ ...h, cliente_id: h.cliente?.id })}
                          onDelete={() => remove(h.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      <RecordFormModal
        open={editing !== null}
        title={editing?.id ? "Editar cobrança" : "Nova cobrança"}
        fields={fields}
        initialValues={editing}
        onClose={() => setEditing(null)}
        onSubmit={salvar}
      />

      {arquivoExtrato && (
        <ImportarExtratoModal arquivo={arquivoExtrato} honorarios={honorarios} orgId={orgId} onClose={() => setArquivoExtrato(null)} />
      )}
    </div>
  );
}
