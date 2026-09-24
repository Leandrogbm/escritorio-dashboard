import { W, H, C, SERIF, SANS, clamp, seg, lerp, eOut, eInOut, eBack, brl, rr, text, strokePoly } from "./utils.js";

const LOGO = [
  { w: 6, pts: [[-30, -45], [30, -45]] },
  { w: 7, pts: [[-44, -34], [44, -34]] },
  { w: 4, pts: [[-36, -24], [-36, 14], [-26, 32], [-12, 44], [0, 50]] },
  { w: 4, pts: [[36, -24], [36, 14], [26, 32], [12, 44], [0, 50]] },
  { w: 4, pts: [[-25, -24], [-25, 28]] },
  { w: 4, pts: [[-14, -24], [-14, 38]] },
  { w: 4, pts: [[14, -24], [14, 38]] },
  { w: 4, pts: [[25, -24], [25, 28]] },
  { w: 4, pts: [[0, -24], [0, -7]] },
  { w: 4, pts: [[0, 15], [0, 46]] },
  { circle: true, w: 4 },
  { arrow: true, w: 5, pts: [[10, 4], [64, 4]] },
  { arrow: true, w: 5, pts: [[52, -7], [65, 4], [52, 15]] },
];

export function drawLogo(ctx, x, y, s, p, bg) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineCap = "butt"; ctx.lineJoin = "miter";
  const n = LOGO.length;
  LOGO.forEach((st, i) => {
    const a = i / n * 0.7;
    const q = eOut(seg(p, a, a + 0.3));
    if (q <= 0) return;
    if (st.circle) {
      ctx.fillStyle = C.bronze;
      ctx.beginPath(); ctx.arc(0, 4, 9 * eBack(q), 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (st.arrow && bg) { ctx.strokeStyle = bg; ctx.lineWidth = st.w + 7; strokePoly(ctx, st.pts, q); }
    ctx.strokeStyle = C.bronze; ctx.lineWidth = st.w;
    strokePoly(ctx, st.pts, q);
  });
  ctx.restore();
}

function drawScales(ctx, x, y, s, p, tilt) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = C.bronze; ctx.fillStyle = C.bronze; ctx.lineWidth = 3; ctx.lineCap = "round";
  strokePoly(ctx, [[0, -22], [0, 26]], eOut(seg(p, 0, 0.4)));
  strokePoly(ctx, [[-14, 26], [14, 26]], eOut(seg(p, 0.2, 0.5)));
  const q = eOut(seg(p, 0.35, 0.8));
  ctx.save(); ctx.rotate(tilt);
  strokePoly(ctx, [[-22, -14], [22, -14]], q);
  ctx.restore();
  const ends = [-1, 1].map((d) => [d * 22 * Math.cos(tilt), d * 22 * Math.sin(tilt) - 14]);
  const pq = eOut(seg(p, 0.6, 1));
  ends.forEach(([ex, ey]) => {
    ctx.globalAlpha = pq;
    strokePoly(ctx, [[ex, ey], [ex - 8, ey + 16]], pq);
    strokePoly(ctx, [[ex, ey], [ex + 8, ey + 16]], pq);
    ctx.beginPath(); ctx.arc(ex, ey + 16, 9, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex - 9, ey + 16); ctx.lineTo(ex + 9, ey + 16); ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(0, -24, 3.5 * q, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFacade(ctx, t) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 115, W, H - 115); ctx.clip();
  const drift = t * 6;
  ctx.strokeStyle = "rgba(242,240,233,0.045)"; ctx.lineWidth = 2;
  for (let i = -4; i < 30; i++) {
    const x0 = 1150 + i * 46 - drift;
    ctx.beginPath(); ctx.moveTo(x0, 115); ctx.lineTo(x0 - 420 + i * 18, H); ctx.stroke();
  }
  for (let j = 0; j < 12; j++) {
    const y = 180 + j * 78 + (drift * 0.4) % 78;
    ctx.beginPath(); ctx.moveTo(1300, y); ctx.lineTo(W, y - 260); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(242,240,233,0.03)";
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 62 + drift * 0.3;
    ctx.beginPath(); ctx.moveTo(x, 115); ctx.lineTo(x, H); ctx.stroke();
  }
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "rgba(34,52,44,0.0)"); g.addColorStop(0.5, "rgba(34,52,44,0.35)"); g.addColorStop(1, "rgba(34,52,44,0.0)");
  ctx.fillStyle = g; ctx.fillRect(0, 115, W, H);
  ctx.restore();
}

const HEAD = [
  [["A", 0], ["gestão", 0], ["do", 0], ["escritório,", 0], ["com", 0], ["o", 0]],
  [["rigor", 0], ["de", 0], ["um", 0], ["processo", 1], ["bem", 1]],
  [["instruído.", 1]],
];

function drawHeadline(ctx, t, t0, alpha) {
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.font = `600 84px ${SERIF}`; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  const space = ctx.measureText(" ").width;
  let k = 0;
  HEAD.forEach((line, li) => {
    let x = 190; const y = 400 + li * 96;
    line.forEach(([w, acc]) => {
      const q = eOut(seg(t, t0 + k * 0.07, t0 + k * 0.07 + 0.55));
      ctx.save(); ctx.globalAlpha *= q;
      ctx.fillStyle = acc ? C.tan : C.cream;
      ctx.fillText(w, x, y + (1 - q) * 30);
      ctx.restore();
      x += ctx.measureText(w).width + space; k++;
    });
  });
  const sq = eOut(seg(t, t0 + 1.5, t0 + 2.2));
  ctx.globalAlpha *= sq;
  ["Clientes, processos, prazos, financeiro e equipe num só lugar,",
    "com acompanhamento automático do andamento processual e",
    "portal para o seu cliente acompanhar sozinho."].forEach((l, i) =>
    text(ctx, l, 190, 650 + i * 46 + (1 - sq) * 16, `400 30px ${SANS}`, "rgba(242,240,233,0.72)"));
  ctx.restore();
}

const MW = 1100, MH = 640;
const NAV = ["Painel", "Clientes", "Processos", "Prazos", "Financeiro", "Equipe"];
const ROWS = [
  ["Contestação: Almeida x Banco Horizonte", "Proc. 1004512-33.2026.8.26.0576", "Hoje", C.bad],
  ["Manifestação sobre laudo pericial", "Proc. 0009821-11.2025.8.26.0576", "Amanhã", C.bronze],
  ["Recurso inominado: Souza", "Proc. 1002877-90.2026.8.26.0576", "Qui", C.muted],
  ["Audiência de conciliação: Farias", "Proc. 1006120-05.2026.8.26.0576", "Sex", C.muted],
];
const MONTHS = ["abr", "mai", "jun", "jul", "ago", "set"];
const REC = [9.8, 11.2, 10.4, 13.9, 15.1, 18.65];
const STEPS = [["Distribuição", "12/03"], ["Citação", "02/04"], ["Contestação", "28/04"], ["Réplica", "20/05"], ["Saneamento", "30/06"], ["Audiência designada", "Hoje"]];

function drawDashboard(ctx, t) {
  const cards = [
    ["A pagar (mês)", 4230, 0.62, C.bronze],
    ["Recebido (mês)", 18650, 0.78, C.ok],
    ["Prazos abertos", 7, 0.4, C.bad],
  ];
  const cq = eOut(seg(t, 9.2, 10.8));
  cards.forEach(([label, val, frac, col], i) => {
    const x = 214 + i * 295, y = 76;
    rr(ctx, x, y, 272, 118, 10); ctx.fillStyle = "#EDE9DF"; ctx.fill();
    text(ctx, label, x + 20, y + 34, `400 16px ${SANS}`, C.muted);
    const v = t < 9.2 ? val : val * cq;
    text(ctx, i === 2 ? String(Math.round(v)) : brl(v), x + 20, y + 72, `600 30px ${SANS}`, C.ink);
    rr(ctx, x + 20, y + 88, 232, 10, 5); ctx.fillStyle = "#DCD5C6"; ctx.fill();
    const f = t < 9.2 ? frac : frac * cq;
    if (f > 0.02) { rr(ctx, x + 20, y + 88, 232 * f, 10, 5); ctx.fillStyle = col; ctx.fill(); }
  });

  text(ctx, "Prazos desta semana", 214, 246, `600 22px ${SERIF}`, C.ink);
  ROWS.forEach(([title, sub, when, col], i) => {
    const q = eOut(seg(t, 9.8 + i * 0.18, 10.4 + i * 0.18));
    const y = 264 + i * 82;
    ctx.save(); ctx.globalAlpha *= (t < 9 ? 1 : q); ctx.translate((t < 9 ? 0 : (1 - q) * 30), 0);
    rr(ctx, 214, y, 500, 70, 9); ctx.fillStyle = "#EDE9DF"; ctx.fill();
    if (t < 9) {
      rr(ctx, 236, y + 26, 300, 12, 6); ctx.fillStyle = "#DCD5C6"; ctx.fill();
      rr(ctx, 620, y + 22, 72, 24, 12); ctx.fill();
    } else {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(236, y + 35, 6, 0, 7); ctx.fill();
      text(ctx, title, 254, y + 31, `500 17px ${SANS}`, C.ink);
      text(ctx, sub, 254, y + 54, `400 14px ${SANS}`, C.muted);
      ctx.font = `600 14px ${SANS}`; const pw = ctx.measureText(when).width + 26;
      rr(ctx, 694 - pw, y + 23, pw, 26, 13); ctx.fillStyle = col === C.muted ? "#DCD5C6" : col; ctx.fill();
      text(ctx, when, 694 - pw / 2, y + 41, `600 14px ${SANS}`, col === C.muted ? C.ink : "#fff", "center");
    }
    ctx.restore();
  });

  const px = 740, py = 226, pw = 336, ph = 390;
  rr(ctx, px, py, pw, ph, 10); ctx.fillStyle = "#EDE9DF"; ctx.fill();
  text(ctx, "Recebimentos", px + 22, py + 40, `600 22px ${SERIF}`, C.ink);
  text(ctx, "últimos 6 meses", px + 22, py + 66, `400 15px ${SANS}`, C.muted);
  const q = t < 9 ? 0 : eInOut(seg(t, 10.2, 11.8));
  const gx = px + 30, gw = pw - 60, gy = py + 110, gh = 210;
  const pts = REC.map((v, i) => [gx + i * gw / 5, gy + gh - (v - 8) / 12 * gh]);
  ctx.strokeStyle = "#DCD5C6"; ctx.lineWidth = 1;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(gx, gy + k * gh / 3); ctx.lineTo(gx + gw, gy + k * gh / 3); ctx.stroke(); }
  MONTHS.forEach((m, i) => text(ctx, m, pts[i][0], gy + gh + 30, `400 14px ${SANS}`, C.muted, "center"));
  if (q > 0) {
    ctx.save();
    ctx.beginPath(); ctx.rect(gx - 10, gy - 40, (gw + 20) * q, gh + 60); ctx.clip();
    const grad = ctx.createLinearGradient(0, gy, 0, gy + gh);
    grad.addColorStop(0, "rgba(46,139,87,0.28)"); grad.addColorStop(1, "rgba(46,139,87,0)");
    ctx.beginPath(); ctx.moveTo(pts[0][0], gy + gh);
    pts.forEach((p) => ctx.lineTo(p[0], p[1])); ctx.lineTo(pts[5][0], gy + gh); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = C.ok; ctx.lineWidth = 3.5; ctx.lineJoin = "round";
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    ctx.restore();
    const dq = eBack(seg(t, 11.7, 12.1));
    if (dq > 0) {
      const [lx, ly] = pts[5];
      ctx.fillStyle = C.ok; ctx.beginPath(); ctx.arc(lx, ly, 7 * dq, 0, 7); ctx.fill();
      ctx.save(); ctx.globalAlpha *= clamp(dq);
      rr(ctx, lx - 108, ly - 50, 100, 32, 6); ctx.fillStyle = C.green; ctx.fill();
      text(ctx, "R$ 18.650", lx - 58, ly - 28, `600 15px ${SANS}`, C.cream, "center");
      ctx.restore();
    }
  }
}

