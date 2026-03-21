import React from "react";
import i18n from "../i18n";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error) {
    console.error("React ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace" }}>
          <h1>{i18n.t("components.errorBoundary.title")}</h1>
          <p style={{ color: "#b91c1c" }}>{String(this.state.error)}</p>
          <p style={{ marginTop: 16 }}>{i18n.t("components.errorBoundary.instructions")}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

