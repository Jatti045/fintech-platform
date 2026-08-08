/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  setupFiles: ["<rootDir>/jest.setup.js"],
  // The app's tsconfig uses `jsx: "react-native"` (leaves JSX for Babel), but
  // Jest has no Babel step — compile JSX to React.createElement in tests.
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: { jsx: "react" } },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Stub out native/Expo modules that ship un-transpiled ESM
    "^expo-haptics$": "<rootDir>/__mocks__/expo-haptics.ts",
    "^react-native$": "<rootDir>/__mocks__/react-native.ts",
    "^expo-notifications$": "<rootDir>/__mocks__/expo-notifications.ts",
    "^expo-localization$": "<rootDir>/__mocks__/expo-localization.ts",
    "^expo-secure-store$": "<rootDir>/__mocks__/expo-secure-store.ts",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock",
  },
  // Silence console noise from slices
  silent: true,
};
