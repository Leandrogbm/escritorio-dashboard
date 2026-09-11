import React from "react";
import { useState } from "react";
import { Scale, ArrowRight, FileSearch, ShieldCheck, Users2, LayoutGrid, Check, X, Lock, ChevronDown } from "lucide-react";
import Card from "./Card.jsx";
import { COLORS } from "../lib/theme.js";
import { MODULES } from "../config/permissions.js";

// Textura de grão de papel já vem de body::before (index.css) — essa página não precisa
// reaplicar nada, só herda o mesmo fundo `paper` do resto do app.

const MODULE_COPY = {
  hoje: "Painel do dia: prazo vencendo, tarefa parada, saldo do caixa — o que precisa de atenção antes de abrir qualquer outra tela.",
  clientes: "Cadastro completo do cliente, histórico de contato e origem — sem planilha solta, sem WhatsApp perdido.",
  processos: "Andamento de cada processo com acompanhamento automático via DataJud e Escavador — movimentação nova aparece sem pesquisa manual.",
  quadro: "Quadro de tarefas no estilo Trello, embutido de verdade dentro do Actum — sem alternar de aba, sem outra assinatura.",
  prazos: "Agenda de prazos processuais com responsável e status — vinculado ao cliente e ao processo, não solto num calendário genérico.",
  financeiro: "Contas a pagar/receber, cobrança de honorários e portal do cliente pra acompanhar o próprio pagamento.",
  erp: "Visão executiva do escritório: faturamento, inadimplência e indicadores — sem depender de planilha exportada.",
  equipe: "Cargos com permissão própria (sócio, advogado, financeiro, recepção) — cada um vê só o que precisa.",
};

// Mockup do produto (KPI + tabela) — em vez de screenshot real ou foto de banco de imagens.
// As linhas da tabela são propositalmente abstratas/borradas: não é dado de cliente
// disfarçado, é ilustração — representa "tem dado sensível ali" sem fingir ser print real.
function ProdutoMockup() {
  const kpis = [
    { label: "A pagar (mês)", cor: COLORS.brass },
    { label: "Recebido (mês)", cor: COLORS.success },
    { label: "Prazos abertos", cor: COLORS.wine },
  ];
  return (
    <div className="rounded-md overflow-hidden w-full" style={{ background: COLORS.paperRaised }}>
      <div className="flex items-center gap-1.5 px-3 py-2.5" style={{ background: COLORS.paper, borderBottom: `1px solid ${COLORS.line}` }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.wine }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.brass }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.success }} />
        <span className="ml-3 text-[10px] font-medium" style={{ color: COLORS.slate }}>actumjus.com.br/erp</span>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {kpis.map(({ label, cor }) => (
            <div key={label} className="rounded p-2.5" style={{ background: COLORS.paper }}>
              <p className="text-[9px] leading-tight mb-2" style={{ color: COLORS.slate }}>{label}</p>
              <div className="h-2.5 rounded-full" style={{ width: "70%", background: cor, opacity: 0.85 }} />
            </div>
          ))}
        </div>
        {/* linhas de tabela: sempre barra cinza borrada, nunca nome/valor real — é ilustração,
            não print com dado escondido depois */}
        <div className="rounded overflow-hidden" style={{ background: COLORS.paper }}>
          {[62, 84, 48, 70].map((w, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: i < 3 ? `1px solid ${COLORS.line}` : "none" }}>
              <div className="h-2 rounded-full" style={{ width: `${w}%`, background: COLORS.line, filter: "blur(1.5px)" }} />
              <div className="h-4 w-11 rounded-full ml-auto shrink-0" style={{ background: COLORS.brassText, opacity: 0.18 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Moldura de notebook em CSS puro (sem foto de mesa/planta — isso exigiria imagem gerada por
// IA que não tenho como produzir aqui). Deixa o mockup lendo como "produto rodando numa tela"
// em vez de card solto flutuando no hero.
function NotebookComProduto() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-t-xl rounded-b-sm p-2.5 pb-3" style={{ background: COLORS.ink, boxShadow: "10px 10px 0 rgba(0,0,0,0.18)" }}>
        <ProdutoMockup />
      </div>
      <div
        className="mx-auto"
        style={{ width: "108%", marginLeft: "-4%", height: 12, background: `linear-gradient(${COLORS.inkSoft}, ${COLORS.ink})`, borderRadius: "0 0 6px 6px" }}
      />
      <div className="mx-auto" style={{ width: "26%", height: 4, background: COLORS.line, borderRadius: 2, marginTop: 3 }} />
    </div>
  );
}

// Ilustração original (pilha de processos + caneta) — mesma linguagem de sombra em pilha do
// Card (.card-stacked), pra contexto de "ambiente de escritório" sem foto de banco de imagens.
function PilhaDeProcessosIlustracao({ size = 96 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <rect x="18" y="40" width="52" height="38" rx="2" fill={COLORS.paper} stroke={COLORS.line} />
      <rect x="12" y="32" width="52" height="38" rx="2" fill={COLORS.paperRaised} stroke={COLORS.line} />
      <rect x="6" y="24" width="52" height="38" rx="2" fill={COLORS.paper} stroke={COLORS.ink} strokeWidth="1.5" />
      <rect x="6" y="24" width="52" height="9" rx="2" fill={COLORS.ink} />
      <line x1="14" y1="44" x2="42" y2="44" stroke={COLORS.line} strokeWidth="2" />
      <line x1="14" y1="51" x2="36" y2="51" stroke={COLORS.line} strokeWidth="2" />
      <path d="M56 20 L86 50" stroke={COLORS.brass} strokeWidth="3" strokeLinecap="round" />
      <path d="M82 46 L90 54 L86 58 L78 50 Z" fill={COLORS.brass} />
    </svg>
  );
}

const LINK_WHATSAPP = "https://wa.me/5518996069879?text=Ol%C3%A1!%20Vim%20pelo%20site%20do%20Actum%20e%20quero%20saber%20mais.";

const FRASE_WHATSAPP = "Olá, tudo bem? Se preferir, agende sua demonstração do Actum por aqui.";

// Widget = a arte que veio pronta (imagens teste/Gemini_Generated_Image_...) — o balão de fala
// era um componente conectado separado do corpo na própria imagem (nunca se tocavam), então
// deu pra remover só ele sem recortar nada do personagem. A frase do balão virou tooltip de
// verdade (texto HTML, some/aparece no hover) em vez de ficar presa em pixel.
function WhatsAppFlutuante() {
  const [aberto, setAberto] = useState(true);
  if (!aberto) return null;
  return (
    <div className="fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-50 w-[110px] group">
      <div className="relative">
        <button
          onClick={() => setAberto(false)}
          aria-label="Fechar"
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center z-10"
          style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, color: COLORS.slate }}
        >
          <X size={13} />
        </button>
        <div
          className="absolute bottom-2 right-full mr-2 w-[200px] rounded-md p-3 text-xs leading-snug opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
          style={{ background: COLORS.paperRaised, color: COLORS.ink, boxShadow: "4px 4px 0 rgba(0,0,0,0.14)" }}
        >
          {FRASE_WHATSAPP}
        </div>
        <a href={LINK_WHATSAPP} target="_blank" rel="noopener noreferrer" className="block" aria-label={FRASE_WHATSAPP}>
          <img src="/brand/whatsapp-widget.png" alt="Falar no WhatsApp" className="w-full drop-shadow-xl" />
        </a>
      </div>
    </div>
  );
}

