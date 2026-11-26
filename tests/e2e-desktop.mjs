// Desktop / MacBook tests: sidebar, detail pane, dialogs, keyboard shortcuts, right-click menus, data safety.
// Run: node tests/e2e-desktop.mjs   (site served at http://localhost:8765)
import { chromium } from "playwright";

const BASE = "http://localhost:8765/";
const BACKUP = new URL("./fixtures/sample-backup.json", import.meta.url).pathname;
const results = []; let failures = 0;
const ok = (n, c, x) => { results.push((c ? "  ok  " : "  FAIL") + " - " + n + (c || x === undefined ? "" : "  [" + x + "]")); if (!c) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pinClock = () => { const R = Date; const f = new R(2026, 9, 12, 18, 0, 0).getTime(); class D extends R { constructor(...a) { if (!a.length) super(f); else super(...a); } static now() { return f; } } window.Date = D; };

async function setup(browser, w, h, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: "light", ...opts });
  await ctx.addInitScript(pinClock);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await p.goto(BASE); await sleep(400);
  await p.click('[data-act="demo"]'); await sleep(400);
  await p.locator('[data-inp="onbOn"][data-i="1"]').check();
  await p.fill('[data-inp="onbBal"][data-i="0"]', "1250"); await p.fill('[data-inp="onbBal"][data-i="1"]', "40");
  await p.setInputFiles('[data-inp="onbFile"]', BACKUP); await sleep(300);
  await p.click('[data-act="onbDone"]'); await sleep(900);
  const S = () => p.evaluate(async () => { const m = await import("/js/app.js"); return { tab: m.__test.S.tab, form: m.__test.S.form && m.__test.S.form.kind, vm: m.__test.S.vm, lm: m.__test.S.lm }; });
  const db = () => p.evaluate(() => JSON.parse(localStorage.getItem("pocket-demo-v1")));
  const cls = () => p.evaluate(() => document.documentElement.className);
  return { ctx, p, errors, S, db, cls };
}
const MOD = "Control";   // Chromium on Linux: shortcuts use Ctrl (⌘ on a Mac)

process.on("uncaughtException", (e) => { console.log(results.join("\n")); console.log("CRASH:", e.message.split("\n")[0]); process.exit(1); });
const browser = await chromium.launch();

