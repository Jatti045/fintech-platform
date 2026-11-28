import React from "react";
import { Platform, Switch, type SwitchProps } from "react-native";
import { useTheme } from "@/hooks/useRedux";

export default function ThemedSwitch(props: SwitchProps) {
  const { THEME } = useTheme();
  const offThumb = THEME.surface;
  const onThumb = THEME.onPrimary;
  const web = Platform.OS === "web" ? { activeThumbColor: onThumb } : {};
  return (
    <Switch
      {...props}
      {...web}
      trackColor={{ false: THEME.border, true: THEME.primary }}
      thumbColor={Platform.OS === "web" || !props.value ? offThumb : onThumb}
    />
  );
}
