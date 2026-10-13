// Runs the real app + real store.js FirebaseStore code against an in-memory Firebase stand-in.
// Run: node tests/e2e-firebase.mjs   (site served at http://localhost:8765)
import { chromium, devices } from "playwright";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8765/";
const MOCK = new URL("./firebase-mock/", import.meta.url).pathname;
const BACKUP = new URL("./fixtures/sample-backup.json", import.meta.url).pathname;
const NBACK = JSON.parse((await import("node:fs")).readFileSync(BACKUP, "utf8")).entries.length;
const results = []; let failures = 0;
const ok = (n, c, x) => { results.push((c ? "  ok  " : "  FAIL") + " - " + n + (c || x === undefined ? "" : "  [" + x + "]")); if (!c) failures++; };
const pinClock = () => { const R = Date; const f = new R(2026, 9, 12, 18, 0, 0).getTime(); class D extends R { constructor(...a) { if (!a.length) super(f); else super(...a); } static now() { return f; } } window.Date = D; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 14"] });
await ctx.addInitScript(pinClock);
await ctx.route("https://www.gstatic.com/firebasejs/13.0.0/*", (route) => {
  const name = route.request().url().split("/").pop();
  route.fulfill({ status: 200, contentType: "text/javascript", body: readFileSync(MOCK + name, "utf8") });
});
await ctx.route("**/js/firebase-config.js", (route) => route.fulfill({ status: 200, contentType: "text/javascript",
  body: `export const firebaseConfig = { apiKey: "AIzaTEST", authDomain: "pocket-test.firebaseapp.com", projectId: "pocket-test", storageBucket: "", messagingSenderId: "1", appId: "1:1:web:1" };` }));
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const tap = async (s) => { await p.locator(s).first().click(); await p.waitForTimeout(250); };
const act = (n, extra = "") => tap(`[data-act="${n}"]${extra}`);
const text = () => p.locator("#app").innerText();
const fs = () => p.evaluate(() => Object.fromEntries([...globalThis.__fsStore.entries()]));
const U = "users/u_test_ramiro";

await p.goto(BASE); await p.waitForTimeout(700);
ok("Google button shown when Firebase is configured", await p.locator('[data-act="signin"]').count() === 1);
ok("Firebase initialized with the config", await p.evaluate(() => globalThis.__fbConfig && globalThis.__fbConfig.projectId) === "pocket-test");
await act("signin"); await p.waitForTimeout(600);
ok("signed in → onboarding greets by first name", (await text()).includes("Welcome, Ramiro"), (await text()).slice(0, 80));

await p.locator('[data-inp="onbOn"][data-i="1"]').check(); await p.waitForTimeout(150);
await p.fill('[data-inp="onbBal"][data-i="0"]', "1250");
await p.fill('[data-inp="onbBal"][data-i="1"]', "40");
await p.setInputFiles('[data-inp="onbFile"]', BACKUP); await p.waitForTimeout(300);
await act("onbDone"); await p.waitForTimeout(900);
let db = await fs();
const monthDocs = Object.keys(db).filter((k) => k.startsWith(U + "/months/"));
const txCount = monthDocs.reduce((s, k) => s + Object.keys(db[k].tx || {}).length, 0);
ok("all imported transactions stored", txCount === NBACK, txCount);
ok("stored as one document per month (few reads)", monthDocs.length <= 7, monthDocs.join(","));
ok("2 accounts stored", Object.keys(db).filter((k) => k.startsWith(U + "/accounts/")).length === 2);
ok("categories stored", Object.keys(db).filter((k) => k.startsWith(U + "/categories/")).length >= 21);
ok("settings.onboarded saved on user doc", db[U] && db[U].settings && db[U].settings.onboarded === true);
ok("Google profile saved", db[U] && db[U].profile && db[U].profile.name === "Ramiro Herrera");
ok("nothing stored outside the user's folder", Object.keys(db).every((k) => k === U || k.startsWith(U + "/")));
let t = await text();
ok("home shows Main bank $1,250.00 (balance today)", t.includes("$1,250.00"));

// add, then move to another month
await tap(".tbadd");
await p.fill("#fAmt", "10"); await p.fill("#fLabel", "Coffee");
await tap('[data-act="pickCat"][data-v="food"]');
await act("saveTx"); await p.waitForTimeout(400);
db = await fs();
let coffee = Object.entries(db[U + "/months/2026-10"].tx).find(([, v]) => v.label === "Coffee");
ok("new transaction saved in October document", !!coffee);
const coffeeId = coffee && coffee[0];
await act("tab", '[data-v="activity"]');
await tap('.item:has-text("Coffee")');
await p.fill("#fDate", "2026-11-02"); await act("saveTx"); await p.waitForTimeout(400);
db = await fs();
ok("editing the date removed it from October", !db[U + "/months/2026-10"].tx[coffeeId]);
ok("…and put it in November", !!(db[U + "/months/2026-11"] && db[U + "/months/2026-11"].tx[coffeeId]));

// transfer → expense must not leave a stale toAccountId
await tap(".tbadd");
await act("segPick", '[data-v="transfer"]');
await p.fill("#fAmt", "25");
await tap('[data-grid="toAccountId"] button:has-text("Cash App")');
await act("saveTx"); await p.waitForTimeout(400);
db = await fs();
let xf = Object.entries(db[U + "/months/2026-10"].tx).find(([, v]) => v.type === "transfer" && v.amount === 25);
ok("transfer saved with a destination", xf && xf[1].toAccountId);
await tap('.item:has-text("Transfer to Cash App")');
await act("segPick", '[data-v="expense"]');
await tap('[data-act="pickCat"][data-v="shop"]');
await act("saveTx"); await p.waitForTimeout(400);
db = await fs();
const xf2 = db[U + "/months/2026-10"].tx[xf[0]];
ok("transfer→expense: type updated", xf2.type === "expense", JSON.stringify(xf2));
ok("transfer→expense: no leftover toAccountId", xf2.toAccountId === null, JSON.stringify(xf2));

// delete + undo
const before = Object.keys((await fs())[U + "/months/2026-10"].tx).length;
p.once("dialog", (d) => d.accept());
await tap('.item:has-text("Transfer to Cash App")');
await act("delTx"); await p.waitForTimeout(300);
ok("delete removes it from Firestore", Object.keys((await fs())[U + "/months/2026-10"].tx).length === before - 1);
await act("toastAct"); await p.waitForTimeout(400);
ok("undo restores it", Object.keys((await fs())[U + "/months/2026-10"].tx).length === before);

// rules, budgets, goals, debts, holidays
await act("goPlan".replace("goPlan", "tab"), '[data-v="plan"]');
await act("planSeg", '[data-v="bills"]'); await act("editRule");
await p.fill("#fAmt", "201"); await p.fill("#fLabel", "Car payment"); await tap('[data-act="pickCat"][data-v="car"]');
await p.selectOption("#fFreq", "weekly"); await p.waitForTimeout(100); await p.selectOption("#fWeekday", "1");
await act("saveRule"); await p.waitForTimeout(300);
await act("planSeg", '[data-v="budgets"]'); await act("editBudgets"); await p.fill('[data-bud="food"]', "300"); await act("saveBudgets"); await p.waitForTimeout(300);
await act("planSeg", '[data-v="goals"]'); await act("editGoal"); await p.fill("#gName", "Emergency fund"); await p.fill("#gTarget", "50000"); await act("saveGoal"); await p.waitForTimeout(300);
await act("planSeg", '[data-v="debts"]'); await act("editDebt"); await p.fill("#dName", "Car loan"); await p.fill("#dBal", "12000"); await p.fill("#dPay", "201"); await act("saveDebt"); await p.waitForTimeout(300);
db = await fs();
const has = (c) => Object.keys(db).some((k) => k.startsWith(U + "/" + c + "/"));
ok("rule, goal, debt saved", has("rules") && has("goals") && has("debts"));
ok("budget saved on category", db[U + "/categories/food"].budget === 300);
// occurrence skip writes into the rule
await act("tab", '[data-v="calendar"]');
await tap('[data-act="selDay"][data-v="2026-10-19"]');
await tap('[data-act="openOcc"]:has-text("Car payment")'); await act("occSkip"); await p.waitForTimeout(300);
db = await fs();
const rule = Object.entries(db).find(([k, v]) => k.startsWith(U + "/rules/") && v.label === "Car payment")[1];
ok("skip stored on the rule", (rule.skips || []).includes("2026-10-19"), JSON.stringify(rule.skips));

// sign out / back in keeps data
await act("tab", '[data-v="home"]'); await tap('.avatar[data-act="tab"]');
p.once("dialog", (d) => d.accept());
await act("signout"); await p.waitForTimeout(500);
ok("signed out → sign-in screen", await p.locator('[data-act="signin"]').count() === 1);
await act("signin"); await p.waitForTimeout(800);
t = await text();
ok("signing back in loads the same data", t.includes("Safe to spend") && t.includes("Main bank"), t.slice(0, 200));

// delete everything
await tap('.avatar[data-act="tab"]');
let nd = 0; const dh = (d) => { nd++; d.accept(nd === 1 ? undefined : "DELETE"); };
p.on("dialog", dh);
await act("deleteAll"); await p.waitForTimeout(700);
p.off("dialog", dh);
db = await fs();
ok("delete everything wipes the user's folder", !Object.keys(db).some((k) => k === U || k.startsWith(U + "/")), Object.keys(db).slice(0, 5).join(","));
ok("back to onboarding after wipe", (await text()).includes("Your accounts"));

ok("no JavaScript errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log(results.join("\n")); console.log(`\n${results.length - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
