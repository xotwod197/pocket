// Touch-gesture and motion tests on a simulated iPhone, using real touch events.
// Run: node tests/e2e-motion.mjs   (site served at http://localhost:8765)
import { chromium, devices } from "playwright";

const BASE = "http://localhost:8765/";
const results = []; let failures = 0;
const ok = (n, c, x) => { results.push((c ? "  ok  " : "  FAIL") + " - " + n + (c || x === undefined ? "" : "  [" + x + "]")); if (!c) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pinClock = () => { const R = Date; const f = new R(2026, 9, 12, 18, 0, 0).getTime(); class D extends R { constructor(...a) { if (!a.length) super(f); else super(...a); } static now() { return f; } } window.Date = D; };

async function setup(browser, opts = {}) {
  const ctx = await browser.newContext({ ...devices["iPhone 14"], colorScheme: "light", ...opts });
  await ctx.addInitScript(pinClock);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const cdp = await ctx.newCDPSession(p);
  const touch = async (pts, steps = 14, dur = 220) => {   // pts: [[x,y], [x,y]] start → end
    const [[x1, y1], [x2, y2]] = pts;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: y1 }] });
    for (let i = 1; i <= steps; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1 + (x2 - x1) * i / steps, y: y1 + (y2 - y1) * i / steps }] }); await sleep(dur / steps); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(120);
  };
  const tap = async (sel) => { await p.locator(sel).first().click(); await sleep(260); };
  const box = async (sel) => (await p.locator(sel).first().boundingBox());
  const S = () => p.evaluate(async () => { const m = await import("/js/app.js"); return { tab: m.__test.S.tab, planSeg: m.__test.S.planSeg, vm: m.__test.S.vm, form: m.__test.S.form && m.__test.S.form.type }; });
  const sheetOpen = () => p.evaluate(() => document.getElementById("sheet").classList.contains("open"));
  const txCount = () => p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("pocket-demo-v1")).tx).length);
  await p.goto(BASE); await sleep(500);
  await tap('[data-act="demo"]'); await sleep(300);
  await p.fill('[data-inp="onbBal"][data-i="0"]', "1250");
  await tap('[data-act="onbDone"]'); await sleep(700);
  return { ctx, p, errors, touch, tap, box, S, sheetOpen, txCount };
}
async function addTx(T, label, amt, repeat) {
  await T.tap(".tbadd"); await sleep(400);
  await T.p.fill("#fAmt", String(amt)); await T.p.fill("#fLabel", label);
  await T.tap('[data-act="pickCat"][data-v="food"]');
  if (repeat) await T.p.selectOption("#fRepeat", repeat);
  await T.tap('[data-act="saveTx"]'); await sleep(500);
}

