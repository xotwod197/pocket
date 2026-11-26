// iPhone UI audit: visits every screen and form on several iPhones (light + dark), saves screenshots,
// and flags overlapping text/controls, clipped text, things off screen and content hidden under the tab bar.
// Run: node tests/ui-audit.mjs [screenshot-folder]     (site served at http://localhost:8765)
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:8765/";
const OUT = process.argv[2] || "";
if (OUT) mkdirSync(OUT, { recursive: true });
const BACKUP = new URL("./fixtures/sample-backup.json", import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pinClock = () => { const R = Date; const f = new R(2026, 9, 12, 18, 0, 0).getTime(); class D extends R { constructor(...a) { if (!a.length) super(f); else super(...a); } static now() { return f; } } window.Date = D; };
const problems = []; let checks = 0;

// runs in the page: returns a list of human-readable layout problems
function scan(scope) {
  const out = [];
  const root = scope === "sheet" ? document.getElementById("sheet") : document;
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const visible = (el) => { const s = getComputedStyle(el); if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const name = (el) => { const t = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 32); return `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : ""} "${t}"`; };
  const inSheetOpen = !!document.querySelector(".sheet.open");
  // 1) leaf boxes: text runs + controls
  const boxes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || !visible(el) || el.closest("#toast, .navbar, .cmenu, .sr, svg")) continue;
    if (scope !== "sheet" && (el.closest("#sheet") || inSheetOpen)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    // text inside a box that cuts it off with "…" only occupies that box
    let clipEl = el; while (clipEl && clipEl !== document.body && getComputedStyle(clipEl).overflowX === "visible") clipEl = clipEl.parentElement;
    const cb = clipEl && clipEl !== document.body ? clipEl.getBoundingClientRect() : null;
    for (const r0 of rg.getClientRects()) { const r = cb ? { left: Math.max(r0.left, cb.left), right: Math.min(r0.right, cb.right), top: Math.max(r0.top, cb.top), bottom: Math.min(r0.bottom, cb.bottom) } : r0;
      if (r.right - r.left > 2 && r.bottom - r.top > 2) boxes.push({ r, el, kind: "text" }); }
  }
  root.querySelectorAll("button, input, select, textarea, .ico, .avatar, img, .sw, .fill, .dot, .cdot").forEach((el) => {
    if (!visible(el) || el.closest("#toast, .navbar, .cmenu")) return;
    if (scope !== "sheet" && (el.closest("#sheet") || inSheetOpen)) return;
    boxes.push({ r: el.getBoundingClientRect(), el, kind: "ctl" });
  });
  // only the part you can actually see counts (rows scrolled away inside a sheet are hidden by it)
  const clipOf = (el) => { const sc = el.closest(".sbody, .hscroll, .chips"); return sc ? sc.getBoundingClientRect() : null; };
  for (const b of boxes) { const c = clipOf(b.el); if (c) { const r = b.r; const nr = { left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) }; b.r = nr; b.gone = nr.right - nr.left < 2 || nr.bottom - nr.top < 2; } }
  for (let i = boxes.length - 1; i >= 0; i--) if (boxes[i].gone || boxes[i].el.closest(".amtwrap > span")) boxes.splice(i, 1);
  // 2) overlaps between unrelated boxes
  const ov = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  const seen = new Set();
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    // a text run inside a control vs the control itself is fine; so are thumbs/lenses drawn under buttons
    if (A.el.closest(".thumb, .lens") || B.el.closest(".thumb, .lens")) continue;
    if (!ov(A.r, B.r)) continue;
    const fixedA = A.el.closest(".tabbar"), fixedB = B.el.closest(".tabbar");
    if (!!fixedA !== !!fixedB) continue;   // content scrolling under the glass tab bar is normal; checked separately
    const key = name(A.el) + " × " + name(B.el); if (seen.has(key)) continue; seen.add(key);
    out.push("overlap: " + key);
  }
  // 3) text cut off without an ellipsis, and things off screen
  root.querySelectorAll("*").forEach((el) => {
    if (!visible(el) || el.closest("#toast, .navbar, .cmenu, .hscroll, .chips, .tabbar .in > .lens") ) return;
    if (scope !== "sheet" && (el.closest("#sheet") || inSheetOpen)) return;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (el.children.length === 0 && el.textContent.trim() && el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== "ellipsis" && (s.overflow === "hidden" || s.overflowX === "hidden")) out.push("clipped text: " + name(el));
    if (s.position !== "fixed" && (r.right > vw + 1 || r.left < -1) && !el.closest(".sheet:not(.open)")) out.push("off screen: " + name(el) + ` (${Math.round(r.left)}–${Math.round(r.right)} of ${vw})`);
  });
  // 4) the end of the page must be reachable above the floating tab bar
  if (scope !== "sheet") {
    const tb = document.querySelector(".tabbar:not([hidden]) .in");
    const app = document.getElementById("app");
    if (tb && app) {
      const last = [...app.querySelectorAll("*")].filter((e) => visible(e)).reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom + scrollY), 0);
      const room = document.documentElement.scrollHeight - last, need = vh - tb.getBoundingClientRect().top;
      if (room + 1 < need) out.push(`last item hides under the tab bar (${Math.round(room)}px room, needs ${Math.round(need)}px)`);
    }
  }
  // 5) sheet content must not run under its own header/footer, and buttons need 44pt
  if (scope === "sheet") {
    const sh = document.getElementById("sheet").getBoundingClientRect();
    if (sh.bottom > vh + 1 || sh.top < 0) out.push(`sheet doesn't fit the screen (${Math.round(sh.top)}–${Math.round(sh.bottom)} of ${vh})`);
  }
  root.querySelectorAll("button, [role=button], input, select").forEach((el) => {
    if (!visible(el) || el.type === "hidden" || el.closest(".sw, #toast")) return;
    if (scope !== "sheet" && (el.closest("#sheet") || inSheetOpen)) return;
    const r = el.getBoundingClientRect();
    const c = clipOf(el); if (c && (r.bottom < c.top || r.top > c.bottom)) return;
    const min = el.closest(".seg, .accpick, .chips, .iconbtn.sm") ? 39.5 : 43.5;   // Apple's segmented controls are 32pt; everything else 44pt
    if (r.height < min && !el.closest(".day, .catgrid, .emojis, .colors") && el.type !== "checkbox") out.push(`small tap target (${Math.round(r.width)}×${Math.round(r.height)}): ` + name(el));
  });
  return out;
}

