import * as F from "./finance.js";
import { DemoStore, FirebaseStore, isConfigured, newId } from "./store.js";
import { firebaseConfig } from "./firebase-config.js";
import { donut, bars, line, ring } from "./charts.js";
import * as M from "./motion.js";

/* ============================== constants ============================== */
const APP_NAME = "Pocket";
const TAB_ORDER = ["home", "calendar", "activity", "plan", "settings"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MON3 = MONTHS.map((m) => m.slice(0, 3));
const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const PALETTE = ["#5DCAA5","#F09595","#F5C4B3","#F0997B","#AFA9EC","#FAC775","#9FD8A0","#8FC9E8","#E3A8D4","#D8B4E2","#C9C4B8","#7FB3F0","#F2B880","#B5D99C"];
const EMOJIS = ["💰","💵","🎉","↩️","🍔","🛒","⛽","🚗","🏠","🛡️","💡","📱","💳","🔁","🛍️","🎮","💊","💇","🎁","✈️","📦","❓","🐶","📚","🏋️","☕","🍺","🎬","🧾","🏦","💸","🅿️","🐷","📈","🎓","👶","🧰","🚌","🏥","⚽"];
const DEFAULT_CATEGORIES = [
  ["income","Paycheck","💰","#5DCAA5","income"], ["bonus","Bonus","🎉","#9FD8A0","income"], ["side","Side income","💵","#B5D99C","income"], ["refund","Refund","↩️","#8FC9E8","income"],
  ["food","Food & dining","🍔","#F2B880","expense"], ["groceries","Groceries","🛒","#9FD8A0","expense"], ["gas","Gas","⛽","#8FC9E8","expense"],
  ["car","Car payment","🚗","#F09595","expense"], ["rent","Rent & insurance","🏠","#F5C4B3","expense"], ["bills","Bills & utilities","💡","#FAC775","expense"],
  ["phone","Phone","📱","#7FB3F0","expense"], ["credit","Credit card","💳","#F0997B","expense"], ["sub","Subscriptions","🔁","#E3A8D4","expense"],
  ["shop","Shopping","🛍️","#AFA9EC","expense"], ["fun","Entertainment","🎮","#D8B4E2","expense"], ["health","Health","💊","#F09595","expense"],
  ["personal","Personal care","💇","#E3A8D4","expense"], ["gifts","Gifts & giving","🎁","#F2B880","expense"], ["travel","Travel","✈️","#7FB3F0","expense"],
  ["misc","Misc","📦","#D8B4E2","expense"], ["other","Other","❓","#C9C4B8","expense"]
];
const ACCOUNT_TYPES = { checking: "Checking", savings: "Savings", wallet: "Cash App / PayPal / wallet", cash: "Cash", credit: "Credit card" };
const FREQ_LABEL = { weekly: "Weekly", biweekly: "Every 2 weeks", semimonthly: "Twice a month", monthly: "Monthly", yearly: "Yearly", daily: "Daily" };
const US_HOLIDAYS = ["2026-01-01","2026-01-19","2026-02-16","2026-05-25","2026-06-19","2026-07-03","2026-09-07","2026-10-12","2026-11-11","2026-11-26","2026-12-25",
  "2027-01-01","2027-01-18","2027-02-15","2027-05-31","2027-06-18","2027-07-05","2027-09-06","2027-10-11","2027-11-11","2027-11-25","2027-12-24","2027-12-31"];

const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  google: '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>'
};

