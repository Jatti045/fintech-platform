import React, { useState } from "react";
import { View, Text, Switch } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { useGetAiPrivacyQuery, useUpdateAiPrivacyMutation } from "@/store/api/apiSlice";
import AiPrivacyDisclosure from "./AiPrivacyDisclosure";

export default function AiPrivacyPreference() {
  const { THEME } = useTheme();
  const { data, isLoading, error } = useGetAiPrivacyQuery();
  const [update, { isLoading: saving }] = useUpdateAiPrivacyMutation();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const save = async (enabled: boolean) => {
    setFailed(false);
    try { await update({ enabled, disclosureVersion: enabled ? data?.disclosureVersion : undefined }).unwrap(); setOpen(false); }
    catch { setFailed(true); }
  };
  return <View style={{ padding: 16, marginBottom: 12, borderRadius: 20, backgroundColor: THEME.surface }}>
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: THEME.textPrimary, fontWeight: "700" }}>AI privacy</Text>
        <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 5 }}>{isLoading ? "Loading preference…" : data?.enabled ? "External AI explanations enabled" : "External AI processing disabled"}</Text>
      </View>
      <Switch accessibilityLabel="Allow external AI explanations" value={Boolean(data?.enabled)} disabled={isLoading || saving || !data}
        onValueChange={enabled => enabled ? setOpen(true) : void save(false)} />
    </View>
    {(error || failed) && <Text style={{ color: THEME.danger, marginTop: 8 }}>Could not update AI privacy. Try again.</Text>}
    <AiPrivacyDisclosure visible={open} preference={data} saving={saving} error={failed} onCancel={() => setOpen(false)} onAccept={() => { void save(true); }} />
  </View>;
}
