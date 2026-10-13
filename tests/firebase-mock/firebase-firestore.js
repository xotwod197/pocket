// In-memory stand-in for the Firestore web SDK (only the calls Pocket uses).
// Mirrors real semantics that matter: set vs set-merge (deep merge of maps, arrays replaced),
// deleteField() inside merges, atomic batches, collection listeners on direct children.
const DELETE = { __delete: true };
const store = (globalThis.__fsStore = globalThis.__fsStore || new Map());
const listeners = (globalThis.__fsListeners = globalThis.__fsListeners || new Set());
globalThis.__fsWrites = globalThis.__fsWrites || 0;

const clone = (v) => JSON.parse(JSON.stringify(v));
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function validate(v, path = "") {
  if (v === undefined) throw Object.assign(new Error("Unsupported field value: undefined at " + path), { code: "invalid-argument" });
  if (isObj(v) && v !== DELETE) for (const k in v) validate(v[k], path + "." + k);
}
function strip(v) { // remove delete sentinels for plain (non-merge) set
  if (!isObj(v)) return v;
  const o = {}; for (const k in v) if (v[k] !== DELETE) o[k] = strip(v[k]); return o;
}
function merge(base, patch) {
  const out = isObj(base) ? { ...base } : {};
  for (const k in patch) {
    const v = patch[k];
    if (v === DELETE) delete out[k];
    else if (isObj(v)) out[k] = merge(out[k], v);
    else out[k] = clone(v);
  }
  return out;
}
const parent = (p) => p.split("/").slice(0, -1).join("/");
function notify(paths) {
  const touched = new Set(paths);
  for (const l of listeners) {
    if (l.kind === "doc" && touched.has(l.path)) l.fire();
    if (l.kind === "col" && [...touched].some((p) => parent(p) === l.path)) l.fire();
  }
}
function snapDoc(path) {
  const d = store.get(path);
  return { id: path.split("/").pop(), ref: { path }, exists: () => d !== undefined, data: () => (d === undefined ? undefined : clone(d)) };
}
function snapCol(path) {
  const docs = [...store.keys()].filter((p) => parent(p) === path).sort().map(snapDoc);
  return { docs, size: docs.length, empty: !docs.length };
}

export function initializeFirestore() { return { __db: true }; }
export function persistentLocalCache() { return {}; }
export function persistentMultipleTabManager() { return {}; }
export function serverTimestamp() { return Date.now(); }
export function deleteField() { return DELETE; }
export function doc(db, path) { if (path.split("/").length % 2) throw new TypeError("doc path must have even segments: " + path); return { path }; }
export function collection(db, path) { if (!(path.split("/").length % 2)) throw new TypeError("collection path must have odd segments: " + path); return { path, col: true }; }

function applySet(ref, data, opts) {
  validate(data);
  if (opts && opts.merge) store.set(ref.path, merge(store.get(ref.path), data));
  else {
    const hasDel = JSON.stringify(data).includes('"__delete":true');
    if (hasDel) throw Object.assign(new Error("deleteField() can only be used with update() and set() with {merge:true}"), { code: "invalid-argument" });
    store.set(ref.path, strip(clone(data)));
  }
  globalThis.__fsWrites++;
}
export async function setDoc(ref, data, opts) { applySet(ref, data, opts); notify([ref.path]); }
export async function updateDoc(ref, data) { if (!store.has(ref.path)) throw Object.assign(new Error("No document to update"), { code: "not-found" }); applySet(ref, data, { merge: true }); notify([ref.path]); }
export async function deleteDoc(ref) { store.delete(ref.path); globalThis.__fsWrites++; notify([ref.path]); }
export async function getDoc(ref) { return snapDoc(ref.path); }
export async function getDocs(ref) { return snapCol(ref.path); }
export function writeBatch() {
  const ops = [];
  return {
    set(ref, data, opts) { ops.push(() => applySet(ref, data, opts)); ops.paths = (ops.paths || []).concat(ref.path); return this; },
    delete(ref) { ops.push(() => { store.delete(ref.path); }); ops.paths = (ops.paths || []).concat(ref.path); return this; },
    async commit() {
      if (ops.length > 500) throw Object.assign(new Error("A batch can hold at most 500 writes"), { code: "invalid-argument" });
      const backup = new Map(store);
      try { ops.forEach((f) => f()); } catch (e) { store.clear(); backup.forEach((v, k) => store.set(k, v)); throw e; }
      notify(ops.paths || []);
    }
  };
}
export function onSnapshot(ref, next, error) {
  const l = { kind: ref.col ? "col" : "doc", path: ref.path, fire: () => setTimeout(() => next(ref.col ? snapCol(ref.path) : snapDoc(ref.path)), 0) };
  listeners.add(l); l.fire();
  return () => listeners.delete(l);
}
