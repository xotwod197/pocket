// finance.js — pure money/date logic. No DOM, no network. Fully unit-tested.
// Dates are "YYYY-MM-DD" strings. Day math uses UTC day numbers, so time zones
// and daylight-saving changes can never shift a date.

export const DAY_MS = 86400000;

export function dayNum(ds) {
  const y = +ds.slice(0, 4), m = +ds.slice(5, 7), d = +ds.slice(8, 10);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
export function fromDayNum(n) {
  const dt = new Date(n * DAY_MS);
  return dt.getUTCFullYear() + "-" + String(dt.getUTCMonth() + 1).padStart(2, "0") + "-" + String(dt.getUTCDate()).padStart(2, "0");
}
export function addDays(ds, n) { return fromDayNum(dayNum(ds) + n); }
export function weekday(ds) { return ((dayNum(ds) % 7) + 11) % 7; } // 0=Sun
export function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); } // m is 1-12
export function ymd(y, m, d) { return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }
export function monthStart(ds) { return ds.slice(0, 8) + "01"; }
export function monthEnd(ds) { const y = +ds.slice(0, 4), m = +ds.slice(5, 7); return ymd(y, m, daysInMonth(y, m)); }
export function addMonths(ds, n) {
  let y = +ds.slice(0, 4), m = +ds.slice(5, 7) + n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return ymd(y, m, Math.min(+ds.slice(8, 10), daysInMonth(y, m)));
}
export function todayLocal(now = new Date()) {
  return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
export const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/* ---------------- business days ---------------- */
export function isBusinessDay(ds, holidays) {
  const w = weekday(ds);
  if (w === 0 || w === 6) return false;
  return !(holidays && holidays.has(ds));
}
export function shiftDate(ds, mode, holidays) {
  if (!mode || mode === "none") return ds;
  let cur = ds, guard = 0;
  while (!isBusinessDay(cur, holidays) && guard++ < 14) cur = addDays(cur, mode === "after" ? 1 : -1);
  return cur;
}

/* ---------------- recurring rules ----------------
 rule = { id, label, amount, type: expense|income|transfer, accountId, toAccountId,
          categoryId, freq: daily|weekly|biweekly|semimonthly|monthly|yearly,
          weekday, monthDay, monthDays:[a,b], startDate, endDate,
          shift: none|before|after, skips:[nominalDate], overrides:{nominalDate:{amount,date}},
          kind: bill|subscription|paycheck|transfer|other }
 monthDay/monthDays use 31 (or anything >= days in month) to mean "last day". */
function nominalDates(rule, from, to) {
  const out = [];
  const start = rule.startDate;
  const end = rule.endDate && rule.endDate < to ? rule.endDate : to;
  const lo = start > from ? start : from;
  if (lo > end) return out;
  const f = rule.freq;
  if (f === "daily") {
    for (let n = dayNum(lo), e = dayNum(end); n <= e; n++) out.push(fromDayNum(n));
  } else if (f === "weekly" || f === "biweekly") {
    const step = f === "weekly" ? 7 : 14;
    let anchor = dayNum(start);
    if (f === "weekly" && rule.weekday !== undefined && rule.weekday !== null && rule.weekday !== "") {
      const w = Number(rule.weekday);
      while (weekday(fromDayNum(anchor)) !== w) anchor++;
    }
    let n = anchor;
    const lon = dayNum(lo);
    if (n < lon) n += Math.ceil((lon - n) / step) * step;
    for (const e = dayNum(end); n <= e; n += step) out.push(fromDayNum(n));
  } else if (f === "monthly" || f === "semimonthly" || f === "yearly") {
    let y = +lo.slice(0, 4), m = +lo.slice(5, 7);
    const ey = +end.slice(0, 4), em = +end.slice(5, 7);
    const days = f === "semimonthly"
      ? (rule.monthDays && rule.monthDays.length ? rule.monthDays : [15, 31]).map(Number)
      : [Number(rule.monthDay) || +start.slice(8, 10)];
    const yearMonth = +start.slice(5, 7);
    while (y < ey || (y === ey && m <= em)) {
      if (f !== "yearly" || m === yearMonth) {
        const dim = daysInMonth(y, m);
        const seen = new Set();
        for (const d of days) {
          const dd = Math.min(Math.max(1, d), dim);
          if (seen.has(dd)) continue;
          seen.add(dd);
          const ds = ymd(y, m, dd);
          if (ds >= lo && ds <= end) out.push(ds);
        }
      }
      m++; if (m > 12) { m = 1; y++; }
    }
    out.sort();
  }
  return out;
}

export function expandRule(rule, from, to, holidays) {
  // Generate a little outside the window so business-day shifts across the edge are caught.
  const pad = rule.shift && rule.shift !== "none" ? 10 : 0;
  const skips = new Set(rule.skips || []);
  const ov = rule.overrides || {};
  const res = [];
  for (const nominal of nominalDates(rule, addDays(from, -pad), addDays(to, pad))) {
    if (skips.has(nominal)) continue;
    const o = ov[nominal] || {};
    let date = o.date || shiftDate(nominal, rule.shift, holidays);
    if (date < from || date > to) continue;
    res.push({
      id: rule.id + "@" + nominal, ruleId: rule.id, nominal, date, virtual: true,
      label: rule.label, amount: round2(Number(o.amount !== undefined ? o.amount : rule.amount) || 0),
      type: rule.type, accountId: rule.accountId, toAccountId: rule.toAccountId || null,
      categoryId: rule.categoryId || null, kind: rule.kind || "other", note: rule.note || ""
    });
  }
  return res;
}

/* ---------------- items & balances ---------------- */
// state = { accounts, transactions, rules, categories, settings:{holidays:[]}, goals, debts }
export function holidaySet(state) { return new Set((state.settings && state.settings.holidays) || []); }

export function buildItems(state, from, to) {
  const hs = holidaySet(state);
  const items = [];
  for (const t of state.transactions || []) {
    if (t.date >= from && t.date <= to) items.push({ ...t, amount: round2(Number(t.amount) || 0) });
  }
  for (const r of state.rules || []) {
    if (r.paused) continue;
    for (const o of expandRule(r, from, to, hs)) items.push(o);
  }
  items.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.type === "income" ? -1 : 0) - (b.type === "income" ? -1 : 0));
  return items;
}

