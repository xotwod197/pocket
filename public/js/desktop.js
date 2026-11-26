// desktop.js — Pocket on computers: layout mode, detail pane, keyboard shortcuts, right-click menus, install.
// Nothing here runs on a phone-sized window except the mode check, so the iPhone app is unchanged.

const DESK_MIN = 900;    // sidebar layout from here
const PANE_MIN = 1180;   // detail pane on the right from here
export const isMac = /Mac|iPhone|iPad/.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent);
export const MOD = isMac ? "⌘" : "Ctrl+";
const root = document.documentElement;
const RM = matchMedia("(prefers-reduced-motion: reduce)");

let H = {};              // handlers from app.js
export function init(handlers) { H = handlers || {}; applyMode(); }

/* ============================== layout mode ============================== */
export const isDesk = () => root.classList.contains("desk");
export const paneMode = () => root.classList.contains("pane") && root.classList.contains("has-main");
function applyMode() {
  const w = window.innerWidth, wasDesk = isDesk(), wasPane = root.classList.contains("pane");
  root.classList.toggle("desk", w >= DESK_MIN);
  root.classList.toggle("pane", w >= PANE_MIN);
  if ((wasDesk !== isDesk() || wasPane !== root.classList.contains("pane")) && H.onModeChange) H.onModeChange();
}
let rt = null;
window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(applyMode, 80); });
applyMode();

export function setMain(on) { root.classList.toggle("has-main", !!on); }

// toolbar gets a hairline once content scrolls under it (macOS scroll-edge effect)
let st = false;
window.addEventListener("scroll", () => { if (st) return; st = true; requestAnimationFrame(() => { st = false; root.classList.toggle("scrolled", window.scrollY > 4); }); }, { passive: true });

/* ============================== detail pane ============================== */
let selKey = null;       // which row's details are open: "act|id"
export function paneEmpty() {
  return `<div class="pane-empty" aria-live="polite">
    <div class="big">No Selection</div>
    <div class="sm">Click a transaction, bill, goal or account to see and edit it here.</div>
    <button class="tbtn primary" data-act="add">＋ New Transaction</button>
    <div class="keys"><span>New transaction</span><kbd>${MOD}N</kbd><span>Search</span><kbd>${MOD}F</kbd><span>Switch screens</span><kbd>${MOD}1–4</kbd><span>Close</span><kbd>Esc</kbd></div>
  </div>`;
}
export function paneOpened(sheet) {
  if (!paneMode() || RM.matches || !sheet.animate) return;
  sheet.querySelectorAll(".shead, .sbody, .sfoot").forEach((el, i) => el.animate([{ opacity: 0, transform: "translateX(14px)" }, { opacity: 1, transform: "none" }], { duration: 260, delay: i * 25, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }));
}
export function clearSelection() { selKey = null; document.querySelectorAll(".selected").forEach((e) => e.classList.remove("selected")); }
function markSelected() {
  document.querySelectorAll(".selected").forEach((e) => e.classList.remove("selected"));
  if (!selKey || !paneMode()) return;
  const [act, id] = selKey.split("|");
  const el = document.querySelector(`#app [data-act="${act}"]${id ? `[data-id="${CSS.escape(id)}"]` : ":not([data-id])"}`);
  if (el) el.classList.add("selected");
}
const SELECTABLE = ["editTx", "openOcc", "editRule", "editGoal", "editDebt", "editAccount", "editCategory", "editJob", "goalAdd"];
document.addEventListener("click", (e) => {
  const el = e.target.closest && e.target.closest("#app [data-act]");
  if (!el || !SELECTABLE.includes(el.dataset.act)) return;
  selKey = el.dataset.act + "|" + (el.dataset.id || "");
  requestAnimationFrame(markSelected);
}, true);

/* after every render: sidebar visibility, toolbar buttons, selection */
export function afterRender(app) {
  if (!isDesk() || !root.classList.contains("has-main")) return;
  const top = app.querySelector(":scope > .top");
  if (top && !top.querySelector(".tools")) {
    const tools = document.createElement("div"); tools.className = "tools";
    tools.innerHTML = `<button class="tbtn primary" data-act="add" title="New transaction (${MOD}N)" aria-label="New transaction">＋ <span>New</span></button>`;
    top.appendChild(tools);
  }
  markSelected();
}

