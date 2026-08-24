import { Clock, Briefcase, DollarSign, Users, Building2, TrendingUp, Trello, UserPlus } from "lucide-react";

export const ROLES = [
  { key: "socio", label: "Sócio(a)" },
  { key: "advogado", label: "Advogado(a)" },
  { key: "financeiro", label: "Financeiro" },
  { key: "recepcao", label: "Recepção" },
  { key: "admin", label: "Administrador(a)" },
];

export const MODULES = [
  { key: "leads", label: "Leads", icon: UserPlus },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "processos", label: "Processos", icon: Briefcase },
  { key: "quadro", label: "Quadro de tarefas", icon: Trello },
  { key: "prazos", label: "Prazos", icon: Clock },
  { key: "financeiro", label: "Financeiro", icon: DollarSign },
  { key: "equipe", label: "Equipe", icon: Building2 },
  { key: "executivo", label: "Visão Executiva", icon: TrendingUp },
];

// A matriz de permissões (quais abas cada perfil enxerga) agora vive na tabela
// role_permissions do Supabase — ver supabase/schema.sql e src/hooks/useRolePermissions.js.
// O seed inicial ali é uma cópia 1:1 do que era este DEFAULT_PERMISSIONS.
