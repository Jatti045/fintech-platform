import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || "Fundleaf",
  slug: config.slug || "budgee-app",
  plugins: [
    ...(config.plugins || []),
    ["expo-secure-store", { configureAndroidBackup: true }],
  ],
});