/* ============================== keyboard shortcuts ============================== */
const typing = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
document.addEventListener("keydown", (e) => {
  if (!isDesk() || !H.act) return;
  if (menu) return menuKey(e);
  const mod = isMac ? e.metaKey : e.ctrlKey, k = e.key.toLowerCase();
  if (mod && !e.altKey && !e.shiftKey) {
    if (k === "n") { e.preventDefault(); H.act("add", {}); return; }
    if (k === "f") { e.preventDefault(); H.find(); return; }
    if (k === ",") { e.preventDefault(); H.act("tab", { v: "settings" }); return; }
    if (/^[1-4]$/.test(k)) { e.preventDefault(); H.act("tab", { v: ["home", "calendar", "activity", "plan"][+k - 1] }); return; }
    if (k === "z" && !typing(e.target) && H.canUndo && H.canUndo()) { e.preventDefault(); H.act("toastAct", {}); return; }
    if (k === "enter" && document.querySelector("#sheet .sfoot .primary, #sheet .shead .primary")) { e.preventDefault(); document.querySelector("#sheet .sfoot .primary, #sheet .shead .primary").click(); return; }
  }
  // Return saves the open form (the default button on a Mac), unless you're in a multi-line box or a search
  if (e.key === "Enter" && !mod && typing(e.target) && e.target.closest("#sheet") && e.target.tagName === "INPUT" && e.target.type !== "search" && e.target.id !== "ncName") {
    const p = document.querySelector("#sheet .sfoot .primary, #sheet .shead .primary"); if (p && !p.disabled) { e.preventDefault(); p.click(); } return;
  }
  if (typing(e.target) || mod || e.altKey) return;
  // ← → change month on Calendar and Activity
  if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && H.monthKey) { if (H.monthKey(e.key === "ArrowLeft" ? -1 : 1)) e.preventDefault(); }
});

/* ============================== right-click menus ============================== */
let menu = null, menuItems = [], hi = -1, lastFocus = null, menuAt = 0;
function closeMenu() { if (!menu) return; menu.remove(); menu = null; menuItems = []; hi = -1; if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
function setHi(i) { hi = i; menuItems.forEach((b, j) => b.classList.toggle("hi", j === i)); if (menuItems[i]) menuItems[i].focus({ preventScroll: true }); }
function menuKey(e) {
  if (e.key === "Escape") { e.preventDefault(); closeMenu(); return; }
  if (e.key === "ArrowDown") { e.preventDefault(); setHi((hi + 1) % menuItems.length); return; }
  if (e.key === "ArrowUp") { e.preventDefault(); setHi((hi - 1 + menuItems.length) % menuItems.length); return; }
  if ((e.key === "Enter" || e.key === " ") && menuItems[hi]) { e.preventDefault(); menuItems[hi].click(); }
}
export function openMenu(x, y, title, items) {
  closeMenu();
  lastFocus = document.activeElement;
  menuAt = performance.now();
  menu = document.createElement("div"); menu.className = "cmenu"; menu.setAttribute("role", "menu");
  menu.innerHTML = (title ? `<div class="hd">${title}</div>` : "") + items.map((it, i) => it === "-" ? `<div class="sep" role="separator"></div>`
    : `<button role="menuitem" data-i="${i}" class="${it.danger ? "danger" : ""}">${it.label}${it.key ? `<span class="k">${it.key}</span>` : ""}</button>`).join("");
  document.body.appendChild(menu);
  menuItems = [...menu.querySelectorAll("button")];
  menu.addEventListener("click", (ev) => { const b = ev.target.closest("button[data-i]"); if (!b) return; ev.stopPropagation(); const it = items[+b.dataset.i]; closeMenu(); it.run(); });
  menu.addEventListener("mousemove", (ev) => { const b = ev.target.closest("button"); if (b) { const i = menuItems.indexOf(b); if (i !== hi) { hi = i; menuItems.forEach((m, j) => m.classList.toggle("hi", j === i)); } } });
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(6, Math.min(x, window.innerWidth - r.width - 6)) + "px";
  menu.style.top = Math.max(6, Math.min(y, window.innerHeight - r.height - 6)) + "px";
}
document.addEventListener("contextmenu", (e) => {
  if (!isDesk() || !H.menuFor) return;
  if (typing(e.target)) return;                              // keep the normal copy/paste menu in fields
  const el = e.target.closest("[data-act][data-id], .sidebar [data-act='openAcctActivity']");
  const m = el && H.menuFor(el);
  if (!m) { if (menu) closeMenu(); return; }
  e.preventDefault();
  openMenu(e.clientX, e.clientY, m.title, m.items);
});
document.addEventListener("mousedown", (e) => { if (menu && !menu.contains(e.target)) closeMenu(); }, true);
window.addEventListener("blur", closeMenu);
window.addEventListener("resize", closeMenu);
window.addEventListener("scroll", () => { if (performance.now() - menuAt > 200) closeMenu(); }, { passive: true });   // ignore the scroll that brought the row into view

/* ============================== install as an app ============================== */
let deferred = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; if (H.onInstallChange) H.onInstallChange(); });
window.addEventListener("appinstalled", () => { deferred = null; if (H.onInstallChange) H.onInstallChange(); });
export const installed = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export const canPromptInstall = () => !!deferred;
export const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR/.test(navigator.userAgent);
export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice.catch(() => null);
  deferred = null;
  return !!(r && r.outcome === "accepted");
}
