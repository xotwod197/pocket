import test from "node:test";
import assert from "node:assert/strict";
import * as F from "../public/js/finance.js";
import { readFileSync, existsSync } from "node:fs";

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.006, `${msg || ""} expected ${b}, got ${a}`);

test("date helpers", () => {
  assert.equal(F.weekday("2026-10-12"), 1); // Monday
  assert.equal(F.weekday("2026-11-14"), 6); // Saturday
  assert.equal(F.addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(F.addDays("2028-02-28", 1), "2028-02-29"); // leap year
  assert.equal(F.daysInMonth(2026, 2), 28);
  assert.equal(F.addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(F.addMonths("2026-11-15", 3), "2027-02-15");
  // DST weekend in the US (Mar 8 2026, Nov 1 2026) must not skip or repeat a day
  assert.equal(F.addDays("2026-03-07", 2), "2026-03-09");
  assert.equal(F.addDays("2026-10-31", 2), "2026-11-02");
});

test("weekly rule on Mondays", () => {
  const r = { id: "car", amount: 201, type: "expense", freq: "weekly", weekday: 1, startDate: "2026-09-01" };
  const d = F.expandRule(r, "2026-09-01", "2026-09-30").map((x) => x.date);
  assert.deepEqual(d, ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
});

test("biweekly Target paychecks anchored May 1", () => {
  const r = { id: "tgt", amount: 287.5, type: "income", freq: "biweekly", startDate: "2026-05-01" };
  const d = F.expandRule(r, "2026-05-01", "2026-06-30").map((x) => x.date);
  assert.deepEqual(d, ["2026-05-01", "2026-05-15", "2026-05-29", "2026-06-12", "2026-06-26"]);
  // window starting mid-cycle still aligns to the anchor
  assert.deepEqual(F.expandRule(r, "2026-10-01", "2026-10-31").map((x) => x.date), ["2026-10-02", "2026-10-16", "2026-10-30"]);
});

test("WCM semimonthly: 15th and last day, moved to prior business day", () => {
  const hol = new Set(["2026-12-25"]);
  const r = { id: "wcm", amount: 1650, type: "income", freq: "semimonthly", monthDays: [15, 31], shift: "before", startDate: "2026-01-01" };
  const d = F.expandRule(r, "2026-08-01", "2026-12-31", hol).map((x) => x.date);
  // matches the 2026 WCM payroll sheet: Aug 14 (Fri), Aug 31, Sep 15, Sep 30, Oct 15, Oct 30 (Fri), Nov 13 (Fri), Nov 30, Dec 15, Dec 31
  assert.deepEqual(d, ["2026-08-14", "2026-08-31", "2026-09-15", "2026-09-30", "2026-10-15", "2026-10-30", "2026-11-13", "2026-11-30", "2026-12-15", "2026-12-31"]);
});

test("shift across window edge is caught", () => {
  // Nov 1 2026 is a Sunday; with shift 'before' it lands on Fri Oct 30
  const r = { id: "x", amount: 10, type: "expense", freq: "monthly", monthDay: 1, shift: "before", startDate: "2026-01-01" };
  assert.deepEqual(F.expandRule(r, "2026-10-25", "2026-10-31").map((x) => x.date), ["2026-10-30"]);
  assert.deepEqual(F.expandRule(r, "2026-11-01", "2026-11-05").map((x) => x.date), []);
});

test("monthly day 31 clamps to short months; yearly", () => {
  const r = { id: "m", amount: 5, type: "expense", freq: "monthly", monthDay: 31, startDate: "2026-01-01" };
  assert.deepEqual(F.expandRule(r, "2026-01-01", "2026-04-30").map((x) => x.date), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  const y = { id: "y", amount: 99, type: "expense", freq: "yearly", startDate: "2026-03-10" };
  assert.deepEqual(F.expandRule(y, "2026-01-01", "2028-12-31").map((x) => x.date), ["2026-03-10", "2027-03-10", "2028-03-10"]);
});

test("skips, overrides, end date", () => {
  const r = { id: "car", amount: 201, type: "expense", freq: "weekly", weekday: 1, startDate: "2026-09-01", endDate: "2026-09-22",
    skips: ["2026-09-07"], overrides: { "2026-09-14": { amount: 400, date: "2026-09-15" } } };
  const o = F.expandRule(r, "2026-09-01", "2026-09-30");
  assert.deepEqual(o.map((x) => [x.date, x.amount]), [["2026-09-15", 400], ["2026-09-21", 201]]);
});

test("transfers move money between accounts but not out of the total", () => {
  const state = {
    accounts: [{ id: "bank", startingBalance: 1000 }, { id: "ca", startingBalance: 0 }],
    transactions: [
      { id: "1", date: "2026-09-01", type: "transfer", amount: 200, accountId: "bank", toAccountId: "ca" },
      { id: "2", date: "2026-09-02", type: "expense", amount: 50, accountId: "ca" }
    ], rules: []
  };
  near(F.balanceAsOf(state, new Set(["bank"]), "2026-09-02"), 800, "bank");
  near(F.balanceAsOf(state, new Set(["ca"]), "2026-09-02"), 150, "cash app");
  near(F.balanceAsOf(state, null, "2026-09-02"), 950, "total");
  const s = F.summarize(F.buildItems(state, "2026-09-01", "2026-09-30"), null);
  assert.equal(s.expense, 50); assert.equal(s.income, 0); // transfer isn't spending
});

test("sample backup imports and balances add up", () => {
  const backup = JSON.parse(readFileSync(new URL("./fixtures/sample-backup.json", import.meta.url)));
  const tx = F.mapLegacyBackup(backup, { mainAccountId: "bank" }).map((t, i) => ({ id: "t" + i, ...t }));
  const state = { accounts: [{ id: "bank", startingBalance: 0 }], transactions: tx, rules: [] };
  assert.equal(tx.length, backup.entries.length);
  const expected = backup.entries.reduce((s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0);
  const last = backup.entries.map((e) => e.date).sort().pop();
  near(F.balanceAsOf(state, new Set(["bank"]), last), F.round2(expected), "final balance");
  const s = F.balanceSeries(state, new Set(["bank"]), "2026-09-01", "2026-09-05");
  near(s["2026-09-03"], s["2026-09-02"] + F.summarize(F.buildItems(state, "2026-09-03", "2026-09-03"), null).net, "day-to-day carry");
});

// Runs only on your own computer if you put your real backup at tests/fixtures/private-backup.json (never committed).
const PRIVATE = new URL("./fixtures/private-backup.json", import.meta.url);
test("private backup reproduces the verified balances", { skip: !existsSync(PRIVATE) && "no private backup present" }, () => {
  const backup = JSON.parse(readFileSync(PRIVATE));
  const tx = F.mapLegacyBackup(backup, { mainAccountId: "bank" }).map((t, i) => ({ id: "t" + i, ...t }));
  const state = { accounts: [{ id: "bank", startingBalance: 0 }], transactions: tx, rules: [] };
  const s = F.balanceSeries(state, new Set(["bank"]), "2026-08-31", "2027-02-01");
  near(s["2026-08-31"], 1449, "Aug 31");
  near(s["2027-02-01"], 1033.27, "Feb 1 (matches CSV backup)");
});

test("budgets split spent vs scheduled", () => {
  const state = {
    accounts: [{ id: "b", startingBalance: 0 }],
    categories: [{ id: "food", name: "Food", budget: 300 }, { id: "gas", name: "Gas", budget: 100 }],
    transactions: [{ id: "1", date: "2026-10-05", type: "expense", amount: 120, categoryId: "food", accountId: "b" },
                   { id: "2", date: "2026-10-20", type: "expense", amount: 200, categoryId: "food", accountId: "b" }],
    rules: [{ id: "g", type: "expense", amount: 40, categoryId: "gas", accountId: "b", freq: "weekly", weekday: 5, startDate: "2026-10-01" }]
  };
  const b = F.budgetStatus(state, 2026, 10, "2026-10-12");
  const food = b.find((x) => x.categoryId === "food"), gas = b.find((x) => x.categoryId === "gas");
  assert.equal(food.spent, 120); assert.equal(food.scheduled, 200); assert.equal(food.status, "over"); assert.equal(food.remaining, -20);
  assert.equal(gas.spent, 80); assert.equal(gas.scheduled, 120); assert.equal(gas.status, "over"); // 5 Fridays in Oct 2026
});

test("safe to spend until next payday", () => {
  const state = {
    accounts: [{ id: "b", startingBalance: 500, type: "checking" }, { id: "sav", startingBalance: 9000, type: "savings" }],
    transactions: [],
    rules: [
      { id: "pay", type: "income", kind: "paycheck", amount: 1550, accountId: "b", freq: "semimonthly", monthDays: [15, 31], shift: "before", startDate: "2026-01-01" },
      { id: "car", type: "expense", amount: 201, accountId: "b", freq: "weekly", weekday: 1, startDate: "2026-10-01" }
    ], settings: { buffer: 50 }
  };
  // today Fri Oct 2 (after Sep 30 payday): balance = 500 + Sep15 + Sep30 paychecks? rules start Jan 1 -> lots of income. Use own window:
  state.rules[0].startDate = "2026-10-15";
  const r = F.safeToSpend(state, "2026-10-02");
  assert.equal(r.payday, "2026-10-15");
  near(r.balance, 500, "savings excluded");
  near(r.upcoming, 402, "Mon Oct 5 + Oct 12 car payments");
  near(r.safe, 500 - 402 - 50, "safe");
  assert.equal(r.daysUntilPayday, 13);
});

test("goal projection with interest, and required monthly", () => {
  const p = F.goalProjection({ target: 50000, monthly: 1000, apy: 3.4, targetDate: "2029-12-31" }, 0, "2026-05-01");
  assert.ok(p.months > 40 && p.months < 50, "months " + p.months);
  assert.ok(p.neededMonthly > 1000 && p.neededMonthly < 1150, "needed " + p.neededMonthly);
  const none = F.goalProjection({ target: 100, monthly: 0 }, 10, "2026-01-01");
  assert.equal(none.finish, null);
  const done = F.goalProjection({ target: 100, monthly: 0 }, 150, "2026-01-01");
  assert.equal(done.months, 0); assert.equal(done.pct, 1);
});

test("debt payoff and interest saved", () => {
  const d = F.debtSummary({ balance: 12000, apr: 7.5, payment: 201, freq: "weekly", minPayment: 640, minFreq: "monthly" }, "2026-10-12");
  assert.ok(d.plan.ok && d.minPlan.ok);
  assert.ok(d.plan.months < d.minPlan.months, "paying weekly $201 finishes sooner");
  assert.ok(d.interestSaved > 0);
  const never = F.payoffPlan(10000, 24, 100, "monthly"); // payment below interest
  assert.equal(never.ok, false);
});

test("paycheck planner matches WCM math", () => {
  const p = F.paycheckEstimate({ hourly: 23, hoursPerWeek: 40, freq: "semimonthly", taxPct: 23 });
  assert.equal(p.annual, 47840);
  near(p.gross, 1993.33); near(p.net, 1534.87);
});

test("suggestCategory learns from history", () => {
  const s = F.suggestCategory({ transactions: [
    { date: "2026-09-01", label: "Capital One", categoryId: "misc", type: "expense" },
    { date: "2026-10-01", label: "capital one", categoryId: "credit", type: "expense" }] }, " Capital ONE ");
  assert.equal(s.categoryId, "credit");
});