function drawProcess(ctx, t) {
  text(ctx, "Processo 1002345-67.2026.8.26.0576", 214, 104, `600 30px ${SERIF}`, C.ink);
  text(ctx, "Ação de indenização por danos morais   |   Cliente: Marina Costa", 214, 136, `400 17px ${SANS}`, C.muted);
  rr(ctx, 830, 80, 246, 36, 18); ctx.fillStyle = "rgba(46,139,87,0.12)"; ctx.fill();
  const pulse = (t * 1.2) % 1;
  ctx.fillStyle = `rgba(46,139,87,${1 - pulse})`; ctx.beginPath(); ctx.arc(852, 98, 6 + pulse * 10, 0, 7); ctx.fill();
  ctx.fillStyle = C.ok; ctx.beginPath(); ctx.arc(852, 98, 6, 0, 7); ctx.fill();
  text(ctx, "Monitoramento ativo", 870, 104, `500 16px ${SANS}`, C.ok);

  const x0 = 260, x1 = 990, ty = 250;
  const xs = STEPS.map((_, i) => lerp(x0, x1, i / 5));
  ctx.strokeStyle = "#DCD5C6"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x0, ty); ctx.lineTo(xs[4], ty); ctx.stroke();
  const prog = eInOut(seg(t, 12.7, 14.2)) * 4;
  ctx.strokeStyle = C.green; ctx.beginPath(); ctx.moveTo(x0, ty); ctx.lineTo(lerp(x0, xs[4], prog / 4), ty); ctx.stroke();
  const nq = eOut(seg(t, 14.3, 14.9));
  if (nq > 0) {
    ctx.strokeStyle = C.bronze; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(xs[4], ty); ctx.lineTo(lerp(xs[4], xs[5], nq), ty); ctx.stroke();
    ctx.setLineDash([]);
  }
  STEPS.forEach(([name, date], i) => {
    const last = i === 5;
    const on = last ? nq : clamp(prog - i + 1);
    if (last && nq <= 0) return;
    ctx.save(); if (last) ctx.globalAlpha *= nq;
    if (last) {
      const g = (Math.sin(t * 4) + 1) / 2;
      ctx.fillStyle = `rgba(165,121,59,${0.18 + g * 0.18})`; ctx.beginPath(); ctx.arc(xs[i], ty, 26, 0, 7); ctx.fill();
    }
    ctx.fillStyle = on > 0.5 ? (last ? C.bronze : C.green) : "#EDE9DF";
    ctx.strokeStyle = last ? C.bronze : (on > 0.5 ? C.green : "#CFC7B6"); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(xs[i], ty, 13, 0, 7); ctx.fill(); ctx.stroke();
    if (on > 0.5 && !last) {
      ctx.strokeStyle = C.cream; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(xs[i] - 5, ty); ctx.lineTo(xs[i] - 1, ty + 4); ctx.lineTo(xs[i] + 6, ty - 4); ctx.stroke();
    }
    text(ctx, name, xs[i], ty + 48, `${last ? 600 : 500} 15px ${SANS}`, last ? C.bronze : C.ink, "center");
    text(ctx, date, xs[i], ty + 70, `400 14px ${SANS}`, C.muted, "center");
    ctx.restore();
  });

  const cq = eOut(seg(t, 14.6, 15.1));
  if (cq > 0) {
    ctx.save(); ctx.globalAlpha *= cq; ctx.translate(0, (1 - cq) * 20);
    rr(ctx, 214, 372, 862, 132, 10); ctx.fillStyle = "#EDE9DF"; ctx.fill();
    ctx.fillStyle = C.bronze; ctx.fillRect(214, 372, 5, 132);
    text(ctx, "Nova movimentação, capturada hoje às 09h12", 244, 410, `500 15px ${SANS}`, C.bronze);
    const full = "Decisão: designada audiência de instrução para 15/10/2026, às 14h.";
    const n = Math.floor(full.length * seg(t, 14.9, 16.0));
    text(ctx, full.slice(0, n), 244, 452, `400 24px ${SERIF}`, C.ink);
    if (n < full.length && Math.floor(t * 3) % 2 === 0) {
      ctx.font = `400 24px ${SERIF}`; const w = ctx.measureText(full.slice(0, n)).width;
      ctx.fillStyle = C.ink; ctx.fillRect(246 + w, 432, 2, 26);
    }
    ctx.restore();
  }
  [["Prazo criado na agenda: 15/10, 14h", 15.6], ["Cliente avisado pelo portal", 16.0]].forEach(([label, at], i) => {
    const q = eBack(seg(t, at, at + 0.45));
    if (q <= 0) return;
    ctx.save(); ctx.globalAlpha *= clamp(q);
    ctx.font = `500 16px ${SANS}`; const w = ctx.measureText(label).width + 60;
    const x = i === 0 ? 214 : 214 + 400;
    ctx.translate(x + w / 2, 556); ctx.scale(q, q); ctx.translate(-(x + w / 2), -556);
    rr(ctx, x, 536, w, 40, 20); ctx.fillStyle = C.green; ctx.fill();
    ctx.strokeStyle = C.tan; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x + 18, 556); ctx.lineTo(x + 24, 562); ctx.lineTo(x + 34, 550); ctx.stroke();
    text(ctx, label, x + 44, 562, `500 16px ${SANS}`, C.cream);
    ctx.restore();
  });
}

