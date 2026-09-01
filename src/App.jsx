import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { COLORS } from "./lib/theme.js";
import { MODULES } from "./config/permissions.js";
import { useAuth } from "./hooks/useAuth.js";
import { useRolePermissions } from "./hooks/useRolePermissions.js";
import Login from "./components/Login.jsx";
import ResetPassword from "./components/ResetPassword.jsx";
import PlatformAdminPanel from "./components/PlatformAdminPanel.jsx";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import EmptyState from "./components/EmptyState.jsx";
import PortalCliente from "./components/PortalCliente.jsx";
import LeadForm from "./components/LeadForm.jsx";
import PageLoader from "./components/PageLoader.jsx";
import AceitarTermosGate from "./components/AceitarTermosGate.jsx";

// code-splitting por aba (vercel-react-best-practices: bundle-dynamic-imports) — só uma aba
// renderiza por vez (`activeTab`), mas antes todas (Financeiro/ERP com Recharts, PDF/OCR do
// extrato etc.) entravam no bundle principal de largada, mesmo sem o usuário nunca abrir
// metade delas numa sessão. Cada `lazy` vira um chunk carregado só quando a aba é escolhida
// — `PageLoader` (já usado na troca de aba) cobre o Suspense.
const PrazosTab = lazy(() => import("./components/tabs/PrazosTab.jsx"));
const ProcessosTab = lazy(() => import("./components/tabs/ProcessosTab.jsx"));
const QuadroTab = lazy(() => import("./components/tabs/QuadroTab.jsx"));
const LeadsTab = lazy(() => import("./components/tabs/LeadsTab.jsx"));
const FinanceiroTab = lazy(() => import("./components/tabs/FinanceiroTab.jsx"));
const ErpTab = lazy(() => import("./components/tabs/ErpTab.jsx"));
const ClientesTab = lazy(() => import("./components/tabs/ClientesTab.jsx"));
const EquipeTab = lazy(() => import("./components/tabs/EquipeTab.jsx"));
const ConfigTab = lazy(() => import("./components/tabs/ConfigTab.jsx"));
const MinhaEmpresaTab = lazy(() => import("./components/tabs/MinhaEmpresaTab.jsx"));
const LeadsCaptacaoTab = lazy(() => import("./components/tabs/LeadsCaptacaoTab.jsx"));