// Effect of one item on a set of accounts (null set = all accounts, "net worth" view).
export function effectOn(item, accSet) {
  const inSet = (id) => !accSet || accSet.has(id);
  const a = Number(item.amount) || 0;
  if (item.type === "income") return inSet(item.accountId) ? a : 0;
  if (item.type === "expense") return inSet(item.accountId) ? -a : 0;
  if (item.type === "transfer") return (inSet(item.toAccountId) ? a : 0) - (inSet(item.accountId) ? a : 0);
  return 0;
}

function earliestDate(state) {
  let min = null;
  for (const t of state.transactions || []) if (!min || t.date < min) min = t.date;
  for (const r of state.rules || []) if (!min || r.startDate < min) min = r.startDate;
  for (const a of state.accounts || []) if (a.startDate && (!min || a.startDate < min)) min = a.startDate;
  return min;
}

export function startingTotal(state, accSet) {
  let s = 0;
  for (const a of state.accounts || []) if (!accSet || accSet.has(a.id)) s += Number(a.startingBalance) || 0;
  return s;
}

// Map date -> end-of-day balance for every day in [from, to].
export function balanceSeries(state, accSet, from, to) {
  const early = earliestDate(state);
  const realFrom = early && early < from ? early : from;
  const items = buildItems(state, realFrom, to);
  const byDate = new Map();
  for (const it of items) {
    const e = effectOn(it, accSet);
    if (e) byDate.set(it.date, (byDate.get(it.date) || 0) + e);
  }
  let bal = startingTotal(state, accSet);
  const out = {};
  for (let n = dayNum(realFrom), e = dayNum(to); n <= e; n++) {
    const ds = fromDayNum(n);
    bal += byDate.get(ds) || 0;
    if (ds >= from) out[ds] = round2(bal);
  }
  return out;
}

export function balanceAsOf(state, accSet, date) {
  const s = balanceSeries(state, accSet, date, date);
  return s[date];
}

export function accountBalances(state, date) {
  const out = {};
  for (const a of state.accounts || []) out[a.id] = balanceAsOf(state, new Set([a.id]), date);
  return out;
}

/* ---------------- summaries ---------------- */
export function summarize(items, accSet) {
  let income = 0, expense = 0;
  const byCat = {};
  for (const it of items) {
    if (it.type === "transfer") continue;
    if (accSet && !accSet.has(it.accountId)) continue;
    if (it.type === "income") income += it.amount;
    else { expense += it.amount; const c = it.categoryId || "uncategorized"; byCat[c] = (byCat[c] || 0) + it.amount; }
  }
  return { income: round2(income), expense: round2(expense), net: round2(income - expense), byCat };
}

