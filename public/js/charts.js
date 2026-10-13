// charts.js — tiny SVG charts, theme-aware via CSS variables. No libraries.

export function donut(segments, opts = {}) {
  const size = 132, r = 52, sw = 20, c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let off = 0;
  let arcs = "";
  if (total <= 0) {
    arcs = `<circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${sw}"/>`;
  } else {
    for (const s of segments) {
      if (s.value <= 0) continue;
      const len = (s.value / total) * c;
      const gap = segments.length > 1 ? Math.min(2, len / 3) : 0;
      arcs += `<circle cx="66" cy="66" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}"
        stroke-dasharray="${Math.max(0.01, len - gap)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 66 66)"/>`;
      off += len;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${opts.label || "Spending by category"}">${arcs}
    <text x="66" y="62" text-anchor="middle" font-size="11" fill="var(--text-3)">${opts.top || "Spent"}</text>
    <text x="66" y="80" text-anchor="middle" font-size="16" font-weight="700" fill="var(--text)">${opts.center || ""}</text></svg>`;
}

export function bars(rows, opts = {}) {
  // rows: [{label, a, b}] a = income (green), b = spending (red)
  const W = 320, H = 150, pad = 18, bottom = 20;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.a, r.b)));
  const gw = (W - pad) / rows.length;
  const bw = Math.min(14, gw / 3.2);
  let g = "";
  rows.forEach((r, i) => {
    const x = pad + i * gw + gw / 2;
    const ha = (r.a / max) * (H - bottom - 8), hb = (r.b / max) * (H - bottom - 8);
    g += `<rect x="${x - bw - 1}" y="${H - bottom - ha}" width="${bw}" height="${Math.max(0, ha)}" rx="3" fill="var(--income)" opacity="${r.cur ? 1 : .75}"/>`;
    g += `<rect x="${x + 1}" y="${H - bottom - hb}" width="${bw}" height="${Math.max(0, hb)}" rx="3" fill="var(--expense)" opacity="${r.cur ? 1 : .75}"/>`;
    g += `<text class="axis" x="${x}" y="${H - 5}" text-anchor="middle" ${r.cur ? 'font-weight="700" fill="var(--text)"' : ""}>${r.label}</text>`;
  });
  const grid = [0.5, 1].map((f) => `<line x1="${pad}" x2="${W}" y1="${H - bottom - f * (H - bottom - 8)}" y2="${H - bottom - f * (H - bottom - 8)}" stroke="var(--line)" stroke-dasharray="3 4"/>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${opts.label || "Income and spending by month"}">${grid}
    <line x1="${pad}" x2="${W}" y1="${H - bottom}" y2="${H - bottom}" stroke="var(--line)"/>${g}</svg>`;
}

export function line(points, opts = {}) {
  // points: [{x: index, v: value, label}] ; draws area + line, zero line, min marker
  const W = 320, H = 140, pl = 4, pr = 4, pt = 12, pb = 20;
  if (!points.length) return "";
  const vals = points.map((p) => p.v);
  let lo = Math.min(0, ...vals), hi = Math.max(...vals, 1);
  if (hi - lo < 1) hi = lo + 1;
  const span = hi - lo;
  lo -= span * 0.06; hi += span * 0.08;
  const X = (i) => pl + (i / Math.max(1, points.length - 1)) * (W - pl - pr);
  const Y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  let d = "";
  points.forEach((p, i) => { d += (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.v).toFixed(1); });
  const area = d + `L${X(points.length - 1).toFixed(1)} ${Y(lo).toFixed(1)}L${X(0).toFixed(1)} ${Y(lo).toFixed(1)}Z`;
  let minI = 0; vals.forEach((v, i) => { if (v < vals[minI]) minI = i; });
  const zero = lo < 0 ? `<line x1="${pl}" x2="${W - pr}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--expense)" stroke-dasharray="4 4" opacity=".7"/>` : "";
  const ticks = (opts.ticks || []).map((t) => `<text class="axis" x="${Math.min(W - 16, Math.max(14, X(t.i)))}" y="${H - 5}" text-anchor="middle">${t.label}</text>`).join("");
  const col = vals[minI] < 0 ? "var(--expense)" : "var(--accent)";
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${opts.label || "Balance forecast"}">
    <defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#lg)"/>${zero}
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${X(minI)}" cy="${Y(vals[minI])}" r="4" fill="${col}" stroke="var(--surface)" stroke-width="2"/>${ticks}</svg>`;
}

export function ring(pct, color, size = 56, label = "") {
  const r = (size - 8) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct || 0));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${Math.round(p * 100)}% ${label}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="7"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${(p * c).toFixed(2)} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${size > 50 ? 13 : 11}" font-weight="700" fill="var(--text)">${Math.round(p * 100)}%</text></svg>`;
}
