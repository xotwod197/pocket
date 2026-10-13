// store.js — one interface, two backends:
//   FirebaseStore: Google sign-in + Firestore (each user's data under users/{uid}, locked by security rules)
//   DemoStore:     data kept only on this device (localStorage) for trying the app without an account
//
// Firestore layout (designed to stay well inside the free plan's 50k reads/day):
//   users/{uid}                     { profile, settings }
//   users/{uid}/months/{YYYY-MM}    { tx: { <txId>: {date,label,amount,type,accountId,toAccountId,categoryId,note,createdAt} } }
//   users/{uid}/accounts/{id}       small collections, a handful of docs each
//   users/{uid}/categories/{id}
//   users/{uid}/rules/{id}
//   users/{uid}/goals/{id}
//   users/{uid}/debts/{id}

export const COLLECTIONS = ["accounts", "categories", "rules", "goals", "debts"];
const FB_VER = "13.0.0";
const CDN = `https://www.gstatic.com/firebasejs/${FB_VER}/`;

export function newId() {
  const a = new Uint8Array(12);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  return Array.from(a, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

function emptyState() {
  return { accounts: [], categories: [], rules: [], goals: [], debts: [], transactions: [], settings: {}, profile: null, loaded: false };
}

// Every transaction is written with its full field set, so a merge-write can never
// leave a stale field behind (e.g. toAccountId after a transfer becomes an expense).
export function normTx(t) {
  return {
    date: t.date, label: String(t.label || "").slice(0, 120), amount: Math.round((Number(t.amount) || 0) * 100) / 100,
    type: t.type, accountId: t.accountId || null, toAccountId: t.type === "transfer" ? (t.toAccountId || null) : null,
    categoryId: t.type === "transfer" ? null : (t.categoryId || null), note: String(t.note || "").slice(0, 500),
    createdAt: t.createdAt || Date.now()
  };
}

function clean(obj) {
  // Firestore rejects undefined values
  const o = {};
  for (const k in obj) if (obj[k] !== undefined) o[k] = obj[k];
  return o;
}

/* =============================== Demo store =============================== */
export class DemoStore {
  constructor(key = "pocket-demo-v1") {
    this.kind = "demo";
    this.key = key;
    this.listeners = new Set();
    this.authListeners = new Set();
    this.user = null;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { saved = null; }
    this.data = saved || { accounts: {}, categories: {}, rules: {}, goals: {}, debts: {}, tx: {}, settings: {}, profile: null };
    this.signedIn = !!(saved && saved.signedIn);
  }
  persist() { try { localStorage.setItem(this.key, JSON.stringify({ ...this.data, signedIn: this.signedIn })); } catch (e) { /* storage full or blocked */ } }
  snapshot() {
    const s = emptyState();
    for (const c of COLLECTIONS) s[c] = Object.entries(this.data[c]).map(([id, v]) => ({ id, ...v }));
    s.transactions = Object.entries(this.data.tx).map(([id, v]) => ({ id, ...v }));
    s.settings = this.data.settings || {};
    s.profile = this.data.profile;
    s.loaded = true;
    return s;
  }
  emit() { const s = this.snapshot(); this.listeners.forEach((f) => f(s)); }
  onAuth(cb) {
    this.authListeners.add(cb);
    setTimeout(() => cb(this.signedIn ? this.demoUser() : null), 0);
    return () => this.authListeners.delete(cb);
  }
  demoUser() { return { uid: "demo", displayName: "Demo", email: "", photoURL: "", isDemo: true }; }
  async signIn() { this.signedIn = true; this.persist(); this.authListeners.forEach((f) => f(this.demoUser())); }
  async signOut() { this.signedIn = false; this.persist(); this.authListeners.forEach((f) => f(null)); }
  subscribe(cb) { this.listeners.add(cb); setTimeout(() => cb(this.snapshot()), 0); return () => this.listeners.delete(cb); }
  async put(col, id, data) { id = id || newId(); this.data[col][id] = clean(data); this.persist(); this.emit(); return id; }
  async remove(col, id) { delete this.data[col][id]; this.persist(); this.emit(); }
  async putTx(t, prevDate) { const id = t.id || newId(); const { id: _, ...rest } = t; this.data.tx[id] = normTx(rest); this.persist(); this.emit(); return id; }
  async removeTx(id) { delete this.data.tx[id]; this.persist(); this.emit(); }
  async putMany({ tx = [], docs = [] }) {
    for (const t of tx) { const { id, ...rest } = t; this.data.tx[id || newId()] = normTx(rest); }
    for (const d of docs) this.data[d.col][d.id || newId()] = clean(d.data);
    this.persist(); this.emit();
  }
  async setSettings(patch) { this.data.settings = { ...(this.data.settings || {}), ...patch }; this.persist(); this.emit(); }
  async setProfile(p) { this.data.profile = p; this.persist(); this.emit(); }
  async deleteEverything() {
    this.data = { accounts: {}, categories: {}, rules: {}, goals: {}, debts: {}, tx: {}, settings: {}, profile: null };
    this.persist(); this.emit();
  }
}

/* ============================= Firebase store ============================= */
export class FirebaseStore {
  constructor(config) {
    this.kind = "firebase";
    this.config = config;
    this.user = null;
    this.ready = this.boot();
  }
  async boot() {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(CDN + "firebase-app.js"), import(CDN + "firebase-auth.js"), import(CDN + "firebase-firestore.js")
    ]);
    this.A = authMod; this.F = fsMod;
    this.app = appMod.initializeApp(this.config);
    this.auth = authMod.initializeAuth(this.app, {
      persistence: [authMod.indexedDBLocalPersistence, authMod.browserLocalPersistence],
      popupRedirectResolver: authMod.browserPopupRedirectResolver
    });
    let cache;
    try { cache = fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }); } catch (e) { cache = undefined; }
    this.db = fsMod.initializeFirestore(this.app, cache ? { localCache: cache } : {});
    try { await authMod.getRedirectResult(this.auth); } catch (e) { this.redirectError = e; }
  }
  async onAuth(cb) {
    await this.ready;
    return this.A.onAuthStateChanged(this.auth, (u) => {
      this.user = u;
      cb(u ? { uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL } : null);
    });
  }
  async signIn() {
    await this.ready;
    const provider = new this.A.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
    if (standalone) return this.A.signInWithRedirect(this.auth, provider);
    try { return await this.A.signInWithPopup(this.auth, provider); }
    catch (e) {
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) return this.A.signInWithRedirect(this.auth, provider);
      throw e;
    }
  }
  async signOut() { await this.ready; this.unsubAll(); return this.A.signOut(this.auth); }

  base() { return "users/" + this.user.uid; }
  unsubAll() { (this.unsubs || []).forEach((u) => { try { u(); } catch (e) { } }); this.unsubs = []; }

  subscribe(cb) {
    const F = this.F, db = this.db, base = this.base();
    const state = emptyState();
    const got = new Set();
    const need = COLLECTIONS.length + 2;
    let timer = null;
    const fire = () => { if (got.size >= need) { state.loaded = true; clearTimeout(timer); timer = setTimeout(() => cb({ ...state }), 0); } };
    const months = new Map();
    this.unsubAll();
    const onErr = (e) => cb({ ...state, error: e });
    for (const c of COLLECTIONS) {
      this.unsubs.push(F.onSnapshot(F.collection(db, base + "/" + c), (snap) => {
        state[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        got.add(c); fire();
      }, onErr));
    }
    this.unsubs.push(F.onSnapshot(F.collection(db, base + "/months"), (snap) => {
      months.clear();
      snap.docs.forEach((d) => months.set(d.id, d.data().tx || {}));
      const all = [];
      months.forEach((tx) => { for (const id in tx) all.push({ id, ...tx[id] }); });
      state.transactions = all;
      got.add("months"); fire();
    }, onErr));
    this.unsubs.push(F.onSnapshot(F.doc(db, base), (snap) => {
      const d = snap.exists() ? snap.data() : {};
      state.settings = d.settings || {}; state.profile = d.profile || null;
      got.add("root"); fire();
    }, onErr));
    return () => this.unsubAll();
  }

  monthRef(date) { return this.F.doc(this.db, this.base() + "/months/" + date.slice(0, 7)); }

  async put(col, id, data) {
    id = id || newId();
    await this.F.setDoc(this.F.doc(this.db, this.base() + "/" + col + "/" + id), clean(data));
    return id;
  }
  async remove(col, id) { await this.F.deleteDoc(this.F.doc(this.db, this.base() + "/" + col + "/" + id)); }

  async putTx(t, prevDate) {
    const F = this.F;
    const id = t.id || newId();
    const { id: _, ...rest } = t;
    const b = F.writeBatch(this.db);
    if (prevDate && prevDate.slice(0, 7) !== t.date.slice(0, 7)) b.set(this.monthRef(prevDate), { tx: { [id]: F.deleteField() } }, { merge: true });
    b.set(this.monthRef(t.date), { tx: { [id]: normTx(rest) } }, { merge: true });
    await b.commit();
    return id;
  }
  async removeTx(id, date) {
    await this.F.setDoc(this.monthRef(date), { tx: { [id]: this.F.deleteField() } }, { merge: true });
  }
  async putMany({ tx = [], docs = [] }) {
    // group by month: one document write per month, batched under Firestore's 500-op limit
    const F = this.F;
    const byMonth = new Map();
    for (const t of tx) {
      const id = t.id || newId();
      const { id: _, ...rest } = t;
      const k = t.date.slice(0, 7);
      if (!byMonth.has(k)) byMonth.set(k, {});
      byMonth.get(k)[id] = normTx(rest);
    }
    const ops = [];
    byMonth.forEach((m, k) => ops.push((b) => b.set(F.doc(this.db, this.base() + "/months/" + k), { tx: m }, { merge: true })));
    for (const d of docs) ops.push((b) => b.set(F.doc(this.db, this.base() + "/" + d.col + "/" + (d.id || newId())), clean(d.data)));
    for (let i = 0; i < ops.length; i += 400) {
      const b = F.writeBatch(this.db);
      ops.slice(i, i + 400).forEach((op) => op(b));
      await b.commit();
    }
  }
  async setSettings(patch) { await this.F.setDoc(this.F.doc(this.db, this.base()), { settings: clean(patch) }, { merge: true }); }
  async setProfile(p) { await this.F.setDoc(this.F.doc(this.db, this.base()), { profile: clean(p) }, { merge: true }); }
  async deleteEverything() {
    const F = this.F, base = this.base();
    const refs = [];
    for (const c of [...COLLECTIONS, "months"]) {
      const snap = await F.getDocs(F.collection(this.db, base + "/" + c));
      snap.docs.forEach((d) => refs.push(d.ref));
    }
    refs.push(F.doc(this.db, base));
    for (let i = 0; i < refs.length; i += 400) {
      const b = F.writeBatch(this.db);
      refs.slice(i, i + 400).forEach((r) => b.delete(r));
      await b.commit();
    }
  }
}

export function isConfigured(cfg) {
  return !!(cfg && cfg.apiKey && cfg.projectId && !String(cfg.apiKey).includes("PASTE"));
}
