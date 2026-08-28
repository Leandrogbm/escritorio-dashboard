import React, { useEffect, useState } from "react";
import { PenTool, ListChecks, Wallet, MapPin, Search, Trello, ChevronDown, Eye, EyeOff } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { useSupabaseTable } from "../hooks/useSupabaseTable.js";
import { supabase } from "../lib/supabaseClient.js";

// Credenciais são DA PRÓPRIA EMPRESA (cada escritório usa a conta dele) — ficam salvas em
// organizations, mesmas colunas que Minha Empresa já usa pro resto do perfil.
// D4Sign/Escavador/Trello: sem teste contra conta real (não temos credencial) — construído
// a partir da documentação oficial de cada um.
//
// Rótulo em linguagem simples pra quem não é técnico + o termo original entre parênteses
// (assim quem olhar a tela do provedor sabe qual campo bate com qual) + passo a passo de
// onde achar cada dado — pedido explícito do usuário depois de mostrar isso pra um cliente
// não-técnico que não reconheceu "tokenAPI"/"cryptKey".
//
// Lista de nomes que expande ao clicar (pedido do usuário — antes tudo vinha aberto, ficava
// longo e confuso pra quem só quer configurar uma coisa).
//
// ponytail: Jusbrasil (captação automática de processo por OAB) foi removido — o cliente
// não tem o produto "Jusbrasil Soluções" (é um contrato B2B separado da conta pessoal dele),
// então a integração ficava sem uso real. Reintroduzir se/quando contratarem esse produto.
const inputStyle = { border: `1px solid ${COLORS.line}`, color: COLORS.ink };
const labelStyle = { color: COLORS.ink, fontWeight: 600 };
const hintStyle = { color: COLORS.slate, fontWeight: 400 };

