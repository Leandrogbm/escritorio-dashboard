import { Clock, Briefcase, DollarSign, Users, Building2, Trello, Calculator, MapPin } from "lucide-react";

export const ROLES = [
  { key: "socio", label: "Sócio(a)" },
  { key: "advogado", label: "Advogado(a)" },
  { key: "financeiro", label: "Financeiro" },
  { key: "recepcao", label: "Recepção" },
  { key: "admin", label: "Administrador(a)" },
];

// "leads_captacao" reativado (pedido do usuário: "criar um novo card com nome Leads",
// formulário público + mapa clicável por região, empresa/responsável/telefone/email —
// só é enxergado pela EMPRESA QUE PROCUROU o escritório sozinha, não é busca ativa, por
// isso não esbarra na vedação da OAB de captação de cliente (ver CLAUDE.md). "leads" (funil
// Kanban interno) continua em back log — reativar junto quando fizer sentido usar os dois.
export const MODULES = [
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "processos", label: "Processos", icon: Briefcase },
  { key: "quadro", label: "Quadro de tarefas", icon: Trello },
  { key: "prazos", label: "Prazos", icon: Clock },
  { key: "financeiro", label: "Financeiro", icon: DollarSign },
  { key: "leads_captacao", label: "Leads", icon: MapPin },
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
