// motion.js — iPhone-style motion and touch gestures for Pocket.
// Everything is optional polish: if a browser lacks a feature, the app still works the same way.
//
//  • press feedback on every tappable thing          • tab bar lens that slides, and follows your finger
//  • sliding segmented controls (tap or drag)        • sliding filter-chip pill
//  • sheets spring up and drag down to dismiss       • swipe a transaction left to delete / skip
//  • calendar month follows your finger              • swipe from the left edge to leave Settings
//  • screens slide in with staggered content          • big numbers count to their new value
//  • compact iOS title bar on scroll                 • light haptic ticks (iOS 18+ / Android)

const RM = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
export const reduced = () => RM.matches;
const LINEAR_OK = typeof CSS !== "undefined" && CSS.supports && CSS.supports("transition-timing-function", "linear(0, 1)");
const SPRING = LINEAR_OK ? "linear(0, 0.018, 0.064, 0.13, 0.207, 0.291, 0.377, 0.46, 0.54, 0.614, 0.681, 0.742, 0.794, 0.84, 0.879, 0.912, 0.939, 0.961, 0.978, 0.991, 1.002, 1.009, 1.014, 1.017, 1.019, 1.02, 1.02, 1.019, 1.018, 1.016, 1.015, 1.013, 1.011, 1.01, 1.008, 1.007, 1.005, 1.004, 1.003, 1.003, 1)" : "cubic-bezier(.2,.9,.25,1.05)";
const BOUNCY = LINEAR_OK ? "linear(0, 0.028, 0.099, 0.199, 0.314, 0.435, 0.554, 0.664, 0.763, 0.849, 0.919, 0.976, 1.018, 1.049, 1.069, 1.08, 1.083, 1.082, 1.077, 1.069, 1.059, 1.049, 1.039, 1.03, 1.021, 1.014, 1.008, 1.003, 0.999, 0.996, 0.995, 0.993, 0.993, 0.993, 0.994, 0.994, 0.995, 0.996, 0.997, 0.997, 1)" : "cubic-bezier(.2,1.3,.4,1)";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rubber = (d, k = 0.35) => d * k;           // resistance past an edge
const anim = (el, frames, opts) => { if (!el || reduced() || !el.animate) return null; try { return el.animate(frames, opts); } catch (e) { return null; } };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

let H = {};                                      // callbacks from app.js
export function init(handlers) { H = handlers || {}; }

/* ============================== haptics ============================== */
// iPhone Safari has no vibration API, but toggling an <input switch> gives a light system haptic (iOS 18+).
let hapticsOn = true;
export function setHaptics(v) { hapticsOn = !!v; }
export function haptic() {
  if (!hapticsOn) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(8); return; }
    const l = document.createElement("label"); l.setAttribute("aria-hidden", "true"); l.style.display = "none";
    const i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", ""); i.tabIndex = -1;
    l.appendChild(i); document.head.appendChild(l); l.click(); l.remove();
  } catch (e) { /* ignore */ }
}

/* ============================== click suppression after a drag ============================== */
let suppressUntil = 0;
export function suppressClick() { suppressUntil = performance.now() + 450; }
document.addEventListener("click", (e) => {
  if (e.isTrusted && performance.now() < suppressUntil) { e.stopPropagation(); e.preventDefault(); suppressUntil = 0; }
}, true);

