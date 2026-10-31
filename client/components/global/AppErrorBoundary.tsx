import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "@/hooks/useRedux";
import { logger } from "@/utils/logger";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

class AppErrorBoundaryClass extends React.Component<
  Props & { background: string; textPrimary: string; primary: string; onPrimary: string },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error("AppErrorBoundary", "Unhandled UI error", {
      error,
      errorInfo,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: this.props.background,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <Text
          style={{
            color: this.props.textPrimary,
            fontSize: 18,
            fontWeight: "700",
          }}
          accessibilityRole="header"
        >
          Something went wrong
        </Text>
        <Text
          style={{
            color: this.props.textPrimary,
            marginTop: 10,
            textAlign: "center",
          }}
        >
          Please try again.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Retry loading app"
          onPress={this.handleRetry}
          style={{
            marginTop: 16,
            backgroundColor: this.props.primary,
            paddingHorizontal: 16,
            paddingVertical: 14,
            minHeight: 48,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: this.props.onPrimary, fontWeight: "700" }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

export default function AppErrorBoundary({ children }: Props) {
  const { THEME } = useTheme();
  return (
    <AppErrorBoundaryClass
      background={THEME.background}
      textPrimary={THEME.textPrimary}
      primary={THEME.primary}
      onPrimary={THEME.onPrimary}
    >
      {children}
    </AppErrorBoundaryClass>
  );
}
