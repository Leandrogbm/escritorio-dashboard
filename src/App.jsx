import React, { useEffect, useMemo, useState } from "react";
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
import PrazosTab from "./components/tabs/PrazosTab.jsx";
import ProcessosTab from "./components/tabs/ProcessosTab.jsx";
import FinanceiroTab from "./components/tabs/FinanceiroTab.jsx";
import ClientesTab from "./components/tabs/ClientesTab.jsx";
import EquipeTab from "./components/tabs/EquipeTab.jsx";
import ExecutivoTab from "./components/tabs/ExecutivoTab.jsx";
import ConfigTab from "./components/tabs/ConfigTab.jsx";

export default function App() {
  const { session, profile, isPlatformAdmin, loading, recovery, clearRecovery, signOut } = useAuth();
  const { permissions, togglePermission } = useRolePermissions(profile?.org_id);
  const [activeTab, setActiveTab] = useState("prazos");
  const [verEmpresa, setVerEmpresa] = useState(false); // platform admin que também é admin de uma org: alterna pra visão normal

  const currentRole = profile?.role;
  const allowedModules = useMemo(() => {
    if (!currentRole || !permissions) return [];
    if (currentRole === "admin") return MODULES.map((m) => m.key);
    return MODULES.filter((m) => permissions[currentRole]?.includes(m.key)).map((m) => m.key);
  }, [currentRole, permissions]);

  useEffect(() => {
    if (activeTab !== "config" && !allowedModules.includes(activeTab)) {
      setActiveTab(allowedModules[0] || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole, allowedModules]);

  if (loading) return <FullScreenMessage>Carregando...</FullScreenMessage>;
  if (recovery) return <ResetPassword onDone={clearRecovery} />;
  if (!session) return <Login />;
  if (isPlatformAdmin && !verEmpresa) {
    return (
      <PlatformAdminPanel
        temPerfilProprio={profile !== null}
        onEntrarNaEmpresa={() => setVerEmpresa(true)}
        signOut={signOut}
      />
    );
  }
  if (profile === null) {
    return (
      <FullScreenMessage>
        Sua conta ainda não tem acesso liberado. Fale com o administrador do escritório.
        <button onClick={signOut} className="block mx-auto mt-4 text-sm underline" style={{ color: COLORS.brass }}>Sair</button>
      </FullScreenMessage>
    );
  }
  if (!permissions) return <FullScreenMessage>Carregando...</FullScreenMessage>;

  const renderTab = () => {
    if (activeTab === "config") return <ConfigTab permissions={permissions} togglePermission={togglePermission} />;
    if (!activeTab) return <EmptyState />;
    switch (activeTab) {
      case "prazos": return <PrazosTab />;
      case "processos": return <ProcessosTab />;
      case "financeiro": return <FinanceiroTab />;
      case "clientes": return <ClientesTab currentRole={currentRole} />;
      case "equipe": return <EquipeTab currentRole={currentRole} />;
      case "executivo": return <ExecutivoTab />;
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
        orgNome={profile.organizations?.nome}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar profile={profile} signOut={signOut} />
        <main className="flex-1 px-8 py-8 overflow-y-auto">
          {renderTab()}
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