/* ============================== state ============================== */
const LS = {
  get(k, d) { try { const v = localStorage.getItem("pocket." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("pocket." + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
};
const today0 = F.todayLocal();
const S = {
  store: null, user: null, data: null, ver: 0, unsub: null, booting: true, bootError: null,
  tab: LS.get("tab", "home"), actSeg: "list", planSeg: LS.get("planSeg", "budgets"),
  vy: +today0.slice(0, 4), vm: +today0.slice(5, 7), sel: today0, calAcc: "spend",
  ly: +today0.slice(0, 4), lm: +today0.slice(5, 7), q: "", fAcc: "", fCat: "", fType: "", showSched: true,
  form: null, onb: null, pendingImport: null, undo: null
};

/* ============================== helpers ============================== */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const today = () => F.todayLocal();
function money(n, opts = {}) {
  const v = Number(n) || 0, a = Math.abs(v);
  const s = a.toLocaleString("en-US", { minimumFractionDigits: opts.cents === false ? 0 : 2, maximumFractionDigits: opts.cents === false ? 0 : 2 });
  return (v < 0 ? "−" : opts.plus && v > 0 ? "+" : "") + "$" + s;
}
function money0(n) {
  const v = Number(n) || 0, a = Math.abs(v), s = v < 0 ? "−" : "";
  if (a >= 100000) return s + "$" + Math.round(a / 1000) + "k";
  if (a >= 10000) return s + "$" + (a / 1000).toFixed(1) + "k";
  return s + "$" + Math.round(a).toLocaleString("en-US");
}
function parseAmt(v) { const n = parseFloat(String(v == null ? "" : v).replace(/[$,\s]/g, "")); return isNaN(n) ? NaN : Math.round(n * 100) / 100; }
function fmtDate(ds, o) { if (!ds) return ""; return new Date(Date.UTC(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10), 12)).toLocaleDateString("en-US", { timeZone: "UTC", ...(o || { weekday: "short", month: "short", day: "numeric" }) }); }
function relDay(ds) {
  const d = F.dayNum(ds) - F.dayNum(today());
  if (d === 0) return "Today"; if (d === 1) return "Tomorrow"; if (d === -1) return "Yesterday";
  return fmtDate(ds);
}
function data() { return S.data || { accounts: [], categories: [], rules: [], goals: [], debts: [], transactions: [], settings: {} }; }
function cat(id) { return data().categories.find((c) => c.id === id) || (id ? { id, name: id, emoji: "📦", color: "#C9C4B8" } : { id: null, name: "Uncategorized", emoji: "📦", color: "#C9C4B8" }); }
function acc(id) { return data().accounts.find((a) => a.id === id) || { id, name: "Unknown account", color: "#C9C4B8", emoji: "🏦" }; }
function activeAccounts() { return data().accounts.filter((a) => !a.archived).sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(b.name)); }
function sortedCats(kind) { return data().categories.filter((c) => !kind || c.kind === kind).sort((a, b) => (a.order || 0) - (b.order || 0)); }
function holidays() { return new Set(data().settings.holidays || []); }

// memo cache, cleared whenever data changes
let MEMO = new Map();
function memo(key, fn) { if (!MEMO.has(key)) MEMO.set(key, fn()); return MEMO.get(key); }
function spendSet() { return memo("spend", () => F.spendAccounts(data())); }
function accSetFor(filter) {
  if (filter === "all") return null;
  if (filter === "spend" || !filter) return spendSet();
  return new Set([filter]);
}
function itemLabel(it) {
  if (it.type === "transfer") return it.label || ("To " + acc(it.toAccountId).name);
  return it.label || cat(it.categoryId).name;
}
function itemIcon(it) {
  if (it.type === "transfer") return { emoji: "🔄", color: "var(--accent-soft)" };
  const c = cat(it.categoryId);
  return { emoji: c.emoji || "📦", color: c.color + "40" };
}

/* ============================== boot ============================== */
function applyStyle() {
  const ios = LS.get("style", "ios") !== "classic";
  document.documentElement.classList.toggle("ios", ios);
  const light = document.querySelector('meta[name="theme-color"][media*="light"]'), dark = document.querySelector('meta[name="theme-color"][media*="dark"]');
  if (light) light.setAttribute("content", ios ? "#f2f2f7" : "#f7f6f3");
  if (dark) dark.setAttribute("content", ios ? "#000000" : "#161615");
}
applyStyle();
function applyTheme() {
  const t = LS.get("theme", "auto");
  if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
}
applyTheme();

async function boot() {
  const demo = new URLSearchParams(location.search).has("demo") || LS.get("mode", "") === "demo";
  // Always use the firebaseapp.com address: sign-in on iPhone is most reliable there.
  if (isConfigured(firebaseConfig) && location.hostname.endsWith(".web.app")) {
    location.replace("https://" + location.hostname.replace(/\.web\.app$/, ".firebaseapp.com") + location.pathname + location.search);
    return;
  }
  if (!demo && isConfigured(firebaseConfig)) {
    try { S.store = new FirebaseStore(firebaseConfig); await S.store.ready; }
    catch (e) { S.bootError = e; S.store = null; }
  }
  if (!S.store) S.store = new DemoStore();
  S.booting = false;
  S.store.onAuth(onAuth);
  render();
}

function onAuth(user) {
  S.user = user;
  S.profileChecked = false;
  if (S.unsub) { S.unsub(); S.unsub = null; }
  S.data = null;
  if (user) {
    S.unsub = S.store.subscribe((snap) => {
      S.data = snap; S.ver++; MEMO = new Map();
      if (snap.error) toast("Sync problem: " + (snap.error.code || snap.error.message || "unknown"));
      if (snap.loaded && !S.profileChecked && S.store.kind === "firebase") {
        S.profileChecked = true;
        if (!snap.profile || snap.profile.email !== user.email || snap.profile.photo !== user.photoURL) S.store.setProfile({ name: user.displayName || "", email: user.email || "", photo: user.photoURL || "" }).catch(() => {});
      }
      render();
    });
  }
  render();
}

/* ============================== render ============================== */
let shownMain = false;
function render() {
  const app = $("app"), tabbar = $("tabbar");
  const keepScroll = window.scrollY;
  M.beforeRender(app);
  renderInner(app, tabbar, keepScroll);
  if (!tabbar.hidden) M.syncLens(tabbar); else shownMain = false;
  M.afterRender(app, S.tab);
}
function renderInner(app, tabbar, keepScroll) {
  if (S.booting) { app.className = "wrap notabs"; app.innerHTML = `<div class="loading"><div class="spin"></div>Opening ${APP_NAME}…</div>`; tabbar.hidden = true; return; }
  if (!S.user) { tabbar.hidden = true; app.className = ""; app.innerHTML = viewSignIn(); return; }
  if (!S.data || !S.data.loaded) { tabbar.hidden = true; app.className = "wrap notabs"; app.innerHTML = `<div class="loading"><div class="spin"></div>Loading your money…</div>`; return; }
  if (!data().settings.onboarded && !data().accounts.length) { tabbar.hidden = true; app.className = "wrap notabs"; app.innerHTML = viewOnboarding(); return; }
  tabbar.hidden = false;
  app.className = "wrap";
  const views = { home: viewHome, calendar: viewCalendar, activity: viewActivity, plan: viewPlan, settings: viewSettings };
  app.innerHTML = (views[S.tab] || viewHome)();
  // the tab bar is built once and kept, so its lens can glide between tabs
  if (!tabbar.querySelector(".in")) { tabbar.innerHTML = viewTabbar(); M.bindTabbar(tabbar); }
  tabbar.querySelectorAll(".tb").forEach((b) => { const on = b.dataset.v === S.tab; b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (S.tab === "calendar") M.attachCalendar($("calcard"));
  if (S.restoreScroll) { window.scrollTo(0, keepScroll); S.restoreScroll = false; }
  if (!shownMain) { shownMain = true; requestAnimationFrame(() => M.enterTab(app, 0)); }
}

function viewTabbar() {
  const t = (id, label) => `<button class="tb${S.tab === id ? " on" : ""}" data-act="tab" data-v="${id}" aria-label="${label}">${ICON[id]}<span>${label}</span></button>`;
  return `<div class="in">${t("home", "Home")}${t("calendar", "Calendar")}<button class="tbadd" data-act="add" aria-label="Add transaction"><span>+</span></button>${t("activity", "Activity")}${t("plan", "Plan")}</div>`;
}

/* ------------------------------ sign in ------------------------------ */
function viewSignIn() {
  const fb = S.store.kind === "firebase";
  const err = S.bootError ? `<div class="banner bad">Couldn't reach Google sign-in (${esc(S.bootError.message || S.bootError)}). You can still try the demo.</div>` : "";
  const notSet = !isConfigured(firebaseConfig) ? `<div class="banner info">Google sign-in isn't connected yet. Follow the setup guide (README) to add your Firebase settings. Until then, the demo keeps data on this device only.</div>` : "";
  return `<div class="signin">
    <img class="logo" src="icons/icon-192.png" alt="">
    <h1>${APP_NAME}</h1>
    <p class="lead">See what's safe to spend, every day.</p>
    <div class="feat"><span class="e">📅</span><div><b>Know your balance on any day</b>Paydays, bills and spending on one calendar.</div></div>
    <div class="feat"><span class="e">🎯</span><div><b>Budgets, goals and debt payoff</b>See when you'll hit $50k or be car-payment free.</div></div>
    <div class="feat"><span class="e">🔒</span><div><b>Private to your Google account</b>Nobody else can see your data.</div></div>
    <div style="height:14px"></div>${err}${notSet}
    ${fb ? `<button class="gbtn" data-act="signin">${ICON.google}<span>Continue with Google</span></button>` : ""}
    <button class="bigbtn ghost" data-act="demo">${fb ? "Try it without an account" : "Try the demo"}</button>
    <p class="fine">${fb ? "Demo data stays on this device only." : "Demo data stays on this device only and isn't backed up."}</p>
  </div>`;
}

/* ------------------------------ onboarding ------------------------------ */
function onbDefaults() {
  return {
    accounts: [
      { key: "bank", name: "Main bank", type: "checking", emoji: "🏦", color: "#7FB3F0", on: true, bal: "" },
      { key: "cashapp", name: "Cash App", type: "wallet", emoji: "💸", color: "#5DCAA5", on: false, bal: "" },
      { key: "paypal", name: "PayPal", type: "wallet", emoji: "🅿️", color: "#FAC775", on: false, bal: "" },
      { key: "ppsave", name: "PayPal Savings", type: "savings", emoji: "🐷", color: "#E3A8D4", on: false, bal: "" },
      { key: "savings", name: "Savings", type: "savings", emoji: "🐷", color: "#9FD8A0", on: false, bal: "" },
      { key: "cc", name: "Credit card", type: "credit", emoji: "💳", color: "#F0997B", on: false, bal: "" }
    ]
  };
}
function viewOnboarding() {
  if (!S.onb) S.onb = onbDefaults();
  const first = (S.user.displayName || "").split(" ")[0];
  const rows = S.onb.accounts.map((a, i) => `
    <div class="toggle">
      <span class="ico" style="background:${a.color}40">${a.emoji}</span>
      <div class="tx"><b>${esc(a.name)}</b><small>${ACCOUNT_TYPES[a.type]}</small></div>
      <label class="sw"><input type="checkbox" data-inp="onbOn" data-i="${i}" ${a.on ? "checked" : ""} aria-label="Use ${esc(a.name)}"><span></span></label>
    </div>
    ${a.on ? `<div class="fg" style="margin:6px 0 10px"><div class="amtwrap sm"><span>$</span><input inputmode="decimal" placeholder="${a.type === "credit" ? "Amount owed today" : "Balance today (optional)"}" value="${esc(a.bal)}" data-inp="onbBal" data-i="${i}" aria-label="${esc(a.name)} balance today"></div></div>` : ""}`).join("");
  const imp = S.pendingImport;
  return `<div class="top"><h1>Welcome${first ? ", " + esc(first) : ""} 👋</h1></div>
    <p class="sub" style="margin:-4px 2px 14px">Two quick steps and you're in. You can change all of this later.</p>
    <div class="sechead" style="margin-top:4px"><h2>1. Your accounts</h2></div>
    <div class="card">${rows}</div>
    <div class="sechead"><h2>2. Bring your old data <span class="muted" style="font-weight:500">(optional)</span></h2></div>
    <div class="card">
      ${imp ? `<div class="banner good" style="margin:0 0 10px">Ready to import <b>${imp.count}</b> entries (${fmtDate(imp.from, { month: "short", day: "numeric", year: "numeric" })} – ${fmtDate(imp.to, { month: "short", day: "numeric", year: "numeric" })}) into Main bank.</div>
        <div class="toggle"><div class="tx">Turn Cash App & PayPal entries into transfers<small>Only if you're adding those accounts above and will track spending in them</small></div>
        <label class="sw"><input type="checkbox" data-inp="onbXfer" ${S.onb.xfer ? "checked" : ""}><span></span></label></div>`
      : `<p class="sub" style="margin:0 0 10px">Import the backup file from your old tracker (finance-backup-….json).</p>`}
      <label class="bigbtn ghost small" style="display:flex;align-items:center;justify-content:center;margin:0">${imp ? "Choose a different file" : "Choose backup file"}<input type="file" accept=".json,application/json" data-inp="onbFile" hidden></label>
    </div>
    <button class="bigbtn" data-act="onbDone" style="margin-top:6px">Get started</button>
    <p class="fine">Tip: enter today's real balances so every day's number matches your bank.</p>`;
}

/* ------------------------------ home ------------------------------ */
function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function avatar() {
  const u = S.user, init = (u.displayName || "?").trim().charAt(0).toUpperCase();
  return `<button class="avatar" data-act="tab" data-v="settings" aria-label="Settings and profile">${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : esc(init)}</button>`;
}
function viewHome() {
  const d = data(), t = today();
  const first = (S.user.displayName || "").split(" ")[0];
  const sts = memo("sts", () => F.safeToSpend(d, t));
  const accs = activeAccounts();
  const bals = memo("bals", () => F.accountBalances(d, t));
  const y = +t.slice(0, 4), m = +t.slice(5, 7);
  const ms = memo("ms" + y + m, () => F.monthSummary(d, y, m, null));
  const pm = m === 1 ? [y - 1, 12] : [y, m - 1];
  const prev = memo("ms" + pm[0] + pm[1], () => F.monthSummary(d, pm[0], pm[1], null));
  // compare spending so far this month with the same point last month
  const dom = +t.slice(8, 10);
  const prevSoFar = memo("prevSoFar", () => F.summarize(F.buildItems(d, F.ymd(pm[0], pm[1], 1), F.ymd(pm[0], pm[1], Math.min(dom, F.daysInMonth(pm[0], pm[1])))), null));
  const soFar = memo("soFar", () => F.summarize(F.buildItems(d, F.monthStart(t), t), null));
  const budgets = memo("bud" + y + m, () => F.budgetStatus(d, y, m, t));
  const up = memo("up7", () => F.upcoming(d, F.addDays(t, 1), 7)).slice(0, 5);

  const safeCol = sts.safe < 0 ? "var(--expense)" : "var(--text)";
  const paydayTxt = sts.payday
    ? `until payday <b>${relDay(sts.payday)}</b> · about <b>${money(Math.max(0, sts.perDay))}</b>/day`
    : `Add your paycheck in <b>Plan → Paychecks</b> to see this until payday.`;
  let html = `<div class="top">${avatar()}<div class="hello"><p class="k">${greeting()}${first ? "," : ""}</p><p class="v">${esc(first || APP_NAME)}</p></div></div>`;
  html += `<div class="card hero">
    <p class="lbl">Safe to spend</p>
    <p class="big num" style="color:${safeCol}">${money(sts.safe)}</p>
    <p class="meta">${paydayTxt}</p>
    <div class="chips3">
      <div class="mini"><p class="k">In accounts</p><p class="v num">${money0(sts.balance)}</p></div>
      <div class="mini"><p class="k">Bills due</p><p class="v num exp">${money0(sts.upcoming)}</p></div>
      <div class="mini"><p class="k">Next pay</p><p class="v num inc">${sts.payday ? money0(sts.paydayAmount) : "—"}</p></div>
    </div></div>`;
  if (sts.lowest < 0) html += `<div class="banner bad">⚠️ Your balance is set to drop to <b>${money(sts.lowest)}</b> on ${relDay(sts.lowestDate)}. Move a payment or transfer money before then.</div>`;
  else if (sts.safe < 0) html += `<div class="banner warn">Bills due before payday are more than what's in your spending accounts by <b>${money(-sts.safe)}</b>.</div>`;

  // accounts strip
  html += `<div class="hscroll">${accs.map((a) => `<button class="acct" data-act="openAcctActivity" data-id="${a.id}">
      <p class="n"><span class="cdot" style="background:${a.color}"></span>${esc(a.name)}</p>
      <p class="b num ${bals[a.id] < 0 ? "exp" : ""}">${money(bals[a.id])}</p></button>`).join("")}
    <button class="acct" data-act="editAccount" style="display:flex;align-items:center;justify-content:center;min-width:96px;color:var(--accent);font-weight:640">+ Account</button></div>`;

  // this month
  const diff = soFar.expense - prevSoFar.expense;
  html += `<div class="grid2">
    <div class="tile"><p class="k">Spent in ${MON3[m - 1]}</p><p class="v num exp">${money(ms.expense)}</p>
      <p class="s">${prevSoFar.expense ? (diff <= 0 ? `↓ ${money0(-diff)} vs last month` : `↑ ${money0(diff)} vs last month`) : `${money(soFar.expense)} so far`}</p></div>
    <div class="tile"><p class="k">Income in ${MON3[m - 1]}</p><p class="v num inc">${money(ms.income)}</p>
      <p class="s">Net ${money(ms.net, { plus: true })}</p></div></div>`;

  // budgets
  html += `<div class="sechead"><h2>Budgets</h2><button class="link" data-act="goPlan" data-v="budgets">${budgets.length ? "See all" : "Set up"}</button></div>`;
  if (budgets.length) html += `<div class="card tight">${budgets.slice(0, 3).map(budgetRow).join("")}</div>`;
  else html += `<button class="card" data-act="goPlan" data-v="budgets" style="width:100%;text-align:left;font-size:15px;color:var(--text-2)">🎯 Set a monthly limit for food, gas or shopping and watch it fill up as you spend.</button>`;

  // upcoming
  html += `<div class="sechead"><h2>Next 7 days</h2><button class="link" data-act="tab" data-v="calendar">Calendar</button></div>`;
  html += `<div class="card flush">${up.length ? up.map((it) => itemRow(it, { showDate: true })).join("") : `<div class="empty">No bills in the next week 🎉</div>`}</div>`;

  // goals
  const goals = d.goals.slice(0, 2);
  if (goals.length) {
    html += `<div class="sechead"><h2>Goals</h2><button class="link" data-act="goPlan" data-v="goals">See all</button></div>`;
    html += goals.map((g) => goalCard(g, true)).join("");
  }
  // debts
  if (d.debts.length) {
    const sums = d.debts.map((x) => F.debtSummary(x, t));
    const last = sums.map((s) => s.plan.payoffDate).filter(Boolean).sort().pop();
    const total = d.debts.reduce((s, x) => s + (Number(x.balance) || 0), 0);
    html += `<button class="card" data-act="goPlan" data-v="debts" style="width:100%;text-align:left;display:flex;gap:12px;align-items:center">
      <span class="ico" style="background:var(--good-bg)">🏁</span><span style="flex:1"><b>${last ? "Debt-free by " + fmtDate(last, { month: "short", year: "numeric" }) : "Debt payoff"}</b><br><span class="sub" style="font-size:13.5px">${money(total)} left across ${d.debts.length} debt${d.debts.length > 1 ? "s" : ""}</span></span><span class="muted">›</span></button>`;
  }
  return html;
}

function budgetRow(b) {
  const c = cat(b.categoryId);
  const pSpent = Math.min(1, b.spent / b.budget), pAll = Math.min(1, (b.spent + b.scheduled) / b.budget);
  const over = b.status === "over";
  return `<div class="bar"><div class="r1"><span class="l"><span>${c.emoji || "📦"}</span><span>${esc(c.name)}</span></span>
    <b class="num ${over ? "exp" : ""}">${over ? money(-b.remaining) + " over" : money(b.remaining) + " left"}</b></div>
    <div class="track"><div class="fill sched" style="width:${pAll * 100}%;background:${over ? "var(--expense)" : c.color}"></div><div class="fill${over ? " over" : ""}" style="width:${pSpent * 100}%;background:${c.color}"></div></div>
    <div class="r2"><span class="num">${money(b.spent)} spent${b.scheduled ? " · " + money(b.scheduled) + " coming" : ""}</span><span class="num">of ${money(b.budget, { cents: false })}</span></div></div>`;
}

function itemRow(it, o = {}) {
  const ic = itemIcon(it);
  const sign = it.type === "income" ? "+" : it.type === "transfer" ? "" : "−";
  const cls = it.type === "income" ? "inc" : it.type === "transfer" ? "" : "exp";
  const accName = it.type === "transfer" ? acc(it.accountId).name + " → " + acc(it.toAccountId).name : (data().accounts.length > 1 ? acc(it.accountId).name : "");
  const meta = [o.showDate ? relDay(it.date) : "", it.type !== "transfer" ? cat(it.categoryId).name : "", accName].filter(Boolean);
  const sched = it.virtual ? `<span class="tag sched" style="margin:0 5px 0 0">${it.kind === "paycheck" ? "payday" : "repeats"}</span>` : (it.date > today() ? `<span class="tag sched" style="margin:0 5px 0 0">planned</span>` : "");
  return `<button class="item" data-act="${it.virtual ? "openOcc" : "editTx"}" data-id="${esc(it.id)}">
    <span class="ico" style="background:${ic.color}">${ic.emoji}</span>
    <span class="info"><span class="nm" style="display:block">${esc(itemLabel(it))}</span><span class="mt" style="display:block">${sched}${esc(meta.join(" · "))}</span></span>
    <span class="amt num ${cls}">${sign}${money(it.amount).replace("−", "")}${o.bal !== undefined ? `<small>${money(o.bal)}</small>` : ""}</span></button>`;
}

/* ------------------------------ calendar ------------------------------ */
function accFilterChips(cur, act) {
  const accs = activeAccounts();
  const chip = (v, label) => `<button class="chip${cur === v ? " on" : ""}" data-act="${act}" data-v="${v}">${label}</button>`;
  return `<div class="chips" data-pill="${act}">${chip("spend", "Spending money")}${chip("all", "All accounts")}${accs.map((a) => chip(a.id, `<span class="cdot" style="background:${a.color}"></span>${esc(a.name)}`)).join("")}</div>`;
}
function viewCalendar() {
  const d = data(), y = S.vy, m = S.vm, dim = F.daysInMonth(y, m), first = F.weekday(F.ymd(y, m, 1)), t = today();
  const set = accSetFor(S.calAcc);
  const from = F.addDays(F.ymd(y, m, 1), -first), to = F.addDays(F.ymd(y, m, dim), 13);
  const series = memo(`ser${S.calAcc}${y}${m}`, () => F.balanceSeries(d, set, from, to));
  const items = memo(`calItems${y}${m}`, () => F.buildItems(d, from, to));
  const byDate = {};
  for (const it of items) {
    if (set && !(set.has(it.accountId) || (it.type === "transfer" && set.has(it.toAccountId)))) continue;
    (byDate[it.date] = byDate[it.date] || []).push(it);
  }
  const ms = F.summarize(items.filter((i) => i.date >= F.ymd(y, m, 1) && i.date <= F.ymd(y, m, dim)), set);
  const endBal = series[F.ymd(y, m, dim)];
  if (S.sel < from || S.sel > to) S.sel = F.ymd(y, m, 1);
  const selBal = series[S.sel];
  let low = null, lowD = null;
  for (let i = 1; i <= dim; i++) { const ds = F.ymd(y, m, i); if (ds >= t && (low === null || series[ds] < low)) { low = series[ds]; lowD = ds; } }

  let cells = ["S","M","T","W","T","F","S"].map((x) => `<div class="dh">${x}</div>`).join("");
  const total = Math.ceil((first + dim) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const ds = F.addDays(from, i), other = ds.slice(0, 7) !== F.ymd(y, m, 1).slice(0, 7), list = byDate[ds] || [];
    const bal = series[ds];
    const dots = list.slice(0, 4).map((it) => `<span class="dot" style="background:${it.type === "transfer" ? "var(--accent)" : it.type === "income" ? "var(--income)" : cat(it.categoryId).color}"></span>`).join("");
    const cls = "day" + (other ? " other" : "") + (ds === t ? " today" : "") + (ds === S.sel ? " sel" : "") + (bal < 0 ? " neg" : "");
    cells += `<button class="${cls}" data-act="selDay" data-v="${ds}" aria-label="${fmtDate(ds, { weekday: "long", month: "long", day: "numeric" })}, ${list.length} items, balance ${money(bal)}">
      <span class="dn">${+ds.slice(8)}</span><span class="dots">${dots}</span>${other ? "" : `<span class="db num${Math.abs(bal) < 0.005 ? " zero" : ""}">${money0(bal)}</span>`}</button>`;
  }
  const dayList = (byDate[S.sel] || []);
  const sIn = dayList.filter((i) => i.type === "income").reduce((s, i) => s + i.amount, 0), sOut = dayList.filter((i) => i.type === "expense").reduce((s, i) => s + i.amount, 0);
  return `<div class="top"><button class="iconbtn" data-act="month" data-v="-1" aria-label="Previous month">‹</button><h1 class="c">${MONTHS[m - 1]} ${y}</h1><button class="iconbtn" data-act="month" data-v="1" aria-label="Next month">›</button></div>
    ${accFilterChips(S.calAcc, "calAcc")}
    <div class="card hero"><p class="lbl">${S.sel === t ? "Left today" : "Left on " + fmtDate(S.sel)}</p>
      <p class="big num" style="color:${selBal < 0 ? "var(--expense)" : "var(--text)"}">${money(selBal)}</p>
      <div class="chips3"><div class="mini"><p class="k">In</p><p class="v num inc">${money0(ms.income)}</p></div>
      <div class="mini"><p class="k">Out</p><p class="v num exp">${money0(ms.expense)}</p></div>
      <div class="mini"><p class="k">Month end</p><p class="v num ${endBal < 0 ? "exp" : ""}">${money0(endBal)}</p></div></div></div>
    ${low !== null && low < 0 ? `<div class="banner bad">Balance drops to <b>${money(low)}</b> on ${fmtDate(lowD, { month: "short", day: "numeric" })}.</div>` : ""}
    <div class="card" id="calcard" style="padding:8px 6px 6px"><div class="cal">${cells}</div></div>
    <div class="sechead"><h2>${fmtDate(S.sel, { weekday: "long", month: "short", day: "numeric" })}</h2><span class="meta num">${sIn ? `<span class="inc">+${money(sIn)}</span> ` : ""}${sOut ? `<span class="exp">−${money(sOut).replace("−", "")}</span>` : ""}</span></div>
    <div class="card flush">${dayList.length ? dayList.map((it) => itemRow(it)).join("") : `<div class="empty">Nothing on this day.</div>`}
      <button class="addline" data-act="add" data-date="${S.sel}">+ Add to this day</button></div>
    ${S.sel !== t ? `<button class="bigbtn ghost" data-act="goToday">Jump to today</button>` : ""}`;
}
function shiftMonth(n) {
  let y = S.vy, m = S.vm + n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; }
  S.vy = y; S.vm = m; const t = today();
  S.sel = t.slice(0, 7) === F.ymd(y, m, 1).slice(0, 7) ? t : F.ymd(y, m, 1);
  render();
}

/* ------------------------------ activity ------------------------------ */
function viewActivity() {
  const seg = `<div class="seg"><button class="${S.actSeg === "list" ? "on" : ""}" data-act="actSeg" data-v="list">Transactions</button><button class="${S.actSeg === "insights" ? "on" : ""}" data-act="actSeg" data-v="insights">Insights</button></div>`;
  const head = `<div class="top"><button class="iconbtn" data-act="lmonth" data-v="-1" aria-label="Previous month">‹</button><h1 class="c">${MONTHS[S.lm - 1]} ${S.ly}</h1><button class="iconbtn" data-act="lmonth" data-v="1" aria-label="Next month">›</button></div>`;
  return head + seg + (S.actSeg === "insights" ? viewInsights() : viewList());
}
function filteredMonthItems() {
  const d = data(), from = F.ymd(S.ly, S.lm, 1), to = F.ymd(S.ly, S.lm, F.daysInMonth(S.ly, S.lm));
  let items = memo(`li${S.ly}${S.lm}`, () => F.buildItems(d, from, to));
  const q = S.q.trim().toLowerCase();
  return items.filter((it) => {
    if (!S.showSched && it.virtual) return false;
    if (S.fType && it.type !== S.fType) return false;
    if (S.fAcc && it.accountId !== S.fAcc && it.toAccountId !== S.fAcc) return false;
    if (S.fCat && it.categoryId !== S.fCat) return false;
    if (q && !(itemLabel(it).toLowerCase().includes(q) || cat(it.categoryId).name.toLowerCase().includes(q) || String(it.note || "").toLowerCase().includes(q) || String(it.amount).includes(q))) return false;
    return true;
  });
}
function viewList() {
  const tchip = (v, l) => `<button class="chip${S.fType === v ? " on" : ""}" data-act="fType" data-v="${v}">${l}</button>`;
  const accOpts = `<option value="">All accounts</option>` + activeAccounts().map((a) => `<option value="${a.id}" ${S.fAcc === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("");
  const catOpts = `<option value="">All categories</option>` + sortedCats().map((c) => `<option value="${c.id}" ${S.fCat === c.id ? "selected" : ""}>${c.emoji || ""} ${esc(c.name)}</option>`).join("");
  let html = `<div class="fg" style="margin-bottom:10px"><input type="search" placeholder="Search transactions" value="${esc(S.q)}" data-inp="q" aria-label="Search transactions" enterkeyhint="search"></div>
    <div class="chips">${tchip("", "All")}${tchip("expense", "Spending")}${tchip("income", "Income")}${tchip("transfer", "Transfers")}
      <button class="chip${S.showSched ? " on" : ""}" data-act="toggleSched">${S.showSched ? "✓ " : ""}Scheduled</button></div>
    <div class="row2" style="margin-bottom:6px"><div class="fg" style="margin:0"><select data-inp="fAcc" aria-label="Filter by account">${accOpts}</select></div>
      <div class="fg" style="margin:0"><select data-inp="fCat" aria-label="Filter by category">${catOpts}</select></div></div>
    <div id="listResults">${listResults()}</div>`;
  return html;
}
function listResults() {
  const items = filteredMonthItems().slice().reverse();
  const s = F.summarize(items, null);
  let html = `<div class="grid2" style="margin-top:10px"><div class="tile"><p class="k">Spent</p><p class="v num exp">${money(s.expense)}</p></div><div class="tile"><p class="k">Earned</p><p class="v num inc">${money(s.income)}</p></div></div>`;
  if (!items.length) return html + `<div class="card"><div class="empty"><span class="e">🔍</span>${S.q || S.fAcc || S.fCat || S.fType ? "Nothing matches these filters." : "No transactions this month yet.<br>Tap + to add one."}</div></div>`;
  let cur = null, group = [];
  const flush = () => {
    if (!group.length) return;
    const tot = group.reduce((a, i) => a + (i.type === "income" ? i.amount : i.type === "expense" ? -i.amount : 0), 0);
    html += `<div class="dayhead"><span>${relDay(cur)}</span><span class="num">${tot ? money(tot, { plus: true }) : ""}</span></div><div class="card flush" style="margin-bottom:4px">${group.map((i) => itemRow(i)).join("")}</div>`;
  };
  for (const it of items) { if (it.date !== cur) { flush(); cur = it.date; group = []; } group.push(it); }
  flush();
  return html;
}

function viewInsights() {
  const d = data(), y = S.ly, m = S.lm, t = today();
  const s = memo(`ms${y}${m}`, () => F.monthSummary(d, y, m, null));
  const pm = m === 1 ? [y - 1, 12] : [y, m - 1];
  const p = memo(`ms${pm[0]}${pm[1]}`, () => F.monthSummary(d, pm[0], pm[1], null));
  const cats = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]);
  const top = cats.slice(0, 6), rest = cats.slice(6).reduce((a, x) => a + x[1], 0);
  const segs = top.map(([id, v]) => ({ value: v, color: cat(id).color })); if (rest) segs.push({ value: rest, color: "var(--surface-3)" });
  const legend = top.map(([id, v]) => {
    const c = cat(id), pv = p.byCat[id] || 0, ch = pv ? (v - pv) / pv : null;
    return `<div class="li"><span class="cdot" style="background:${c.color}"></span><span>${c.emoji || ""} ${esc(c.name)}</span><b class="num">${money0(v)}</b>${ch !== null ? `<span class="${ch > 0 ? "exp" : "inc"}" style="font-size:11.5px;width:40px;text-align:right">${ch > 0 ? "↑" : "↓"}${Math.abs(Math.round(ch * 100))}%</span>` : `<span style="width:40px"></span>`}</div>`;
  }).join("") + (rest ? `<div class="li"><span class="cdot" style="background:var(--surface-3)"></span><span>Everything else</span><b class="num">${money0(rest)}</b><span style="width:40px"></span></div>` : "");
  // 6 months bars ending at viewed month
  const months = F.lastNMonths(F.ymd(y, m, 1), 6).map(({ y: yy, m: mm }) => {
    const x = memo(`ms${yy}${mm}`, () => F.monthSummary(d, yy, mm, null));
    return { label: MON3[mm - 1], a: x.income, b: x.expense, cur: yy === y && mm === m, net: x.net };
  });
  // forecast next 60 days of spending money
  const fc = memo("fc60", () => F.balanceSeries(d, spendSet(), t, F.addDays(t, 60)));
  const pts = Object.keys(fc).sort().map((ds, i) => ({ v: fc[ds], ds, i }));
  const minP = pts.reduce((a, b) => (b.v < a.v ? b : a), pts[0] || { v: 0, ds: t });
  const ticks = pts.filter((p2) => p2.ds.endsWith("-01") || p2.i === 0).map((p2) => ({ i: p2.i, label: p2.i === 0 ? "Today" : MON3[+p2.ds.slice(5, 7) - 1] }));
  // top labels ("merchants")
  const items = memo(`li${y}${m}`, () => F.buildItems(d, F.ymd(y, m, 1), F.ymd(y, m, F.daysInMonth(y, m))));
  const byLabel = {};
  for (const it of items) if (it.type === "expense") { const k = itemLabel(it); byLabel[k] = byLabel[k] || { n: 0, v: 0, c: it.categoryId }; byLabel[k].n++; byLabel[k].v += it.amount; }
  const topL = Object.entries(byLabel).sort((a, b) => b[1].v - a[1].v).slice(0, 5);
  const dim = F.daysInMonth(y, m);
  const daysElapsed = t.slice(0, 7) === F.ymd(y, m, 1).slice(0, 7) ? +t.slice(8) : dim;
  const biggest = items.filter((i) => i.type === "expense").sort((a, b) => b.amount - a.amount)[0];
  const savingsRate = s.income ? s.net / s.income : null;
  return `<div class="grid2">
      <div class="tile"><p class="k">Spent</p><p class="v num exp">${money(s.expense)}</p><p class="s">${p.expense ? (s.expense <= p.expense ? "↓ " : "↑ ") + money0(Math.abs(s.expense - p.expense)) + " vs " + MON3[pm[1] - 1] : "&nbsp;"}</p></div>
      <div class="tile"><p class="k">Kept</p><p class="v num ${s.net < 0 ? "exp" : "inc"}">${money(s.net)}</p><p class="s">${savingsRate !== null ? Math.round(savingsRate * 100) + "% of income" : "&nbsp;"}</p></div>
      <div class="tile"><p class="k">Avg per day</p><p class="v num">${money(s.expense / dim)}</p><p class="s">over ${dim} days</p></div>
      <div class="tile"><p class="k">Biggest expense</p><p class="v num">${biggest ? money0(biggest.amount) : "—"}</p><p class="s">${biggest ? esc(itemLabel(biggest)) : "&nbsp;"}</p></div></div>
    <div class="sechead"><h2>Where it went</h2><span class="meta">vs ${MON3[pm[1] - 1]}</span></div>
    <div class="card">${cats.length ? `<div class="donutwrap">${donut(segs, { center: money0(s.expense) })}<div class="legend">${legend}</div></div>` : `<div class="empty">No spending in ${MONTHS[m - 1]}.</div>`}</div>
    <div class="sechead"><h2>In vs out</h2><span class="meta"><span class="inc">■</span> income <span class="exp">■</span> spending</span></div>
    <div class="card">${bars(months)}</div>
    <div class="sechead"><h2>Next 60 days</h2><span class="meta">spending money</span></div>
    <div class="card">${line(pts, { ticks })}<p class="sub" style="margin:6px 2px 0;font-size:13.5px">Lowest point: <b class="${minP.v < 0 ? "exp" : ""}">${money(minP.v)}</b> on ${fmtDate(minP.ds)}.</p></div>
    <div class="sechead"><h2>Top spending</h2></div>
    <div class="card flush">${topL.length ? topL.map(([k, v]) => `<div class="item"><span class="ico" style="background:${cat(v.c).color}40">${cat(v.c).emoji || "📦"}</span><span class="info"><span class="nm" style="display:block">${esc(k)}</span><span class="mt" style="display:block">${v.n} time${v.n > 1 ? "s" : ""}</span></span><span class="amt num exp">${money(v.v)}</span></div>`).join("") : `<div class="empty">Nothing yet.</div>`}</div>`;
}

/* ------------------------------ plan ------------------------------ */
function viewPlan() {
  const segs = [["budgets", "Budgets"], ["bills", "Bills"], ["goals", "Goals"], ["debts", "Debts"], ["pay", "Paychecks"]];
  const head = `<div class="top"><h1>Plan</h1></div><div class="chips" data-pill="plan">${segs.map(([v, l]) => `<button class="chip${S.planSeg === v ? " on" : ""}" data-act="planSeg" data-v="${v}">${l}</button>`).join("")}</div>`;
  const body = { budgets: planBudgets, bills: planBills, goals: planGoals, debts: planDebts, pay: planPay }[S.planSeg] || planBudgets;
  return head + body();
}
function planBudgets() {
  const d = data(), t = today(), y = +t.slice(0, 4), m = +t.slice(5, 7);
  const b = memo("bud" + y + m, () => F.budgetStatus(d, y, m, t));
  const total = b.reduce((s, x) => s + x.budget, 0), used = b.reduce((s, x) => s + x.spent + x.scheduled, 0), spent = b.reduce((s, x) => s + x.spent, 0);
  const daysLeft = F.daysInMonth(y, m) - +t.slice(8) + 1;
  let html = "";
  if (b.length) {
    html += `<div class="card hero"><p class="lbl">${MONTHS[m - 1]} budget</p><p class="big num ${total - used < 0 ? "exp" : ""}">${money(total - used)}</p>
      <p class="meta">${total - used >= 0 ? "left" : "over"} of ${money(total, { cents: false })} · ${daysLeft} day${daysLeft > 1 ? "s" : ""} to go · about <b>${money(Math.max(0, (total - used) / daysLeft))}</b>/day</p>
      <div class="track" style="margin-top:12px"><div class="fill sched" style="width:${Math.min(100, used / total * 100)}%;background:var(--accent)"></div><div class="fill" style="width:${Math.min(100, spent / total * 100)}%;background:var(--accent)"></div></div></div>`;
    html += `<div class="card tight">${b.map(budgetRow).join("")}</div>`;
    const over = b.filter((x) => x.status === "over");
    if (over.length) html += `<div class="banner warn">Over budget in ${over.map((x) => esc(x.name)).join(", ")}. Lighter bars are bills already scheduled for later this month.</div>`;
  } else html += `<div class="card"><div class="empty"><span class="e">🎯</span>No budgets yet. Pick a few categories you want to keep an eye on, like food, gas or shopping.</div></div>`;
  html += `<button class="bigbtn" data-act="editBudgets">${b.length ? "Edit budgets" : "Set budgets"}</button>`;
  return html;
}
function ruleNext(r, from) { const o = F.expandRule(r, from, F.addDays(from, 400), holidays()); return o[0] || null; }
function perMonth(r) { const f = { daily: 30.44, weekly: 4.345, biweekly: 2.1725, semimonthly: 2, monthly: 1, yearly: 1 / 12 }[r.freq] || 1; return r.amount * f; }
function freqText(r) {
  if (r.freq === "weekly") return "Every " + DOW[Number(r.weekday ?? F.weekday(r.startDate))];
  if (r.freq === "biweekly") return "Every other " + DOW[F.weekday(r.startDate)];
  if (r.freq === "semimonthly") return "The " + (r.monthDays || [15, 31]).map((x) => (+x >= 31 ? "last day" : ordinal(+x))).join(" & ");
  if (r.freq === "monthly") return "Monthly on the " + (+r.monthDay >= 31 ? "last day" : ordinal(+r.monthDay || +r.startDate.slice(8)));
  if (r.freq === "yearly") return "Every " + fmtDate(r.startDate, { month: "long", day: "numeric" });
  return FREQ_LABEL[r.freq] || r.freq;
}
function ordinal(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function ruleRow(r, t) {
  const nx = ruleNext(r, t);
  const ic = r.type === "transfer" ? { emoji: "🔄", color: "var(--accent-soft)" } : { emoji: cat(r.categoryId).emoji || "📦", color: cat(r.categoryId).color + "40" };
  const cls = r.type === "income" ? "inc" : r.type === "expense" ? "exp" : "";
  return `<button class="item" data-act="editRule" data-id="${r.id}"><span class="ico" style="background:${ic.color}">${ic.emoji}</span>
    <span class="info"><span class="nm" style="display:block">${esc(r.label || cat(r.categoryId).name)}${r.paused ? '<span class="tag">paused</span>' : ""}</span>
    <span class="mt" style="display:block">${esc(freqText(r))}${nx && !r.paused ? " · next " + relDay(nx.date) : r.endDate && r.endDate < t ? " · ended" : ""}</span></span>
    <span class="amt num ${cls}">${money(r.amount)}<small>${money0(perMonth(r))}/mo</small></span></button>`;
}
function planBills() {
  const d = data(), t = today();
  const active = d.rules.filter((r) => !r.paused && (!r.endDate || r.endDate >= t));
  const inc = active.filter((r) => r.type === "income").reduce((s, r) => s + perMonth(r), 0);
  const out = active.filter((r) => r.type === "expense").reduce((s, r) => s + perMonth(r), 0);
  const subs = active.filter((r) => r.kind === "subscription");
  const groups = [["Bills", (r) => r.type === "expense" && r.kind !== "subscription"], ["Subscriptions", (r) => r.kind === "subscription"], ["Income", (r) => r.type === "income"], ["Transfers & savings", (r) => r.type === "transfer"]];
  let html = `<div class="grid2"><div class="tile"><p class="k">Bills per month</p><p class="v num exp">${money(out)}</p><p class="s">${active.filter((r) => r.type === "expense").length} recurring</p></div>
    <div class="tile"><p class="k">Income per month</p><p class="v num inc">${money(inc)}</p><p class="s">left after bills ${money0(inc - out)}</p></div></div>`;
  if (subs.length) html += `<div class="banner info">Subscriptions cost you <b>${money(subs.reduce((s, r) => s + perMonth(r), 0) * 12, { cents: false })}</b> a year. Worth a look?</div>`;
  html += `<button class="bigbtn" data-act="editRule">+ Add a bill, subscription or repeat</button>`;
  for (const [name, test] of groups) {
    const rs = d.rules.filter(test).sort((a, b) => (ruleNext(a, t)?.date || "9") < (ruleNext(b, t)?.date || "9") ? -1 : 1);
    if (!rs.length) continue;
    html += `<div class="sechead"><h2>${name}</h2></div><div class="card flush">${rs.map((r) => ruleRow(r, t)).join("")}</div>`;
  }
  if (!d.rules.length) html += `<div class="card"><div class="empty"><span class="e">🔁</span>Add things that repeat, like rent, your car payment, phone bill or Netflix. They'll fill in your calendar automatically.</div></div>`;
  return html;
}
function goalCurrent(g) {
  if (g.accountId) return memo("bals", () => F.accountBalances(data(), today()))[g.accountId] || 0;
  return Number(g.saved) || 0;
}
function goalCard(g, compact) {
  const t = today(), cur = goalCurrent(g), p = F.goalProjection(g, cur, t), color = g.color || "#5DCAA5";
  const status = p.current >= p.target ? "🎉 Goal reached!"
    : p.finish ? `On pace for <b>${fmtDate(p.finish, { month: "short", year: "numeric" })}</b>` : "Add a monthly amount to see when you'll get there";
  let extra = "";
  if (!compact) {
    extra = `<div style="margin-top:10px">
      <div class="kv"><span>Saved</span><b class="num">${money(p.current)} of ${money(p.target, { cents: false })}</b></div>
      <div class="kv"><span>Putting in</span><b class="num">${money(g.monthly || 0)}/month${g.apy ? " · " + g.apy + "% APY" : ""}</b></div>
      ${g.targetDate ? `<div class="kv"><span>Target date</span><b>${fmtDate(g.targetDate, { month: "short", day: "numeric", year: "numeric" })}</b></div>
      <div class="kv"><span>Needed per month</span><b class="num ${p.onTrack === false ? "exp" : "inc"}">${money(p.neededMonthly)}${p.onTrack === false ? " (behind)" : p.onTrack ? " ✓" : ""}</b></div>` : ""}
      ${g.accountId ? `<div class="kv"><span>Tracking</span><b>${esc(acc(g.accountId).name)} balance</b></div>` : ""}
      </div><div class="btnrow">${g.accountId ? "" : `<button class="bigbtn small" data-act="goalAdd" data-id="${g.id}">+ Add money</button>`}<button class="bigbtn ghost small" data-act="editGoal" data-id="${g.id}">Edit</button></div>`;
  }
  return `<div class="card"${compact ? ` data-act="goPlan" data-v="goals" role="button" tabindex="0" style="cursor:pointer"` : ""}><div class="goalcard">${ring(p.target ? p.current / p.target : 0, color, 56, g.name)}
    <div class="info"><div class="nm">${esc(g.emoji || "🎯")} ${esc(g.name)}</div><div class="mt num">${money0(p.current)} of ${money0(p.target)}</div><div class="mt">${status}</div></div></div>${extra}</div>`;
}
function planGoals() {
  const d = data();
  let html = d.goals.length ? d.goals.map((g) => goalCard(g, false)).join("") : `<div class="card"><div class="empty"><span class="e">🐷</span>Saving for something? Add a goal and see exactly when you'll hit it, interest included.</div></div>`;
  return html + `<button class="bigbtn" data-act="editGoal">+ New goal</button>`;
}
function planDebts() {
  const d = data(), t = today();
  if (!d.debts.length) return `<div class="card"><div class="empty"><span class="e">🏁</span>Add your car loan or credit cards to see your payoff date and how much extra payments save you.</div></div><button class="bigbtn" data-act="editDebt">+ Add a debt</button>`;
  const total = d.debts.reduce((s, x) => s + (Number(x.balance) || 0), 0);
  let html = `<div class="grid2"><div class="tile"><p class="k">Total owed</p><p class="v num exp">${money(total)}</p></div>
    <div class="tile"><p class="k">Debt-free by</p><p class="v">${(() => { const ds = d.debts.map((x) => F.debtSummary(x, t).plan.payoffDate); return ds.includes(null) ? "—" : fmtDate(ds.sort().pop(), { month: "short", year: "numeric" }); })()}</p></div></div>`;
  for (const x of d.debts) {
    const s = F.debtSummary(x, t), extra = S.debtExtra?.[x.id] || 0;
    const what = extra ? F.payoffPlan(x.balance, x.apr, (Number(x.payment) || 0) + extra, x.freq, t) : null;
    html += `<div class="card"><div class="goalcard"><span class="ico" style="background:var(--bad-bg);width:48px;height:48px;font-size:24px">${esc(x.emoji || "💳")}</span>
      <div class="info"><div class="nm">${esc(x.name)}</div><div class="mt num">${money(x.balance)} at ${Number(x.apr) || 0}% APR</div></div></div>
      <div style="margin-top:10px">
      <div class="kv"><span>Paying</span><b class="num">${money(x.payment)} ${(FREQ_LABEL[x.freq] || "monthly").toLowerCase()}</b></div>
      ${s.plan.ok ? `<div class="kv"><span>Paid off</span><b>${fmtDate(s.plan.payoffDate, { month: "short", year: "numeric" })} <span class="muted" style="font-weight:500">(${Math.ceil(s.plan.months)} mo)</span></b></div>
      <div class="kv"><span>Interest you'll pay</span><b class="num exp">${money(s.plan.interest)}</b></div>` : `<div class="banner bad" style="margin:6px 0">This payment doesn't cover the interest, so the balance never goes down.</div>`}
      ${s.interestSaved !== null && s.interestSaved > 0 ? `<div class="kv"><span>Saved vs. minimum</span><b class="num inc">${money(s.interestSaved)} · ${Math.max(0, Math.round(s.minPlan.months - s.plan.months))} mo sooner</b></div>` : ""}
      <div class="fg" style="margin:12px 0 0"><label>What if I paid extra each time?</label>
      <input type="range" min="0" max="${Math.max(50, Math.round((Number(x.payment) || 100) * 2 / 10) * 10)}" step="5" value="${extra}" data-inp="debtExtra" data-id="${x.id}" aria-label="Extra payment"></div>
      ${what ? `<div class="banner ${what.ok ? "good" : "bad"}" style="margin:4px 0 0">${what.ok ? `+${money(extra, { cents: false })} each payment → paid off <b>${fmtDate(what.payoffDate, { month: "short", year: "numeric" })}</b>, saving <b>${money(Math.max(0, s.plan.interest - what.interest))}</b> in interest.` : "Still not enough to cover interest."}</div>` : ""}
      </div><div class="btnrow"><button class="bigbtn ghost small" data-act="editDebt" data-id="${x.id}">Edit / update balance</button></div></div>`;
  }
  return html + `<button class="bigbtn" data-act="editDebt">+ Add a debt</button>`;
}
function planPay() {
  const d = data(), t = today();
  const jobs = d.rules.filter((r) => r.kind === "paycheck");
  const nextChecks = F.buildItems({ ...d, transactions: [] }, t, F.addDays(t, 75)).filter((i) => i.kind === "paycheck").slice(0, 8);
  const monthly = jobs.filter((r) => !r.paused).reduce((s, r) => s + perMonth(r), 0);
  const y = +t.slice(0, 4);
  const yearItems = F.buildItems({ ...d, rules: jobs, transactions: d.transactions.filter((x) => x.type === "income") }, F.ymd(y, 1, 1), F.ymd(y, 12, 31)).filter((i) => i.type === "income");
  const yearTotal = yearItems.reduce((s, i) => s + i.amount, 0);
  let html = `<div class="grid2"><div class="tile"><p class="k">Take-home / month</p><p class="v num inc">${money(monthly)}</p><p class="s">average, from ${jobs.length} job${jobs.length === 1 ? "" : "s"}</p></div>
    <div class="tile"><p class="k">Income in ${y}</p><p class="v num">${money0(yearTotal)}</p><p class="s">recorded + scheduled</p></div></div>`;
  html += `<button class="bigbtn" data-act="editJob">+ Add a job / paycheck</button>`;
  if (jobs.length) html += `<div class="sechead"><h2>Your jobs</h2></div><div class="card flush">${jobs.map((r) => `<button class="item" data-act="editJob" data-id="${r.id}"><span class="ico" style="background:var(--good-bg)">💼</span>
      <span class="info"><span class="nm" style="display:block">${esc(r.label)}</span><span class="mt" style="display:block">${esc(freqText(r))}${r.meta && r.meta.hourly ? ` · $${r.meta.hourly}/hr × ${r.meta.hours}h` : ""}${r.shift === "before" ? " · early if weekend" : ""}</span></span>
      <span class="amt num inc">${money(r.amount)}<small>per check</small></span></button>`).join("")}</div>`;
  if (nextChecks.length) html += `<div class="sechead"><h2>Upcoming paydays</h2></div><div class="card flush">${nextChecks.map((i) => itemRow(i, { showDate: true })).join("")}</div>`;
  if (!jobs.length) html += `<div class="card"><div class="empty"><span class="e">💼</span>Add each job once (hourly rate, hours, how often you're paid) and every future payday shows up on your calendar, moved earlier when it lands on a weekend or holiday.</div></div>`;
  html += `<p class="fine">Paydays that land on a weekend or a holiday in Settings → Holidays move to the business day before.</p>`;
  return html;
}

/* ------------------------------ settings ------------------------------ */
function viewSettings() {
  const d = data(), u = S.user, theme = LS.get("theme", "auto");
  const accs = d.accounts.slice().sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || (a.order || 0) - (b.order || 0));
  const bals = memo("bals", () => F.accountBalances(d, today()));
  return `<div class="top"><button class="iconbtn" data-act="tab" data-v="home" aria-label="Back">${ICON.back}</button><h1>Settings</h1></div>
    <div class="card"><div class="goalcard">${avatar().replace('data-act="tab" data-v="settings"', 'tabindex="-1"')}<div class="info"><div class="nm">${esc(u.displayName || "You")}</div><div class="mt">${esc(u.email || (S.store.kind === "demo" ? "Demo mode · data on this device only" : ""))}</div></div></div></div>
    <div class="sechead"><h2>Accounts</h2><button class="link" data-act="editAccount">+ Add</button></div>
    <div class="card flush">${accs.map((a) => `<button class="setrow" data-act="editAccount" data-id="${a.id}"><span class="ico" style="background:${a.color}40">${esc(a.emoji || "🏦")}</span>
      <span class="tx">${esc(a.name)}${a.archived ? ' <span class="tag">hidden</span>' : ""}<small>${ACCOUNT_TYPES[a.type] || ""}${a.includeInSafe === false || a.type === "savings" || a.type === "credit" ? "" : " · counts as spending money"}</small></span>
      <span class="num ${bals[a.id] < 0 ? "exp" : ""}">${money(bals[a.id])}</span></button>`).join("") || `<div class="empty">No accounts yet.</div>`}</div>
    <div class="sechead"><h2>Categories & budgets</h2><button class="link" data-act="editCategory">+ Add</button></div>
    <div class="card flush">${sortedCats().map((c) => `<button class="setrow" data-act="editCategory" data-id="${c.id}"><span class="ico" style="background:${c.color}40">${esc(c.emoji || "📦")}</span>
      <span class="tx">${esc(c.name)}<small>${c.kind === "income" ? "Income" : c.budget ? "Budget " + money(c.budget, { cents: false }) + "/month" : "Spending"}</small></span><span class="chev">›</span></button>`).join("")}</div>
    <div class="sechead"><h2>Preferences</h2></div>
    <div class="card">
      <div class="fg"><span class="lab">Style</span><div class="seg" style="margin:0">${[["ios", "iOS"], ["classic", "Classic"]].map(([v, l]) => `<button class="${LS.get("style", "ios") === v ? "on" : ""}" data-act="style" data-v="${v}">${l}</button>`).join("")}</div></div>
      <div class="fg"><span class="lab">Appearance</span><div class="seg" style="margin:0">${["auto", "light", "dark"].map((v) => `<button class="${theme === v ? "on" : ""}" data-act="theme" data-v="${v}">${v === "auto" ? "Match phone" : v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</div></div>
      <div class="toggle" style="margin:-4px 0 12px"><div class="tx">Haptic taps<small>Light taps on tab switches and swipes (iPhone with iOS 18 or newer)</small></div><label class="sw"><input type="checkbox" data-inp="haptics" aria-label="Haptic taps" ${LS.get("haptics", true) ? "checked" : ""}><span></span></label></div>
      <div class="fg" style="margin:0"><label for="bufIn">Safe-to-spend cushion</label><div class="amtwrap sm"><span>$</span><input id="bufIn" inputmode="decimal" value="${Number(d.settings.buffer) || ""}" placeholder="0" data-inp="buffer"></div>
      <p class="hint">Money to always keep aside. It's subtracted from "Safe to spend".</p></div></div>
    <div class="sechead"><h2>Holidays</h2><span class="meta">${(d.settings.holidays || []).length} dates</span></div>
    <div class="card"><p class="sub" style="margin:0 0 10px;font-size:14px">Paydays and bills set to "move earlier" skip these days, like your payroll does.</p>
      <div class="btnrow" style="margin:0"><button class="bigbtn ghost small" data-act="editHolidays">Edit dates</button><button class="bigbtn ghost small" data-act="addUSHolidays">Add US holidays</button></div></div>
    <div class="sechead"><h2>Your data</h2></div>
    <div class="card flush">
      <label class="setrow"><span class="ico" style="background:var(--accent-soft)">📥</span><span class="tx">Import backup<small>Old tracker backup or a ${APP_NAME} export</small></span><span class="chev">›</span><input type="file" accept=".json,application/json" data-inp="importFile" hidden></label>
      <button class="setrow" data-act="exportJson"><span class="ico" style="background:var(--good-bg)">💾</span><span class="tx">Back up everything<small>Saves a file you can restore from</small></span><span class="chev">›</span></button>
      <button class="setrow" data-act="exportCsv"><span class="ico" style="background:var(--warn-bg)">📊</span><span class="tx">Export to spreadsheet<small>CSV for Excel, Numbers or Google Sheets</small></span><span class="chev">›</span></button>
    </div>
    <div class="sechead"><h2>Install on iPhone</h2></div>
    <div class="card"><p class="sub" style="margin:0;font-size:14px;line-height:1.5">In Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>. ${APP_NAME} opens full screen like a regular app.</p></div>
    <button class="bigbtn ghost" data-act="signout">${S.store.kind === "demo" ? "Leave demo" : "Sign out"}</button>
    <button class="bigbtn danger" data-act="deleteAll">Delete all my data</button>
    <p class="fine">${APP_NAME} · ${S.store.kind === "firebase" ? "Synced with your Google account" : "Demo mode"}</p>`;
}

/* ============================== sheets ============================== */
function openSheet(title, body, foot, onOpen) {
  const sh = $("sheet");
  sh.innerHTML = `<div class="grab"></div><div class="shead"><h3>${title}</h3><button class="iconbtn" data-act="closeSheet" aria-label="Close">✕</button></div>
    <div class="sbody">${body}</div>${foot ? `<div class="sfoot">${foot}</div>` : ""}`;
  sh.classList.add("open"); $("scrim").classList.add("open");
  document.body.style.overflow = "hidden"; document.body.classList.add("sheet-open");
  sh.querySelector(".sbody").scrollTop = 0;
  M.sheetOpened(); M.syncThumbs(sh, false);
  if (onOpen) onOpen(sh);
}
function closeSheet() {
  $("sheet").classList.remove("open"); $("scrim").classList.remove("open"); document.body.style.overflow = ""; document.body.classList.remove("sheet-open");
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  S.form = null;
}
function seg(name, cur, opts) { return `<div class="seg" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" class="${cur === v ? "on" : ""}" data-act="segPick" data-seg="${name}" data-v="${v}">${l}</button>`).join("")}</div>`; }
function catGrid(kind, sel) {
  return `<div class="catgrid" data-grid="cat">${sortedCats(kind).map((c) => `<button type="button" class="${c.id === sel ? "on" : ""}" data-act="pickCat" data-v="${c.id}"><span class="e">${esc(c.emoji || "📦")}</span>${esc(c.name)}</button>`).join("")}<button type="button" class="newcat" data-act="newCatOpen" data-kind="${kind}" aria-label="Add a new category"><span class="e">＋</span>New</button></div><div id="newCatBox"></div>`;
}
const NEWCAT_EMOJIS = ["☕","🍕","🍺","🎬","🏋️","🐶","👶","📚","🎓","🚌","🅿️","🧾","💇","🎁","🧰","🏥","✈️","🎮","💻","📦"];
function newCatForm(kind) {
  const f = S.form;
  if (!f.ncEmoji) f.ncEmoji = NEWCAT_EMOJIS[0];
  return `<div class="card" style="margin:10px 0 0;background:var(--surface-2);border:none">
    <div class="fg" style="margin-bottom:10px"><label for="ncName">New ${kind === "income" ? "income" : "spending"} category</label>
      <input id="ncName" autocomplete="off" autocapitalize="words" maxlength="40" placeholder="e.g. Coffee, Pets, School" enterkeyhint="done"></div>
    <div class="fg" style="margin-bottom:10px"><span class="lab">Icon</span><div class="emojis" data-grid="ncEmoji">${NEWCAT_EMOJIS.map((e) => `<button type="button" class="${f.ncEmoji === e ? "on" : ""}" data-act="ncEmoji" data-v="${e}">${e}</button>`).join("")}</div></div>
    <div class="btnrow" style="margin:0"><button type="button" class="bigbtn ghost small" data-act="newCatCancel">Cancel</button><button type="button" class="bigbtn small" data-act="newCatSave" data-kind="${kind}" id="ncSave">Add category</button></div>
    <p class="hint" style="font-size:12.5px;color:var(--text-3);margin:8px 2px 0">Rename, recolor or set a budget later in Settings → Categories.</p></div>`;
}
async function newCatSave(kind) {
  const name = val("ncName").trim();
  if (!name) { toast("Give the category a name."); $("ncName").focus(); return; }
  const clash = data().categories.find((c) => c.kind === kind && c.name.trim().toLowerCase() === name.toLowerCase());
  if (clash) { S.form.categoryId = clash.id; $("fCatWrap").innerHTML = txCatBlock(); toast(`"${clash.name}" already exists, so it's selected.`); return; }
  const btn = $("ncSave"); if (btn) { btn.disabled = true; btn.textContent = "Adding…"; }
  const id = newId();
  const n = data().categories.length;
  try {
    await S.store.put("categories", id, { name, emoji: S.form.ncEmoji || "📦", color: PALETTE[n % PALETTE.length], kind, budget: 0, order: 900 + n });
    S.form.categoryId = id; S.form.ncEmoji = null;
    $("fCatWrap").innerHTML = txCatBlock();
    toast(`Added "${name}"`);
  } catch (e) { if (btn) { btn.disabled = false; btn.textContent = "Add category"; } toast("Couldn't add it: " + (e.code || e.message)); }
}
function accPick(field, sel, exclude) {
  return `<div class="accpick" data-grid="${field}">${activeAccounts().filter((a) => a.id !== exclude).map((a) => `<button type="button" class="${a.id === sel ? "on" : ""}" data-act="pickAcc" data-field="${field}" data-v="${a.id}"><span class="cdot" style="background:${a.color}"></span>${esc(a.name)}</button>`).join("")}</div>`;
}
function val(id) { const el = $(id); return el ? el.value : ""; }
function defaultAccount() { const a = activeAccounts(); return (a.find((x) => x.type === "checking") || a[0] || {}).id; }

/* ------------------------------ transaction form ------------------------------ */
function openTxForm(id, presetDate) {
  const d = data();
  const t = id ? d.transactions.find((x) => x.id === id) : null;
  if (id && !t) return toast("That transaction no longer exists.");
  if (!activeAccounts().length) { toast("Add an account first."); return openAccountForm(); }
  S.form = t ? { kind: "tx", id: t.id, prevDate: t.date, type: t.type, accountId: t.accountId, toAccountId: t.toAccountId, categoryId: t.categoryId, repeat: "none" }
    : { kind: "tx", id: null, type: "expense", accountId: defaultAccount(), toAccountId: null, categoryId: null, repeat: "none" };
  const labels = [...new Set(d.transactions.map((x) => x.label).filter(Boolean))].slice(-200);
  const body = `${seg("type", S.form.type, [["expense", "Expense"], ["income", "Income"], ["transfer", "Transfer"]])}
    <div class="fg"><div class="amtwrap"><span>$</span><input id="fAmt" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${t ? t.amount : ""}" aria-label="Amount"></div></div>
    <div class="fg"><label for="fLabel">Description</label><input id="fLabel" list="labelList" autocomplete="off" autocapitalize="sentences" placeholder="e.g. Gas, Paycheck, Netflix" value="${esc(t ? t.label : "")}" data-inp="labelSuggest">
      <datalist id="labelList">${labels.map((l) => `<option value="${esc(l)}">`).join("")}</datalist></div>
    <div id="fCatWrap">${txCatBlock()}</div>
    <div class="fg"><span class="lab" id="fAccLab">${S.form.type === "income" ? "Into account" : S.form.type === "transfer" ? "From" : "Paid from"}</span>${accPick("accountId", S.form.accountId)}</div>
    <div id="fToWrap">${S.form.type === "transfer" ? `<div class="fg"><span class="lab">To</span>${accPick("toAccountId", S.form.toAccountId, S.form.accountId)}</div>` : ""}</div>
    <div class="row2"><div class="fg"><label for="fDate">Date</label><input type="date" id="fDate" value="${t ? t.date : presetDate || today()}"></div>
    ${t ? "" : `<div class="fg"><label for="fRepeat">Repeat</label><select id="fRepeat"><option value="none">Never</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="semimonthly">Twice a month</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>`}</div>
    <div class="fg"><label for="fNote">Note <span class="muted" style="font-weight:500">(optional)</span></label><input id="fNote" autocomplete="off" value="${esc(t ? t.note : "")}"></div>`;
  const foot = `${t ? `<button class="del" data-act="delTx" aria-label="Delete">🗑</button>` : ""}<button data-act="closeSheet">Cancel</button><button class="primary" data-act="saveTx" id="saveBtn">Save</button>`;
  openSheet(t ? "Edit transaction" : "Add transaction", body, foot);
}
function txCatBlock() {
  if (!S.form || S.form.type === "transfer") return "";
  return `<div class="fg"><span class="lab">Category</span>${catGrid(S.form.type === "income" ? "income" : "expense", S.form.categoryId)}</div>`;
}
function refreshTxForm() {
  $("fCatWrap").innerHTML = txCatBlock();
  $("fAccLab").textContent = S.form.type === "income" ? "Into account" : S.form.type === "transfer" ? "From" : "Paid from";
  $("fToWrap").innerHTML = S.form.type === "transfer" ? `<div class="fg"><span class="lab">To</span>${accPick("toAccountId", S.form.toAccountId, S.form.accountId)}</div>` : "";
}
async function saveTx() {
  const f = S.form, amount = parseAmt(val("fAmt")), date = val("fDate");
  let label = val("fLabel").trim();
  if (!(amount > 0)) return toast("Enter an amount greater than $0.");
  if (!date) return toast("Pick a date.");
  if (!f.accountId) return toast("Pick an account.");
  if (f.type === "transfer") {
    if (!f.toAccountId) return toast("Pick where the money is going.");
    if (f.toAccountId === f.accountId) return toast("Pick two different accounts.");
  } else if (!f.categoryId) f.categoryId = f.type === "income" ? "income" : "misc";
  if (!label) label = f.type === "transfer" ? "Transfer to " + acc(f.toAccountId).name : cat(f.categoryId).name;
  const repeat = $("fRepeat") ? $("fRepeat").value : "none";
  const btn = $("saveBtn"); btn.disabled = true; btn.textContent = "Saving…";
  try {
    if (repeat !== "none") {
      const r = { label, amount, type: f.type, accountId: f.accountId, toAccountId: f.type === "transfer" ? f.toAccountId : null, categoryId: f.type === "transfer" ? null : f.categoryId,
        freq: repeat, startDate: date, weekday: F.weekday(date), monthDay: +date.slice(8), monthDays: [15, 31], shift: "none", kind: f.type === "income" ? "other" : f.type === "transfer" ? "transfer" : "bill", skips: [], overrides: {} };
      await S.store.put("rules", null, r);
      toast("Saved. It repeats " + FREQ_LABEL[repeat].toLowerCase() + ".");
    } else {
      const t = { id: f.id || undefined, date, label, amount, type: f.type, accountId: f.accountId, toAccountId: f.toAccountId, categoryId: f.categoryId, note: val("fNote").trim(),
        createdAt: f.id ? (data().transactions.find((x) => x.id === f.id) || {}).createdAt : Date.now() };
      await S.store.putTx(t, f.prevDate);
      toast(f.id ? "Updated" : "Added " + money(amount));
    }
    closeSheet();
    if (S.tab === "calendar") { S.sel = date; S.vy = +date.slice(0, 4); S.vm = +date.slice(5, 7); render(); }
  } catch (e) { btn.disabled = false; btn.textContent = "Save"; toast("Couldn't save: " + (e.code || e.message)); }
}
async function deleteTxNow(id) {
  const t = data().transactions.find((x) => x.id === id); if (!t) return;
  try {
    await S.store.removeTx(id, t.date);
    toast("Deleted " + (t.label || ""), "Undo", async () => { await S.store.putTx({ ...t }); toast("Restored"); });
  } catch (e) { toast("Couldn't delete: " + (e.code || e.message)); }
}
async function skipOccNow(occId) {
  const [ruleId, nominal] = String(occId).split("@"), r = data().rules.find((x) => x.id === ruleId); if (!r) return;
  const skips = [...new Set([...(r.skips || []), nominal])];
  await S.store.put("rules", r.id, stripId({ ...r, skips }));
  toast("Skipped " + (r.label || ""), "Undo", async () => { const rr = data().rules.find((x) => x.id === ruleId); await S.store.put("rules", ruleId, stripId({ ...rr, skips: (rr.skips || []).filter((x) => x !== nominal) })); });
}
async function deleteTx() {
  const id = S.form.id, t = data().transactions.find((x) => x.id === id);
  if (!t || !confirm(`Delete "${t.label}" (${money(t.amount)})?`)) return;
  try {
    await S.store.removeTx(id, t.date);
    closeSheet();
    toast("Deleted", "Undo", async () => { await S.store.putTx({ ...t }); toast("Restored"); });
  } catch (e) { toast("Couldn't delete: " + (e.code || e.message)); }
}

/* ------------------------------ occurrence of a recurring item ------------------------------ */
function openOccurrence(occId) {
  const [ruleId, nominal] = occId.split("@");
  const r = data().rules.find((x) => x.id === ruleId);
  if (!r) return;
  const ov = (r.overrides || {})[nominal] || {};
  const occ = F.expandRule(r, F.addDays(nominal, -15), F.addDays(nominal, 15), holidays()).find((o) => o.nominal === nominal);
  S.form = { kind: "occ", ruleId, nominal };
  const body = `<div class="banner info" style="margin-bottom:14px">${esc(r.label)} · ${esc(freqText(r))}</div>
    <div class="fg"><label for="oAmt">Amount this time</label><div class="amtwrap"><span>$</span><input id="oAmt" inputmode="decimal" value="${occ ? occ.amount : r.amount}"></div></div>
    <div class="fg"><label for="oDate">Date this time</label><input type="date" id="oDate" value="${occ ? occ.date : nominal}"></div>
    <div class="btnrow" style="margin:0 0 4px"><button class="bigbtn small ghost" data-act="occSkip">Skip this one</button><button class="bigbtn small ghost" data-act="editRule" data-id="${r.id}">Edit every time</button></div>
    <p class="hint" style="font-size:12.5px;color:var(--text-3)">Changing this one doesn't affect other dates.</p>`;
  openSheet(fmtDate(occ ? occ.date : nominal, { weekday: "long", month: "short", day: "numeric" }), body, `<button data-act="closeSheet">Cancel</button><button class="primary" data-act="occSave">Save</button>`);
}
async function occSave() {
  const { ruleId, nominal } = S.form, r = data().rules.find((x) => x.id === ruleId);
  const amount = parseAmt(val("oAmt")), date = val("oDate");
  if (!(amount > 0) || !date) return toast("Enter an amount and date.");
  const overrides = { ...(r.overrides || {}) };
  overrides[nominal] = { amount, date };
  await S.store.put("rules", r.id, stripId({ ...r, overrides }));
  closeSheet(); toast("Changed for " + fmtDate(date));
}
async function occSkip() {
  const { ruleId, nominal } = S.form, r = data().rules.find((x) => x.id === ruleId);
  const skips = [...new Set([...(r.skips || []), nominal])];
  await S.store.put("rules", r.id, stripId({ ...r, skips }));
  closeSheet();
  toast("Skipped", "Undo", async () => { const rr = data().rules.find((x) => x.id === ruleId); await S.store.put("rules", ruleId, stripId({ ...rr, skips: (rr.skips || []).filter((s) => s !== nominal) })); });
}
function stripId(o) { const { id, ...rest } = o; return rest; }

/* ------------------------------ recurring rule form ------------------------------ */
function openRuleForm(id) {
  const r = id ? data().rules.find((x) => x.id === id) : null;
  if (r && r.kind === "paycheck") return openJobForm(id);
  S.form = r ? { kind: "rule", id, type: r.type, accountId: r.accountId, toAccountId: r.toAccountId, categoryId: r.categoryId, freq: r.freq, shift: r.shift || "none", rkind: r.kind || "bill" }
    : { kind: "rule", id: null, type: "expense", accountId: defaultAccount(), toAccountId: null, categoryId: null, freq: "monthly", shift: "none", rkind: "bill" };
  const t = today(), md = r && r.monthDays ? r.monthDays : [15, 31];
  const body = `${seg("type", S.form.type, [["expense", "Bill"], ["income", "Income"], ["transfer", "Transfer"]])}
    <div class="fg"><div class="amtwrap"><span>$</span><input id="fAmt" inputmode="decimal" placeholder="0.00" value="${r ? r.amount : ""}" aria-label="Amount"></div></div>
    <div class="fg"><label for="fLabel">Name</label><input id="fLabel" autocomplete="off" autocapitalize="sentences" placeholder="e.g. Car payment, Netflix, Rent" value="${esc(r ? r.label : "")}"></div>
    <div id="fKindWrap">${S.form.type === "expense" ? `<div class="fg"><span class="lab">Type</span>${seg("rkind", S.form.rkind, [["bill", "Bill"], ["subscription", "Subscription"]])}</div>` : ""}</div>
    <div id="fCatWrap">${txCatBlock()}</div>
    <div class="fg"><span class="lab" id="fAccLab">${S.form.type === "income" ? "Into account" : S.form.type === "transfer" ? "From" : "Paid from"}</span>${accPick("accountId", S.form.accountId)}</div>
    <div id="fToWrap">${S.form.type === "transfer" ? `<div class="fg"><span class="lab">To</span>${accPick("toAccountId", S.form.toAccountId, S.form.accountId)}</div>` : ""}</div>
    <div class="fg"><label for="fFreq">How often</label><select id="fFreq" data-inp="freq">${["weekly", "biweekly", "semimonthly", "monthly", "yearly"].map((f) => `<option value="${f}" ${S.form.freq === f ? "selected" : ""}>${FREQ_LABEL[f]}</option>`).join("")}</select></div>
    <div id="freqExtra">${freqExtra(r)}</div>
    <div class="row2"><div class="fg"><label for="fStart">${S.form.freq === "biweekly" ? "Next (or first) date" : "Starts"}</label><input type="date" id="fStart" value="${r ? r.startDate : t}"></div>
      <div class="fg"><label for="fEnd">Ends <span class="muted" style="font-weight:500">(optional)</span></label><input type="date" id="fEnd" value="${r && r.endDate ? r.endDate : ""}"></div></div>
    <div class="fg"><label for="fShift">If it lands on a weekend or holiday</label><select id="fShift"><option value="none" ${S.form.shift === "none" ? "selected" : ""}>Keep the same date</option><option value="before" ${S.form.shift === "before" ? "selected" : ""}>Move to the business day before</option><option value="after" ${S.form.shift === "after" ? "selected" : ""}>Move to the business day after</option></select></div>
    ${r ? `<div class="toggle"><div class="tx">Paused<small>Hide it from the calendar for now</small></div><label class="sw"><input type="checkbox" id="fPaused" ${r.paused ? "checked" : ""}><span></span></label></div>` : ""}`;
  void md;
  const foot = `${r ? `<button class="del" data-act="delRule" aria-label="Delete">🗑</button>` : ""}<button data-act="closeSheet">Cancel</button><button class="primary" data-act="saveRule" id="saveBtn">Save</button>`;
  openSheet(r ? "Edit repeating item" : "New repeating item", body, foot);
}
function freqExtra(r) {
  const f = S.form.freq;
  if (f === "weekly") { const w = r ? Number(r.weekday ?? F.weekday(r.startDate)) : F.weekday(today()); return `<div class="fg"><label for="fWeekday">Day of the week</label><select id="fWeekday">${DOW.map((n, i) => `<option value="${i}" ${i === w ? "selected" : ""}>${n}</option>`).join("")}</select></div>`; }
  if (f === "semimonthly") { const md = r && r.monthDays ? r.monthDays : [15, 31]; return `<div class="row2"><div class="fg"><label for="fMd1">First day</label><input id="fMd1" inputmode="numeric" value="${md[0]}"></div><div class="fg"><label for="fMd2">Second day</label><input id="fMd2" inputmode="numeric" value="${md[1]}"></div></div><p class="hint" style="margin:-8px 2px 12px;font-size:12.5px;color:var(--text-3)">Use 31 for "last day of the month".</p>`; }
  if (f === "monthly") return `<div class="fg"><label for="fMd">Day of the month</label><input id="fMd" inputmode="numeric" value="${r ? r.monthDay || +r.startDate.slice(8) : +today().slice(8)}"><p class="hint">31 means the last day of every month.</p></div>`;
  return "";
}
function readRuleSchedule(base) {
  const freq = val("fFreq"), startDate = val("fStart"), endDate = val("fEnd") || null;
  const o = { freq, startDate, endDate, shift: val("fShift") || "none" };
  if (freq === "weekly") o.weekday = Number(val("fWeekday"));
  if (freq === "semimonthly") o.monthDays = [Number(val("fMd1")) || 15, Number(val("fMd2")) || 31];
  if (freq === "monthly") o.monthDay = Number(val("fMd")) || +startDate.slice(8);
  if (!startDate) throw new Error("Pick a start date.");
  if (endDate && endDate < startDate) throw new Error("The end date has to be after the start date.");
  if (o.monthDays && o.monthDays.some((x) => x < 1 || x > 31)) throw new Error("Days must be 1 to 31.");
  if (o.monthDay !== undefined && (o.monthDay < 1 || o.monthDay > 31)) throw new Error("Day must be 1 to 31.");
  return { ...base, ...o };
}
async function saveRule() {
  const f = S.form, amount = parseAmt(val("fAmt"));
  let label = val("fLabel").trim();
  if (!(amount > 0)) return toast("Enter an amount greater than $0.");
  if (!f.accountId) return toast("Pick an account.");
  if (f.type === "transfer" && (!f.toAccountId || f.toAccountId === f.accountId)) return toast("Pick two different accounts.");
  if (f.type !== "transfer" && !f.categoryId) f.categoryId = f.type === "income" ? "income" : "bills";
  if (!label) label = f.type === "transfer" ? "Transfer to " + acc(f.toAccountId).name : cat(f.categoryId).name;
  const old = f.id ? data().rules.find((x) => x.id === f.id) : {};
  let r;
  try {
    r = readRuleSchedule({ ...stripId(old || {}), label, amount, type: f.type, accountId: f.accountId, toAccountId: f.type === "transfer" ? f.toAccountId : null,
      categoryId: f.type === "transfer" ? null : f.categoryId, kind: f.type === "expense" ? f.rkind : f.type === "transfer" ? "transfer" : (old && old.kind) || "other",
      skips: (old && old.skips) || [], overrides: (old && old.overrides) || {}, paused: $("fPaused") ? $("fPaused").checked : false });
  } catch (e) { return toast(e.message); }
  // If the schedule changed, old one-off tweaks may no longer line up; keep them only if dates still exist.
  const btn = $("saveBtn"); btn.disabled = true;
  try { await S.store.put("rules", f.id, r); closeSheet(); toast(f.id ? "Updated" : "Added to your calendar"); }
  catch (e) { btn.disabled = false; toast("Couldn't save: " + (e.code || e.message)); }
}
async function deleteRule() {
  const r = data().rules.find((x) => x.id === S.form.id);
  if (!r || !confirm(`Delete "${r.label}" and every repeat of it? Past transactions you entered stay.`)) return;
  await S.store.remove("rules", r.id); closeSheet();
  toast("Deleted", "Undo", () => S.store.put("rules", r.id, stripId(r)));
}

/* ------------------------------ paycheck planner ------------------------------ */
function openJobForm(id) {
  const r = id ? data().rules.find((x) => x.id === id) : null;
  const m = (r && r.meta) || { payType: "hourly", hourly: "", hours: 40, tax: 20 };
  S.form = { kind: "job", id, accountId: r ? r.accountId : defaultAccount(), payType: m.payType || "hourly", freq: r ? r.freq : "biweekly" };
  const body = `<div class="fg"><label for="jName">Job name</label><input id="jName" autocomplete="off" placeholder="e.g. West Coast Magnetics" value="${esc(r ? r.label : "")}"></div>
    ${seg("payType", S.form.payType, [["hourly", "Hourly"], ["salary", "Salary"], ["fixed", "Same each check"]])}
    <div id="jPayFields">${jobPayFields(m, r)}</div>
    <div class="fg"><label for="fFreq">Paid</label><select id="fFreq" data-inp="jobFreq">${["weekly", "biweekly", "semimonthly", "monthly"].map((f) => `<option value="${f}" ${S.form.freq === f ? "selected" : ""}>${FREQ_LABEL[f]}</option>`).join("")}</select></div>
    <div id="freqExtra">${jobFreqExtra(r)}</div>
    <div class="fg"><label for="fStart" id="jStartLab">${S.form.freq === "biweekly" || S.form.freq === "weekly" ? "Next payday" : "Starting"}</label><input type="date" id="fStart" value="${r ? r.startDate : today()}"></div>
    <div class="fg"><label for="fShift">Payday on a weekend or holiday</label><select id="fShift"><option value="before" ${!r || r.shift === "before" ? "selected" : ""}>Paid the business day before</option><option value="after" ${r && r.shift === "after" ? "selected" : ""}>Paid the business day after</option><option value="none" ${r && r.shift === "none" ? "selected" : ""}>Same day anyway</option></select></div>
    <div class="fg"><span class="lab">Deposited into</span>${accPick("accountId", S.form.accountId)}</div>
    <div class="card" id="jEst" style="background:var(--surface-2);border:none"></div>`;
  const foot = `${r ? `<button class="del" data-act="delRule" aria-label="Delete">🗑</button>` : ""}<button data-act="closeSheet">Cancel</button><button class="primary" data-act="saveJob" id="saveBtn">Save</button>`;
  S.form.id = id || null;
  openSheet(r ? "Edit job" : "Add a job", body, foot, () => jobEstimate());
}
function jobPayFields(m, r) {
  const pt = S.form.payType;
  if (pt === "fixed") return `<div class="fg"><label for="jFixed">Take-home per check</label><div class="amtwrap sm"><span>$</span><input id="jFixed" inputmode="decimal" value="${r ? r.amount : ""}" data-inp="jobEst"></div></div>`;
  return `${pt === "hourly" ? `<div class="row2"><div class="fg"><label for="jRate">Hourly rate</label><div class="amtwrap sm"><span>$</span><input id="jRate" inputmode="decimal" value="${m.hourly || ""}" data-inp="jobEst"></div></div>
      <div class="fg"><label for="jHours">Hours / week</label><input id="jHours" inputmode="decimal" value="${m.hours || 40}" data-inp="jobEst"></div></div>`
    : `<div class="fg"><label for="jSalary">Yearly salary</label><div class="amtwrap sm"><span>$</span><input id="jSalary" inputmode="decimal" value="${m.salary || ""}" data-inp="jobEst"></div></div>`}
    <div class="fg"><label for="jTax">Taxes & deductions (%)</label><input id="jTax" inputmode="decimal" value="${m.tax ?? 20}" data-inp="jobEst"><p class="hint">Check a pay stub: (gross − take-home) ÷ gross. Around 20–25% is common.</p></div>`;
}
function jobFreqExtra(r) {
  if (S.form.freq === "semimonthly") { const md = r && r.monthDays ? r.monthDays : [15, 31]; return `<div class="row2"><div class="fg"><label for="fMd1">First payday</label><input id="fMd1" inputmode="numeric" value="${md[0]}"></div><div class="fg"><label for="fMd2">Second payday</label><input id="fMd2" inputmode="numeric" value="${md[1]}"></div></div><p class="hint" style="margin:-8px 2px 12px;font-size:12.5px;color:var(--text-3)">31 = last day of the month.</p>`; }
  if (S.form.freq === "monthly") return `<div class="fg"><label for="fMd">Payday (day of month)</label><input id="fMd" inputmode="numeric" value="${r ? r.monthDay || 1 : 1}"></div>`;
  return "";
}
function jobEstimate() {
  const el = $("jEst"); if (!el) return null;
  const pt = S.form.payType, freq = val("fFreq");
  let net, gross = null;
  if (pt === "fixed") net = parseAmt(val("jFixed"));
  else {
    const e = F.paycheckEstimate({ hourly: parseAmt(val("jRate")), hoursPerWeek: parseFloat(val("jHours")), salary: pt === "salary" ? parseAmt(val("jSalary")) : null, freq, taxPct: parseFloat(val("jTax")) });
    net = e.net; gross = e.gross;
  }
  if (!(net > 0)) { el.innerHTML = `<p class="sub" style="margin:0;font-size:14px">Fill in your pay to see each check.</p>`; return null; }
  const n = F.CHECKS_PER_YEAR[freq];
  el.innerHTML = `<div class="kv"><span>Take-home per check</span><b class="num inc">${money(net)}</b></div>
    ${gross ? `<div class="kv"><span>Before taxes</span><b class="num">${money(gross)}</b></div>` : ""}
    <div class="kv"><span>Per month (average)</span><b class="num">${money(net * n / 12)}</b></div>
    <div class="kv"><span>Per year</span><b class="num">${money(net * n, { cents: false })}</b></div>`;
  return { net, gross };
}
async function saveJob() {
  const est = jobEstimate(), label = val("jName").trim() || "Paycheck";
  if (!est) return toast("Enter your pay first.");
  if (!S.form.accountId) return toast("Pick the account it's deposited into.");
  const old = S.form.id ? data().rules.find((x) => x.id === S.form.id) : null;
  let r;
  try {
    r = readRuleSchedule({ ...(old ? stripId(old) : {}), label, amount: F.round2(est.net), type: "income", kind: "paycheck", categoryId: "income", accountId: S.form.accountId, toAccountId: null,
      skips: (old && old.skips) || [], overrides: (old && old.overrides) || {},
      meta: { payType: S.form.payType, hourly: parseAmt(val("jRate")) || null, hours: parseFloat(val("jHours")) || null, salary: parseAmt(val("jSalary")) || null, tax: parseFloat(val("jTax")) || 0 } });
  } catch (e) { return toast(e.message); }
  if (r.freq === "biweekly" || r.freq === "weekly") r.weekday = F.weekday(r.startDate);
  await S.store.put("rules", S.form.id, r);
  closeSheet(); toast(old ? "Job updated" : "Paydays added to your calendar");
}

/* ------------------------------ budgets ------------------------------ */
function openBudgets() {
  const cats = sortedCats("expense");
  S.form = { kind: "budgets" };
  const t = today(), y = +t.slice(0, 4), m = +t.slice(5, 7);
  const pm = m === 1 ? [y - 1, 12] : [y, m - 1];
  const last = F.monthSummary(data(), pm[0], pm[1], null).byCat;
  const body = `<p class="sub" style="margin:0 0 12px;font-size:14px">Leave blank for no limit. Gray numbers are what you spent last month.</p>` +
    cats.map((c) => `<div class="toggle"><span class="ico" style="background:${c.color}40">${esc(c.emoji || "📦")}</span><div class="tx">${esc(c.name)}<small class="num">${last[c.id] ? money(last[c.id], { cents: false }) + " last month" : "&nbsp;"}</small></div>
      <div class="amtwrap sm" style="width:120px"><span>$</span><input inputmode="decimal" data-bud="${c.id}" value="${c.budget || ""}" placeholder="—" aria-label="${esc(c.name)} budget" style="min-height:44px"></div></div>`).join("");
  openSheet("Monthly budgets", `<div class="fg">${body}</div>`, `<button data-act="closeSheet">Cancel</button><button class="primary" data-act="saveBudgets">Save</button>`);
}
async function saveBudgets() {
  const docs = [];
  document.querySelectorAll("[data-bud]").forEach((el) => {
    const c = data().categories.find((x) => x.id === el.dataset.bud); if (!c) return;
    const v = parseAmt(el.value), nb = v > 0 ? v : 0;
    if ((Number(c.budget) || 0) !== nb) docs.push({ col: "categories", id: c.id, data: { ...stripId(c), budget: nb } });
  });
  if (docs.length) await S.store.putMany({ docs });
  closeSheet(); toast(docs.length ? "Budgets saved" : "No changes");
}

/* ------------------------------ goals ------------------------------ */
function openGoalForm(id) {
  const g = id ? data().goals.find((x) => x.id === id) : null;
  S.form = { kind: "goal", id, emoji: g ? g.emoji : "🎯", color: g ? g.color : "#5DCAA5", accountId: g ? g.accountId || "" : "" };
  const savAccs = activeAccounts();
  const body = `<div class="fg"><label for="gName">What are you saving for?</label><input id="gName" autocomplete="off" placeholder="e.g. Emergency fund, New car" value="${esc(g ? g.name : "")}"></div>
    <div class="fg"><span class="lab">Icon</span><div class="emojis" data-grid="emoji">${["🎯","🐷","🏠","🚗","✈️","🎓","💍","🛡️","💻","🎮","👶","🏖️","📈","🏦","🎁","💰"].map((e) => `<button type="button" class="${S.form.emoji === e ? "on" : ""}" data-act="pickEmoji" data-v="${e}">${e}</button>`).join("")}</div></div>
    <div class="row2"><div class="fg"><label for="gTarget">Goal amount</label><div class="amtwrap sm"><span>$</span><input id="gTarget" inputmode="decimal" value="${g ? g.target : ""}" placeholder="50,000"></div></div>
      <div class="fg"><label for="gMonthly">Saving per month</label><div class="amtwrap sm"><span>$</span><input id="gMonthly" inputmode="decimal" value="${g ? g.monthly || "" : ""}" placeholder="0"></div></div></div>
    <div class="fg"><label for="gAcct">Where is it saved?</label><select id="gAcct" data-inp="goalAcct"><option value="">I'll update it myself</option>${savAccs.map((a) => `<option value="${a.id}" ${S.form.accountId === a.id ? "selected" : ""}>Use my ${esc(a.name)} balance</option>`).join("")}</select></div>
    <div class="fg" id="gSavedWrap" ${S.form.accountId ? "hidden" : ""}><label for="gSaved">Saved so far</label><div class="amtwrap sm"><span>$</span><input id="gSaved" inputmode="decimal" value="${g ? g.saved || "" : ""}" placeholder="0"></div></div>
    <div class="row2"><div class="fg"><label for="gApy">Interest (APY %)</label><input id="gApy" inputmode="decimal" value="${g ? g.apy || "" : ""}" placeholder="e.g. 3.4"></div>
      <div class="fg"><label for="gDate">Target date</label><input type="date" id="gDate" value="${g ? g.targetDate || "" : ""}"></div></div>`;
  const foot = `${g ? `<button class="del" data-act="delGoal" aria-label="Delete">🗑</button>` : ""}<button data-act="closeSheet">Cancel</button><button class="primary" data-act="saveGoal">Save</button>`;
  openSheet(g ? "Edit goal" : "New goal", body, foot);
}
async function saveGoal() {
  const name = val("gName").trim(), target = parseAmt(val("gTarget"));
  if (!name) return toast("Give your goal a name.");
  if (!(target > 0)) return toast("Enter a goal amount.");
  const g = { name, target, emoji: S.form.emoji, color: S.form.color, monthly: parseAmt(val("gMonthly")) || 0, saved: parseAmt(val("gSaved")) || 0,
    accountId: val("gAcct") || null, apy: parseFloat(val("gApy")) || 0, targetDate: val("gDate") || null };
  await S.store.put("goals", S.form.id, g); closeSheet(); toast("Goal saved");
}
function openGoalAdd(id) {
  const g = data().goals.find((x) => x.id === id);
  S.form = { kind: "goalAdd", id };
  openSheet("Add to " + esc(g.name), `<div class="fg"><div class="amtwrap"><span>$</span><input id="gaAmt" inputmode="decimal" placeholder="0.00" aria-label="Amount"></div><p class="hint">Use a minus sign to take money out.</p></div>`,
    `<button data-act="closeSheet">Cancel</button><button class="primary" data-act="saveGoalAdd">Add</button>`);
}
async function saveGoalAdd() {
  const g = data().goals.find((x) => x.id === S.form.id), v = parseAmt(val("gaAmt"));
  if (!v) return toast("Enter an amount.");
  await S.store.put("goals", g.id, { ...stripId(g), saved: F.round2((Number(g.saved) || 0) + v) });
  closeSheet(); toast((v > 0 ? "Added " : "Took out ") + money(Math.abs(v)));
}

/* ------------------------------ debts ------------------------------ */
function openDebtForm(id) {
  const x = id ? data().debts.find((d) => d.id === id) : null;
  S.form = { kind: "debt", id, emoji: x ? x.emoji : "💳" };
  const fopt = (sel) => ["weekly", "biweekly", "monthly"].map((f) => `<option value="${f}" ${sel === f ? "selected" : ""}>${FREQ_LABEL[f]}</option>`).join("");
  const body = `<div class="fg"><label for="dName">Name</label><input id="dName" autocomplete="off" placeholder="e.g. Car loan, Capital One" value="${esc(x ? x.name : "")}"></div>
    <div class="fg"><span class="lab">Icon</span><div class="emojis" data-grid="emoji">${["💳","🚗","🏠","🎓","🏥","📱","🧾","💸"].map((e) => `<button type="button" class="${S.form.emoji === e ? "on" : ""}" data-act="pickEmoji" data-v="${e}">${e}</button>`).join("")}</div></div>
    <div class="row2"><div class="fg"><label for="dBal">Balance owed</label><div class="amtwrap sm"><span>$</span><input id="dBal" inputmode="decimal" value="${x ? x.balance : ""}"></div></div>
      <div class="fg"><label for="dApr">Interest (APR %)</label><input id="dApr" inputmode="decimal" value="${x ? x.apr : ""}" placeholder="e.g. 7.9"></div></div>
    <div class="row2"><div class="fg"><label for="dPay">You pay</label><div class="amtwrap sm"><span>$</span><input id="dPay" inputmode="decimal" value="${x ? x.payment : ""}"></div></div>
      <div class="fg"><label for="dFreq">How often</label><select id="dFreq">${fopt(x ? x.freq : "monthly")}</select></div></div>
    <div class="row2"><div class="fg"><label for="dMin">Minimum payment</label><div class="amtwrap sm"><span>$</span><input id="dMin" inputmode="decimal" value="${x ? x.minPayment || "" : ""}" placeholder="optional"></div></div>
      <div class="fg"><label for="dMinFreq">Minimum is due</label><select id="dMinFreq">${fopt(x ? x.minFreq || "monthly" : "monthly")}</select></div></div>
    <p class="hint" style="font-size:12.5px;color:var(--text-3);margin-top:-4px">With a minimum payment entered, you'll see how much paying more saves you.</p>`;
  const foot = `${x ? `<button class="del" data-act="delDebt" aria-label="Delete">🗑</button>` : ""}<button data-act="closeSheet">Cancel</button><button class="primary" data-act="saveDebt">Save</button>`;
  openSheet(x ? "Edit debt" : "Add a debt", body, foot);
}
async function saveDebt() {
  const name = val("dName").trim(), balance = parseAmt(val("dBal")), payment = parseAmt(val("dPay"));
  if (!name) return toast("Give it a name.");
  if (!(balance >= 0)) return toast("Enter the balance owed.");
  if (!(payment > 0)) return toast("Enter your payment.");
  await S.store.put("debts", S.form.id, { name, emoji: S.form.emoji, balance, apr: parseFloat(val("dApr")) || 0, payment, freq: val("dFreq"),
    minPayment: parseAmt(val("dMin")) || 0, minFreq: val("dMinFreq"), asOf: today() });
  closeSheet(); toast("Saved");
}

/* ------------------------------ accounts ------------------------------ */
function openAccountForm(id) {
  const a = id ? data().accounts.find((x) => x.id === id) : null;
  S.form = { kind: "account", id, emoji: a ? a.emoji : "🏦", color: a ? a.color : PALETTE[data().accounts.length % PALETTE.length], type: a ? a.type : "checking" };
  const cur = a ? memo("bals", () => F.accountBalances(data(), today()))[a.id] : "";
  const body = `<div class="fg"><label for="aName">Name</label><input id="aName" autocomplete="off" placeholder="e.g. Chase checking, Cash App" value="${esc(a ? a.name : "")}"></div>
    <div class="fg"><label for="aType">Type</label><select id="aType">${Object.entries(ACCOUNT_TYPES).map(([k, v]) => `<option value="${k}" ${S.form.type === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <div class="fg"><label for="aBal">Balance today</label><div class="amtwrap sm"><span>$</span><input id="aBal" inputmode="decimal" value="${a ? F.round2(cur) : ""}" placeholder="0.00"></div>
      <p class="hint">For a credit card, enter what you owe as a negative number (e.g. −250).</p></div>
    <div class="fg"><span class="lab">Icon</span><div class="emojis" data-grid="emoji">${["🏦","💸","🅿️","🐷","💳","💵","📈","🪙"].map((e) => `<button type="button" class="${S.form.emoji === e ? "on" : ""}" data-act="pickEmoji" data-v="${e}">${e}</button>`).join("")}</div></div>
    <div class="fg"><span class="lab">Color</span><div class="colors" data-grid="color">${PALETTE.map((c) => `<button type="button" class="${S.form.color === c ? "on" : ""}" style="background:${c}" data-act="pickColor" data-v="${c}" aria-label="Color ${c}"></button>`).join("")}</div></div>
    <div class="toggle"><div class="tx">Counts as spending money<small>Included in "Safe to spend" and the calendar's default view</small></div><label class="sw"><input type="checkbox" id="aSafe" ${!a || a.includeInSafe !== false ? "checked" : ""}><span></span></label></div>
    ${a ? `<div class="toggle"><div class="tx">Hide this account<small>Keeps its history but removes it from lists</small></div><label class="sw"><input type="checkbox" id="aArch" ${a.archived ? "checked" : ""}><span></span></label></div>` : ""}`;
  const foot = `${a ? `<button class="del" data-act="delAccount" aria-label="Delete">🗑</button>` : ""}<button data-act="closeSheet">Cancel</button><button class="primary" data-act="saveAccount">Save</button>`;
  openSheet(a ? "Edit account" : "Add an account", body, foot);
}
async function saveAccount() {
  const name = val("aName").trim(); if (!name) return toast("Give the account a name.");
  const id = S.form.id || newId();
  const old = S.form.id ? data().accounts.find((x) => x.id === id) : null;
  const type = val("aType");
  const balToday = parseAmt(val("aBal"));
  // startingBalance is whatever makes today's balance match what was typed in.
  const d = data(), probe = { ...d, accounts: [{ id, startingBalance: 0 }] };
  const netSoFar = F.balanceAsOf(probe, new Set([id]), today()) || 0;
  const startingBalance = isNaN(balToday) ? (old ? Number(old.startingBalance) || 0 : 0) : F.round2(balToday - netSoFar);
  await S.store.put("accounts", id, { name, type, emoji: S.form.emoji, color: S.form.color, startingBalance, includeInSafe: $("aSafe").checked && type !== "savings" && type !== "credit",
    archived: $("aArch") ? $("aArch").checked : false, order: old ? old.order || 0 : d.accounts.length });
  closeSheet(); toast("Account saved");
}
async function deleteAccount() {
  const id = S.form.id, d = data();
  const used = d.transactions.some((t) => t.accountId === id || t.toAccountId === id) || d.rules.some((r) => r.accountId === id || r.toAccountId === id);
  if (used) { toast("This account has history. Hide it instead (toggle above)."); return; }
  if (!confirm("Delete this account?")) return;
  await S.store.remove("accounts", id); closeSheet(); toast("Deleted");
}

/* ------------------------------ categories ------------------------------ */
function openCategoryForm(id) {
  const c = id ? data().categories.find((x) => x.id === id) : null;
  S.form = { kind: "category", id, emoji: c ? c.emoji : "📦", color: c ? c.color : PALETTE[0], ckind: c ? c.kind : "expense" };
  const body = `<div class="fg"><label for="cName">Name</label><input id="cName" autocomplete="off" value="${esc(c ? c.name : "")}" placeholder="e.g. Coffee"></div>
    <div class="fg"><span class="lab">For</span>${seg("ckind", S.form.ckind, [["expense", "Spending"], ["income", "Income"]])}</div>
    <div class="fg"><span class="lab">Icon</span><div class="emojis" data-grid="emoji">${EMOJIS.map((e) => `<button type="button" class="${S.form.emoji === e ? "on" : ""}" data-act="pickEmoji" data-v="${e}">${e}</button>`).join("")}</div></div>
    <div class="fg"><span class="lab">Color</span><div class="colors" data-grid="color">${PALETTE.map((x) => `<button type="button" class="${S.form.color === x ? "on" : ""}" style="background:${x}" data-act="pickColor" data-v="${x}" aria-label="Color ${x}"></button>`).join("")}</div></div>
    <div class="fg"><label for="cBud">Monthly budget <span class="muted" style="font-weight:500">(optional)</span></label><div class="amtwrap sm"><span>$</span><input id="cBud" inputmode="decimal" value="${c && c.budget ? c.budget : ""}"></div></div>`;
  const foot = `${c ? `<button class="del" data-act="delCategory" aria-label="Delete">🗑</button>` : ""}<button data-act="closeSheet">Cancel</button><button class="primary" data-act="saveCategory">Save</button>`;
  openSheet(c ? "Edit category" : "New category", body, foot);
}
async function saveCategory() {
  const name = val("cName").trim(); if (!name) return toast("Give it a name.");
  const old = S.form.id ? data().categories.find((x) => x.id === S.form.id) : null;
  await S.store.put("categories", S.form.id || newId(), { name, emoji: S.form.emoji, color: S.form.color, kind: S.form.ckind, budget: parseAmt(val("cBud")) || 0, order: old ? old.order || 0 : 999 });
  closeSheet(); toast("Saved");
}
async function deleteCategory() {
  const id = S.form.id, d = data(), c = d.categories.find((x) => x.id === id) || { id, name: id, kind: "expense" };
  const txs = d.transactions.filter((t) => t.categoryId === id), rules = d.rules.filter((r) => r.categoryId === id);
  if (!txs.length && !rules.length) {
    if (!confirm("Delete this category?")) return;
    await S.store.remove("categories", id); closeSheet(); toast("Deleted"); return;
  }
  // items still use it: ask where they should go instead of silently dumping them in "Misc"
  S.form = { kind: "catDelete", id };
  const others = sortedCats(c.kind).filter((x) => x.id !== id);
  const accs = c.kind === "expense" ? activeAccounts() : [];
  const guess = accs.find((a) => /cash ?app/i.test(c.name) ? /cash ?app/i.test(a.name) : /paypal/i.test(c.name) ? /paypal/i.test(a.name) && a.type !== "savings" : false);
  const def = guess ? "acc:" + guess.id : (others.find((x) => x.id === "misc") || others[0] || {}).id;
  const n = txs.length + rules.length;
  const body = `<p class="sub" style="margin:0 0 14px;font-size:15px"><b>${n}</b> ${n === 1 ? "item uses" : "items use"} “${esc(c.name)}”. Where should ${n === 1 ? "it" : "they"} go?</p>
    <div class="fg"><label for="cdTo">Move to</label><select id="cdTo" data-inp="cdTo">
      <optgroup label="Categories">${others.map((x) => `<option value="${x.id}" ${def === x.id ? "selected" : ""}>${esc(x.emoji || "")} ${esc(x.name)}</option>`).join("")}</optgroup>
      ${accs.length ? `<optgroup label="Turn into transfers to">${accs.map((a) => `<option value="acc:${a.id}" ${def === "acc:" + a.id ? "selected" : ""}>→ ${esc(a.name)}</option>`).join("")}</optgroup>` : ""}
    </select></div>
    <p class="hint" id="cdHint"></p>`;
  openSheet("Delete “" + esc(c.name) + "”", body, `<button data-act="closeSheet">Cancel</button><button class="primary danger-bg" data-act="catDelGo" id="saveBtn">Delete & move</button>`, () => catDelHint());
}
function catDelHint() {
  const el = $("cdHint"), v = val("cdTo"); if (!el) return;
  if (!v.startsWith("acc:")) { el.textContent = "Past entries keep their dates and amounts, just under the new category."; return; }
  const a = acc(v.slice(4)), counts = spendSet().has(a.id);
  el.innerHTML = `They'll stop counting as spending and become money moved into <b>${esc(a.name)}</b>.` +
    (counts ? ` Since ${esc(a.name)} counts as spending money, log what you spend from it too, or turn off “counts as spending money” for that account in Settings, so Safe to spend stays accurate.` : "");
}
async function catDelGo() {
  const id = S.form.id, to = val("cdTo"), d = data(); if (!to) return toast("Pick where to move them.");
  const btn = $("saveBtn"); btn.disabled = true; btn.textContent = "Moving…";
  let kept = 0;
  const tx = [], docs = [];
  for (const t of d.transactions.filter((x) => x.categoryId === id)) {
    if (to.startsWith("acc:")) {
      const dest = to.slice(4);
      if (dest === t.accountId) { tx.push({ ...t, categoryId: "misc" }); kept++; }
      else tx.push({ ...t, type: "transfer", toAccountId: dest, categoryId: null });
    } else tx.push({ ...t, categoryId: to });
  }
  for (const r of d.rules.filter((x) => x.categoryId === id)) {
    if (to.startsWith("acc:") && to.slice(4) !== r.accountId) docs.push({ col: "rules", id: r.id, data: { ...stripId(r), type: "transfer", toAccountId: to.slice(4), categoryId: null, kind: "transfer" } });
    else docs.push({ col: "rules", id: r.id, data: { ...stripId(r), categoryId: to.startsWith("acc:") ? "misc" : to } });
  }
  try {
    await S.store.putMany({ tx, docs });
    await S.store.remove("categories", id);
    closeSheet();
    toast(to.startsWith("acc:") ? `Turned ${tx.length - kept} into transfers to ${acc(to.slice(4)).name}` + (kept ? ` (${kept} moved to Misc)` : "") : `Moved to ${cat(to).name}`);
  } catch (e) { btn.disabled = false; btn.textContent = "Delete & move"; toast("Couldn't delete: " + (e.code || e.message)); }
}

/* ------------------------------ holidays ------------------------------ */
function openHolidays() {
  const hs = (data().settings.holidays || []).slice().sort();
  S.form = { kind: "holidays", list: hs };
  const body = `<p class="sub" style="margin:0 0 12px;font-size:14px">Add your company's paid holidays so paydays and bills move to the right day.</p>
    <div class="row2" style="align-items:end"><div class="fg"><label for="hNew">Add a date</label><input type="date" id="hNew"></div><div class="fg"><button class="bigbtn small" data-act="holAdd" style="width:100%">Add</button></div></div>
    <div class="card flush" id="hList">${holList()}</div>`;
  openSheet("Holidays", body, `<button class="primary" data-act="closeSheet">Done</button>`);
}
function holList() {
  const l = (data().settings.holidays || []).slice().sort();
  return l.length ? l.map((h) => `<div class="item"><span class="info"><span class="nm" style="display:block">${fmtDate(h, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</span></span><button class="iconbtn" data-act="holDel" data-v="${h}" aria-label="Remove">✕</button></div>`).join("") : `<div class="empty">No holidays yet.</div>`;
}
async function setHolidays(list) { await S.store.setSettings({ holidays: [...new Set(list)].sort() }); }

/* ------------------------------ import / export ------------------------------ */
function readFile(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file); }); }
async function parseBackupFile(file) {
  let j;
  try { j = JSON.parse(await readFile(file)); } catch (e) { throw new Error("That file isn't a valid backup."); }
  if (j && j.app === APP_NAME && j.version) return { kind: "full", json: j, count: (j.transactions || []).length };
  if (j && Array.isArray(j.entries)) {
    const ds = j.entries.map((e) => e.date).filter(Boolean).sort();
    return { kind: "legacy", json: j, count: j.entries.length, from: ds[0], to: ds[ds.length - 1] };
  }
  throw new Error("This doesn't look like a backup from your tracker.");
}
const LEGACY_CAT = { income: "income", car: "car", rent: "rent", credit: "credit", food: "food", gas: "gas", sub: "sub", misc: "misc", other: "other", cashapp: "cashapp", paypal: "paypal" };
async function importLegacy(json, { mainId, xfer, cashappId, paypalId }) {
  const transfersFor = xfer ? { ...(cashappId ? { cashapp: cashappId } : {}), ...(paypalId ? { paypal: paypalId } : {}) } : null;
  const tx = F.mapLegacyBackup(json, { mainAccountId: mainId, categoryMap: LEGACY_CAT, transfersFor }).map((t) => ({ ...t, id: newId(), createdAt: Date.now() }));
  const d = data(), docs = [];
  // make sure Cash App / PayPal categories exist when kept as spending
  const need = new Set(tx.filter((t) => t.type === "expense").map((t) => t.categoryId));
  if (need.has("cashapp") && !d.categories.some((c) => c.id === "cashapp")) docs.push({ col: "categories", id: "cashapp", data: { name: "Sent to Cash App", emoji: "💸", color: "#AFA9EC", kind: "expense", budget: 0, order: 50 } });
  if (need.has("paypal") && !d.categories.some((c) => c.id === "paypal")) docs.push({ col: "categories", id: "paypal", data: { name: "Sent to PayPal", emoji: "🅿️", color: "#FAC775", kind: "expense", budget: 0, order: 51 } });
  await S.store.putMany({ tx, docs });
  return tx.length;
}
async function importFull(j) {
  const docs = [];
  for (const col of ["accounts", "categories", "rules", "goals", "debts"]) for (const x of j[col] || []) docs.push({ col, id: x.id, data: stripId(x) });
  await S.store.putMany({ tx: j.transactions || [], docs });
  if (j.settings) await S.store.setSettings({ ...j.settings, onboarded: true });
}
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const file = typeof File !== "undefined" ? new File([blob], name, { type }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    return navigator.share({ files: [file], title: name }).catch(() => {});
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function exportJson() {
  const d = data();
  const j = { app: APP_NAME, version: 1, exportedAt: new Date().toISOString(), accounts: d.accounts, categories: d.categories, rules: d.rules, goals: d.goals, debts: d.debts, settings: d.settings, transactions: d.transactions };
  download(`${APP_NAME.toLowerCase()}-backup-${today()}.json`, JSON.stringify(j, null, 2), "application/json");
}
function exportCsv() {
  const d = data(), rows = [["Date", "Description", "Type", "Category", "Account", "To account", "Amount", "Note"]];
  for (const t of d.transactions.slice().sort((a, b) => (a.date < b.date ? -1 : 1))) {
    rows.push([t.date, t.label, t.type, t.type === "transfer" ? "" : cat(t.categoryId).name, acc(t.accountId).name, t.toAccountId ? acc(t.toAccountId).name : "", (t.type === "expense" || t.type === "transfer" ? -t.amount : t.amount).toFixed(2), t.note || ""]);
  }
  const csv = rows.map((r) => r.map((f) => { const s = String(f ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\n");
  download(`${APP_NAME.toLowerCase()}-transactions-${today()}.csv`, csv, "text/csv");
}

/* ------------------------------ onboarding finish ------------------------------ */
async function finishOnboarding() {
  const chosen = S.onb.accounts.filter((a) => a.on);
  if (!chosen.length) return toast("Pick at least one account.");
  const btn = document.querySelector('[data-act="onbDone"]'); if (btn) { btn.disabled = true; btn.textContent = "Setting up…"; }
  try {
    const ids = {}, docs = [];
    chosen.forEach((a, i) => { ids[a.key] = newId(); });
    const catDocs = DEFAULT_CATEGORIES.map(([id, name, emoji, color, kind], i) => ({ col: "categories", id, data: { name, emoji, color, kind, budget: 0, order: i } }));
    // compute starting balances so "balance today" matches what was typed, after any import
    let importTx = [];
    if (S.pendingImport && S.pendingImport.kind === "legacy") {
      const transfersFor = S.onb.xfer ? { ...(ids.cashapp ? { cashapp: ids.cashapp } : {}), ...(ids.paypal ? { paypal: ids.paypal } : {}) } : null;
      importTx = F.mapLegacyBackup(S.pendingImport.json, { mainAccountId: ids.bank || ids[chosen[0].key], categoryMap: LEGACY_CAT, transfersFor }).map((t) => ({ ...t, id: newId(), createdAt: Date.now() }));
      const need = new Set(importTx.filter((t) => t.type === "expense").map((t) => t.categoryId));
      if (need.has("cashapp")) catDocs.push({ col: "categories", id: "cashapp", data: { name: "Sent to Cash App", emoji: "💸", color: "#AFA9EC", kind: "expense", budget: 0, order: 50 } });
      if (need.has("paypal")) catDocs.push({ col: "categories", id: "paypal", data: { name: "Sent to PayPal", emoji: "🅿️", color: "#FAC775", kind: "expense", budget: 0, order: 51 } });
    }
    const probe = { accounts: chosen.map((a) => ({ id: ids[a.key], startingBalance: 0 })), transactions: importTx, rules: [] };
    chosen.forEach((a, i) => {
      const typed = parseAmt(a.bal);
      let start = 0;
      if (!isNaN(typed)) {
        const net = F.balanceAsOf(probe, new Set([ids[a.key]]), today()) || 0;
        start = F.round2((a.type === "credit" ? -Math.abs(typed) : typed) - net);
      }
      docs.push({ col: "accounts", id: ids[a.key], data: { name: a.name, type: a.type, emoji: a.emoji, color: a.color, startingBalance: start,
        includeInSafe: a.type !== "savings" && a.type !== "credit", archived: false, order: i } });
    });
    if (S.pendingImport && S.pendingImport.kind === "full") {
      await importFull(S.pendingImport.json);
    } else {
      await S.store.putMany({ tx: importTx, docs: [...catDocs, ...docs] });
    }
    await S.store.setSettings({ onboarded: true, holidays: data().settings.holidays || [] });
    S.pendingImport = null; S.onb = null;
    S.tab = "home"; LS.set("tab", "home"); window.scrollTo(0, 0);
    toast(importTx.length ? `Imported ${importTx.length} entries` : "You're all set");
  } catch (e) { if (btn) { btn.disabled = false; btn.textContent = "Get started"; } toast("Setup failed: " + (e.code || e.message)); }
}

/* ============================== toast ============================== */
let toastTimer = null;
function toast(msg, actionLabel, action) {
  const el = $("toast");
  el.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button data-act="toastAct">${esc(actionLabel)}</button>` : ""}`;
  S.undo = action || null;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); S.undo = null; }, actionLabel ? 5000 : 2400);
}

/* ============================== events ============================== */
function pickInGrid(el, gridAttr) {
  const grid = el.closest(`[data-grid]`); if (!grid) return;
  grid.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === el));
}
const ACT = {
  tab: (ds) => {
    const prev = S.tab; S.tab = ds.v; if (ds.v !== "settings") LS.set("tab", ds.v); if (ds.v === "calendar") { const t = today(); S.vy = +t.slice(0, 4); S.vm = +t.slice(5, 7); S.sel = t; }
    render(); window.scrollTo(0, 0);
    if (prev !== ds.v) { M.haptic(); M.enterTab($("app"), Math.sign(TAB_ORDER.indexOf(ds.v) - TAB_ORDER.indexOf(prev))); }
  },
  add: (ds) => openTxForm(null, ds.date || (S.tab === "calendar" ? S.sel : today())),
  signin: async () => { try { await S.store.signIn(); } catch (e) { if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") toast("Sign-in failed: " + (e.code || e.message)); } },
  demo: async () => { LS.set("mode", "demo"); if (S.store.kind !== "demo") { S.store = new DemoStore(); S.store.onAuth(onAuth); } await S.store.signIn(); },
  signout: async () => { if (!confirm(S.store.kind === "demo" ? "Leave the demo? Demo data stays on this device." : "Sign out?")) return; LS.set("mode", ""); S.tab = "home"; LS.set("tab", "home"); await S.store.signOut(); if (S.store.kind === "demo" && isConfigured(firebaseConfig)) location.reload(); },
  deleteAll: async () => {
    if (!confirm("Delete ALL your data? This can't be undone.\n\nTip: back up first in Settings → Back up everything.")) return;
    if (prompt('Type DELETE to confirm') !== "DELETE") return toast("Cancelled");
    await S.store.deleteEverything(); S.onb = null; toast("All data deleted");
  },
  closeSheet: () => closeSheet(),
  toastAct: async () => { const f = S.undo; S.undo = null; $("toast").classList.remove("show"); if (f) await f(); },
  goPlan: (ds) => { S.tab = "plan"; S.planSeg = ds.v; LS.set("tab", "plan"); LS.set("planSeg", ds.v); render(); window.scrollTo(0, 0); },
  planSeg: (ds) => { const keys = ["budgets", "bills", "goals", "debts", "pay"], dir = Math.sign(keys.indexOf(ds.v) - keys.indexOf(S.planSeg)); S.planSeg = ds.v; LS.set("planSeg", ds.v); S.restoreScroll = true; render(); if (dir) { M.haptic(); M.slideContent($("app"), dir, 2); } },
  actSeg: (ds) => { const dir = ds.v === S.actSeg ? 0 : ds.v === "insights" ? 1 : -1; S.actSeg = ds.v; S.restoreScroll = true; render(); if (dir) { M.haptic(); M.slideContent($("app"), dir, 2); } },
  month: (ds) => { shiftMonth(+ds.v); M.slideIn(document.querySelector("#calcard .cal"), +ds.v); },
  lmonth: (ds) => { let y = S.ly, m = S.lm + +ds.v; if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; } S.ly = y; S.lm = m; render(); M.slideContent($("app"), +ds.v); },
  selDay: (ds) => { const v = ds.v; if (v.slice(0, 7) !== F.ymd(S.vy, S.vm, 1).slice(0, 7)) { S.vy = +v.slice(0, 4); S.vm = +v.slice(5, 7); } const changed = S.sel !== v; S.sel = v; S.restoreScroll = true; render(); if (changed) M.pop(document.querySelector(".day.sel .dn")); },
  goToday: () => { const t = today(); S.vy = +t.slice(0, 4); S.vm = +t.slice(5, 7); S.sel = t; render(); window.scrollTo(0, 0); },
  calAcc: (ds) => { S.calAcc = ds.v; S.restoreScroll = true; render(); },
  fType: (ds) => { S.fType = ds.v; S.restoreScroll = true; render(); },
  toggleSched: () => { S.showSched = !S.showSched; S.restoreScroll = true; render(); },
  openAcctActivity: (ds) => { S.tab = "activity"; S.actSeg = "list"; S.fAcc = ds.id; const t = today(); S.ly = +t.slice(0, 4); S.lm = +t.slice(5, 7); render(); window.scrollTo(0, 0); },
  editTx: (ds) => openTxForm(ds.id),
  openOcc: (ds) => openOccurrence(ds.id),
  saveTx, delTx: deleteTx, occSave, occSkip,
  editRule: (ds) => openRuleForm(ds.id), saveRule, delRule: deleteRule,
  editJob: (ds) => openJobForm(ds.id), saveJob,
  editBudgets: openBudgets, saveBudgets,
  editGoal: (ds) => openGoalForm(ds.id), saveGoal, delGoal: async () => { if (!confirm("Delete this goal?")) return; await S.store.remove("goals", S.form.id); closeSheet(); toast("Deleted"); },
  goalAdd: (ds) => openGoalAdd(ds.id), saveGoalAdd,
  editDebt: (ds) => openDebtForm(ds.id), saveDebt, delDebt: async () => { if (!confirm("Delete this debt?")) return; await S.store.remove("debts", S.form.id); closeSheet(); toast("Deleted"); },
  editAccount: (ds) => openAccountForm(ds.id), saveAccount, delAccount: deleteAccount,
  editCategory: (ds) => openCategoryForm(ds.id), saveCategory, delCategory: deleteCategory, catDelGo,
  editHolidays: openHolidays,
  holAdd: async () => { const v = val("hNew"); if (!v) return toast("Pick a date."); await setHolidays([...(data().settings.holidays || []), v]); $("hList").innerHTML = holList(); $("hNew").value = ""; },
  holDel: async (ds) => { await setHolidays((data().settings.holidays || []).filter((h) => h !== ds.v)); $("hList").innerHTML = holList(); },
  addUSHolidays: async () => { await setHolidays([...(data().settings.holidays || []), ...US_HOLIDAYS]); toast("Added US holidays for 2026–2027"); },
  theme: (ds) => { LS.set("theme", ds.v); applyTheme(); render(); },
  style: (ds) => { LS.set("style", ds.v); applyStyle(); S.restoreScroll = true; render(); },
  exportJson, exportCsv,
  onbDone: finishOnboarding,
  segPick: (ds, el) => {
    const row = el.closest(".seg");
    if (row) { row.querySelectorAll(":scope > button").forEach((b) => b.classList.toggle("on", b === el)); M.syncThumbs(row.parentElement, true); M.haptic(); }
    const f = S.form; if (!f) return;
    if (ds.seg === "type") { f.type = ds.v; f.categoryId = null; if (ds.v === "transfer" && !f.toAccountId) f.toAccountId = (activeAccounts().find((a) => a.id !== f.accountId) || {}).id || null; refreshTxForm();
      if ($("fKindWrap")) $("fKindWrap").innerHTML = f.type === "expense" ? `<div class="fg"><span class="lab">Type</span>${seg("rkind", f.rkind || "bill", [["bill", "Bill"], ["subscription", "Subscription"]])}</div>` : ""; }
    if (ds.seg === "rkind") f.rkind = ds.v;
    if (ds.seg === "ckind") f.ckind = ds.v;
    if (ds.seg === "payType") { f.payType = ds.v; $("jPayFields").innerHTML = jobPayFields({ payType: ds.v, hours: 40, tax: 20 }, null); jobEstimate(); }
    M.syncThumbs($("sheet"), true);
  },
  pickCat: (ds, el) => { pickInGrid(el); S.form.categoryId = ds.v; },
  newCatOpen: (ds) => { const box = $("newCatBox"); if (!box) return; box.innerHTML = newCatForm(ds.kind); setTimeout(() => { const i = $("ncName"); if (i) { i.focus(); i.scrollIntoView({ block: "center", behavior: "smooth" }); } }, 50); },
  newCatCancel: () => { const box = $("newCatBox"); if (box) box.innerHTML = ""; },
  newCatSave: (ds) => newCatSave(ds.kind),
  ncEmoji: (ds, el) => { const g = el.closest("[data-grid]"); if (g) g.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === el)); S.form.ncEmoji = ds.v; },
  pickAcc: (ds, el) => {
    pickInGrid(el); S.form[ds.field] = ds.v;
    if (ds.field === "accountId" && S.form.type === "transfer") { if (S.form.toAccountId === ds.v) S.form.toAccountId = null; $("fToWrap").innerHTML = `<div class="fg"><span class="lab">To</span>${accPick("toAccountId", S.form.toAccountId, S.form.accountId)}</div>`; }
  },
  pickEmoji: (ds, el) => { pickInGrid(el); S.form.emoji = ds.v; },
  pickColor: (ds, el) => { pickInGrid(el); S.form.color = ds.v; }
};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const f = ACT[el.dataset.act]; if (!f) return;
  if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") e.preventDefault();
  Promise.resolve(f(el.dataset, el, e)).catch((err) => toast("Something went wrong: " + (err.code || err.message)));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target && e.target.id === "ncName") { e.preventDefault(); const b = $("ncSave"); if (b) b.click(); return; }
  if (e.key === "Escape" && $("sheet").classList.contains("open")) closeSheet();
  if ((e.key === "Enter" || e.key === " ") && e.target.getAttribute && e.target.getAttribute("role") === "button") { e.preventDefault(); e.target.click(); }
});
$("scrim").addEventListener("click", closeSheet);

