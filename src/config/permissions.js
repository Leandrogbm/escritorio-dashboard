import { Clock, Briefcase, DollarSign, Users, Building2, Trello, Calculator, Sunrise } from "lucide-react";

export const ROLES = [
  { key: "socio", label: "Sócio(a)" },
  { key: "advogado", label: "Advogado(a)" },
  { key: "financeiro", label: "Financeiro" },
  { key: "recepcao", label: "Recepção" },
  { key: "admin", label: "Administrador(a)" },
];

// ponytail: "leads" (funil Kanban) e "leads_captacao" (formulário público + mapa) de volta
// ao back log — pedido do usuário ("tire essa aba leads") depois de ter pedido, 3x seguidas,
// uma versão de busca ATIVA de empresa por região/raio (recusada, ver CLAUDE.md/
// ROADMAP-comparativo.md — vedação OAB arts. 5º-7º/39-41). Componentes/tabela/Edge Function
// continuam intactos (LeadForm.jsx, LeadsCaptacaoTab.jsx, LeadsMap.jsx, LeadsList.jsx,
// leads_captacao) — só a UI some. Reativar: colocar "leads_captacao" de volta aqui.
export const MODULES = [
  { key: "hoje", label: "Hoje", icon: Sunrise },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "processos", label: "Processos", icon: Briefcase },
  { key: "quadro", label: "Quadro de tarefas", icon: Trello },
  { key: "prazos", label: "Prazos", icon: Clock },
  { key: "financeiro", label: "Financeiro", icon: DollarSign },
  // Visão Executiva não é mais módulo próprio — virou sub-aba dentro do ERP (pedido do
  // usuário: "visão executiva tem que ser um adereço dentro do ERP"). Quem tem acesso ao
  // ERP já vê as duas; ExecutivoTab.jsx continua existindo como componente, só não tem
  // mais rota/permissão separada (ver ErpTab.jsx e App.jsx).
  { key: "erp", label: "ERP", icon: Calculator },
  { key: "equipe", label: "Equipe", icon: Building2 },
];

// A matriz de permissões (quais abas cada perfil enxerga) agora vive na tabela
// role_permissions do Supabase — ver supabase/schema.sql e src/hooks/useRolePermissions.js.
// O seed inicial ali é uma cópia 1:1 do que era este DEFAULT_PERMISSIONS.