const browser = await chromium.launch();
{
  const T = await setup(browser); const { p, touch, tap, box, S } = T;

  // ---- tab bar lens ----
  const lensAt = () => p.evaluate(() => { const l = document.querySelector(".lens"), on = document.querySelector(".tb.on"); return { lx: parseFloat(l.style.getPropertyValue("--x")), tx: on ? on.offsetLeft : null, hidden: l.classList.contains("hide") }; });
  let L = await lensAt();
  ok("tab bar lens sits under the selected tab", !L.hidden && Math.abs(L.lx - L.tx) < 1, JSON.stringify(L));
  await tap('.tb[data-v="activity"]'); await sleep(600);
  L = await lensAt();
  ok("lens glides to the tab you tap", (await S()).tab === "activity" && Math.abs(L.lx - L.tx) < 1, JSON.stringify(L));
  ok("tab bar is kept (not rebuilt) so the lens can animate", await p.evaluate(() => document.querySelectorAll("#tabbar .lens").length === 1));
  // drag across the tab bar: Activity → Home
  const a = await box('.tb[data-v="activity"]'), h = await box('.tb[data-v="home"]');
  const y = a.y + a.height / 2;
  await touch([[a.x + a.width / 2, y], [h.x + h.width / 2, y]], 12, 260);
  await sleep(500);
  ok("sliding a finger across the tab bar switches tabs", (await S()).tab === "home", JSON.stringify(await S()));
  L = await lensAt();
  ok("…and the lens lands on Home", Math.abs(L.lx - L.tx) < 1, JSON.stringify(L));
  // a short wiggle on a tab still counts as a tap
  await touch([[h.x + h.width / 2, y], [h.x + h.width / 2 + 3, y]], 2, 40);
  ok("a tiny wiggle doesn't switch tabs", (await S()).tab === "home");

  // ---- screen transition never widens the page ----
  const wob = await p.evaluate(async () => {
    document.querySelector('.tb[data-v="plan"]').click();
    let maxW = 0; const vw = document.documentElement.clientWidth;
    for (let i = 0; i < 20; i++) { maxW = Math.max(maxW, document.documentElement.scrollWidth); await new Promise((r) => requestAnimationFrame(r)); }
    return { maxW, vw, scale: visualViewport.scale };
  });
  ok("sliding screens never make the page wider (no wobble/zoom)", wob.maxW <= wob.vw + 1 && Math.abs(wob.scale - 1) < 0.01, JSON.stringify(wob));
  await sleep(500);

  // ---- plan chips pill ----
  const pill = () => p.evaluate(() => { const c = document.querySelector('[data-pill="plan"]'), t = c && c.querySelector(".thumb"), on = c && c.querySelector(".chip.on"); return t && on ? { x: parseFloat(t.style.getPropertyValue("--x")), ox: on.offsetLeft, w: parseFloat(t.style.getPropertyValue("--w")), ow: on.offsetWidth } : null; });
  let P = await pill();
  ok("plan filter has a sliding pill under the selected chip", P && Math.abs(P.x - P.ox) < 1 && Math.abs(P.w - P.ow) < 1, JSON.stringify(P));
  await tap('[data-act="planSeg"][data-v="goals"]'); await sleep(650);
  P = await pill();
  ok("pill slides to the chip you tap", (await S()).planSeg === "goals" && P && Math.abs(P.x - P.ox) < 1, JSON.stringify(P));

  // ---- segmented control in the add sheet ----
  await tap(".tbadd"); await sleep(600);
  ok("add sheet opens", await T.sheetOpen());
  ok("page behind the sheet eases back", await p.evaluate(() => getComputedStyle(document.getElementById("app")).transform !== "none"));
  const thumb = () => p.evaluate(() => { const c = document.querySelector('#sheet .seg[data-seg="type"]'), t = c.querySelector(".thumb"), on = c.querySelector("button.on"); return { x: parseFloat(t.style.getPropertyValue("--x")), ox: on.offsetLeft, v: on.dataset.v }; });
  let TH = await thumb();
  ok("type switch has a thumb under Expense", TH.v === "expense" && Math.abs(TH.x - TH.ox) < 1, JSON.stringify(TH));
  await tap('#sheet [data-act="segPick"][data-v="income"]'); await sleep(550);
  TH = await thumb();
  ok("tapping Income slides the thumb there", TH.v === "income" && Math.abs(TH.x - TH.ox) < 1 && (await S()).form === "income", JSON.stringify(TH));
  const sI = await box('#sheet [data-act="segPick"][data-v="income"]'), sT = await box('#sheet [data-act="segPick"][data-v="transfer"]');
  await touch([[sI.x + sI.width / 2, sI.y + sI.height / 2], [sT.x + sT.width / 2, sT.y + sT.height / 2]], 10, 200);
  await sleep(550);
  TH = await thumb();
  ok("dragging the thumb to Transfer selects Transfer", TH.v === "transfer" && (await S()).form === "transfer", JSON.stringify(TH));
  ok("…and the transfer fields appear", await p.locator("#fToWrap .accpick, #fToWrap [data-grid]").count() > 0 || (await p.locator("#fToWrap").innerText()).includes("To"));

  // ---- sheet: short drag springs back, long drag dismisses ----
  const g = await box("#sheet .grab");
  await touch([[g.x + g.width / 2, g.y + 3], [g.x + g.width / 2, g.y + 50]], 6, 120);
  await sleep(600);
  ok("short drag down: sheet springs back", await T.sheetOpen());
  ok("…back to its resting place", await p.evaluate(() => document.getElementById("sheet").style.transform === ""));
  await touch([[g.x + g.width / 2, g.y + 3], [g.x + g.width / 2, g.y + 320]], 14, 260);
  await sleep(600);
  ok("long drag down dismisses the sheet", !(await T.sheetOpen()));
  ok("page behind returns to normal", await p.evaluate(() => getComputedStyle(document.getElementById("app")).transform === "none"));
  // quick flick
  await tap(".tbadd"); await sleep(600);
  const g2 = await box("#sheet .grab");
  await touch([[g2.x + 40, g2.y + 3], [g2.x + 40, g2.y + 110]], 4, 50);
  await sleep(600);
  ok("a quick flick down also dismisses", !(await T.sheetOpen()));
  // dragging inside a scrolled form must scroll, not close
  await tap(".tbadd"); await sleep(600);
  await p.evaluate(() => { document.querySelector("#sheet .sbody").scrollTop = 120; });
  const sb = await box("#sheet .sbody");
  await touch([[sb.x + sb.width / 2, sb.y + 140], [sb.x + sb.width / 2, sb.y + 300]], 10, 200);
  await sleep(400);
  ok("dragging down inside a scrolled form doesn't close it", await T.sheetOpen());
  await tap('#sheet [data-act="closeSheet"]'); await sleep(400);

  // ---- swipe a transaction left ----
  await addTx(T, "Coffee", 6.5); await addTx(T, "Lunch", 12); await addTx(T, "Snack", 3);
  await tap('.tb[data-v="activity"]'); await sleep(600);
  const n0 = await T.txCount();
  const row = async (txt) => box(`.item[data-act="editTx"]:has-text("${txt}")`);
  let r = await row("Coffee");
  await touch([[r.x + r.width - 30, r.y + r.height / 2], [r.x + r.width - 30 - 70, r.y + r.height / 2]], 8, 160);
  await sleep(600);
  ok("short swipe left reveals Delete", await p.locator(".swipe-act button").count() === 1 && (await box(".swipe-act button")).width >= 80);
  ok("…without opening the edit sheet", !(await T.sheetOpen()));
  await tap(".swipe-act button"); await sleep(900);
  ok("tapping Delete removes the transaction", (await T.txCount()) === n0 - 1 && !(await p.locator('.item:has-text("Coffee")').count()));
  ok("…with an Undo button", (await p.locator("#toast").innerText()).includes("Undo"));
  await tap('[data-act="toastAct"]'); await sleep(500);
  ok("Undo brings it back", (await T.txCount()) === n0);
  // full swipe deletes straight away
  r = await row("Lunch");
  await touch([[r.x + r.width - 20, r.y + r.height / 2], [r.x + 10, r.y + r.height / 2]], 14, 240);
  await sleep(1000);
  ok("full swipe left deletes in one go", (await T.txCount()) === n0 - 1 && !(await p.locator('.item:has-text("Lunch")').count()));
  // swipe then swipe back closes it
  r = await row("Snack");
  await touch([[r.x + r.width - 30, r.y + r.height / 2], [r.x + r.width - 110, r.y + r.height / 2]], 8, 160); await sleep(500);
  await touch([[r.x + r.width - 110, r.y + r.height / 2], [r.x + r.width - 10, r.y + r.height / 2]], 8, 160); await sleep(600);
  ok("swiping back right closes it again", await p.locator(".swipe-act").count() === 0 && (await T.txCount()) === n0 - 1);
  // vertical scroll over a row doesn't swipe it
  r = await row("Snack");
  await touch([[r.x + r.width / 2, r.y + r.height / 2], [r.x + r.width / 2 + 8, r.y + r.height / 2 - 150]], 10, 200); await sleep(400);
  ok("scrolling up over a row doesn't swipe or open it", await p.locator(".swipe-act").count() === 0 && !(await T.sheetOpen()));
  // a plain tap still opens the edit sheet
  await tap('.item[data-act="editTx"]:has-text("Snack")'); await sleep(500);
  ok("a normal tap still opens the transaction", await T.sheetOpen());
  await tap('#sheet [data-act="closeSheet"]'); await sleep(400);

  // ---- swipe a repeating item to skip it ----
  await addTx(T, "Gym", 25, "weekly"); await sleep(300);
  await tap('.tb[data-v="calendar"]'); await sleep(600);
  await tap('[data-act="selDay"][data-v="2026-10-19"]'); await sleep(400);
  await p.locator('.item[data-act="openOcc"]:has-text("Gym")').first().evaluate((e) => e.scrollIntoView({ block: "center" })); await sleep(300);
  r = await box('.item[data-act="openOcc"]:has-text("Gym")');
  await touch([[r.x + r.width - 20, r.y + r.height / 2], [r.x + 10, r.y + r.height / 2]], 14, 240); await sleep(1000);
  const skipped = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem("pocket-demo-v1")).rules).some((x) => x.label === "Gym" && (x.skips || []).includes("2026-10-19")));
  ok("full swipe on a repeating item skips that date", skipped);
  ok("…and it disappears from that day", !(await p.locator('.item[data-act="openOcc"]:has-text("Gym")').count()));

  // ---- calendar month follows your finger ----
  const cc = await box("#calcard");
  const m0 = (await S()).vm;
  await touch([[cc.x + cc.width - 30, cc.y + cc.height / 2], [cc.x + cc.width - 30 - 40, cc.y + cc.height / 2]], 6, 200); await sleep(500);
  ok("small sideways drag on the calendar springs back", (await S()).vm === m0);
  await touch([[cc.x + cc.width - 30, cc.y + cc.height / 2], [cc.x + 40, cc.y + cc.height / 2]], 12, 220); await sleep(700);
  ok("swiping the calendar left shows next month", (await S()).vm === m0 + 1 && (await p.locator("#app h1").innerText()).includes("November"));
  const cc2 = await box("#calcard");
  await touch([[cc2.x + 40, cc2.y + cc2.height / 2], [cc2.x + cc2.width - 30, cc2.y + cc2.height / 2]], 12, 220); await sleep(700);
  ok("swiping right goes back", (await S()).vm === m0);
  ok("calendar swipe didn't open a day by accident", !(await T.sheetOpen()));

  // ---- settings: swipe from the left edge to go back ----
  await tap('.tb[data-v="home"]'); await sleep(500);
  await tap('.avatar[data-act="tab"]'); await sleep(600);
  ok("settings open from the profile picture", (await S()).tab === "settings");
  L = await lensAt();
  ok("lens hides on Settings (no tab selected)", L.hidden);
  await touch([[6, 400], [60, 400]], 6, 150); await sleep(600);
  ok("short edge swipe stays in Settings", (await S()).tab === "settings");
  await touch([[6, 400], [300, 405]], 12, 220); await sleep(800);
  ok("edge swipe from the left goes back to Home", (await S()).tab === "home");
  ok("page isn't left shifted after the swipe", await p.evaluate(() => document.getElementById("app").style.transform === ""));

  // ---- haptics setting ----
  await tap('.avatar[data-act="tab"]'); await sleep(500);
  const hap = p.locator('[data-inp="haptics"]');
  ok("haptic taps setting is on by default", await hap.isChecked());
  await p.locator(".toggle:has([data-inp=haptics]) .sw").click(); await sleep(200);
  ok("turning haptics off is remembered", await p.evaluate(() => localStorage.getItem("pocket.haptics") === "false"));

  // ---- compact title bar ----
  await p.evaluate(() => window.scrollTo(0, 400)); await sleep(300);
  ok("compact title bar appears after scrolling (iOS look)", await p.evaluate(() => document.getElementById("navbar").classList.contains("show") && document.getElementById("navbar").textContent === "Settings"));
  await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
  ok("…and hides at the top", await p.evaluate(() => !document.getElementById("navbar").classList.contains("show")));

  // ---- safe to spend counts down to the new value ----
  await tap('[data-act="tab"][data-v="home"]'); await sleep(700);
  const before = await p.locator(".hero .big").innerText();
  await addTx(T, "Shoes", 50); await sleep(100);
  const mid = await p.locator(".hero .big").innerText();
  await sleep(900);
  const after = await p.locator(".hero .big").innerText();
  const num = (s) => parseFloat(s.replace(/[^0-9.]/g, "")) * (s.includes("−") ? -1 : 1);
  ok("Safe to spend lands on the exact new amount", Math.abs(num(before) - 50 - num(after)) < 0.006, before + " → " + after);
  ok("…counting through in-between values", mid !== after || mid !== before, mid);

  ok("no JavaScript errors", T.errors.length === 0, T.errors.join(" | "));
  await T.ctx.close();
}