/* ============================== press feedback ============================== */
const PRESS = "button, [data-act], .setrow, .acct, label.sw";
let pressed = null, pressAt = 0, px = 0, py = 0;
function release() {
  const el = pressed; pressed = null; if (!el) return;
  const wait = Math.max(0, 90 - (performance.now() - pressAt));   // quick taps still show the press
  setTimeout(() => el.classList.remove("pressed"), wait);
}
document.addEventListener("pointerdown", (e) => {
  if (e.button > 0) return;
  const el = e.target.closest(PRESS);
  if (!el || el.disabled || el.closest(".swipe-act")) return;
  release(); pressed = el; pressAt = performance.now(); px = e.clientX; py = e.clientY;
  el.classList.add("pressed");
}, { passive: true });
window.addEventListener("pointermove", (e) => { if (pressed && Math.hypot(e.clientX - px, e.clientY - py) > 10) { pressed.classList.remove("pressed"); pressed = null; } }, { passive: true });
["pointerup", "pointercancel"].forEach((t) => window.addEventListener(t, release, { passive: true }));
window.addEventListener("scroll", () => { if (pressed) { pressed.classList.remove("pressed"); pressed = null; } }, { passive: true });
// switches tick when flipped
document.addEventListener("change", (e) => { if (e.target && e.target.closest && e.target.closest(".sw")) haptic(); });

/* ============================== tab bar lens ============================== */
function lensOf(tabbar) {
  const inEl = tabbar.querySelector(".in"); if (!inEl) return null;
  let lens = inEl.querySelector(".lens");
  if (!lens) { lens = document.createElement("div"); lens.className = "lens hide instant"; lens.setAttribute("aria-hidden", "true"); inEl.prepend(lens); }
  return lens;
}
function placeLens(lens, tb, instant) {
  if (!tb || !tb.offsetWidth) { lens.classList.add("hide"); return; }
  const wasHidden = lens.classList.contains("hide");
  if (instant || wasHidden) lens.classList.add("instant");
  lens.style.setProperty("--x", tb.offsetLeft + "px");
  lens.style.setProperty("--w", tb.offsetWidth + "px");
  if (wasHidden) { void lens.offsetWidth; lens.classList.remove("hide"); }
  if (instant || wasHidden) { void lens.offsetWidth; requestAnimationFrame(() => lens.classList.remove("instant")); }
}
export function syncLens(tabbar, instant) {
  const lens = lensOf(tabbar); if (!lens) return;
  placeLens(lens, tabbar.querySelector(".tb.on"), instant);
}
let tabbarBound = false;
export function bindTabbar(tabbar) {
  if (tabbarBound) return; tabbarBound = true;
  tabbar.addEventListener("pointerdown", (e) => {
    const start = e.target.closest(".tb"); if (!start || e.button > 0) return;
    const inEl = tabbar.querySelector(".in"), lens = lensOf(tabbar);
    const tabs = [...inEl.querySelectorAll(".tb")];
    const sx = e.clientX; let drag = false, hover = start;
    const move = (ev) => {
      const dx = ev.clientX - sx;
      if (!drag) {
        if (Math.abs(dx) < 8) return;
        drag = true; lens.classList.remove("hide", "instant"); lens.classList.add("drag");
        if (pressed) { pressed.classList.remove("pressed"); pressed = null; }
      }
      const r = inEl.getBoundingClientRect(), x = ev.clientX - r.left;
      let best = tabs[0], bd = Infinity;
      for (const t of tabs) { const c = t.offsetLeft + t.offsetWidth / 2, d = Math.abs(c - x); if (d < bd) { bd = d; best = t; } }
      const minX = tabs[0].offsetLeft, maxX = tabs[tabs.length - 1].offsetLeft;
      lens.style.setProperty("--w", best.offsetWidth + "px");
      lens.style.setProperty("--x", clamp(x - best.offsetWidth / 2, minX - 6, maxX + 6) + "px");
      if (best !== hover) { if (hover) hover.classList.remove("hover"); hover = best; hover.classList.add("hover"); haptic(); }
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      if (!drag) return;
      suppressClick();
      lens.classList.remove("drag"); tabs.forEach((t) => t.classList.remove("hover"));
      if (hover && !hover.classList.contains("on") && H.onTab) H.onTab(hover.dataset.v);
      else syncLens(tabbar);
    };
    window.addEventListener("pointermove", move, { passive: true }); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  });
  window.addEventListener("resize", () => syncLens(tabbar, true));
}

