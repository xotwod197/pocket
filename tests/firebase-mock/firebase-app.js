export function initializeApp(config) { globalThis.__fbConfig = config; return { name: "[DEFAULT]", options: config }; }