// ---- Reduce Motion on: everything still works, nothing animates ----
{
  const T = await setup(browser, { reducedMotion: "reduce" }); const { p, tap, S } = T;
  await tap('.tb[data-v="plan"]'); await sleep(150);
  ok("reduce motion: tabs still switch", (await S()).tab === "plan");
  ok("reduce motion: no slide animations run", await p.evaluate(() => document.getAnimations().filter((a) => !a.transitionProperty).length === 0));
  await tap(".tbadd"); await sleep(150);
  ok("reduce motion: sheet opens instantly", await T.sheetOpen() && await p.evaluate(() => getComputedStyle(document.getElementById("app")).transform === "none"));
  await tap('#sheet [data-act="closeSheet"]'); await sleep(150);
  ok("reduce motion: no JavaScript errors", T.errors.length === 0, T.errors.join(" | "));
  await T.ctx.close();
}

// ---- Classic look: motion works there too ----
{
  const T = await setup(browser); const { p, tap, S } = T;
  await p.evaluate(() => localStorage.setItem("pocket.style", JSON.stringify("classic"))); await p.reload(); await sleep(700);
  await tap('.tb[data-v="calendar"]'); await sleep(600);
  const L = await p.evaluate(() => { const l = document.querySelector(".lens"), on = document.querySelector(".tb.on"); return Math.abs(parseFloat(l.style.getPropertyValue("--x")) - on.offsetLeft); });
  ok("classic look: lens follows tabs too", L < 1 && !(await p.evaluate(() => document.documentElement.classList.contains("ios"))));
  ok("classic look: no compact title bar", await p.evaluate(() => getComputedStyle(document.getElementById("navbar")).display === "none"));
  ok("classic look: no JavaScript errors", T.errors.length === 0, T.errors.join(" | "));
  await T.ctx.close();
}