function drawMockup(ctx, t, s) {
  ctx.save();
  ctx.shadowColor = "rgba(10,20,15,0.45)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  rr(ctx, -16, -16, MW + 32, MH + 32, 22); ctx.fillStyle = C.greenD; ctx.fill();
  ctx.restore();
  rr(ctx, 0, 0, MW, MH, 12); ctx.fillStyle = C.cream; ctx.fill();
  ctx.save(); rr(ctx, 0, 0, MW, MH, 12); ctx.clip();

  ctx.fillStyle = "#EAE6DC"; ctx.fillRect(0, 0, MW, 52);
  [C.bad, C.bronze, C.ok].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(28 + i * 26, 26, 8, 0, 7); ctx.fill(); });
  rr(ctx, 110, 12, 420, 28, 14); ctx.fillStyle = "#F6F4EE"; ctx.fill();
  const url = s.proc > 0.5 ? "actumjus.com.br/erp/processos" : "actumjus.com.br/erp";
  text(ctx, url, 128, 31, `400 16px ${SANS}`, C.muted);

  ctx.fillStyle = "#ECE7DC"; ctx.fillRect(0, 52, 190, MH - 52);
  drawLogo(ctx, 34, 92, 0.3, 1, "#ECE7DC");
  text(ctx, "Actum", 58, 100, `600 22px ${SERIF}`, C.ink);
  const hy = 140 + s.nav * 46;
  rr(ctx, 12, hy, 166, 38, 7); ctx.fillStyle = "rgba(165,121,59,0.16)"; ctx.fill();
  ctx.fillStyle = C.bronze; ctx.fillRect(12, hy + 8, 3, 22);
  NAV.forEach((n, i) => text(ctx, n, 32, 165 + i * 46, `${Math.abs(s.nav - i) < 0.5 ? 600 : 400} 17px ${SANS}`, Math.abs(s.nav - i) < 0.5 ? C.ink : C.muted));

  if (s.dash > 0) { ctx.save(); ctx.globalAlpha *= s.dash; drawDashboard(ctx, t); ctx.restore(); }
  if (s.proc > 0) { ctx.save(); ctx.globalAlpha *= s.proc; drawProcess(ctx, t); ctx.restore(); }
  ctx.restore();
}

