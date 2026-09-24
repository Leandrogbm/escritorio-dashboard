export const W = 1920;
export const H = 1080;
export const DURATION = 24;
export const FINAL_FRAME = 23.5;

export const C = Object.freeze({
  green: "#2B4037", greenD: "#22342C", greenL: "#3A5548",
  bronze: "#A5793B", tan: "#C9A77A", cream: "#F2F0E9", cream2: "#E8E3D7",
  ink: "#1F2A24", muted: "#6B7770", ok: "#2E8B57", bad: "#A83A3A",
});
export const SERIF = '"Source Serif 4", Georgia, "Times New Roman", serif';
export const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const lerp = (a, b, p) => a + (b - a) * p;
export const eOut = (p) => 1 - Math.pow(1 - p, 3);
export const eInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const eBack = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
export const brl = (n) => "R$ " + Math.round(n).toLocaleString("pt-BR");

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function text(ctx, str, x, y, font, color, align = "left", base = "alphabetic") {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(str, x, y);
}

function polyLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

export function strokePoly(ctx, pts, p) {
  if (p <= 0) return;
  let remain = polyLen(pts) * p;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && remain > 0; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const d = Math.hypot(x1 - x0, y1 - y0);
    const k = Math.min(1, remain / d);
    ctx.lineTo(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k);
    remain -= d;
  }
  ctx.stroke();
}