function Botao({ children, variant = "primary", ...props }) {
  const styles =
    variant === "primary"
      ? { background: COLORS.brass, color: "#fff" }
      : variant === "onDark"
      ? { background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.35)" }
      : { background: "transparent", color: COLORS.ink, border: `1px solid ${COLORS.line}` };
  return (
    <button
      {...props}
      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md text-sm font-semibold whitespace-nowrap"
      style={styles}
    >
      {children}
    </button>
  );
}

export default function LandingPage({ onEntrar, onCadastrar }) {
  return (
    <div className="min-h-screen w-full" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 sm:px-8 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <img src="/brand/logo-icon.png" alt="Actum" className="w-8 h-8" />
          <span style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 19 }}>Actum</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onEntrar} className="text-sm font-medium underline sm:no-underline sm:px-3 sm:py-2" style={{ color: COLORS.ink }}>
            Entrar
          </button>
          <Botao variant="secondary" onClick={onCadastrar} className="hidden sm:inline-flex">
            Cadastrar meu escritório
          </Botao>
        </div>
      </header>

      {/* Hero — foto de arquivo (Unsplash, licença livre p/ uso comercial, sem marca de
          terceiro visível: https://unsplash.com/photos/worms-eye-view-of-skyscraper-NuxrBq5-Sd0)
          com tingimento verde-cartório por cima (gradiente), pra não ficar com o azul original. */}
      <section className="relative overflow-hidden" style={{ background: COLORS.ink }}>
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url(/brand/hero-predios.jpg)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, ${COLORS.ink}f2, ${COLORS.ink}d9 55%, ${COLORS.ink}f7)` }}
        />
        <div
          className="absolute inset-0 opacity-[0.09] pointer-events-none"
          style={{
            mixBlendMode: "screen",
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-12 pb-16 sm:pt-20 sm:pb-24 grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-12 items-center">
          <div>
            <Scale size={36} color={COLORS.brass} className="mb-6" />
            <h1
              className="max-w-2xl text-[32px] sm:text-[46px] leading-[1.15]"
              style={{ fontFamily: "'Source Serif 4', serif", color: "#fff", fontWeight: 600 }}
            >
              A gestão do escritório, com o rigor de um processo bem instruído.
            </h1>
            <p className="max-w-xl text-base sm:text-lg mt-5" style={{ color: "rgba(255,255,255,0.7)" }}>
              Clientes, processos, prazos, financeiro e equipe num só lugar — com acompanhamento
              automático de andamento processual e portal pro seu cliente acompanhar sozinho.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Botao onClick={onCadastrar}>
                Cadastrar meu escritório <ArrowRight size={16} />
              </Botao>
              <Botao variant="onDark" onClick={onEntrar}>
                Já tenho conta — Entrar
              </Botao>
            </div>
          </div>
          <div className="hidden lg:block">
            <NotebookComProduto />
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <div className="flex items-start justify-between gap-6 mb-10">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: COLORS.brassText }}>
              Como funciona
            </p>
            <h2 className="text-2xl sm:text-[28px]" style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600 }}>
              Três passos, sem trocar de planilha por outro sistema complicado
            </h2>
          </div>
          <div className="hidden sm:block shrink-0">
            <PilhaDeProcessosIlustracao />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { n: "1", title: "Cadastre o escritório", text: "Nome, CNPJ e responsável — a conta já sai pronta pra usar, sem etapa de implantação." },
            { n: "2", title: "Cadastre cliente e processo", text: "No seu ritmo. Não precisa migrar o histórico inteiro de uma vez pra começar a usar." },
            { n: "3", title: "Acompanhe num painel só", text: "Prazo, financeiro e andamento processual juntos — sem alternar entre planilha, WhatsApp e site do tribunal." },
          ].map(({ n, title, text }) => (
            <div key={n}>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center mb-3 text-sm font-semibold"
                style={{ background: COLORS.ink, color: COLORS.brass }}
              >
                {n}
              </div>
              <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 16 }} className="mb-1.5">
                {title}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: COLORS.slate }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Módulos */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-14 sm:pb-20">
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: COLORS.brassText }}>
          O que tem dentro
        </p>
        <h2 className="text-2xl sm:text-[28px] mb-10" style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600 }}>
          Cada frente do escritório, numa aba só
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map(({ key, label, icon: Icon }) => (
            <Card key={key} className="flex flex-col gap-3">
              <Icon size={22} color={COLORS.brassText} />
              <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 16 }}>{label}</p>
              <p className="text-sm leading-relaxed" style={{ color: COLORS.slate }}>{MODULE_COPY[key]}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Diferenciais */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-14 sm:pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              icon: FileSearch,
              title: "Andamento processual automático",
              text: "Integração com DataJud e Escavador — movimentação nova do processo chega sozinha, sem consulta manual repetida.",
            },
            {
              icon: ShieldCheck,
              title: "Cada cargo vê o que precisa",
              text: "Sócio, advogado, financeiro e recepção têm permissão própria por módulo — nada de conta única compartilhada pro escritório inteiro.",
            },
            {
              icon: Users2,
              title: "Portal do cliente",
              text: "Seu cliente acompanha processo e pagamento sem precisar te ligar pra saber \"como está o meu caso\".",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <Icon size={20} color={COLORS.ink} className="mb-3" />
              <p style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600, fontSize: 16 }} className="mb-1.5">
                {title}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: COLORS.slate }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparativo */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-14 sm:pb-20">
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: COLORS.brassText }}>
          A diferença no dia a dia
        </p>
        <h2 className="text-2xl sm:text-[28px] mb-8" style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600 }}>
          Como o escritório trabalha hoje x com o Actum
        </h2>
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: COLORS.slate }}></th>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: COLORS.slate }}>Hoje</th>
                  <th className="text-left px-5 py-3 font-semibold" style={{ color: COLORS.ink }}>Com o Actum</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { linha: "Prazo processual", antes: "Planilha ou agenda separada — fácil de esquecer", depois: "Vinculado ao cliente e ao processo, com responsável e alerta" },
                  { linha: "Andamento do processo", antes: "Consulta manual no site do tribunal", depois: "Chega sozinho via DataJud e Escavador" },
                  { linha: "Financeiro do escritório", antes: "Planilha à parte, sem ligação com o processo", depois: "Contas a pagar/receber e cobrança no mesmo lugar" },
                  { linha: "Cliente perguntando do caso", antes: "Liga ou manda WhatsApp pra saber notícia", depois: "Acompanha sozinho pelo portal do cliente" },
                  { linha: "Acesso da equipe", antes: "Todo mundo vê tudo, ou senha única compartilhada", depois: "Cada cargo vê só o que precisa" },
                ].map((r) => (
                  <tr key={r.linha} style={{ borderTop: `1px solid ${COLORS.line}` }}>
                    <td className="px-5 py-4 font-medium" style={{ color: COLORS.ink }}>{r.linha}</td>
                    <td className="px-5 py-4" style={{ color: COLORS.slate }}>
                      <span className="inline-flex items-center gap-1.5"><X size={14} color={COLORS.wine} className="shrink-0" />{r.antes}</span>
                    </td>
                    <td className="px-5 py-4" style={{ color: COLORS.ink }}>
                      <span className="inline-flex items-center gap-1.5"><Check size={14} color={COLORS.success} className="shrink-0" />{r.depois}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Segurança / LGPD — só o confidencial de processo é diferencial de venda; isolamento
          por RLS e credencial protegida são obrigação básica, não vantagem, então ficam como
          rodapé discreto em vez de disputar espaço com o destaque. */}
      <section className="px-5 sm:px-8 pb-14 sm:pb-20">
        <div className="max-w-6xl mx-auto rounded-md px-6 sm:px-10 py-10" style={{ background: COLORS.inkSoft }}>
          <div className="flex items-center gap-2 mb-3" style={{ color: COLORS.brass }}>
            <Lock size={18} />
            <span className="text-xs font-semibold tracking-widest uppercase">Sigilo de processo</span>
          </div>
          <p className="text-base sm:text-lg max-w-2xl leading-relaxed mb-6" style={{ color: "#fff" }}>
            Processo pode ser marcado como confidencial, restringindo quem no próprio escritório
            visualiza — nem todo caso deve aparecer pra equipe inteira.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
            Isolamento de dados por empresa e credencial de integração nunca exposta ao navegador
            já são padrão esperado de qualquer sistema — isso o Actum garante, não é diferencial.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-14 sm:pb-20">
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: COLORS.brassText }}>
          Perguntas frequentes
        </p>
        <h2 className="text-2xl sm:text-[28px] mb-8" style={{ fontFamily: "'Source Serif 4', serif", color: COLORS.ink, fontWeight: 600 }}>
          Antes de cadastrar
        </h2>
        <div className="max-w-2xl flex flex-col gap-3">
          {[
            { p: "Preciso migrar todo o histórico de uma vez?", r: "Não. Cadastre processos e clientes no seu ritmo — dá pra começar só com o que está ativo agora." },
            { p: "Funciona pra advogado autônomo, sem equipe?", r: "Sim. Os cargos (sócio, advogado, financeiro, recepção) existem pra escritório com equipe; sozinho, você usa a conta de admin com acesso a tudo." },
            { p: "Já uso outro sistema — dá pra trocar sem perder histórico?", r: "Cadastro manual ou por planilha é suportado hoje. Migração automatizada de outro sistema é avaliada caso a caso." },
            { p: "Como funciona o suporte se eu tiver um problema?", r: "Contato direto com quem mantém o produto — não é central de atendimento terceirizada." },
            { p: "Tem contrato de fidelidade ou custo de cancelamento?", r: "Isso é definido na conversa de cadastro do seu escritório — hoje o Actum não trabalha no formato de autoatendimento com plano fechado." },
          ].map(({ p, r }) => (
            <details key={p} className="group" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
              <summary
                className="flex items-center justify-between gap-4 py-3.5 cursor-pointer list-none text-sm font-semibold"
                style={{ color: COLORS.ink }}
              >
                {p}
                <ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" style={{ color: COLORS.slate }} />
              </summary>
              <p className="text-sm leading-relaxed pb-4 pr-8" style={{ color: COLORS.slate }}>{r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="px-5 sm:px-8 pb-16">
        <div
          className="max-w-6xl mx-auto rounded-md px-6 sm:px-10 py-10 sm:py-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
          style={{ background: COLORS.ink }}
        >
          <div>
            <div className="flex items-center gap-2 mb-2" style={{ color: COLORS.brass }}>
              <LayoutGrid size={18} />
              <span className="text-xs font-semibold tracking-widest uppercase">Comece agora</span>
            </div>
            <p className="text-xl sm:text-2xl max-w-md" style={{ fontFamily: "'Source Serif 4', serif", color: "#fff", fontWeight: 600 }}>
              Cadastre o escritório e organize tudo ainda hoje.
            </p>
          </div>
          <Botao onClick={onCadastrar} className="shrink-0">
            Cadastrar meu escritório <ArrowRight size={16} />
          </Botao>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-5 sm:px-8 pb-10 flex items-center justify-between text-xs" style={{ color: COLORS.slate }}>
        <span>© {new Date().getFullYear()} Actum</span>
        <button onClick={onEntrar} className="underline">Entrar</button>
      </footer>

      <WhatsAppFlutuante />
    </div>
  );
}