/* ============================== segmented controls & chip pills ============================== */
const THUMBS = ".seg, [data-pill]";
const keyOf = (c, i) => c.dataset.seg || c.dataset.pill || ((c.querySelector("[data-act]") || {}).dataset || {}).act || "s" + i;
let thumbMemo = new Map();
function thumbOf(c) {
  let t = c.querySelector(":scope > .thumb"), fresh = false;
  if (!t) { t = document.createElement("div"); t.className = "thumb instant"; t.setAttribute("aria-hidden", "true"); c.prepend(t); fresh = true; }
  return { t, fresh };
}
function placeThumb(c, animate, from) {
  const on = c.querySelector(":scope > button.on, :scope > .chip.on");
  if (!on || !c.offsetWidth) { const t = c.querySelector(":scope > .thumb"); if (t) t.remove(); c.classList.remove("has-thumb"); return; }
  const { t, fresh } = thumbOf(c);
  const top = c.classList.contains("seg") ? null : on.offsetTop;
  if (top !== null) t.style.top = top + "px";
  if (from && !reduced()) {   // start where the old selection was (survives a full re-render)
    t.classList.add("instant"); t.style.setProperty("--x", from.x + "px"); t.style.setProperty("--w", from.w + "px"); void t.offsetWidth; t.classList.remove("instant");
  } else if (fresh || !animate || reduced()) t.classList.add("instant");
  t.style.setProperty("--x", on.offsetLeft + "px"); t.style.setProperty("--w", on.offsetWidth + "px");
  c.classList.add("has-thumb");
  if (t.classList.contains("instant")) { void t.offsetWidth; requestAnimationFrame(() => t.classList.remove("instant")); }
}
export function captureThumbs(root) {
  thumbMemo = new Map();
  if (!root) return;
  root.querySelectorAll(THUMBS).forEach((c, i) => {
    const on = c.querySelector(":scope > button.on, :scope > .chip.on");
    if (on && c.offsetWidth) thumbMemo.set(keyOf(c, i), { x: on.offsetLeft, w: on.offsetWidth, v: on.dataset.v });
  });
}
export function syncThumbs(root, animate = true) {
  if (!root) return;
  root.querySelectorAll(THUMBS).forEach((c, i) => {
    const on = c.querySelector(":scope > button.on, :scope > .chip.on");
    const old = thumbMemo.get(keyOf(c, i));
    placeThumb(c, animate, old && on && old.v !== on.dataset.v ? old : null);
  });
}
// drag the selection across a segmented control
document.addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".seg > button"); if (!b || e.button > 0) return;
  const c = b.parentElement, btns = [...c.querySelectorAll(":scope > button")];
  const sx = e.clientX, sy = e.clientY; let drag = false, hover = null;
  const t = () => c.querySelector(":scope > .thumb");
  const move = (ev) => {
    const dx = ev.clientX - sx;
    if (!drag) { if (Math.abs(dx) < 8 || Math.abs(ev.clientY - sy) > Math.abs(dx)) return; drag = true; const th = t(); if (th) th.classList.add("drag"); }
    const r = c.getBoundingClientRect(), x = ev.clientX - r.left;
    let best = btns[0], bd = Infinity;
    for (const bb of btns) { const d = Math.abs(bb.offsetLeft + bb.offsetWidth / 2 - x); if (d < bd) { bd = d; best = bb; } }
    const th = t(); if (th) { th.style.setProperty("--w", best.offsetWidth + "px"); th.style.setProperty("--x", clamp(x - best.offsetWidth / 2, btns[0].offsetLeft, btns[btns.length - 1].offsetLeft) + "px"); }
    if (best !== hover) { if (hover) haptic(); hover = best; }
  };
  const up = () => {
    window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
    if (!drag) return;
    const th = t(); if (th) th.classList.remove("drag");
    if (hover && !hover.classList.contains("on")) hover.click();   // runs the normal tap action
    else placeThumb(c, true);
    suppressClick();
  };
  window.addEventListener("pointermove", move, { passive: true }); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
}, { passive: true });