let qTimer = null;
const INP = {
  q: (el) => { clearTimeout(qTimer); qTimer = setTimeout(() => { S.q = el.value; const r = $("listResults"); if (r) r.innerHTML = listResults(); else render(); }, 200); },
  fAcc: (el) => { S.fAcc = el.value; S.restoreScroll = true; render(); },
  fCat: (el) => { S.fCat = el.value; S.restoreScroll = true; render(); },
  onbOn: (el) => { S.onb.accounts[+el.dataset.i].on = el.checked; render(); },
  onbBal: (el) => { S.onb.accounts[+el.dataset.i].bal = el.value; },
  onbXfer: (el) => { S.onb.xfer = el.checked; },
  onbFile: async (el) => { const f = el.files[0]; if (!f) return; try { S.pendingImport = await parseBackupFile(f); render(); } catch (e) { toast(e.message); } },
  importFile: async (el) => {
    const f = el.files[0]; el.value = ""; if (!f) return;
    try {
      const p = await parseBackupFile(f);
      if (p.kind === "full") { if (!confirm(`Restore ${p.count} transactions and all settings from this backup? Items with the same ID are replaced.`)) return; await importFull(p.json); toast("Backup restored"); return; }
      const accs = activeAccounts(); if (!accs.length) return toast("Add an account first.");
      S.form = { kind: "import", p };
      openSheet("Import old tracker", `<div class="banner good">${p.count} entries · ${fmtDate(p.from, { month: "short", day: "numeric", year: "numeric" })} – ${fmtDate(p.to, { month: "short", day: "numeric", year: "numeric" })}</div>
        <div class="fg"><label for="impAcc">Put them in</label><select id="impAcc">${accs.map((a) => `<option value="${a.id}" ${a.type === "checking" ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div>
        <div class="toggle"><div class="tx">Cash App & PayPal entries are transfers<small>Moves that money into those accounts instead of counting it as spent</small></div><label class="sw"><input type="checkbox" id="impX"><span></span></label></div>
        <p class="hint" style="font-size:12.5px;color:var(--text-3)">Importing the same file twice will add duplicates.</p>`,
        `<button data-act="closeSheet">Cancel</button><button class="primary" id="impGo">Import</button>`);
      $("impGo").onclick = async () => {
        const find = (re) => (activeAccounts().find((a) => re.test(a.name)) || {}).id;
        const n = await importLegacy(p.json, { mainId: val("impAcc"), xfer: $("impX").checked, cashappId: find(/cash ?app/i), paypalId: find(/^paypal$/i) || find(/paypal(?!.*sav)/i) });
        closeSheet(); toast(`Imported ${n} entries`);
      };
    } catch (e) { toast(e.message); }
  },
  haptics: (el) => { LS.set("haptics", el.checked); M.setHaptics(el.checked); if (el.checked) M.haptic(); },
  cdTo: () => catDelHint(),
  buffer: (el) => { clearTimeout(qTimer); qTimer = setTimeout(() => S.store.setSettings({ buffer: parseAmt(el.value) || 0 }), 600); },
  freq: (el) => { S.form.freq = el.value; $("freqExtra").innerHTML = freqExtra(S.form.id ? data().rules.find((r) => r.id === S.form.id) : null); },
  jobFreq: (el) => { S.form.freq = el.value; $("freqExtra").innerHTML = jobFreqExtra(null); $("jStartLab").textContent = el.value === "biweekly" || el.value === "weekly" ? "Next payday" : "Starting"; jobEstimate(); },
  jobEst: () => jobEstimate(),
  goalAcct: (el) => { $("gSavedWrap").hidden = !!el.value; },
  debtExtra: (el) => { S.debtExtra = { ...(S.debtExtra || {}), [el.dataset.id]: +el.value }; S.restoreScroll = true; render(); },
  labelSuggest: (el) => {
    if (!S.form || S.form.kind !== "tx" || S.form.id) return;
    const s = F.suggestCategory(data(), el.value);
    if (s && s.categoryId && s.type === S.form.type && s.categoryId !== S.form.categoryId) {
      S.form.categoryId = s.categoryId; $("fCatWrap").innerHTML = txCatBlock();
      if (s.accountId && activeAccounts().some((a) => a.id === s.accountId)) { S.form.accountId = s.accountId; document.querySelectorAll('[data-grid="accountId"] button').forEach((b) => b.classList.toggle("on", b.dataset.v === s.accountId)); }
      if (!$("fAmt").value && s.amount) $("fAmt").value = s.amount;
    }
  }
};
document.addEventListener("input", (e) => { const el = e.target.closest("[data-inp]"); if (el && INP[el.dataset.inp] && el.type !== "file" && el.type !== "checkbox") INP[el.dataset.inp](el); });
document.addEventListener("change", (e) => { const el = e.target.closest("[data-inp]"); if (el && INP[el.dataset.inp] && (el.type === "file" || el.type === "checkbox")) INP[el.dataset.inp](el); });

// keep "today" fresh if the app stays open past midnight
let lastDay = today();
setInterval(() => { if (today() !== lastDay) { lastDay = today(); MEMO = new Map(); render(); } }, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && today() !== lastDay) { lastDay = today(); MEMO = new Map(); render(); } });

M.setHaptics(LS.get("haptics", true));
M.init({
  onTab: (v) => ACT.tab({ v }),
  shiftMonth: (n) => shiftMonth(n),
  onDeleteTx: deleteTxNow,
  onSkipOcc: skipOccNow,
  closeSheet: () => closeSheet(),
  canGoBack: () => S.tab === "settings" && !!S.user,
  goBack: () => ACT.tab({ v: "home" })
});
M.bindSheet($("sheet"), $("scrim"));

export const __test = { S, ACT, INP, render, data, toast };
boot();
