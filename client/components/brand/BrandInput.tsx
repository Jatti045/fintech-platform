import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { SheetInputContext } from "@/components/sheets/FundleafSheet";
import React, { forwardRef, useState, useContext, useCallback } from "react";
import {
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BRAND } from "@/constants/ThemePalettes";
import { useTheme } from "@/hooks/useRedux";

interface Props extends TextInputProps {
  label: string;
  password?: boolean;
}

const BrandInput = forwardRef<TextInput, Props>(function BrandInput(
  { label, password, style, ...props },
  ref,
) {
  const { THEME } = useTheme();
  const inSheet = useContext(SheetInputContext);
  const inputRef = useCallback(
    (instance: TextInput | null | undefined) => {
      if (typeof ref === "function") ref(instance ?? null);
      else if (ref) ref.current = instance ?? null;
    },
    [ref],
  );
  const Input = inSheet ? BottomSheetTextInput : TextInput;
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const toggleLabel = label.toLowerCase();
  return (
    <View style={{ gap: BRAND.spacing.sm }}>
      <Text
        style={{ color: THEME.textPrimary, fontSize: 14, fontWeight: "600" }}
      >
        {label}
      </Text>
      <View style={{ position: "relative" }}>
        <Input
          {...props}
          ref={inputRef}
          accessibilityLabel={props.accessibilityLabel || label}
          secureTextEntry={password ? !visible : props.secureTextEntry}
          autoCapitalize={props.autoCapitalize || "none"}
          autoCorrect={false}
          placeholderTextColor={THEME.placeholderText}
          selectionColor={THEME.primary}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[
            {
              minHeight: 54,
              paddingVertical: 15,
              paddingLeft: BRAND.spacing.md,
              paddingRight: password ? 56 : BRAND.spacing.md,
              borderRadius: BRAND.radius.input,
              borderWidth: focused ? 2 : 1,
              borderColor: focused ? THEME.primary : THEME.border,
              backgroundColor: THEME.inputBackground,
              color: THEME.textPrimary,
              fontSize: 16,
            },
            style,
          ]}
        />
        {password && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${visible ? "Hide" : "Show"} ${toggleLabel}`}
            accessibilityState={{ disabled: props.editable === false }}
            disabled={props.editable === false}
            onPress={() => setVisible((value) => !value)}
            style={{
              position: "absolute",
              right: 4,
              top: 3,
              bottom: 3,
              width: BRAND.touchTarget,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={visible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={THEME.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

export default BrandInput;