export function monthSummary(state, y, m, accSet) {
  const from = ymd(y, m, 1), to = ymd(y, m, daysInMonth(y, m));
  return summarize(buildItems(state, from, to), accSet);
}

/* ---------------- budgets ---------------- */
export function budgetStatus(state, y, m, today) {
  const from = ymd(y, m, 1), to = ymd(y, m, daysInMonth(y, m));
  const items = buildItems(state, from, to).filter((i) => i.type === "expense");
  const out = [];
  for (const c of state.categories || []) {
    const budget = Number(c.budget) || 0;
    if (!budget) continue;
    let spent = 0, scheduled = 0;
    for (const i of items) if (i.categoryId === c.id) { if (i.date <= today) spent += i.amount; else scheduled += i.amount; }
    const used = spent + scheduled;
    out.push({
      categoryId: c.id, name: c.name, budget, spent: round2(spent), scheduled: round2(scheduled),
      remaining: round2(budget - used), pct: budget ? used / budget : 0,
      status: used > budget ? "over" : used > budget * 0.85 ? "close" : "ok"
    });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

/* ---------------- safe to spend ---------------- */
export function spendAccounts(state) {
  const ids = (state.accounts || []).filter((a) => !a.archived && a.includeInSafe !== false && a.type !== "credit" && a.type !== "savings").map((a) => a.id);
  return new Set(ids);
}

export function safeToSpend(state, today, opts = {}) {
  const accSet = opts.accSet || spendAccounts(state);
  const horizon = addDays(today, 62);
  const items = buildItems(state, addDays(today, 1), horizon);
  const balance = balanceAsOf(state, accSet, today) || 0;
  let payday = null, paydayAmount = 0;
  for (const it of items) {
    if (it.type === "income" && accSet.has(it.accountId) && (it.kind === "paycheck" || it.categoryId === "income" || !opts.paycheckOnly)) {
      payday = it.date; break;
    }
  }
  if (payday) for (const it of items) if (it.date === payday && it.type === "income" && accSet.has(it.accountId)) paydayAmount += it.amount;
  const until = payday ? addDays(payday, -1) : addDays(today, 30);
  let upcoming = 0;
  const bills = [];
  for (const it of items) {
    if (it.date > until) break;
    const e = effectOn(it, accSet);
    if (e < 0) { upcoming += -e; bills.push(it); }
  }
  // payday-day bills are paid from the paycheck, but we still want to know about same-day outflows
  const buffer = Number(state.settings && state.settings.buffer) || 0;
  const safe = round2(balance - upcoming - buffer);
  const days = Math.max(1, dayNum(until) - dayNum(today) + 1);
  // lowest balance in next 30 days
  const series = balanceSeries(state, accSet, today, addDays(today, 30));
  let low = Infinity, lowDate = today;
  for (const d in series) if (series[d] < low) { low = series[d]; lowDate = d; }
  return {
    balance: round2(balance), upcoming: round2(upcoming), buffer, safe, payday, paydayAmount: round2(paydayAmount),
    daysUntilPayday: payday ? dayNum(payday) - dayNum(today) : null, perDay: round2(safe / days),
    bills, lowest: round2(low), lowestDate: lowDate
  };
}

/* ---------------- goals ----------------
 goal = { id, name, target, saved, accountId?, monthly, apy, targetDate, startDate } */
export function goalProjection(goal, current, today) {
  const target = Number(goal.target) || 0;
  const monthly = Number(goal.monthly) || 0;
  const r = (Number(goal.apy) || 0) / 100 / 12;
  let bal = Number(current) || 0;
  const pct = target ? Math.min(1, bal / target) : 0;
  let months = 0;
  if (bal < target) {
    if (monthly <= 0 && r <= 0) months = Infinity;
    else {
      while (bal < target && months < 1200) { bal = bal * (1 + r) + monthly; months++; }
      if (bal < target) months = Infinity;
    }
  }
  const finish = months === Infinity ? null : addMonths(today, months);
  let neededMonthly = null;
  if (goal.targetDate && goal.targetDate > today) {
    const n = Math.max(1, Math.round((dayNum(goal.targetDate) - dayNum(today)) / 30.4375));
    const c = Number(current) || 0;
    // FV = c(1+r)^n + p * ((1+r)^n - 1)/r  -> solve p
    const g = Math.pow(1 + r, n);
    neededMonthly = r > 0 ? (target - c * g) * r / (g - 1) : (target - c) / n;
    neededMonthly = Math.max(0, round2(neededMonthly));
  }
  const onTrack = goal.targetDate && finish ? finish <= goal.targetDate : null;
  return { current: round2(Number(current) || 0), target, pct, months, finish, neededMonthly, onTrack };
}

/* ---------------- debts ----------------
 debt = { id, name, balance, apr, payment, freq: weekly|biweekly|monthly, minPayment } */
const PERIODS = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };
export function payoffPlan(balance, apr, payment, freq = "monthly", today = "2026-01-01") {
  const per = PERIODS[freq] || 12;
  const r = (Number(apr) || 0) / 100 / per;
  let bal = Number(balance) || 0, interest = 0, n = 0;
  const pay = Number(payment) || 0;
  if (bal <= 0) return { periods: 0, months: 0, interest: 0, payoffDate: today, ok: true };
  if (pay <= bal * r) return { periods: Infinity, months: Infinity, interest: Infinity, payoffDate: null, ok: false };
  while (bal > 0.005 && n < 5000) {
    const i = bal * r; interest += i; bal = bal + i - pay; n++;
  }
  const days = Math.round(n * 365.25 / per);
  return { periods: n, months: round2(n * 12 / per), interest: round2(interest), payoffDate: addDays(today, days), ok: true };
}
export function debtSummary(debt, today) {
  const withPlan = payoffPlan(debt.balance, debt.apr, debt.payment, debt.freq, today);
  const minPay = Number(debt.minPayment) || 0;
  const minPlan = minPay ? payoffPlan(debt.balance, debt.apr, minPay, debt.minFreq || "monthly", today) : null;
  const saved = minPlan && minPlan.ok && withPlan.ok ? round2(minPlan.interest - withPlan.interest) : null;
  return { plan: withPlan, minPlan, interestSaved: saved };
}

/* ---------------- paycheck planner ---------------- */
export const CHECKS_PER_YEAR = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };
export function paycheckEstimate({ hourly, hoursPerWeek, freq, taxPct, salary }) {
  const annual = salary ? Number(salary) : (Number(hourly) || 0) * (Number(hoursPerWeek) || 0) * 52;
  const n = CHECKS_PER_YEAR[freq] || 26;
  const gross = annual / n;
  const net = gross * (1 - (Number(taxPct) || 0) / 100);
  return { annual: round2(annual), gross: round2(gross), net: round2(net), perMonth: round2(net * n / 12) };
}