function drawPhone(ctx, t) {
  const PW = 380, PH = 760;
  ctx.save();
  ctx.shadowColor = "rgba(10,20,15,0.5)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
  rr(ctx, -14, -14, PW + 28, PH + 28, 56); ctx.fillStyle = C.greenD; ctx.fill();
  ctx.restore();
  rr(ctx, 0, 0, PW, PH, 44); ctx.fillStyle = C.cream; ctx.fill();
  ctx.save(); rr(ctx, 0, 0, PW, PH, 44); ctx.clip();
  ctx.fillStyle = C.green; ctx.fillRect(0, 0, PW, 170);
  rr(ctx, PW / 2 - 60, 12, 120, 30, 15); ctx.fillStyle = "#111a15"; ctx.fill();
  text(ctx, "14:02", 34, 34, `600 15px ${SANS}`, C.cream);
  drawLogo(ctx, 46, 90, 0.34, 1, C.green);
  text(ctx, "Portal do cliente", 76, 97, `500 17px ${SANS}`, "rgba(242,240,233,0.8)");
  text(ctx, "Olá, Marina", 30, 146, `600 34px ${SERIF}`, C.cream);

  const item = (i, fn) => {
    const q = eOut(seg(t, 17.4 + i * 0.3, 18.0 + i * 0.3));
    if (q <= 0) return;
    ctx.save(); ctx.globalAlpha *= q; ctx.translate(0, (1 - q) * 24); fn(); ctx.restore();
  };
  item(0, () => {
    rr(ctx, 20, 192, PW - 40, 150, 16); ctx.fillStyle = "#EDE9DF"; ctx.fill();
    text(ctx, "Seu processo", 40, 226, `400 15px ${SANS}`, C.muted);
    text(ctx, "Ação de indenização", 40, 258, `600 22px ${SERIF}`, C.ink);
    text(ctx, "Fase de instrução", 40, 290, `500 16px ${SANS}`, C.bronze);
    for (let k = 0; k < 6; k++) {
      rr(ctx, 40 + k * 50, 310, 42, 8, 4);
      ctx.fillStyle = k < 5 ? C.green : (k === 5 ? C.bronze : "#DCD5C6"); ctx.fill();
    }
  });
  item(1, () => {
    rr(ctx, 20, 360, PW - 40, 110, 16); ctx.fillStyle = C.green; ctx.fill();
    rr(ctx, 40, 384, 54, 60, 8); ctx.fillStyle = C.cream; ctx.fill();
    ctx.fillStyle = C.bronze; ctx.fillRect(40, 384, 54, 16);
    text(ctx, "out", 67, 397, `600 12px ${SANS}`, C.cream, "center");
    text(ctx, "15", 67, 434, `600 24px ${SANS}`, C.ink, "center");
    text(ctx, "Audiência de instrução", 110, 408, `600 18px ${SANS}`, C.cream);
    text(ctx, "15 de outubro, às 14h", 110, 436, `400 16px ${SANS}`, "rgba(242,240,233,0.75)");
  });
  const ups = ["O juiz marcou a audiência", "Seu advogado apresentou a defesa", "A outra parte foi notificada"];
  ups.forEach((u, i) => item(2 + i, () => {
    const y = 506 + i * 72;
    ctx.fillStyle = i === 0 ? C.bronze : C.ok; ctx.beginPath(); ctx.arc(44, y + 18, 13, 0, 7); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(38, y + 18); ctx.lineTo(42, y + 22); ctx.lineTo(50, y + 13); ctx.stroke();
    text(ctx, u, 70, y + 16, `500 16px ${SANS}`, C.ink);
    text(ctx, ["hoje", "28 de abril", "2 de abril"][i], 70, y + 38, `400 14px ${SANS}`, C.muted);
    if (i < 2) { ctx.fillStyle = "#DCD5C6"; ctx.fillRect(43, y + 34, 2, 40); }
  }));
  ctx.restore();
}