// ===================== MacBook-sized window: sidebar + content + detail pane =====================
{
  const T = await setup(browser, 1440, 900); const { p, S, db, cls } = T;
  ok("wide window uses the desktop layout with a detail pane", /\bdesk\b/.test(await cls()) && /\bpane\b/.test(await cls()) && /\bhas-main\b/.test(await cls()));
  ok("sidebar is shown", await p.locator("#sidebar").isVisible());
  ok("phone tab bar is hidden", !(await p.locator("#tabbar").isVisible()));
  ok("sidebar lists accounts with balances", (await p.locator("#sidebar").innerText()).includes("Main bank") && (await p.locator("#sidebar").innerText()).includes("$1,250"));
  const geo = await p.evaluate(() => { const sb = document.getElementById("sidebar").getBoundingClientRect(), sh = document.getElementById("sheet").getBoundingClientRect();
    const kids = [...document.querySelectorAll("#app > *")].map((k) => k.getBoundingClientRect()).filter((r) => r.width > 0);
    return { sbR: sb.right, shL: sh.left, minL: Math.min(...kids.map((r) => r.left)), maxR: Math.max(...kids.map((r) => r.right)), sw: document.documentElement.scrollWidth, vw: innerWidth }; });
  ok("content never sits under the sidebar or the pane", geo.minL >= geo.sbR && geo.maxR <= geo.shL, JSON.stringify(geo));
  ok("no sideways scrolling", geo.sw <= geo.vw, JSON.stringify(geo));
  ok("pane shows 'No Selection' when nothing is open", (await p.locator("#sheet").innerText()).includes("No Selection"));

  // sidebar navigation
  for (const [v, txt] of [["calendar", "October 2026"], ["activity", "Transactions"], ["plan", "Plan"], ["settings", "Settings"], ["home", "Safe to spend"]]) {
    await p.click(`#sidebar [data-act="tab"][data-v="${v}"]`); await sleep(450);
    ok(`sidebar → ${v}`, (await S()).tab === v && (await p.locator("#app").innerText()).includes(txt));
  }
  ok("selected sidebar item is highlighted", await p.locator('#sidebar .si.on[data-v="home"]').count() === 1);

  // toolbar New button → pane form, typing, Return saves, data stored
  const n0 = Object.keys((await db()).tx).length;
  await p.click("#app .tools .tbtn"); await sleep(500);
  ok("New opens the form in the detail pane (no dimmed overlay)", (await S()).form === "tx" && !(await p.locator("#scrim.open").count()) && (await p.locator("#sheet").innerText()).includes("Add transaction"));
  ok("amount field gets focus automatically", await p.evaluate(() => document.activeElement && document.activeElement.id === "fAmt"));
  ok("page stays scrollable while the pane is open", await p.evaluate(() => document.body.style.overflow !== "hidden"));
  await p.keyboard.type("12.34"); await p.fill("#fLabel", "Desk coffee"); await p.click('#sheet [data-act="pickCat"][data-v="food"]');
  await p.focus("#fLabel"); await p.keyboard.press("Enter"); await sleep(500);
  ok("Return saves the transaction", Object.values((await db()).tx).some((t) => t.label === "Desk coffee" && t.amount === 12.34) && Object.keys((await db()).tx).length === n0 + 1);
  ok("pane returns to 'No Selection' after saving", (await p.locator("#sheet").innerText()).includes("No Selection"));

  // click a row → details in pane, row highlighted; edit and save
  await p.click('#sidebar [data-v="activity"]'); await sleep(500);
  await p.click('#app .item[data-act="editTx"]:has-text("Desk coffee")'); await sleep(400);
  ok("clicking a transaction shows it in the pane", (await p.locator("#sheet").innerText()).includes("Edit transaction") && (await p.inputValue("#fLabel")) === "Desk coffee");
  ok("…and highlights that row", await p.locator('#app .item.selected:has-text("Desk coffee")').count() === 1);
  await p.fill("#fLabel", "Desk coffee (edited)"); await p.keyboard.press(`${MOD}+Enter`); await sleep(500);
  ok(`${MOD}+Enter saves edits`, Object.values((await db()).tx).some((t) => t.label === "Desk coffee (edited)"));
  await p.click('#app .item[data-act="editTx"]:has-text("Desk coffee")'); await sleep(300);
  await p.keyboard.press("Escape"); await sleep(300);
  ok("Esc closes the details", (await p.locator("#sheet").innerText()).includes("No Selection") && !(await p.locator("#app .item.selected").count()));

  // keyboard shortcuts
  await p.keyboard.press(`${MOD}+2`); await sleep(400); ok(`${MOD}+2 → Calendar`, (await S()).tab === "calendar");
  const vm = (await S()).vm;
  await p.keyboard.press("ArrowRight"); await sleep(400); ok("→ shows next month", (await S()).vm === vm + 1);
  await p.keyboard.press("ArrowLeft"); await sleep(400); ok("← goes back", (await S()).vm === vm);
  await p.keyboard.press(`${MOD}+4`); await sleep(400); ok(`${MOD}+4 → Plan`, (await S()).tab === "plan");
  await p.keyboard.press(`${MOD}+Comma`); await sleep(400); ok(`${MOD}+, → Settings`, (await S()).tab === "settings");
  ok("Settings shows keyboard shortcuts and install help", (await p.locator("#app").innerText()).includes("Keyboard shortcuts") && (await p.locator("#app").innerText()).includes("Install on this computer"));
  await p.keyboard.press(`${MOD}+f`); await sleep(500);
  ok(`${MOD}+F jumps to search`, (await S()).tab === "activity" && await p.evaluate(() => document.activeElement && document.activeElement.dataset.inp === "q"));
  await p.keyboard.type("coffee"); await sleep(500);
  ok("search filters while typing", (await p.locator("#listResults").innerText()).includes("Desk coffee"));
  await p.fill('[data-inp="q"]', ""); await sleep(400);
  await p.keyboard.press(`${MOD}+n`); await sleep(400);
  ok(`${MOD}+N opens a new transaction`, (await S()).form === "tx" && (await p.locator("#sheet").innerText()).includes("Add transaction"));
  await p.keyboard.press("Escape"); await sleep(300);

  // right-click menu: duplicate, delete, undo
  await p.click('#app .item[data-act="editTx"]:has-text("Desk coffee")', { button: "right" }); await sleep(250);
  ok("right-click shows a menu", await p.locator(".cmenu").isVisible() && (await p.locator(".cmenu").innerText()).includes("Duplicate"));
  const n1 = Object.keys((await db()).tx).length;
  await p.click('.cmenu button:has-text("Duplicate")'); await sleep(400);
  ok("Duplicate copies the transaction", Object.keys((await db()).tx).length === n1 + 1 && Object.values((await db()).tx).filter((t) => t.label === "Desk coffee (edited)").length === 2);
  await p.locator('#app .item[data-act="editTx"]:has-text("Desk coffee")').first().click({ button: "right" }); await sleep(250);
  await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter"); await sleep(400);
  ok("menu works with the keyboard (↓ ↓ ↓ Return = Delete)", Object.keys((await db()).tx).length === n1);
  await p.keyboard.press(`${MOD}+z`); await sleep(400);
  ok(`${MOD}+Z undoes the delete`, Object.keys((await db()).tx).length === n1 + 1);
  await p.click('#app .item[data-act="editTx"]', { button: "right" }); await sleep(200);
  await p.keyboard.press("Escape"); await sleep(150);
  ok("Esc closes the menu", !(await p.locator(".cmenu").count()));
  await p.click('#sidebar [data-act="openAcctActivity"]:has-text("Cash App")', { button: "right" }); await sleep(200);
  ok("right-click an account in the sidebar", (await p.locator(".cmenu").innerText()).includes("Show Activity"));
  await p.click('.cmenu button:has-text("Show Activity")'); await sleep(400);
  ok("…Show Activity filters to that account", (await S()).tab === "activity" && (await p.locator('[data-inp="fAcc"]').inputValue()) !== "");
  await p.click('#app input[data-inp="q"]', { button: "right" }); await sleep(150);
  ok("text fields keep the normal copy/paste menu", !(await p.locator(".cmenu").count()));

  // hover feedback exists
  const hover = await p.evaluate(() => [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.media && /hover/.test(r.media.mediaText)); } catch (e) { return false; } }));
  ok("hover effects are defined for mouse users", hover);

  // resize: pane ↔ dialog, nothing lost
  await p.click('#sidebar [data-v="home"]'); await sleep(300);
  await p.keyboard.press(`${MOD}+n`); await sleep(300); await p.fill("#fAmt", "7"); await p.fill("#fLabel", "Kept while resizing");
  await p.setViewportSize({ width: 1000, height: 800 }); await sleep(400);
  ok("narrower window: open form becomes a centered dialog", !/\bpane\b/.test(await cls()) && await p.locator("#scrim.open").count() === 1 && (await p.inputValue("#fLabel")) === "Kept while resizing");
  await p.setViewportSize({ width: 1440, height: 900 }); await sleep(400);
  ok("wider again: back in the pane, typing kept", /\bpane\b/.test(await cls()) && !(await p.locator("#scrim.open").count()) && (await p.inputValue("#fLabel")) === "Kept while resizing");
  await p.keyboard.press("Escape"); await sleep(200);

  // data persists across reload
  await p.reload(); await sleep(900);
  ok("everything is still there after reloading", Object.values((await db()).tx).some((t) => t.label === "Desk coffee (edited)") && (await p.locator("#sidebar").innerText()).includes("Main bank"));
  ok("desktop: no JavaScript errors", T.errors.length === 0, T.errors.join(" | "));
  await T.ctx.close();
}