/* ============================== screen transitions ============================== */
let enterTimer = null;
export function enterTab(app, dir = 0) {
  if (!app || reduced()) return;
  app.classList.add("entering"); clearTimeout(enterTimer); enterTimer = setTimeout(() => app.classList.remove("entering"), 1000);
  const kids = [...app.children].slice(0, 14);
  kids.forEach((k, i) => anim(k, [{ opacity: 0, transform: `translate(${dir * 28}px, ${dir ? 0 : 14}px)` }, { opacity: 1, transform: "none" }],
    { duration: 520, delay: Math.min(i, 8) * 28, easing: SPRING, fill: "backwards" }));
}
// slide content sideways after a month change (skips the header row)
export function slideContent(app, dir, skip = 1) {
  if (!app) return;
  [...app.children].slice(skip, skip + 9).forEach((k, i) => anim(k, [{ opacity: 0, transform: `translateX(${dir * 36}px)` }, { opacity: 1, transform: "none" }], { duration: 460, delay: i * 18, easing: SPRING, fill: "backwards" }));
}
export function slideIn(el, dir) { anim(el, [{ opacity: 0, transform: `translateX(${dir * 60}px)` }, { opacity: 1, transform: "none" }], { duration: 480, easing: SPRING }); }
export function pop(el) { anim(el, [{ transform: "scale(.55)" }, { transform: "scale(1)" }], { duration: 520, easing: BOUNCY }); }