const CAPS = [
  ["Financeiro e prazos no mesmo painel", 9.4, 12.2],
  ["Andamento processual acompanhado sozinho", 12.6, 16.4],
  ["Seu cliente acompanha tudo pelo portal", 16.8, 19.6],
];

function drawCaptions(ctx, t) {
  CAPS.forEach(([c, a, b]) => {
    const q = Math.min(eOut(seg(t, a, a + 0.5)), 1 - seg(t, b - 0.4, b));
    if (q <= 0) return;
    ctx.save(); ctx.globalAlpha *= q;
    ctx.fillStyle = C.bronze; ctx.fillRect(190, 1002, 36 * q, 3);
    text(ctx, c, 244, 1014, `400 32px ${SERIF}`, C.cream);
    ctx.restore();
  });
}

function drawIntro(ctx, t) {
  const move = eInOut(seg(t, 3.0, 4.0));
  const lp = seg(t, 0.3, 2.4);
  const lx = lerp(960, 215, move), ly = lerp(430, 57, move), ls = lerp(3.2, 0.42, move);
  const wq = eOut(seg(t, 1.9, 2.7));

  const rise = eInOut(seg(t, 3.2, 4.2));
  const gTop = lerp(H, 115, rise);
  if (rise > 0) {
    ctx.fillStyle = C.green; ctx.fillRect(0, gTop, W, H - gTop);
    ctx.save(); ctx.beginPath(); ctx.rect(0, gTop, W, H); ctx.clip(); drawFacade(ctx, t); ctx.restore();
  }

  drawLogo(ctx, lx, ly, ls, lp, C.cream);
  ctx.save(); ctx.globalAlpha = wq * (1 - seg(move, 0, 0.3));
  text(ctx, "Actum", 960, 680 - move * 60, `400 120px ${SERIF}`, C.ink, "center");
  ctx.globalAlpha = eOut(seg(move, 0.7, 1));
  text(ctx, "Actum", 252, 67, `400 30px ${SERIF}`, C.ink);
  ctx.restore();
  if (t < 3.2) {
    const tq = Math.min(eOut(seg(t, 2.3, 2.9)), 1 - seg(t, 2.8, 3.1));
    ctx.save(); ctx.globalAlpha = tq;
    text(ctx, "Gestão jurídica com rigor", 960, 760, `400 34px ${SANS}`, C.muted, "center");
    ctx.restore();
  }
  const navq = eOut(seg(t, 3.8, 4.4));
  if (navq > 0) {
    ctx.save(); ctx.globalAlpha = navq;
    text(ctx, "Entrar", 1440, 66, `500 24px ${SANS}`, C.ink, "center");
    rr(ctx, 1507, 23, 314, 68, 6); ctx.strokeStyle = "#D9D3C5"; ctx.lineWidth = 1.5; ctx.stroke();
    text(ctx, "Cadastrar meu escritório", 1664, 66, `500 24px ${SANS}`, C.ink, "center");
    ctx.restore();
  }
  return rise;
}

