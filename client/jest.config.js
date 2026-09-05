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
    "^react-native-safe-area-context$":
      "<rootDir>/__mocks__/react-native-safe-area-context.ts",
    "^react-native-svg$": "<rootDir>/__mocks__/react-native-svg.ts",
    "^react-native-reanimated$":
      "<rootDir>/__mocks__/react-native-reanimated.ts",
    "^react-native-gesture-handler$":
      "<rootDir>/__mocks__/react-native-gesture-handler.ts",
    "^react-native-animated-numbers$":
      "<rootDir>/__mocks__/react-native-animated-numbers.ts",
    "^expo-linear-gradient$": "<rootDir>/__mocks__/expo-linear-gradient.ts",
    "^@expo/vector-icons$": "<rootDir>/__mocks__/vector-icons.ts",
    "^expo-notifications$": "<rootDir>/__mocks__/expo-notifications.ts",
    "^expo-localization$": "<rootDir>/__mocks__/expo-localization.ts",
    "^expo-secure-store$": "<rootDir>/__mocks__/expo-secure-store.ts",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock",
    "^@react-native-community/datetimepicker$":
      "<rootDir>/__mocks__/react-native-datetimepicker.ts",
    // In-memory stand-in for static CSS assets (e.g. app/global.css) so
    // app-layout modules can be imported by the test suite.
    "\\.css$": "<rootDir>/__mocks__/styleMock.js",
  },
  // Silence console noise from slices
  silent: true,
};