/* ============================== big numbers count to their new value ============================== */
const MONEY = /^([−-]?)\$([\d,]+\.\d\d)$/;
const parseMoney = (s) => { const m = MONEY.exec(String(s).trim()); return m ? (m[1] ? -1 : 1) * parseFloat(m[2].replace(/,/g, "")) : null; };
const fmtMoney = (v) => (v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let numMemo = new Map();
export function rollNumbers(root, scope) {
  if (!root) return;
  root.querySelectorAll(".hero .big.num").forEach((el, i) => {
    const key = scope + ":" + i, txt = el.textContent.trim(), to = parseMoney(txt), prev = numMemo.get(key);
    numMemo.set(key, txt);
    const from = prev == null ? null : parseMoney(prev);
    if (to == null || from == null || from === to || reduced()) return;
    const t0 = performance.now(), dur = 650;
    el.textContent = fmtMoney(from);
    const step = (now) => {
      if (!el.isConnected) return;
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k >= 1 ? txt : fmtMoney(Math.round((from + (to - from) * e) * 100) / 100);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ============================== sheets ============================== */
export function sheetOpened() {
  document.documentElement.style.setProperty("--oy", (window.scrollY + window.innerHeight / 2) + "px");
  document.body.style.setProperty("--sheetp", "1");
}
export function bindSheet(sheet, scrim) {
  let st = null;
  const app = () => document.getElementById("app");
  sheet.addEventListener("touchstart", (e) => {
    if (!sheet.classList.contains("open") || e.touches.length > 1) { st = null; return; }
    const t = e.target;
    if (t.closest("input[type=range], select, textarea, .hscroll, .chips")) { st = null; return; }
    const body = sheet.querySelector(".sbody");
    const inHead = !t.closest(".sbody, .sfoot"), inBody = !!(body && body.contains(t));
    if (!inHead && !inBody) { st = null; return; }
    const y = e.touches[0].clientY;
    st = { x: e.touches[0].clientX, y, inHead, body, active: false, hist: [[performance.now(), y]] };
  }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    if (!st) return;
    const y = e.touches[0].clientY, dy = y - st.y, dx = e.touches[0].clientX - st.x;
    if (!st.active) {
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
      if (Math.abs(dx) > Math.abs(dy) || dy < 0 || (!st.inHead && st.body.scrollTop > 0)) { st = null; return; }
      st.active = true; st.y0 = y; st.h = sheet.offsetHeight;
      sheet.classList.add("dragging"); scrim.classList.add("dragging"); document.body.classList.add("sheet-dragging");
      if (pressed) { pressed.classList.remove("pressed"); pressed = null; }
    }
    e.preventDefault();
    let d = y - st.y0; if (d < 0) d = -rubber(-d, 0.15);
    st.d = d; st.hist.push([performance.now(), y]); if (st.hist.length > 6) st.hist.shift();
    sheet.style.transform = `translateY(${d}px)`;
    const p = clamp(1 - d / st.h, 0, 1);
    scrim.style.opacity = String(p); document.body.style.setProperty("--sheetp", String(p));
  }, { passive: false });
  const end = () => {
    if (!st) return;
    const s = st; st = null; if (!s.active) return;
    const [t0, y0] = s.hist[0], [t1, y1] = s.hist[s.hist.length - 1];
    const v = (y1 - y0) / Math.max(1, t1 - t0);                    // px per ms, + is down
    sheet.classList.remove("dragging"); scrim.classList.remove("dragging"); document.body.classList.remove("sheet-dragging");
    sheet.style.transform = ""; scrim.style.opacity = "";
    if (s.d > Math.min(150, s.h * 0.3) || (v > 0.55 && s.d > 20)) {
      haptic(); document.body.style.setProperty("--sheetp", "0");
      if (H.closeSheet) H.closeSheet();
    } else document.body.style.setProperty("--sheetp", "1");
    suppressClick();
  };
  sheet.addEventListener("touchend", end); sheet.addEventListener("touchcancel", end);
}

/* ============================== swipe rows: delete a transaction / skip a repeating item ============================== */
const ACTW = 88;
let openRow = null;
function closeRow(row, instant) {
  if (!row) return;
  const act = row._act;
  row.classList.remove("swiping"); row.classList.add("swiped");
  row.style.transform = "translateX(0)";
  const done = () => { row.classList.remove("swiped"); row.style.transform = ""; if (act) act.remove(); row._act = null; };
  if (instant || reduced()) done(); else setTimeout(done, 420);
  if (openRow === row) openRow = null;
}
function actionFor(row) {
  const skip = row.dataset.act === "openOcc";
  const a = document.createElement("div");
  a.className = "swipe-act" + (skip ? " skip" : "");
  a.innerHTML = `<button type="button" data-swipe="${skip ? "skip" : "delete"}" aria-label="${skip ? "Skip this one" : "Delete"}"><span class="i">${skip ? "⏭" : "🗑"}</span>${skip ? "Skip" : "Delete"}</button>`;
  a.style.top = row.offsetTop + "px"; a.style.height = row.offsetHeight + "px"; a.style.width = "0px";
  row.parentElement.appendChild(a); row._act = a;
  return a;
}
async function commitRow(row) {
  const act = row._act, id = row.dataset.id, skip = row.dataset.act === "openOcc", w = row.offsetWidth;
  haptic(); openRow = null;
  row.classList.remove("swiping"); row.classList.add("swiped");
  row.style.transform = `translateX(${-w}px)`; if (act) act.style.width = w + "px";
  if (!reduced()) {
    await new Promise((r) => setTimeout(r, 220));
    const h = row.offsetHeight;
    const a1 = anim(row, [{ height: h + "px", minHeight: "0px" }, { height: "0px", minHeight: "0px", paddingTop: "0px", paddingBottom: "0px" }], { duration: 260, easing: "ease-in", fill: "forwards" });
    anim(act, [{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 260, easing: "ease-in", fill: "forwards" });
    if (a1) await a1.finished.catch(() => {});
  }
  try { if (skip) { if (H.onSkipOcc) await H.onSkipOcc(id); } else if (H.onDeleteTx) await H.onDeleteTx(id); }
  finally { if (row.isConnected) { row.getAnimations().forEach((a) => a.cancel()); closeRow(row, true); } }
}
document.addEventListener("pointerdown", (e) => {
  if (openRow && !e.target.closest(".swipe-act") && !openRow.contains(e.target)) { closeRow(openRow); }
  const row = e.target.closest('.item[data-act="editTx"], .item[data-act="openOcc"]');
  if (!row || e.button > 0 || e.pointerType === "mouse") return;
  const base = row === openRow ? -ACTW : 0;
  const s = { x: e.clientX, y: e.clientY, active: false, dx: base, full: false, last: [[performance.now(), e.clientX]] };
  const w = row.offsetWidth, fullAt = Math.max(160, w * 0.6);
  const move = (ev) => {
    const dx = ev.clientX - s.x, dy = ev.clientY - s.y;
    if (!s.active) {
      if (Math.abs(dx) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) { cleanup(); return; }
      s.active = true; if (pressed) { pressed.classList.remove("pressed"); pressed = null; }
      try { row.setPointerCapture(ev.pointerId); } catch (er) { /* ignore */ }
      if (!row._act) actionFor(row);
      row.classList.remove("swiped"); row.classList.add("swiping");
    }
    let x = base + dx;
    if (x > 0) x = rubber(x, 0.2);
    if (x < -w) x = -w - rubber(-w - x, 0.2);
    s.dx = x; s.last.push([performance.now(), ev.clientX]); if (s.last.length > 5) s.last.shift();
    row.style.transform = `translateX(${x}px)`;
    const act = row._act; act.style.width = Math.max(0, -x) + "px";
    const full = -x > fullAt;
    if (full !== s.full) { s.full = full; act.classList.toggle("full", full); act.style.setProperty("--pull", "0px"); haptic(); }
  };
  const cleanup = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); };
  const cancel = () => { cleanup(); if (s.active) closeRow(row); };
  const wasOpen = base !== 0;
  const up = () => {
    cleanup();
    if (!s.active) { if (wasOpen) { closeRow(row); suppressClick(); } return; }
    suppressClick();
    const [t0, x0] = s.last[0], [t1, x1] = s.last[s.last.length - 1], v = (x1 - x0) / Math.max(1, t1 - t0);
    if (s.full) { commitRow(row); return; }
    if (s.dx < -ACTW / 2 || v < -0.5) {
      row.classList.remove("swiping"); row.classList.add("swiped");
      row.style.transform = `translateX(${-ACTW}px)`; row._act.style.transition = "width .5s " + SPRING; row._act.style.width = ACTW + "px";
      openRow = row;
    } else closeRow(row);
  };
  window.addEventListener("pointermove", move, { passive: true }); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel);
}, { passive: true });
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-swipe]"); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const row = openRow; if (row) commitRow(row);
});
window.addEventListener("scroll", () => { if (openRow) closeRow(openRow); }, { passive: true });

