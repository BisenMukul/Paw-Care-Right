import { Component, type ErrorInfo, type ReactNode } from "react";
import { Text, View } from "react-native";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console -- JUSTIFIED: last-resort startup-crash diagnostic; fires only after the UI has already failed (Sentry wiring lands in P9)
    console.error("AppErrorBoundary", error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 items-center justify-center bg-white p-6">
          <Text className="mb-2 text-lg font-semibold text-red-600">App failed to start</Text>
          <Text className="text-center text-sm text-gray-700">{this.state.error.message}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}
