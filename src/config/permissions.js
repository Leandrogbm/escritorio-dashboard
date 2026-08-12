import { Clock, Briefcase, DollarSign, Users, Building2, TrendingUp } from "lucide-react";

export const ROLES = [
  { key: "socio", label: "Sócio(a)" },
  { key: "advogado", label: "Advogado(a)" },
  { key: "financeiro", label: "Financeiro" },
  { key: "recepcao", label: "Recepção" },
  { key: "admin", label: "Administrador(a)" },
];

export const MODULES = [
  { key: "prazos", label: "Prazos", icon: Clock },
  { key: "processos", label: "Processos", icon: Briefcase },
  { key: "financeiro", label: "Financeiro", icon: DollarSign },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "equipe", label: "Equipe", icon: Building2 },
  { key: "executivo", label: "Visão Executiva", icon: TrendingUp },
];

// Defina aqui quais abas cada perfil enxerga por padrão.
// O admin pode ajustar isso em tempo real pela aba "Configurações".
export const DEFAULT_PERMISSIONS = {
  socio: ["prazos", "processos", "financeiro", "clientes", "equipe", "executivo"],
  advogado: ["prazos", "processos", "clientes"],
  financeiro: ["financeiro", "clientes"],
  recepcao: ["prazos", "clientes"],
  admin: ["prazos", "processos", "financeiro", "clientes", "equipe", "executivo"],
};
