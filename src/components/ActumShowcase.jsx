import React, { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { COLORS } from "../lib/theme.js";
import { W, H, DURATION, FINAL_FRAME } from "./actumShowcase/utils.js";
import { renderFrame } from "./actumShowcase/scenes.js";

const FONTS = ['600 84px "Source Serif 4"', '400 30px "Source Serif 4"', "500 20px Inter", "600 20px Inter"];
const ARIA = "Animação de apresentação do Actum: a marca é desenhada, depois aparecem o painel financeiro, a linha do tempo de um processo com nova movimentação e o portal do cliente no celular.";

export default function ActumShowcase() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [userPaused, setUserPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const tRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    let vivo = true;
    const pronto = () => vivo && setFontsReady(true);
    Promise.all(FONTS.map((f) => document.fonts.load(f))).then(() => document.fonts.ready).then(pronto, pronto);
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!fontsReady) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf = 0;

    const desenhar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const largura = Math.round(canvas.clientWidth * dpr);
      if (largura && canvas.width !== largura) { canvas.width = largura; canvas.height = Math.round(largura * H / W); }
      const k = canvas.width / W;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      renderFrame(ctx, tRef.current);
    };

    const ro = new ResizeObserver(desenhar);
    ro.observe(canvas);

    if (reduced) {
      tRef.current = FINAL_FRAME;
      desenhar();
    } else if (visible && !userPaused) {
      let last = null;
      const loop = (now) => {
        if (last === null) last = now;
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        tRef.current = (tRef.current + dt) % DURATION;
        desenhar();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else {
      desenhar();
    }
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [fontsReady, visible, userPaused, reduced]);

  return (
    <section className="max-w-6xl mx-auto sm:px-8 py-8 sm:py-14">
      {/* Mobile: sem padding lateral (largura total) — o canvas é 16:9 com texto pensado pra
          desktop, cada pixel de largura ajuda a legibilidade. */}
      <div ref={wrapRef} className="relative w-full overflow-hidden sm:rounded-lg" style={{ aspectRatio: "16 / 9", background: COLORS.inkSoft, boxShadow: "0 18px 50px rgba(20,35,28,0.28)" }}>
        <canvas ref={canvasRef} role="img" aria-label={ARIA} className="block w-full h-full" />
        {!reduced && (
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? "Reproduzir animação" : "Pausar animação"}
            className="absolute bottom-3 right-3 flex items-center justify-center rounded-full p-2 opacity-60 hover:opacity-100 focus-visible:opacity-100"
            style={{ background: "rgba(34,52,44,0.75)", color: COLORS.paper }}
          >
            {userPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        )}
      </div>
    </section>
  );
}