export default function App() {
  // Captação de Leads reativada (ver ROADMAP-comparativo.md) — formulário público embutido
  // via iframe no site do escritório: <URL_DO_ACTUM>?leadform=1&org=<org_id da empresa>.
  const paramsPublicos = new URLSearchParams(window.location.search);
  if (paramsPublicos.get("leadform") === "1") {
    return <LeadForm orgId={paramsPublicos.get("org")} />;
  }

  const { session, profile, clienteAcesso, isPlatformAdmin, loading, recovery, clearRecovery, signOut, refreshProfile } = useAuth();
  // orgOverride: platform admin "entrou" como admin de uma empresa alheia (linha de
  // platform_org_metrics, tem org_id/nome/suspenso etc.) — null no uso normal.
  const [orgOverride, setOrgOverride] = useState(null);
  const emSuporte = isPlatformAdmin && !!orgOverride;
  const { permissions, togglePermission } = useRolePermissions(emSuporte ? orgOverride.org_id : profile?.org_id);
  // Persiste a aba ativa: navegador às vezes descarta/recarrega uma aba parada por um
  // tempo (economia de memória, comum em celular) — sem isso, o reload sempre caía de
  // volta em "Prazos" em vez de continuar onde a pessoa estava.
  const [activeTab, setActiveTabState] = useState(() => localStorage.getItem("activeTab") || "clientes");
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    if (tab) localStorage.setItem("activeTab", tab); else localStorage.removeItem("activeTab");
  };
  const [verEmpresa, setVerEmpresa] = useState(false); // platform admin que também é admin de uma org: alterna pra visão normal
  // Balança girando por um instante a cada troca de aba (UX, não é o loading de dado —
  // cada aba já cuida do próprio `loading`) — dá o "algo está acontecendo" na transição
  // sem esperar a query terminar, evita a tela mudar de conteúdo seca demais.
  const [trocandoAba, setTrocandoAba] = useState(false);
  useEffect(() => {
    setTrocandoAba(true);
    const t = setTimeout(() => setTrocandoAba(false), 420);
    return () => clearTimeout(t);
  }, [activeTab]);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false); // sidebar vira gaveta em telas pequenas

  // Navegação entre abas a partir da página do Cliente (clicar num processo/cobrança dele
  // deve trocar de aba E já abrir aquele registro específico, não só cair na lista) — a aba
  // de destino lê isso na montagem e limpa depois de abrir, pra não reabrir de novo à toa
  // numa próxima troca de aba.
  const [abrirProcessoId, setAbrirProcessoId] = useState(null);
  const [abrirClienteFinanceiroId, setAbrirClienteFinanceiroId] = useState(null);
  const abrirProcesso = (id) => { setAbrirProcessoId(id); setActiveTab("processos"); };
  const abrirFinanceiroDoCliente = (id) => { setAbrirClienteFinanceiroId(id); setActiveTab("financeiro"); };

  // Em modo suporte o platform admin opera como admin completo da empresa escolhida —
  // vê e mexe em tudo, sem depender do role_permissions dela.
  const currentRole = emSuporte ? "admin" : profile?.role;
  const allowedModules = useMemo(() => {
    if (emSuporte) return MODULES.map((m) => m.key);
    if (!currentRole || !permissions) return [];
    if (currentRole === "admin") return MODULES.map((m) => m.key);
    return MODULES.filter((m) => permissions[currentRole]?.includes(m.key)).map((m) => m.key);
  }, [currentRole, permissions, emSuporte]);

  useEffect(() => {
    // allowedModules.length > 0 evita resetar a aba durante um estado transitório de
    // carregamento (permissions ainda null por uma fração de segundo) — só troca de aba
    // de verdade quando já sabemos com certeza que ela não é permitida.
    if (allowedModules.length > 0 && activeTab !== "config" && !allowedModules.includes(activeTab)) {
      setActiveTab(allowedModules[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole, allowedModules]);

  if (loading) return <FullScreenMessage>Carregando...</FullScreenMessage>;
  if (recovery) return <ResetPassword onDone={clearRecovery} />;
  if (!session) return <Login />;
  if (clienteAcesso) return <PortalCliente clienteAcesso={clienteAcesso} signOut={signOut} />;
  if (isPlatformAdmin && !verEmpresa && !orgOverride) {
    return (
      <PlatformAdminPanel
        temPerfilProprio={profile !== null}
        onEntrarNaEmpresa={() => setVerEmpresa(true)}
        onEntrarComoAdmin={setOrgOverride}
        signOut={signOut}
      />
    );
  }
  if (!emSuporte && profile === null) {
    return (
      <FullScreenMessage>
        Sua conta ainda não tem acesso liberado. Fale com o administrador do escritório.
        <button onClick={signOut} className="block mx-auto mt-4 text-sm underline" style={{ color: COLORS.brassText }}>Sair</button>
      </FullScreenMessage>
    );
  }
  if (!emSuporte && profile.organizations?.suspenso) {
    return (
      <FullScreenMessage>
        O acesso da sua empresa está suspenso no momento. Fale com o suporte pra regularizar.
        <button onClick={signOut} className="block mx-auto mt-4 text-sm underline" style={{ color: COLORS.brassText }}>Sair</button>
      </FullScreenMessage>
    );
  }
  // Empresa criada antes dessa tela existir nunca aceitou os Termos/Privacidade do Actum
  // (quem cadastra agora já aceita no formulário, ver Signup.jsx) — bloqueia até aceitar.
  if (!emSuporte && !profile.organizations?.termos_aceite) {
    return <AceitarTermosGate profile={profile} currentRole={currentRole} signOut={signOut} onAceito={refreshProfile} />;
  }
  if (!permissions) return <FullScreenMessage>Carregando...</FullScreenMessage>;

  // Sempre um valor concreto (nunca undefined pra quem é platform admin): is_platform_admin()
  // libera a RLS de select pra QUALQUER org, então sem esse filtro explícito o próprio
  // platform admin vendo a própria empresa (fora do modo suporte) veria clientes/processos
  // de todas as empresas misturados — o filtro é o que mantém isso restrito a uma org por vez.
  const orgId = emSuporte ? orgOverride.org_id : profile?.org_id;

  const renderTab = () => {
    if (activeTab === "config") return <ConfigTab permissions={permissions} togglePermission={togglePermission} orgId={orgId} />;
    // Minha Empresa fica de fora do modo suporte de propósito: ela lê/grava em
    // profile.organizations/profile.org_id, que continuam sendo os do PRÓPRIO platform
    // admin — misturar com orgOverride ali daria pra editar a empresa errada por engano.
    if (activeTab === "empresa" && !emSuporte) return <MinhaEmpresaTab profile={profile} onAtualizado={refreshProfile} />;
    if (!activeTab) return <EmptyState />;
    switch (activeTab) {
      case "prazos": return <PrazosTab orgId={orgId} />;
      case "processos": return <ProcessosTab currentRole={currentRole} orgId={orgId} profile={profile} abrirProcessoId={abrirProcessoId} onAbriuProcesso={() => setAbrirProcessoId(null)} />;
      case "quadro": return <QuadroTab orgId={orgId} currentRole={currentRole} profile={profile} />;
      case "financeiro": return <FinanceiroTab orgId={orgId} abrirClienteId={abrirClienteFinanceiroId} onAbriuCliente={() => setAbrirClienteFinanceiroId(null)} />;
      case "erp": return <ErpTab orgId={orgId} />; // Visão Executiva vira sub-aba aqui dentro (ErpTab.jsx)
      case "leads": return <LeadsTab orgId={orgId} />;
      case "leads_captacao": return <LeadsCaptacaoTab orgId={orgId} currentRole={currentRole} />;
      case "clientes": return <ClientesTab currentRole={currentRole} orgId={orgId} profile={profile} onAbrirProcesso={abrirProcesso} onAbrirFinanceiro={abrirFinanceiroDoCliente} />;
      case "equipe": return <EquipeTab currentRole={currentRole} orgId={orgId} />;
      default: return <EmptyState />;
    }
  };

  return (
    <div className="min-h-screen w-full flex" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif" }}>
      <Sidebar
        allowedModules={allowedModules}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentRole={currentRole}
        emSuporte={emSuporte}
        orgNome={emSuporte ? orgOverride.nome : profile.organizations?.nome}
        mobileAberto={menuMobileAberto}
        fecharMobile={() => setMenuMobileAberto(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          profile={profile ?? { nome: "Platform admin", role: "admin", organizations: null }}
          signOut={signOut}
          onAbrirMenu={() => setMenuMobileAberto(true)}
          suporte={emSuporte ? orgOverride.nome : null}
          onSairSuporte={() => setOrgOverride(null)}
        />
        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 overflow-y-auto overflow-x-hidden">
          {trocandoAba ? <PageLoader /> : (
            <Suspense fallback={<PageLoader />}>
              <div key={activeTab} className="tab-fade-in">{renderTab()}</div>
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
}

function FullScreenMessage({ children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center text-center px-6" style={{ background: COLORS.paper, fontFamily: "'Inter', sans-serif", color: COLORS.slate }}>
      <p className="max-w-sm text-sm">{children}</p>
    </div>
  );
}