// ===================== laptop / iPad-landscape size: sidebar + dialogs =====================
{
  const T = await setup(browser, 1024, 768); const { p, S, cls } = T;
  ok("1024px: sidebar layout without a pane", /\bdesk\b/.test(await cls()) && !/\bpane\b/.test(await cls()) && await p.locator("#sidebar").isVisible());
  await p.click('#app .item[data-act="editTx"], #app .item[data-act="openOcc"]'); await sleep(500);
  const box = await p.locator("#sheet").boundingBox();
  ok("forms open as a centered dialog", box && Math.abs(box.x + box.width / 2 - 512) < 4 && Math.abs(box.y + box.height / 2 - 384) < 12, JSON.stringify(box));
  ok("dialog dims the window behind it", await p.locator("#scrim.open").count() === 1);
  await p.click("#scrim", { position: { x: 20, y: 20 } }); await sleep(400);
  ok("clicking outside closes the dialog", !(await p.locator("#sheet.open").count()));
  ok("1024: no JavaScript errors", T.errors.length === 0, T.errors.join(" | "));
  await T.ctx.close();
}

// ===================== dark mode + classic style on desktop =====================
{
  const T = await setup(browser, 1440, 900, { colorScheme: "dark" }); const { p, cls } = T;
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok("dark mode uses a dark Mac window color", bg === "rgb(30, 30, 32)", bg);
  await p.evaluate(() => localStorage.setItem("pocket.style", JSON.stringify("classic"))); await p.reload(); await sleep(900);
  ok("Classic style also gets the sidebar layout", !/\bios\b/.test(await cls()) && await p.locator("#sidebar").isVisible());
  ok("dark/classic: no JavaScript errors", T.errors.length === 0, T.errors.join(" | "));
  await T.ctx.close();
}

// ===================== phone stays a phone =====================
{
  const T = await setup(browser, 390, 844, { isMobile: true, hasTouch: true, deviceScaleFactor: 3 }); const { p, cls } = T;
  ok("iPhone size: no desktop layout", !/\bdesk\b/.test(await cls()) && !(await p.locator("#sidebar").isVisible()) && await p.locator("#tabbar").isVisible());
  await T.ctx.close();
}

// ===================== installable =====================
{
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  const r = await p.goto(BASE + "manifest.webmanifest"); const m = await r.json();
  ok("manifest: opens in its own window", m.display === "standalone" && !!m.id && !m.orientation);
  ok("manifest: 'New transaction' app shortcut", (m.shortcuts || []).some((s) => /new=1/.test(s.url)));
  await p.goto(BASE + "sw.js"); const sw = await p.locator("body").innerText();
  ok("offline cache includes the desktop files", sw.includes("css/desktop.css") && sw.includes("js/desktop.js"));
  await ctx.close();
}

await browser.close();
console.log(results.join("\n")); console.log(`\n${results.length - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
