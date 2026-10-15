// End-to-end test: drives the app like a person on an iPhone, in demo mode.
// Run: node tests/e2e.mjs <outdir>   (expects the site served at http://localhost:8765)
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] || "shots";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:8765/";
const BACKUP = new URL("./fixtures/sample-backup.json", import.meta.url).pathname;
const NBACK = JSON.parse((await import("node:fs")).readFileSync(BACKUP, "utf8")).entries.length;
const results = [];
let failures = 0;
const ok = (name, cond, extra) => { results.push((cond ? "  ok  " : "  FAIL") + " - " + name + (cond || extra === undefined ? "" : "  [" + extra + "]")); if (!cond) failures++; };

const pinClock = () => {
  const R = Date; const fixed = new R(2026, 9, 12, 18, 0, 0).getTime();
  class D extends R { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } }
  window.Date = D;
};

async function layoutCheck(p, label) {
  const r = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const over = document.documentElement.scrollWidth > vw + 1;
    const sheetOpen = !!document.querySelector(".sheet.open");   // the page behind an open sheet is covered and gently scaled back
    const front = (e) => !sheetOpen || !!e.closest(".sheet");
    const vis = (e) => { if (!front(e)) return false;  const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden") return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const small = [...document.querySelectorAll("button, input:not([type=range]):not([type=checkbox]):not([type=file]), select, label.setrow")]
      .filter(vis).filter((e) => !e.closest(".sheet:not(.open)") && !e.classList.contains("day") && !e.closest(".colors"))
      .filter((e) => e.getBoundingClientRect().height < 40).map((e) => (e.className || e.tagName) + ":" + Math.round(e.getBoundingClientRect().height));
    const tiny = [...document.querySelectorAll("input:not([type=range]):not([type=checkbox]):not([type=file]), select, textarea")].filter(vis)
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id || e.dataset.inp || e.tagName);
    const clipped = [...document.querySelectorAll(".db, .mini .v, .tile .v, .hero .big, .acct .b, .amt")].filter(vis)
      .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim().slice(0, 20));
    const offscreen = [...document.querySelectorAll("button, input, select")].filter(vis).filter((e) => !e.closest(".hscroll,.chips,.sheet:not(.open)"))
      .filter((e) => { const r = e.getBoundingClientRect(); return r.right > vw + 1 || r.left < -1; }).map((e) => e.className || e.tagName);
    return { over, small: [...new Set(small)], tiny, clipped, offscreen: [...new Set(offscreen)] };
  });
  ok(`${label}: no sideways scrolling`, !r.over);
  ok(`${label}: tap targets >= 40px`, !r.small.length, r.small.join(", "));
  ok(`${label}: inputs >= 16px (no iOS zoom)`, !r.tiny.length, r.tiny.join(", "));
  ok(`${label}: no cut-off numbers`, !r.clipped.length, r.clipped.join(" | "));
  ok(`${label}: nothing off screen`, !r.offscreen.length, r.offscreen.join(", "));
}

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 14"], colorScheme: "light" });
  await ctx.addInitScript(pinClock);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  const shot = (n, full) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: !!full });
  const tap = async (sel) => { await p.locator(sel).first().click(); await p.waitForTimeout(250); };
  const act = (name, extra = "") => tap(`[data-act="${name}"]${extra}`);
  const appText = () => p.locator("#app").innerText();

  await p.goto(BASE); await p.waitForTimeout(600);
  await shot("01-signin");
  ok("sign-in screen shows", (await appText()).includes("safe to spend"));
  await layoutCheck(p, "sign-in");

  // ---- demo + onboarding ----
  await act("demo"); await p.waitForTimeout(400);
  ok("onboarding shows after first sign-in", (await appText()).includes("Your accounts"));
  // turn on Cash App and PayPal
  await p.locator('[data-inp="onbOn"][data-i="1"]').check(); await p.waitForTimeout(150);
  await p.locator('[data-inp="onbOn"][data-i="2"]').check(); await p.waitForTimeout(150);
  await p.fill('[data-inp="onbBal"][data-i="0"]', "1250.00");
  await p.fill('[data-inp="onbBal"][data-i="1"]', "40");
  await p.setInputFiles('[data-inp="onbFile"]', BACKUP); await p.waitForTimeout(300);
  ok("backup file recognized", (await appText()).includes(`Ready to import ${NBACK} entries`));
  await shot("02-onboarding", true);
  await layoutCheck(p, "onboarding");
  await act("onbDone"); await p.waitForTimeout(700);
  const st = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem("pocket-demo-v1")); return { tx: Object.keys(d.tx).length, acc: Object.values(d.accounts).map((a) => a.name), cats: Object.keys(d.categories).length, onboarded: d.settings.onboarded }; });
  ok("imported all backup transactions", st.tx === NBACK, st.tx);
  ok("created 3 accounts", st.acc.length === 3, st.acc.join(","));
  ok("default categories created", st.cats >= 21, st.cats);
  ok("onboarding marked done", st.onboarded === true);

  // ---- home ----
  let t = await appText();
  ok("home shows Safe to spend", t.includes("Safe to spend"));
  ok("Main bank balance today matches what was typed ($1,250.00)", t.includes("$1,250.00"), t.slice(0, 400));
  ok("Cash App balance $40.00", t.includes("$40.00"));
  await shot("03-home");
  await shot("03b-home-full", true);
  await layoutCheck(p, "home");

  // ---- paycheck planner: WCM semimonthly ----
  await act("goPlan", '[data-v="budgets"]');
  await act("planSeg", '[data-v="pay"]');
  await act("editJob");
  await p.fill("#jName", "West Coast Magnetics");
  await p.fill("#jRate", "23"); await p.fill("#jHours", "40"); await p.fill("#jTax", "23");
  await p.selectOption("#fFreq", "semimonthly"); await p.waitForTimeout(150);
  await p.fill("#fStart", "2026-10-13");
  t = await p.locator("#jEst").innerText();
  ok("planner estimate shows $1,534.87 per check", t.includes("$1,534.87"), t);
  await shot("04-job-sheet");
  await layoutCheck(p, "job sheet");
  await act("saveJob"); await p.waitForTimeout(300);
  // Target biweekly fixed into Cash App
  await act("editJob");
  await p.fill("#jName", "Target");
  await act("segPick", '[data-v="fixed"]');
  { const on = await p.locator('#sheet [data-seg="payType"] button.on').allInnerTexts(); ok("Same-each-check switch highlights", on.length === 1 && on[0] === "Same each check", on.join(",")); }
  await p.fill("#jFixed", "287.50");
  await p.selectOption("#fFreq", "biweekly"); await p.waitForTimeout(100);
  await p.fill("#fStart", "2026-10-16");
  await tap('[data-act="pickAcc"]:has-text("Cash App")');
  await act("saveJob"); await p.waitForTimeout(300);
  t = await appText();
  ok("paycheck page lists both jobs", t.includes("West Coast Magnetics") && t.includes("Target"));
  ok("WCM Oct 30 payday shown (Oct 31 is a Saturday)", t.includes("Fri, Oct 30") || t.includes("Oct 30"), t.slice(0, 900));
  await shot("05-paychecks", true);
  await layoutCheck(p, "paychecks");

  // ---- bills: car payment weekly Monday ----
  await act("planSeg", '[data-v="bills"]');
  await act("editRule");
  await p.fill("#fAmt", "201"); await p.fill("#fLabel", "Car payment");
  await tap('[data-act="pickCat"][data-v="car"]');
  await p.selectOption("#fFreq", "weekly"); await p.waitForTimeout(100);
  await p.selectOption("#fWeekday", "1");
  await p.fill("#fStart", "2026-10-13");
  await shot("06-rule-sheet");
  await layoutCheck(p, "rule sheet");
  await act("saveRule"); await p.waitForTimeout(300);
  // a subscription
  await act("editRule");
  await p.fill("#fAmt", "15.49"); await p.fill("#fLabel", "Netflix");
  await act("segPick", '[data-v="subscription"]');
  { const on = await p.locator('#sheet [data-seg="rkind"] button.on').allInnerTexts(); ok("Subscription switch highlights", on.length === 1 && on[0] === "Subscription", on.join(",")); }
  await tap('[data-act="pickCat"][data-v="sub"]');
  await p.fill("#fMd", "20"); await p.fill("#fStart", "2026-10-13");
  await act("saveRule"); await p.waitForTimeout(300);
  t = await appText();
  ok("bills list shows car payment + subscription", t.includes("Car payment") && t.includes("Netflix") && t.includes("Subscriptions"));
  ok("subscription yearly cost nudge", t.includes("a year"));
  await shot("07-bills", true);
  await layoutCheck(p, "bills");

  // ---- budgets ----
  await act("planSeg", '[data-v="budgets"]');
  await act("editBudgets");
  await p.fill('[data-bud="food"]', "300"); await p.fill('[data-bud="gas"]', "160"); await p.fill('[data-bud="misc"]', "250");
  await layoutCheck(p, "budget sheet");
  await act("saveBudgets"); await p.waitForTimeout(300);
  t = await appText();
  ok("budgets show", t.includes("Food & dining") && t.includes("Gas") && t.includes("budget"));
  await shot("08-budgets", true);

  // ---- goal ----
  await act("planSeg", '[data-v="goals"]');
  await act("editGoal");
  await p.fill("#gName", "Emergency fund"); await p.fill("#gTarget", "50000"); await p.fill("#gMonthly", "1000"); await p.fill("#gSaved", "2500"); await p.fill("#gApy", "3.4"); await p.fill("#gDate", "2029-12-31");
  await act("saveGoal"); await p.waitForTimeout(300);
  await act("goalAdd"); await p.fill("#gaAmt", "250"); await act("saveGoalAdd"); await p.waitForTimeout(300);
  t = await appText();
  ok("goal saved with $2,750 after adding $250", t.includes("$2,750.00"), t.slice(0, 600));
  ok("goal shows needed per month", t.includes("Needed per month"));
  await shot("09-goals", true);
  await layoutCheck(p, "goals");

  // ---- debt ----
  await act("planSeg", '[data-v="debts"]');
  await act("editDebt");
  await p.fill("#dName", "Car loan"); await p.fill("#dBal", "12000"); await p.fill("#dApr", "7.9"); await p.fill("#dPay", "201"); await p.selectOption("#dFreq", "weekly"); await p.fill("#dMin", "640");
  await act("saveDebt"); await p.waitForTimeout(300);
  t = await appText();
  ok("debt shows payoff date and interest saved", t.includes("Paid off") && t.includes("Saved vs. minimum"), t.slice(0, 700));
  await p.locator('[data-inp="debtExtra"]').fill("50"); await p.waitForTimeout(300);
  ok("extra payment what-if updates", (await appText()).includes("+$50 each payment"));
  await shot("10-debts", true);
  await layoutCheck(p, "debts");

  // ---- add expense via + with auto category ----
  await act("tab", '[data-v="home"]');
  await tap(".tbadd");
  ok("add sheet opened", await p.locator("#sheet.open").count() === 1);
  await p.fill("#fAmt", "42.18"); await p.fill("#fLabel", "capital one"); await p.dispatchEvent("#fLabel", "input"); await p.waitForTimeout(150);
  const autoCat = await p.locator('[data-grid="cat"] button.on').getAttribute("data-v").catch(() => null);
  ok("label 'capital one' auto-picked its usual category", autoCat === "misc", autoCat);
  await shot("11-add-sheet");
  await layoutCheck(p, "add sheet");
  await act("saveTx"); await p.waitForTimeout(400);
  t = await appText();
  ok("home balance dropped by $42.18 → $1,207.82", t.includes("$1,207.82"), t.slice(0, 500));

  // ---- every switch moves its highlight (regression: tab stayed on "Expense") ----
  const onText = (sel) => p.locator(sel + " button.on").allInnerTexts();
  await tap(".tbadd");
  for (const [v, label] of [["income", "Income"], ["transfer", "Transfer"], ["expense", "Expense"], ["transfer", "Transfer"]]) {
    await act("segPick", `[data-seg="type"][data-v="${v}"]`);
    const on = await onText('#sheet [data-seg="type"]');
    ok(`tapping ${label} highlights ${label} only`, on.length === 1 && on[0] === label, on.join(","));
  }
  ok("transfer hides categories and shows To account", (await p.locator("#fCatWrap .catgrid").count()) === 0 && (await p.locator('[data-grid="toAccountId"]').count()) === 1);
  await act("closeSheet");

  // ---- add a brand-new category from inside the add screen ----
  await tap(".tbadd");
  ok("category grid has a + New tile", (await p.locator("#fCatWrap .newcat").count()) === 1);
  await act("newCatOpen");
  ok("new-category box opens", await p.locator("#ncName").isVisible());
  await layoutCheck(p, "new category box");
  await p.fill("#ncName", "Coffee");
  await act("ncEmoji", '[data-v="☕"]');
  const emo = await onText('[data-grid="ncEmoji"]');
  ok("icon pick highlights only that icon", emo.length === 1 && emo[0] === "☕", emo.join(","));
  await act("newCatSave"); await p.waitForTimeout(300);
  const sel = await p.locator('#fCatWrap [data-grid="cat"] button.on').innerText().catch(() => "");
  ok("new category is created and selected", sel.includes("Coffee"), sel);
  ok("new-category box closes after adding", (await p.locator("#ncName").count()) === 0);
  await p.fill("#fAmt", "5.25"); await p.fill("#fLabel", "Latte");
  await act("saveTx"); await p.waitForTimeout(300);
  const saved = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem("pocket-demo-v1")); const c = Object.entries(d.categories).find(([, v]) => v.name === "Coffee"); const t = Object.values(d.tx).find((x) => x.label === "Latte"); return { cat: c && c[1], catId: c && c[0], tx: t }; });
  ok("Coffee saved as a spending category with its icon", saved.cat && saved.cat.kind === "expense" && saved.cat.emoji === "☕", JSON.stringify(saved.cat));
  ok("Latte saved under Coffee", saved.tx && saved.tx.categoryId === saved.catId, JSON.stringify(saved.tx));
  // duplicate name just selects the existing one
  await tap(".tbadd"); await act("newCatOpen"); await p.fill("#ncName", "coffee"); await act("newCatSave"); await p.waitForTimeout(250);
  const nCoffee = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem("pocket-demo-v1")).categories).filter((c) => c.name.toLowerCase() === "coffee").length);
  ok("adding a duplicate name doesn't create a second one", nCoffee === 1, nCoffee);
  // income side gets its own + New, and creates an income category
  await act("segPick", '[data-seg="type"][data-v="income"]');
  await act("newCatOpen"); await p.fill("#ncName", "Tips"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  const tips = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem("pocket-demo-v1")).categories).find((c) => c.name === "Tips"));
  ok("Enter key adds an income category from the Income tab", tips && tips.kind === "income", JSON.stringify(tips));
  await act("closeSheet");

  // ---- transfer bank → Cash App ----
  await tap(".tbadd");
  await act("segPick", '[data-v="transfer"]');
  await p.fill("#fAmt", "100");
  await tap('[data-grid="toAccountId"] button:has-text("Cash App")');
  await act("saveTx"); await p.waitForTimeout(400);
  t = await appText();
  ok("transfer: bank $1,102.57 and Cash App $140.00", t.includes("$1,102.57") && t.includes("$140.00"), t.slice(0, 500));

  // ---- edit + delete + undo ----
  await act("tab", '[data-v="activity"]');
  await tap('.item:has-text("capital one")');
  await p.fill("#fAmt", "50"); await act("saveTx"); await p.waitForTimeout(300);
  ok("edit changed amount to $50", (await appText()).includes("$50.00"));
  const nBefore = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("pocket-demo-v1")).tx).length);
  p.once("dialog", (d) => d.accept());
  await tap('.item:has-text("capital one") >> nth=0');
  await act("delTx"); await p.waitForTimeout(300);
  const nAfter = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("pocket-demo-v1")).tx).length);
  ok("delete removes it", nAfter === nBefore - 1, nBefore + "→" + nAfter);
  await act("toastAct"); await p.waitForTimeout(300);
  const nUndo = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("pocket-demo-v1")).tx).length);
  ok("undo brings it back", nUndo === nBefore, nUndo);

  // ---- search keeps the same input element (iPhone keyboard stays open) ----
  const inputHandle = await p.$('[data-inp="q"]');
  await p.focus('[data-inp="q"]'); await p.keyboard.type("paypal", { delay: 30 }); await p.waitForTimeout(400);
  const same = await p.evaluate((el) => el.isConnected && document.activeElement === el, inputHandle);
  ok("search box keeps focus while typing", same);
  t = await appText();
  ok("search filters to PayPal items", t.includes("paypal") || t.includes("PayPal"));
  await shot("12-activity-search");
  await layoutCheck(p, "activity");
  await p.fill('[data-inp="q"]', ""); await p.dispatchEvent('[data-inp="q"]', "input"); await p.waitForTimeout(300);
  await shot("12b-activity", true);

  // ---- insights ----
  await act("actSeg", '[data-v="insights"]');
  t = await appText();
  ok("insights show charts", (await p.locator("#app svg").count()) >= 3 && t.includes("Where it went") && t.includes("Next 60 days"));
  await shot("13-insights", true);
  await layoutCheck(p, "insights");

  // ---- calendar + recurring occurrence ----
  await act("tab", '[data-v="calendar"]');
  t = await appText();
  ok("calendar opens on October 2026", t.includes("October 2026"));
  await shot("14-calendar");
  await layoutCheck(p, "calendar");
  await tap('[data-act="selDay"][data-v="2026-10-19"]');
  t = await appText();
  ok("Oct 19 shows the Monday car payment", t.includes("Car payment"));
  await tap('[data-act="openOcc"]:has-text("Car payment")');
  await p.fill("#oAmt", "400"); await act("occSave"); await p.waitForTimeout(300);
  ok("one-time change to $400 on Oct 19", (await appText()).includes("$400.00"));
  await tap('[data-act="openOcc"]:has-text("Car payment")');
  await act("occSkip"); await p.waitForTimeout(300);
  ok("skip removes just that occurrence", !(await p.locator('#app [data-act="openOcc"]:has-text("Car payment")').count()));
  await tap('[data-act="selDay"][data-v="2026-10-26"]');
  ok("next Monday still has it", (await appText()).includes("Car payment"));
  await act("month", '[data-v="1"]');
  ok("next month works", (await appText()).includes("November 2026"));
  await shot("15-calendar-nov", true);
  // account filter
  await tap('[data-act="calAcc"]:has-text("Cash App")');
  ok("calendar account filter", (await p.locator('[data-act="calAcc"].on').innerText()).includes("Cash App"));

  // ---- settings (opened from the profile picture on Home) ----
  await act("tab", '[data-v="home"]');
  await tap('.avatar[data-act="tab"]');
  t = await appText();
  ok("settings show accounts + categories", t.includes("Main bank") && t.includes("Categories & budgets"));
  await act("addUSHolidays"); await p.waitForTimeout(300);
  ok("US holidays added", (await appText()).includes("23 dates"));
  await shot("16-settings", true);
  await layoutCheck(p, "settings");
  await act("editAccount", '[data-id]'); await p.waitForTimeout(200);
  await layoutCheck(p, "account sheet");
  await act("closeSheet");
  await act("editCategory", '[data-id="food"]');
  await layoutCheck(p, "category sheet");
  await act("closeSheet");
  // export json works (download fallback path in desktop chromium)
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 3000 }).catch(() => null), act("exportJson")]);
  ok("backup download produced", !!dl);
  if (dl) { const path = await dl.path(); const j = JSON.parse((await import("node:fs")).readFileSync(path, "utf8")); ok("backup has all transactions", j.transactions.length === NBACK + 3, j.transactions.length); }

  // ---- theme dark ----
  await act("theme", '[data-v="dark"]'); await p.waitForTimeout(200);
  await act("tab", '[data-v="home"]');
  await shot("17-home-dark");
  await act("theme", '[data-v="auto"]').catch(() => {});

  // ---- style switch (iOS default ↔ Classic) ----
  const isIos = () => p.evaluate(() => document.documentElement.classList.contains("ios"));
  ok("iOS style is the default", await isIos());
  await tap('.avatar[data-act="tab"]');
  await act("style", '[data-v="classic"]'); await p.waitForTimeout(200);
  ok("Style → Classic removes iOS look", !(await isIos()));
  ok("Classic button highlighted", (await p.locator('[data-act="style"].on').innerText()).includes("Classic"));
  await layoutCheck(p, "settings classic");
  await p.reload(); await p.waitForTimeout(700);
  ok("Classic choice survives reload", !(await isIos()));
  await act("tab", '[data-v="home"]').catch(() => {});
  await tap('.avatar[data-act="tab"]');
  await act("style", '[data-v="ios"]'); await p.waitForTimeout(200);
  ok("Style → iOS restores it", await isIos());
  await act("tab", '[data-v="home"]');

  ok("no JavaScript errors", errors.length === 0, errors.join(" || "));
  await ctx.close();

  // ---- other phone sizes ----
  for (const dev of ["iPhone SE", "iPhone 14 Pro Max"]) {
    const c2 = await browser.newContext({ ...devices[dev], colorScheme: dev === "iPhone SE" ? "light" : "dark" });
    await c2.addInitScript(pinClock);
    const p2 = await c2.newPage();
    const e2 = []; p2.on("pageerror", (e) => e2.push(e.message));
    await p2.goto(BASE); await p2.waitForTimeout(400);
    await p2.locator('[data-act="demo"]').click(); await p2.waitForTimeout(300);
    await p2.locator('[data-inp="onbBal"][data-i="0"]').fill("1250");
    await p2.setInputFiles('[data-inp="onbFile"]', BACKUP); await p2.waitForTimeout(200);
    await p2.locator('[data-act="onbDone"]').click(); await p2.waitForTimeout(600);
    const tag = dev.replace(/ /g, "");
    await p2.screenshot({ path: `${OUT}/20-${tag}-home.png` });
    await layoutCheck(p2, dev + " home");
    for (const tab of ["calendar", "activity", "plan"]) {
      await p2.locator(`.tb[data-act="tab"][data-v="${tab}"]`).click(); await p2.waitForTimeout(250);
      await layoutCheck(p2, `${dev} ${tab}`);
      if (tab === "calendar") await p2.screenshot({ path: `${OUT}/21-${tag}-calendar.png` });
    }
    await p2.locator(".tbadd").click(); await p2.waitForTimeout(300);
    await layoutCheck(p2, dev + " add sheet");
    await p2.screenshot({ path: `${OUT}/22-${tag}-add.png` });
    ok(dev + ": no JS errors", e2.length === 0, e2.join(" | "));
    await c2.close();
  }
  await browser.close();
  console.log(results.join("\n"));
  console.log(`\n${results.length - failures} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
};
run().catch((e) => { console.log(results.join("\n")); console.error("CRASH:", e.message.split("\n").slice(0, 6).join("\n")); process.exit(2); });