function drawHero(ctx, t) {
  const headOut = eInOut(seg(t, 8.2, 8.8));
  if (t <= 3.9 || headOut >= 1) return;
  ctx.save(); ctx.globalAlpha = 1 - headOut; ctx.translate(-headOut * 80, 0);
  drawScales(ctx, 215, 262, 1, seg(t, 3.9, 4.8), Math.sin(Math.max(0, t - 4.4) * 3) * 0.25 * Math.exp(-Math.max(0, t - 4.4) * 1.1));
  drawHeadline(ctx, t, 4.3, 1);
  const bq = eOut(seg(t, 6.4, 7.0));
  ctx.globalAlpha *= bq;
  rr(ctx, 189, 780, 348, 68, 6); ctx.fillStyle = C.bronze; ctx.fill();
  text(ctx, "Cadastrar meu escritório", 363, 823, `600 24px ${SANS}`, "#fff", "center");
  rr(ctx, 556, 780, 304, 68, 6); ctx.strokeStyle = "rgba(242,240,233,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();
  text(ctx, "Já tenho conta", 708, 823, `600 24px ${SANS}`, C.cream, "center");
  ctx.restore();
}

function drawProduct(ctx, t) {
  const mIn = eOut(seg(t, 6.0, 7.0));
  const toB = eInOut(seg(t, 8.4, 9.4));
  const toC = eInOut(seg(t, 16.4, 17.3));
  const endOut = eInOut(seg(t, 19.6, 20.3));
  if (mIn > 0 && endOut < 1) {
    let cx = lerp(1570, 960, toB), cy = lerp(560, 580, toB), sc = lerp(0.44, 1, toB);
    cx = lerp(cx, 700, toC); cy = lerp(cy, 590, toC); sc = lerp(sc, 0.8, toC);
    cy += (1 - mIn) * 60;
    const state = {
      dash: 1 - eInOut(seg(t, 12.1, 12.6)),
      proc: eInOut(seg(t, 12.4, 12.9)),
      nav: lerp(0, 2, eInOut(seg(t, 12.1, 12.7))),
    };
    ctx.save();
    ctx.globalAlpha = mIn * (1 - endOut);
    ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-MW / 2, -MH / 2);
    drawMockup(ctx, t, state);
    ctx.restore();
  }

  const toq = Math.min(eOut(seg(t, 14.5, 15.0)), 1 - eInOut(seg(t, 16.0, 16.4)));
  if (toq > 0) {
    ctx.save(); ctx.globalAlpha = toq; ctx.translate((1 - toq) * 60, 0);
    ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    rr(ctx, 1340, 150, 520, 96, 10); ctx.fillStyle = C.cream; ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = C.bronze; ctx.beginPath(); ctx.arc(1384, 198, 18, 0, 7); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(1384, 188); ctx.lineTo(1384, 200); ctx.moveTo(1384, 206); ctx.lineTo(1384, 208); ctx.stroke();
    text(ctx, "Nova movimentação no seu processo", 1418, 190, `600 19px ${SANS}`, C.ink);
    text(ctx, "1002345-67.2026.8.26.0576, Marina Costa", 1418, 218, `400 16px ${SANS}`, C.muted);
    ctx.restore();
  }

  const ph = eOut(seg(t, 16.6, 17.5));
  if (ph > 0 && endOut < 1) {
    ctx.save(); ctx.globalAlpha = ph * (1 - endOut);
    ctx.translate(1440, 205 + (1 - ph) * 200);
    ctx.scale(0.94, 0.94);
    drawPhone(ctx, t);
    ctx.restore();
  }
}

