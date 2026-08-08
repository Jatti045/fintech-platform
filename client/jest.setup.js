// Jest environment setup.
// apiClient reads EXPO_PUBLIC_API_BASE_URL at module load; Jest does not load
// the project's .env file, so define it here so API-layer tests can run.
process.env.EXPO_PUBLIC_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080/api";

// Tell React that tests run inside an act environment. Silences the
// "isConcurrentActEnvironment" warning raised by react-test-renderer's
// deprecated act() wrapper used in component tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