// Campo de credencial (token/chave) — mascarado por padrão (type="password", como qualquer
// senha), com olho pra revelar só quando o usuário pede. Pedido do usuário: chave já
// conectada não deve ficar exposta em texto puro na tela.
function CampoSegredo({ value, onChange }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <input
        type={ver ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoComplete="off"
        className="w-full px-3 py-2 pr-9 rounded-md text-sm"
        style={inputStyle}
      />
      <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Esconder" : "Mostrar"} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:opacity-70" style={{ color: COLORS.slate }}>
        {ver ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function ComoConseguir({ passos }) {
  return (
    <div className="mb-4 px-3 py-3 rounded-md text-xs max-w-md" style={{ background: "rgba(165,121,59,0.08)", color: COLORS.ink }}>
      <p className="flex items-center gap-1.5 font-semibold mb-1.5"><ListChecks size={13} color={COLORS.brass} /> Onde encontrar isso</p>
      <ol className="list-decimal pl-4 flex flex-col gap-1">
        {passos.map((p, i) => <li key={i} style={{ color: COLORS.slate }}>{p}</li>)}
      </ol>
    </div>
  );
}

// Item da lista — clica no nome, expande os campos. `Icon`/`titulo`/`resumo` sempre visíveis;
// o resto só quando `aberto`.
function ItemIntegracao({ Icon, titulo, resumo, aberto, onToggle, children }) {
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.line}` }}>
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 py-3.5 text-left">
        <span className="flex items-center gap-2.5">
          <Icon size={16} color={COLORS.brass} />
          <span>
            <span className="block text-sm font-semibold" style={{ color: COLORS.ink }}>{titulo}</span>
            <span className="block text-xs" style={{ color: COLORS.slate }}>{resumo}</span>
          </span>
        </span>
        <ChevronDown size={16} color={COLORS.slate} style={{ transform: aberto ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
      </button>
      {aberto && <div className="pb-5">{children}</div>}
    </div>
  );
}

// Key+Token dão pra buscar os quadros/listas direto na API do Trello (GET com CORS
// liberado — é como os próprios Power-Ups funcionam no navegador) — evita o usuário caçar
// "ID da lista" na mão, que na prática ele não acha (colava o link do quadro inteiro, não
// da lista, e a integração não funcionava).
function TrelloForm({ trello, setTrello, salvando, onSalvar }) {
  const [quadros, setQuadros] = useState(null);
  const [quadroId, setQuadroId] = useState("");
  const [listas, setListas] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");

  const buscarQuadros = async () => {
    setErro("");
    setBuscando(true);
    try {
      const res = await fetch(`https://api.trello.com/1/members/me/boards?key=${trello.trello_key}&token=${trello.trello_token}&fields=name,shortLink`);
      if (!res.ok) throw new Error(await res.text());
      setQuadros(await res.json());
    } catch (err) {
      // Mostra o erro exato que a Trello devolveu (ex.: "invalid app token" = token
      // expirado/errado) em vez de um genérico — é sempre isso ou isso, dá pra diagnosticar
      // direto na tela sem precisar testar por fora.
      setErro(`A Trello recusou: "${err.message || "erro desconhecido"}". Gere a API Key e o Token de novo em trello.com/power-ups/admin.`);
    } finally {
      setBuscando(false);
    }
  };

  const escolherQuadro = async (id) => {
    setQuadroId(id);
    setListas(null);
    const board = quadros?.find((q) => q.id === id);
    setTrello((v) => ({ ...v, trello_board_shortlink: board?.shortLink ?? "", trello_board_id: id }));
    if (!id) return;
    try {
      const res = await fetch(`https://api.trello.com/1/boards/${id}/lists?key=${trello.trello_key}&token=${trello.trello_token}&fields=name`);
      if (!res.ok) throw new Error(await res.text());
      setListas(await res.json());
    } catch {
      setErro("Não consegui buscar as listas desse quadro.");
    }
  };

  return (
    <form onSubmit={onSalvar} className="flex flex-col gap-3 max-w-md">
      <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
        <span style={labelStyle}>API Key</span>
        <CampoSegredo value={trello.trello_key} onChange={(e) => setTrello((v) => ({ ...v, trello_key: e.target.value }))} />
      </label>
      <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
        <span style={labelStyle}>Token</span> <span>(NÃO é o "Segredo" da tela da Trello — veja abaixo)</span>
        <CampoSegredo value={trello.trello_token} onChange={(e) => setTrello((v) => ({ ...v, trello_token: e.target.value }))} />
      </label>
      {trello.trello_key && (
        <a
          href={`https://trello.com/1/authorize?expiration=never&name=Actum&scope=read,write&response_type=token&key=${trello.trello_key}`}
          target="_blank" rel="noreferrer"
          className="self-start text-xs underline"
          style={{ color: COLORS.brassText }}
        >
          Gerar o Token certo agora →
        </a>
      )}

      <button type="button" onClick={buscarQuadros} disabled={!trello.trello_key || !trello.trello_token || buscando} className="self-start px-3 py-2 rounded-md text-xs font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink, opacity: !trello.trello_key || !trello.trello_token || buscando ? 0.5 : 1 }}>
        {buscando ? "Buscando..." : "Buscar quadros"}
      </button>
      {erro && <p className="text-xs" style={{ color: COLORS.wine }}>{erro}</p>}

      {quadros && (
        <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
          <span style={labelStyle}>Quadro</span>
          <select value={quadroId} onChange={(e) => escolherQuadro(e.target.value)} className="px-3 py-2 rounded-md text-sm" style={inputStyle}>
            <option value="">Selecione</option>
            {quadros.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
        </label>
      )}
      {listas && (
        <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
          <span style={labelStyle}>Lista</span> <span>(coluna onde os cartões entram)</span>
          <select value={trello.trello_list_id} onChange={(e) => setTrello((v) => ({ ...v, trello_list_id: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle}>
            <option value="">Selecione</option>
            {listas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      )}
      {trello.trello_list_id && !listas && (
        <p className="text-xs" style={{ color: COLORS.slate }}>Lista já conectada — busque os quadros de novo só se quiser trocar.</p>
      )}

      <button type="submit" disabled={salvando} className="self-start px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}

export default function IntegracoesSection({ orgId }) {
  // Credenciais moram em `integracoes` (RLS admin/sócio), não em `organizations` (que
  // qualquer membro da empresa consegue ler) — ver comentário no schema.sql. Essa tela só
  // aparece pra admin/sócio mesmo (Sidebar.jsx), então a leitura passa igual na RLS.
  const { data: integRows, refresh: refreshOrg } = useSupabaseTable("integracoes", {
    select: "d4sign_token,d4sign_crypt_key,d4sign_safe_uuid,asaas_token,asaas_ambiente,escavador_token,trello_key,trello_token,trello_list_id,trello_board_shortlink,trello_board_id",
    eq: orgId ? ["org_id", orgId] : undefined,
  });
  const org = integRows[0];
  const [expandido, setExpandido] = useState(null); // "d4sign" | "escavador" | "trello" | null

  const [d4, setD4] = useState({ d4sign_token: "", d4sign_crypt_key: "", d4sign_safe_uuid: "" });
  const [salvandoD4, setSalvandoD4] = useState(false);
  const [asaas, setAsaas] = useState({ asaas_token: "", asaas_ambiente: "sandbox" });
  const [salvandoAsaas, setSalvandoAsaas] = useState(false);
  const [escavador, setEscavador] = useState({ escavador_token: "" });
  const [salvandoEscavador, setSalvandoEscavador] = useState(false);
  const [trello, setTrello] = useState({ trello_key: "", trello_token: "", trello_list_id: "", trello_board_shortlink: "", trello_board_id: "" });
  const [salvandoTrello, setSalvandoTrello] = useState(false);

  // carrega os valores salvos assim que a organização chega (fetch async)
  useEffect(() => {
    if (!org) return;
    setD4({ d4sign_token: org.d4sign_token ?? "", d4sign_crypt_key: org.d4sign_crypt_key ?? "", d4sign_safe_uuid: org.d4sign_safe_uuid ?? "" });
    setAsaas({ asaas_token: org.asaas_token ?? "", asaas_ambiente: org.asaas_ambiente ?? "sandbox" });
    setEscavador({ escavador_token: org.escavador_token ?? "" });
    setTrello({ trello_key: org.trello_key ?? "", trello_token: org.trello_token ?? "", trello_list_id: org.trello_list_id ?? "", trello_board_shortlink: org.trello_board_shortlink ?? "", trello_board_id: org.trello_board_id ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.d4sign_token, org?.d4sign_crypt_key, org?.d4sign_safe_uuid, org?.asaas_token, org?.asaas_ambiente, org?.escavador_token, org?.trello_key, org?.trello_token, org?.trello_list_id, org?.trello_board_shortlink, org?.trello_board_id]);

  const salvar = (campos, setSalvando) => async (e) => {
    e.preventDefault();
    setSalvando(true);
    // upsert (não update): a linha em `integracoes` só existe depois da primeira vez que
    // alguém salva algo — org nova não tem linha lá ainda.
    const { error } = await supabase.from("integracoes").upsert({ org_id: orgId, ...campos }, { onConflict: "org_id" });
    setSalvando(false);
    if (error) return alert(error.message);
    await refreshOrg();
  };

  const toggle = (nome) => setExpandido((v) => (v === nome ? null : nome));

  return (
    <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${COLORS.line}` }}>
      <p className="text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>Integrações</p>
      <p className="text-xs mb-3" style={{ color: COLORS.slate }}>Clique no nome pra ver os campos e o passo a passo de cada uma.</p>

      <ItemIntegracao Icon={PenTool} titulo="D4Sign" resumo="Assinatura eletrônica de documentos" aberto={expandido === "d4sign"} onToggle={() => toggle("d4sign")}>
        <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
          Pra mandar documento pra assinar sem sair da Actum, conecte a conta D4Sign do escritório aqui embaixo — são 3 códigos, você pega tudo dentro da conta D4Sign de vocês.
        </p>
        <ComoConseguir passos={[
          <>Entre em <strong>secure.d4sign.com.br</strong> com o login de administrador da conta D4Sign do escritório.</>,
          <>No menu, procure por <strong>"Dev API"</strong> (ou "Integrações"). Lá aparecem dois códigos: um chamado <strong>Token</strong> e outro <strong>Crypt Key</strong> — copie os dois.</>,
          <>Se essa tela não aparecer, mande um email pra <strong>suporte@d4sign.com.br</strong> pedindo pra liberar o acesso via API da conta — eles respondem com os códigos.</>,
          <>Depois, vá em <strong>"Cofres"</strong> (ou "Safes"), abra a pasta onde os documentos vão ficar guardados (ou crie uma nova) e copie o código dela.</>,
        ]} />
        <form onSubmit={salvar(d4, setSalvandoD4)} className="flex flex-col gap-3 max-w-md">
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Código de acesso</span> <span>(chamado de "Token" na D4Sign)</span>
            <CampoSegredo value={d4.d4sign_token} onChange={(e) => setD4((v) => ({ ...v, d4sign_token: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Chave de segurança</span> <span>(chamada de "Crypt Key" na D4Sign)</span>
            <CampoSegredo value={d4.d4sign_crypt_key} onChange={(e) => setD4((v) => ({ ...v, d4sign_crypt_key: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Código da pasta de documentos</span> <span>(UUID do "Cofre"/"Safe" na D4Sign)</span>
            <input value={d4.d4sign_safe_uuid} onChange={(e) => setD4((v) => ({ ...v, d4sign_safe_uuid: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle} />
          </label>
          <button type="submit" disabled={salvandoD4} className="self-start px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvandoD4 ? 0.6 : 1 }}>
            {salvandoD4 ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </ItemIntegracao>

      <ItemIntegracao Icon={Search} titulo="Escavador" resumo="Buscar processos de um cliente por CPF/CNPJ" aberto={expandido === "escavador"} onToggle={() => toggle("escavador")}>
        <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
          Com a conta Escavador conectada, aparece um botão "Buscar processos" no cadastro do cliente — mostra o que a Escavador achou pra você revisar e escolher o que entra em Processos. Cada busca é cobrada na sua conta Escavador (plano pago, cobrança deles).
        </p>
        <ComoConseguir passos={[
          <>Entre na conta paga do escritório em <strong>escavador.com</strong>.</>,
          <>Vá em <strong>api.escavador.com/tokens</strong> e clique em <strong>"Criar token"</strong>.</>,
          <>Copie o token — ele só aparece uma vez nessa tela, então cole aqui embaixo antes de sair.</>,
        ]} />
        <form onSubmit={salvar(escavador, setSalvandoEscavador)} className="flex flex-col gap-3 max-w-md">
          <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
            <span style={labelStyle}>Token de API</span> <span>(gerado em api.escavador.com/tokens)</span>
            <CampoSegredo value={escavador.escavador_token} onChange={(e) => setEscavador({ escavador_token: e.target.value })} />
          </label>
          <button type="submit" disabled={salvandoEscavador} className="self-start px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvandoEscavador ? 0.6 : 1 }}>
            {salvandoEscavador ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </ItemIntegracao>

      <ItemIntegracao Icon={Trello} titulo="Trello" resumo="Copiar tarefa criada pro Trello" aberto={expandido === "trello"} onToggle={() => toggle("trello")}>
        <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
          Toda tarefa criada no Actum (Kanban, ou dentro de um processo) também vira um cartão numa lista do seu Trello. É via única — editar/mover/concluir no Trello não volta pro Actum.
        </p>
        <ComoConseguir passos={[
          <>Entre em <strong>trello.com/power-ups/admin</strong> logado com a conta do escritório, crie um Power-Up novo (qualquer nome) e vá em <strong>"Chave de API"</strong>.</>,
          <>Copie o campo <strong>"Chave de API"</strong> e cole abaixo — isso é a API Key.</>,
          <>⚠️ <strong>Não copie o campo "Segredo"</strong> dessa mesma tela — não é o que precisa aqui. Depois de colar a API Key abaixo, aparece um link <strong>"Gerar o Token certo agora"</strong> — clique nele, autorize, e copie o token que aparecer na página seguinte.</>,
          <>Com os dois colados, clique em <strong>"Buscar quadros"</strong> — escolhe o quadro e a lista (coluna) direto da tela, sem precisar copiar nenhum ID na mão.</>,
        ]} />
        <TrelloForm trello={trello} setTrello={setTrello} salvando={salvandoTrello} onSalvar={salvar(trello, setSalvandoTrello)} />
      </ItemIntegracao>

      {/* ponytail: Asaas construído e testado (function + webhook), mas o usuário pediu pra
          segurar em back log — não subir pro cliente ainda. UI escondida, código intacto
          (ver ROADMAP-comparativo.md). Reativar: tirar esse comentário e o "false &&" abaixo. */}
      {false && (
        <ItemIntegracao Icon={Wallet} titulo="Asaas" resumo="Cobrança automática (boleto/Pix/cartão)" aberto={expandido === "asaas"} onToggle={() => toggle("asaas")}>
          <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
            Conecte a conta Asaas do escritório pra gerar boleto/Pix/cartão de verdade em cada cobrança (Financeiro) — quando o cliente pagar, a cobrança vira "Pago" sozinha, sem precisar importar extrato.
          </p>
          <ComoConseguir passos={[
            <>Crie (ou entre na) conta em <strong>asaas.com</strong> com os dados do escritório.</>,
            <>No menu, vá em <strong>"Integrações" → "API"</strong> e copie a <strong>Chave de API</strong>.</>,
            <>Se quiser testar antes de usar de verdade, use o <strong>Ambiente de testes (sandbox)</strong> — a Asaas tem uma conta sandbox separada (sandbox.asaas.com), com chave de API própria.</>,
          ]} />
          <form onSubmit={salvar(asaas, setSalvandoAsaas)} className="flex flex-col gap-3 max-w-md">
            <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
              <span style={labelStyle}>Chave de API</span> <span>(em Integrações → API, na Asaas)</span>
              <CampoSegredo value={asaas.asaas_token} onChange={(e) => setAsaas((v) => ({ ...v, asaas_token: e.target.value }))} />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={hintStyle}>
              <span style={labelStyle}>Ambiente</span>
              <select value={asaas.asaas_ambiente} onChange={(e) => setAsaas((v) => ({ ...v, asaas_ambiente: e.target.value }))} className="px-3 py-2 rounded-md text-sm" style={inputStyle}>
                <option value="sandbox">Testes (sandbox) — não gera cobrança real</option>
                <option value="producao">Produção — gera cobrança real</option>
              </select>
            </label>
            <button type="submit" disabled={salvandoAsaas} className="self-start px-3.5 py-2 rounded-md text-sm font-semibold" style={{ background: COLORS.ink, color: "#fff", opacity: salvandoAsaas ? 0.6 : 1 }}>
              {salvandoAsaas ? "Salvando..." : "Salvar"}
            </button>
          </form>
        </ItemIntegracao>
      )}

      {/* ponytail: Captação de Leads (formulário público + mapa) construída e testada, mas
          em back log a pedido do usuário — escondida junto com o módulo "leads_captacao"
          (permissions.js) e o formulário público (App.jsx). Reativar: tirar o "false &&". */}
      {false && (
        <ItemIntegracao Icon={MapPin} titulo="Captação de leads no site" resumo="Formulário embutido no site do escritório" aberto={expandido === "leads"} onToggle={() => toggle("leads")}>
          <p className="text-xs mb-3" style={{ color: COLORS.slate }}>
            Cole esse código no site do escritório (numa página ou seção de contato) pra mostrar o formulário de captação — os contatos aparecem em "Captação de Leads" no menu.
          </p>
          <pre className="px-3 py-3 rounded-md text-xs overflow-x-auto max-w-md" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>
{`<iframe src="${window.location.origin}/?leadform=1&org=${orgId}" width="100%" height="640" style="border:0"></iframe>`}
          </pre>
        </ItemIntegracao>
      )}
    </div>
  );
}
