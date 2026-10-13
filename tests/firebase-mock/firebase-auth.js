// In-memory stand-in for Firebase Auth: Google sign-in returns a fixed test user.
const subs = new Set();
const state = (globalThis.__authState = globalThis.__authState || { user: null });
const emit = () => subs.forEach((cb) => setTimeout(() => cb(state.user), 0));
export const indexedDBLocalPersistence = { type: "indexedDB" };
export const browserLocalPersistence = { type: "local" };
export const browserPopupRedirectResolver = {};
export function initializeAuth() { return { __auth: true }; }
export function getAuth() { return { __auth: true }; }
export class GoogleAuthProvider { setCustomParameters(p) { this.p = p; } }
export async function getRedirectResult() { return null; }
export function onAuthStateChanged(auth, cb) { subs.add(cb); setTimeout(() => cb(state.user), 0); return () => subs.delete(cb); }
export async function signInWithPopup() {
  state.user = { uid: "u_test_ramiro", displayName: "Ramiro Herrera", email: "test@example.com", photoURL: "" };
  emit(); return { user: state.user };
}
export async function signInWithRedirect() { globalThis.__usedRedirect = true; return signInWithPopup(); }
export async function signOut() { state.user = null; emit(); }