/* ============================== calendar month follows your finger ============================== */
export function attachCalendar(card) {
  if (!card || card._bound) return; card._bound = true;
  card.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || e.pointerType === "mouse") return;
    const cal = card.querySelector(".cal"); if (!cal) return;
    const sx = e.clientX, sy = e.clientY; let active = false, dx = 0; const hist = [[performance.now(), sx]];
    const move = (ev) => {
      const ddx = ev.clientX - sx;
      if (!active) { if (Math.abs(ddx) < 10) return; if (Math.abs(ev.clientY - sy) > Math.abs(ddx)) { cleanup(); return; } active = true; if (pressed) { pressed.classList.remove("pressed"); pressed = null; } try { card.setPointerCapture(ev.pointerId); } catch (er) { /* ignore */ } }
      dx = ddx; hist.push([performance.now(), ev.clientX]); if (hist.length > 5) hist.shift();
      cal.style.transition = "none"; cal.style.transform = `translateX(${dx}px)`; cal.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / card.offsetWidth));
    };
    const cleanup = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    const up = async () => {
      cleanup(); if (!active) return;
      suppressClick();
      const v = (hist[hist.length - 1][1] - hist[0][1]) / Math.max(1, hist[hist.length - 1][0] - hist[0][0]);
      const go = Math.abs(dx) > 60 || Math.abs(v) > 0.45 ? (dx < 0 ? 1 : -1) : 0;
      if (!go) { cal.style.transition = `transform .5s ${SPRING}, opacity .3s`; cal.style.transform = ""; cal.style.opacity = ""; return; }
      haptic();
      cal.style.transition = "transform .16s ease-in, opacity .16s"; cal.style.transform = `translateX(${-go * card.offsetWidth}px)`; cal.style.opacity = "0";
      await new Promise((r) => setTimeout(r, reduced() ? 0 : 150));
      if (H.shiftMonth) H.shiftMonth(go);
      const nc = document.querySelector("#calcard .cal"); slideIn(nc, go);
    };
    window.addEventListener("pointermove", move, { passive: true }); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  }, { passive: true });
}

