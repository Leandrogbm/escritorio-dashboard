export const PRAZOS = [
  { id: 1, processo: "0001234-56.2024.8.26.0100", cliente: "Metalúrgica Bragança Ltda", tipo: "Contestação", data: "14/08/2026", responsavel: "Fernanda Duarte", dias: 2 },
  { id: 2, processo: "0005678-12.2025.5.02.0030", cliente: "João Pereira", tipo: "Recurso Ordinário", data: "15/08/2026", responsavel: "Ricardo Nassif", dias: 3 },
  { id: 3, processo: "1002233-44.2023.4.03.6100", cliente: "Comércio Vitória EIRELI", tipo: "Manifestação sobre laudo", data: "19/08/2026", responsavel: "Fernanda Duarte", dias: 7 },
  { id: 4, processo: "0009988-77.2024.8.26.0053", cliente: "Sandra Melo", tipo: "Réplica", data: "27/08/2026", responsavel: "Bruno Katz", dias: 15 },
  { id: 5, processo: "0004411-90.2025.8.26.0577", cliente: "Distribuidora Norte Sul", tipo: "Cumprimento de sentença", data: "05/09/2026", responsavel: "Ricardo Nassif", dias: 24 },
];

export const PROCESSOS = [
  { id: 1, numero: "0001234-56.2024.8.26.0100", cliente: "Metalúrgica Bragança Ltda", area: "Cível", status: "Em andamento", valor: 185000, responsavel: "Fernanda Duarte" },
  { id: 2, numero: "0005678-12.2025.5.02.0030", cliente: "João Pereira", area: "Trabalhista", status: "Aguardando decisão", valor: 42000, responsavel: "Ricardo Nassif" },
  { id: 3, numero: "1002233-44.2023.4.03.6100", cliente: "Comércio Vitória EIRELI", area: "Tributário", status: "Em andamento", valor: 612000, responsavel: "Fernanda Duarte" },
  { id: 4, numero: "0009988-77.2024.8.26.0053", cliente: "Sandra Melo", area: "Família", status: "Suspenso", valor: 0, responsavel: "Bruno Katz" },
  { id: 5, numero: "0004411-90.2025.8.26.0577", cliente: "Distribuidora Norte Sul", area: "Empresarial", status: "Em andamento", valor: 298000, responsavel: "Ricardo Nassif" },
  { id: 6, numero: "0007766-21.2024.8.26.0011", cliente: "Paulo Zanetti", area: "Cível", status: "Aguardando decisão", valor: 76000, responsavel: "Bruno Katz" },
];

export const HONORARIOS = [
  { cliente: "Metalúrgica Bragança Ltda", valor: 18500, vencimento: "20/08/2026", status: "Em aberto" },
  { cliente: "Comércio Vitória EIRELI", valor: 34200, vencimento: "10/08/2026", status: "Vencido" },
  { cliente: "Distribuidora Norte Sul", valor: 9800, vencimento: "28/08/2026", status: "Em aberto" },
  { cliente: "Sandra Melo", valor: 4200, vencimento: "02/08/2026", status: "Vencido" },
];

export const CLIENTES = [
  { nome: "Metalúrgica Bragança Ltda", tipo: "PJ", origem: "Indicação", contrato: "12/2026" },
  { nome: "João Pereira", tipo: "PF", origem: "Site", contrato: "—" },
  { nome: "Comércio Vitória EIRELI", tipo: "PJ", origem: "Indicação", contrato: "09/2026" },
  { nome: "Sandra Melo", tipo: "PF", origem: "Indicação", contrato: "—" },
  { nome: "Distribuidora Norte Sul", tipo: "PJ", origem: "Evento OAB", contrato: "03/2027" },
  { nome: "Paulo Zanetti", tipo: "PF", origem: "Site", contrato: "—" },
];

export const EQUIPE = [
  { nome: "Fernanda Duarte", cargo: "Sócia", ativos: 14, horas: 142, meta: 160 },
  { nome: "Ricardo Nassif", cargo: "Advogado Sênior", ativos: 11, horas: 158, meta: 160 },
  { nome: "Bruno Katz", cargo: "Advogado Pleno", ativos: 9, horas: 121, meta: 150 },
  { nome: "Camila Yoshida", cargo: "Advogada Júnior", ativos: 6, horas: 96, meta: 140 },
];

export const RECEITA_AREA = [
  { area: "Cível", valor: 98000 },
  { area: "Trabalhista", valor: 64000 },
  { area: "Tributário", valor: 71000 },
  { area: "Empresarial", valor: 39000 },
  { area: "Família", valor: 12500 },
];

export const BRL = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
