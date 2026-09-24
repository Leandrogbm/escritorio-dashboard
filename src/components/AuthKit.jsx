import React, { useEffect, useRef, useState } from "react";
import { COLORS } from "../lib/theme.js";

// Peças compartilhadas por Login.jsx e Signup.jsx — linguagem visual do print de
// referência (card escuro "Register Identity" do codepen @ilmah), reinterpretada com a
// paleta ink/brass do Actum: label pequena maiúscula acima do campo, abas de texto com
// sublinhado na aba ativa em vez do link "Cadastrar minha empresa" solto no rodapé.
const FIELD_STYLE = { border: `1px solid ${COLORS.line}`, color: COLORS.ink, background: COLORS.paperRaised };

export function AuthField({ id, label, className = "", ...inputProps }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: COLORS.slate }}>
        {label}
      </label>
      <input id={id} className="px-3.5 py-2.5 rounded-md text-sm outline-none" style={FIELD_STYLE} {...inputProps} />
    </div>
  );
}

// `active`: "login" | "signup". Substitui o antigo link de texto "Cadastrar minha
// empresa" — a troca de componente (Login ⇄ Signup) continua igual, só a UI do seletor virou
// abas no estilo do print (sublinhado colorido que desliza até a aba ativa, referência
// "Sliding NAVBar" do codepen @ilmah — mecânica de deslizar, cores continuam ink/brass).
export function AuthTabs({ active, onLogin, onSignup }) {
  const wrapRef = useRef(null);
  const loginRef = useRef(null);
  const signupRef = useRef(null);
  const [indicator, setIndicator] = useState(null);

  useEffect(() => {
    const el = (active === "login" ? loginRef : signupRef).current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const elRect = el.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    setIndicator({ left: elRect.left - wrapRect.left, width: elRect.width });
  }, [active]);

  const tabStyle = (tab) => ({ color: active === tab ? COLORS.ink : COLORS.slate });
  return (
    <div ref={wrapRef} className="relative flex items-center justify-center gap-6 text-sm font-semibold" style={{ fontFamily: "'Source Serif 4', serif" }}>
      <button ref={loginRef} type="button" onClick={onLogin} className="pb-1.5" style={tabStyle("login")}>
        Login
      </button>
      <button ref={signupRef} type="button" onClick={onSignup} className="pb-1.5" style={tabStyle("signup")}>
        Nova empresa
      </button>
      <span
        className="absolute bottom-0 h-0.5 transition-all duration-300 ease-out"
        style={{
          background: COLORS.brass,
          left: indicator?.left ?? 0,
          width: indicator?.width ?? 0,
          opacity: indicator ? 1 : 0,
        }}
      />
    </div>
  );
}
