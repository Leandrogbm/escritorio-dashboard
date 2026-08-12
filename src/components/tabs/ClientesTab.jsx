import React from "react";
import { Users } from "lucide-react";
import Card from "../Card.jsx";
import SectionTitle from "../SectionTitle.jsx";
import { COLORS } from "../../lib/theme.js";
import { CLIENTES } from "../../data/mockData.js";

export default function ClientesTab() {
  return (
    <div>
      <SectionTitle icon={Users} title="Clientes" subtitle="Base de clientes e contratos" />
      <Card className="overflow-hidden !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: COLORS.ink }}>
              {["Cliente", "Tipo", "Origem", "Renovação de contrato"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.paper, fontSize: 11 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLIENTES.map((c, i) => (
              <tr key={c.nome} style={{ borderTop: `1px solid ${COLORS.line}`, background: i % 2 ? "#FAF9F5" : COLORS.paperRaised }}>
                <td className="px-4 py-3" style={{ color: COLORS.ink }}>{c.nome}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.tipo}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.origem}</td>
                <td className="px-4 py-3" style={{ color: COLORS.slate }}>{c.contrato}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