/* ============================== swipe from the left edge to go back (Settings) ============================== */
document.addEventListener("pointerdown", (e) => {
  if (!H.canGoBack || !H.canGoBack() || e.pointerType === "mouse" || e.clientX > 24 || document.body.classList.contains("sheet-open")) return;
  const app = document.getElementById("app"); const sx = e.clientX, sy = e.clientY; let active = false, dx = 0, t0 = performance.now();
  const move = (ev) => {
    const d = ev.clientX - sx;
    if (!active) { if (d < 10) return; if (Math.abs(ev.clientY - sy) > d) { cleanup(); return; } active = true; app.classList.add("edge-drag"); }
    dx = Math.max(0, d); app.style.transform = `translateX(${dx}px)`;
  };
  const cleanup = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  const up = async () => {
    cleanup(); if (!active) return; suppressClick();
    const v = dx / Math.max(1, performance.now() - t0), w = app.offsetWidth || window.innerWidth;
    app.classList.remove("edge-drag");
    if (dx > w * 0.33 || v > 0.6) {
      haptic(); app.style.transition = "transform .2s ease-out"; app.style.transform = `translateX(${w}px)`;
      await new Promise((r) => setTimeout(r, reduced() ? 0 : 190));
      app.style.transition = ""; app.style.transform = "";
      if (H.goBack) H.goBack();
    } else { app.style.transition = `transform .45s ${SPRING}`; app.style.transform = ""; setTimeout(() => { app.style.transition = ""; }, 460); }
  };
  window.addEventListener("pointermove", move, { passive: true }); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
}, { passive: true });

/* ============================== compact title bar (iOS look) ============================== */
let navbar = null, navTicking = false;
function ensureNavbar() {
  if (navbar) return navbar;
  navbar = document.createElement("div"); navbar.className = "navbar"; navbar.id = "navbar"; navbar.innerHTML = "<span></span>";
  navbar.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }));   // tap the top to scroll up
  document.body.appendChild(navbar);
  window.addEventListener("scroll", () => { if (!navTicking) { navTicking = true; requestAnimationFrame(() => { navTicking = false; updateNavbar(); }); } }, { passive: true });
  return navbar;
}
const NAV_FALLBACK = { home: "Home" };
let navScope = "";
export function updateNavbar(scope) {
  if (scope !== undefined) navScope = scope;
  const nb = ensureNavbar();
  const app = document.getElementById("app");
  const title = app && !app.classList.contains("notabs") && document.getElementById("tabbar") && !document.getElementById("tabbar").hidden ? (app.querySelector(".top h1") || app.querySelector(".top")) : null;
  if (!title) { nb.classList.remove("show"); return; }
  nb.firstChild.textContent = title.tagName === "H1" ? title.textContent : (NAV_FALLBACK[navScope] || "");
  const sat = parseFloat(getComputedStyle(nb).paddingTop) || 0;
  nb.classList.toggle("show", title.getBoundingClientRect().bottom < sat + 44);
}

/* ============================== hooks around app.js render() ============================== */
export function beforeRender(app) { if (openRow) { openRow = null; } captureThumbs(app); }
export function afterRender(app, scope) {
  syncThumbs(app, true);
  rollNumbers(app, scope);
  updateNavbar(scope);
}
