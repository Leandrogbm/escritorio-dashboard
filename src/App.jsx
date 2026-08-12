import React, { useState, useEffect, useMemo } from "react";
import { COLORS } from "./lib/theme.js";
import { MODULES, DEFAULT_PERMISSIONS } from "./config/permissions.js";
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
  const [currentRole, setCurrentRole] = useState("socio");
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [activeTab, setActiveTab] = useState("prazos");

  const allowedModules = useMemo(() => {
    if (currentRole === "admin") return MODULES.map((m) => m.key);
    return MODULES.filter((m) => permissions[currentRole].includes(m.key)).map((m) => m.key);
  }, [currentRole, permissions]);

  useEffect(() => {
    if (activeTab !== "config" && !allowedModules.includes(activeTab)) {
      setActiveTab(allowedModules[0] || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole, allowedModules]);

  const togglePermission = (role, moduleKey) => {
    setPermissions((prev) => {
      const has = prev[role].includes(moduleKey);
      return {
        ...prev,
        [role]: has ? prev[role].filter((k) => k !== moduleKey) : [...prev[role], moduleKey],
      };
    });
  };

  const renderTab = () => {
    if (activeTab === "config") return <ConfigTab permissions={permissions} togglePermission={togglePermission} />;
    if (!activeTab) return <EmptyState />;
    switch (activeTab) {
      case "prazos": return <PrazosTab />;
      case "processos": return <ProcessosTab />;
      case "financeiro": return <FinanceiroTab />;
      case "clientes": return <ClientesTab />;
      case "equipe": return <EquipeTab />;
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
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar currentRole={currentRole} setCurrentRole={setCurrentRole} />
        <main className="flex-1 px-8 py-8 overflow-y-auto">
          {renderTab()}
        </main>
      </div>
    </div>
  );
}
