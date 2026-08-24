import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import Stamp from "./Stamp.jsx";
import { COLORS } from "../lib/theme.js";
import { useEscClose } from "../hooks/useEscClose.js";

const ALTURA_ESTIMADA_ITEM = 36;

// Selo de status clicável — abre uma lista curta pra trocar na hora, sem precisar abrir o
// formulário de editar só pra isso. `tone`: mesmo mapa {status: "ok"|"warn"|"neutral"|"urgent"}
// que o Stamp já usa.
//
// A lista é renderizada num portal (document.body) com position:fixed calculado pela posição
// real do botão — dentro de tabela com scroll/Card com overflow-hidden, um dropdown `absolute`
// comum fica cortado ou some quando a linha tá perto do fim da página. Portal escapa disso.
export default function StatusPicker({ value, options, tone, onChange }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState(null); // {top, left, abrirPraCima}
  const botaoRef = useRef(null);
  useEscClose(() => setAberto(false), aberto);

  useLayoutEffect(() => {
    if (!aberto || !botaoRef.current) return;
    const calcular = () => {
      const r = botaoRef.current.getBoundingClientRect();
      const alturaMenu = options.length * ALTURA_ESTIMADA_ITEM + 8;
      const espacoEmbaixo = window.innerHeight - r.bottom;
      const abrirPraCima = espacoEmbaixo < alturaMenu && r.top > alturaMenu;
      setPos({
        left: Math.min(r.left, window.innerWidth - 176), // 160 de minWidth + folga, não deixa vazar na direita
        top: abrirPraCima ? r.top - alturaMenu - 4 : r.bottom + 4,
      });
    };
    calcular();
    window.addEventListener("scroll", calcular, true);
    window.addEventListener("resize", calcular);
    return () => {
      window.removeEventListener("scroll", calcular, true);
      window.removeEventListener("resize", calcular);
    };
  }, [aberto, options.length]);

  return (
    <div className="inline-block" onClick={(e) => e.stopPropagation()}>
      <button ref={botaoRef} onClick={() => setAberto((v) => !v)} className="flex items-center gap-1 hover:opacity-80">
        <Stamp tone={tone[value]}>{value}</Stamp>
        <ChevronDown size={12} color={COLORS.slate} />
      </button>

      {aberto && pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div
            className="fixed z-50 rounded-lg overflow-hidden py-1"
            style={{ top: pos.top, left: pos.left, minWidth: 160, background: "#fff", border: `1px solid ${COLORS.line}`, boxShadow: "0 8px 24px rgba(22,35,59,0.14)" }}
          >
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setAberto(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:opacity-70"
                style={{ color: COLORS.ink, fontWeight: opt === value ? 600 : 400, background: opt === value ? "rgba(165,121,59,0.08)" : "transparent" }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