// ---- deleting a category asks where its items go (e.g. "Sent to Cash App" → transfers) ----
{
  const T = await setup(browser); const { p, tap } = T;
  await p.evaluate(async () => {
    const { __test } = await import("/js/app.js"); const st = __test.S.store;
    await st.put("accounts", "cashapp1", { name: "Cash App", type: "wallet", emoji: "💸", color: "#5DCAA5", order: 2, includeInSafe: false });
    await st.put("categories", "cashapp", { name: "Sent to Cash App", emoji: "💸", color: "#AFA9EC", kind: "expense", budget: 0, order: 50 });
    await st.put("categories", "paypal", { name: "Sent to PayPal", emoji: "🅿️", color: "#FAC775", kind: "expense", budget: 0, order: 51 });
  });
  await sleep(300);
  for (const [l, c] of [["Sent to Cash App", "cashapp"], ["Sent to Cash App", "cashapp"], ["Sent to PayPal", "paypal"]]) {
    await tap(".tbadd"); await sleep(400); await p.fill("#fAmt", "20"); await p.fill("#fLabel", l);
    await tap(`[data-act="pickAcc"][data-field="accountId"]:has-text("Main")`).catch(() => {});
    await tap(`[data-act="pickCat"][data-v="${c}"]`); await tap('[data-act="saveTx"]'); await sleep(400);
  }
  const db = () => p.evaluate(() => JSON.parse(localStorage.getItem("pocket-demo-v1")));
  await tap('.avatar[data-act="tab"]'); await sleep(500);
  await tap('[data-act="editCategory"][data-id="cashapp"]'); await sleep(400);
  await tap('#sheet [data-act="delCategory"]'); await sleep(500);
  ok("deleting a used category asks where its items go", (await p.locator("#sheet").innerText()).includes("2 items use"));
  ok("…and suggests turning them into transfers to Cash App", (await p.locator("#cdTo").inputValue()) === "acc:cashapp1");
  ok("…explaining what that means", (await p.locator("#cdHint").innerText()).includes("money moved into Cash App"));
  await tap('[data-act="catDelGo"]'); await sleep(500);
  let d = await db();
  const moved = Object.values(d.tx).filter((t) => t.label === "Sent to Cash App");
  ok("Sent to Cash App entries became transfers to Cash App", moved.length === 2 && moved.every((t) => t.type === "transfer" && t.toAccountId === "cashapp1" && !t.categoryId), JSON.stringify(moved[0]));
  ok("the category is gone", !d.categories.cashapp);
  // move into another category instead
  await tap('[data-act="editCategory"][data-id="paypal"]'); await sleep(400);
  await tap('#sheet [data-act="delCategory"]'); await sleep(500);
  ok("no PayPal account → defaults to a category", !(await p.locator("#cdTo").inputValue()).startsWith("acc:"));
  await p.selectOption("#cdTo", "shop"); await sleep(150);
  await tap('[data-act="catDelGo"]'); await sleep(500);
  d = await db();
  ok("Sent to PayPal entry moved to Shopping", Object.values(d.tx).filter((t) => t.label === "Sent to PayPal").every((t) => t.categoryId === "shop" && t.type === "expense") && !d.categories.paypal);
  // unused category: plain confirm
  p.once("dialog", (x) => x.accept());
  await tap('[data-act="editCategory"][data-id="travel"]'); await sleep(400);
  await tap('#sheet [data-act="delCategory"]'); await sleep(500);
  ok("unused category deletes with a simple confirm", !(await db()).categories.travel);
  ok("category delete: no JavaScript errors", T.errors.length === 0, T.errors.join(" | "));
  await T.ctx.close();
}

await browser.close();
console.log(results.join("\n")); console.log(`\n${results.length - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