function drawEndCard(ctx, t) {
  if (seg(t, 19.9, 24) <= 0) return;
  const lq = seg(t, 20.0, 21.4);
  drawLogo(ctx, 960, 400, 2.3, lq, C.green);
  const aq = eOut(seg(t, 20.9, 21.6));
  ctx.save(); ctx.globalAlpha = aq;
  text(ctx, "Actum", 960, 630 + (1 - aq) * 20, `400 104px ${SERIF}`, C.cream, "center");
  ctx.restore();
  const sq = eOut(seg(t, 21.3, 22.0));
  ctx.save(); ctx.globalAlpha = sq;
  text(ctx, "Clientes, processos, prazos, financeiro e equipe num só lugar.", 960, 700, `400 30px ${SANS}`, "rgba(242,240,233,0.72)", "center");
  ctx.restore();
  const bq = eBack(seg(t, 21.8, 22.4));
  if (bq > 0) {
    ctx.save(); ctx.globalAlpha = clamp(bq);
    ctx.translate(960, 800); ctx.scale(bq, bq);
    rr(ctx, -200, -36, 400, 72, 6); ctx.fillStyle = C.bronze; ctx.fill();
    ctx.save(); rr(ctx, -200, -36, 400, 72, 6); ctx.clip();
    const sh = lerp(-320, 320, seg(t, 22.6, 23.4));
    const g = ctx.createLinearGradient(sh - 60, 0, sh + 60, 0);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(-200, -36, 400, 72);
    ctx.restore();
    text(ctx, "Cadastrar meu escritório", 0, 9, `600 26px ${SANS}`, "#fff", "center");
    ctx.restore();
  }
  const uq = eOut(seg(t, 22.3, 22.9));
  ctx.save(); ctx.globalAlpha = uq;
  text(ctx, "actumjus.com.br", 960, 904, `500 26px ${SANS}`, C.tan, "center");
  ctx.restore();
}

export function renderFrame(ctx, t) {
  ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H);
  const rise = drawIntro(ctx, t);
  if (rise <= 0) return;
  drawHero(ctx, t);
  drawProduct(ctx, t);
  drawCaptions(ctx, t);
  drawEndCard(ctx, t);
}
