// Jest environment setup.
// apiClient reads EXPO_PUBLIC_API_BASE_URL at module load; Jest does not load
// the project's .env file, so define it here so API-layer tests can run.
process.env.EXPO_PUBLIC_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080/api";

// Tell React that tests run inside an act environment. Silences the
// "isConcurrentActEnvironment" warning raised by react-test-renderer's
// deprecated act() wrapper used in component tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// React Native defines __DEV__ as a global; Jest's node environment does not.
// Some modules (e.g. the Redux store's devTools flag) read it at load time.
globalThis.__DEV__ = true;

// The transaction screen's filter-loader coordination uses
// requestAnimationFrame, which does not exist in the node test environment.
// Polyfill it with a macrotask so the effect behaves identically.
if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