const SE3 = { ...devices["iPhone 14"], viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 }, deviceScaleFactor: 2 };   // iPhone SE (2nd/3rd gen)
async function run(devName, scheme) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...(devName === "iPhone SE 3" ? SE3 : devices[devName]), colorScheme: scheme });
  await ctx.addInitScript(pinClock);
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const tag = `${devName.replace(/\s+/g, "")}-${scheme}`;
  const check = async (label, scope = "page") => {
    await sleep(650);
    const found = await p.evaluate(scan, scope);
    checks++;
    for (const f of found) problems.push(`[${tag}] ${label}: ${f}`);
    if (OUT) await p.screenshot({ path: `${OUT}/${tag}-${label.replace(/[^a-z0-9]+/gi, "_")}.png`, fullPage: scope !== "sheet" });
  };
  const tap = async (s) => { await p.locator(s).first().click(); await sleep(300); };
  const closeSheet = async () => { await tap('#sheet [data-act="closeSheet"]'); await sleep(350); };
  await p.goto(BASE); await sleep(500);
  await check("sign-in");
  await tap('[data-act="demo"]'); await sleep(400);
  await check("onboarding");
  await p.locator('[data-inp="onbOn"][data-i="1"]').check();
  await p.fill('[data-inp="onbBal"][data-i="0"]', "1250"); await p.fill('[data-inp="onbBal"][data-i="1"]', "40");
  await p.setInputFiles('[data-inp="onbFile"]', BACKUP); await sleep(300);
  await tap('[data-act="onbDone"]'); await sleep(2600);   // let the import toast go away
  // some extra data so every section has content
  await p.evaluate(async () => {
    const { __test } = await import("/js/app.js"); const st = __test.S.store;
    await st.put("goals", null, { name: "Emergency fund", emoji: "🛟", target: 2000, saved: 450, color: "#5DCAA5" });
    await st.put("debts", null, { name: "Car loan", balance: 9800, apr: 6.9, minPay: 180, emoji: "🚗" });
    await st.put("categories", "food", { ...__test.data().categories.find((c) => c.id === "food"), budget: 300 });
  });
  await sleep(300);
  await check("home");
  await tap('.tb[data-v="calendar"]'); await check("calendar");
  await tap('.tb[data-v="activity"]'); await check("activity");
  await tap('[data-act="actSeg"][data-v="insights"]'); await check("insights");
  await tap('.tb[data-v="plan"]');
  for (const s of ["budgets", "bills", "goals", "debts", "pay"]) { await tap(`[data-act="planSeg"][data-v="${s}"]`); await check("plan-" + s); }
  await tap('.tb[data-v="home"]'); await tap('.avatar[data-act="tab"]'); await check("settings");
  // forms
  await tap(".tbadd"); await check("sheet-add-expense", "sheet");
  await tap('#sheet [data-act="segPick"][data-v="transfer"]'); await check("sheet-add-transfer", "sheet"); await closeSheet();
  await tap('.tb[data-v="activity"]'); await tap('[data-act="actSeg"][data-v="list"]');
  await tap('.item[data-act="editTx"]'); await check("sheet-edit-tx", "sheet"); await closeSheet();
  await tap('.tb[data-v="calendar"]'); await tap('[data-act="selDay"][data-v="2026-10-15"]');
  if (await p.locator('.item[data-act="openOcc"]').count()) { await tap('.item[data-act="openOcc"]'); await check("sheet-occurrence", "sheet"); await closeSheet(); }
  await tap('.tb[data-v="plan"]'); await tap('[data-act="planSeg"][data-v="bills"]');
  await tap('[data-act="editRule"]'); await check("sheet-new-bill", "sheet"); await closeSheet();
  await tap('[data-act="planSeg"][data-v="goals"]'); await tap('[data-act="editGoal"]'); await check("sheet-goal", "sheet"); await closeSheet();
  await tap('[data-act="planSeg"][data-v="debts"]'); await tap('[data-act="editDebt"]'); await check("sheet-debt", "sheet"); await closeSheet();
  await tap('[data-act="planSeg"][data-v="pay"]'); await tap('[data-act="editJob"]'); await check("sheet-job", "sheet"); await closeSheet();
  await tap('[data-act="planSeg"][data-v="budgets"]'); await tap('[data-act="editBudgets"]'); await check("sheet-budgets", "sheet"); await closeSheet();
  await tap('.tb[data-v="home"]'); await tap('.avatar[data-act="tab"]');
  await tap('[data-act="editAccount"][data-id]'); await check("sheet-account", "sheet"); await closeSheet();
  await tap('[data-act="editCategory"][data-id]'); await check("sheet-category", "sheet"); await closeSheet();
  await tap('[data-act="editHolidays"]'); await check("sheet-holidays", "sheet"); await closeSheet();
  if (errs.length) problems.push(`[${tag}] JavaScript errors: ${errs.join(" | ")}`);
  await browser.close();
}

for (const [d, s] of [["iPhone SE 3", "light"], ["iPhone 14", "dark"], ["iPhone 14 Pro Max", "light"], ["iPhone 14", "light"], ["iPhone SE", "dark"]]) await run(d, s);
console.log(problems.length ? problems.join("\n") : "no problems found");
console.log(`\n${checks} screens checked, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