/* ---------------- insights helpers ---------------- */
export function lastNMonths(today, n) {
  const out = [];
  let y = +today.slice(0, 4), m = +today.slice(5, 7);
  for (let i = 0; i < n; i++) { out.unshift({ y, m }); m--; if (m < 1) { m = 12; y--; } }
  return out;
}

export function upcoming(state, today, days) {
  return buildItems(state, today, addDays(today, days)).filter((i) => i.type !== "income");
}

// Suggest a category for a label based on the most recent transaction with the same label.
export function suggestCategory(state, label) {
  const l = String(label || "").trim().toLowerCase();
  if (!l) return null;
  let best = null;
  for (const t of state.transactions || []) {
    if (String(t.label || "").trim().toLowerCase() === l && (!best || t.date > best.date)) best = t;
  }
  return best ? { categoryId: best.categoryId, type: best.type, accountId: best.accountId, amount: best.amount } : null;
}

/* ---------------- backup import ---------------- */
// Converts the old single-account tracker backup into transactions for the new app.
export function mapLegacyBackup(backup, opts) {
  const map = opts.categoryMap || {};
  const out = [];
  for (const e of backup.entries || []) {
    const t = {
      date: e.date, label: e.label, amount: round2(Number(e.amount) || 0), type: e.type,
      accountId: opts.mainAccountId, categoryId: map[e.category] || e.category || "misc", note: ""
    };
    if (opts.transfersFor && e.type === "expense" && opts.transfersFor[e.category]) {
      t.type = "transfer"; t.toAccountId = opts.transfersFor[e.category]; t.categoryId = null;
    }
    out.push(t);
  }
  return out;
}
