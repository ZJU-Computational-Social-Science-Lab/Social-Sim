import React from "react";
import { useTranslation } from "react-i18next";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: any;
};

export function ErrorBoundary({ children }: Props) {
  const { t } = useTranslation();
  const [state, setState] = React.useState<State>({ hasError: false, error: null });

  React.useEffect(() => {
    const handleError = (error: any) => {
      console.error("React ErrorBoundary Caught:", error);
      setState({ hasError: true, error });
    };

    const handleErrorEvent = (event: ErrorEvent) => {
      handleError(event.error);
    };

    window.addEventListener("error", handleErrorEvent);
    return () => window.removeEventListener("error", handleErrorEvent);
  }, []);

  // Static method for class component compatibility
  ErrorBoundary.getDerivedStateFromError = (error: any) => {
    return { hasError: true, error };
  };

  if (state.hasError) {
    return (
      <div style={{ padding: 24, fontFamily: "monospace" }}>
        <h1>{t('components.errorBoundary.title')}</h1>
        <p style={{ color: "#b91c1c" }}>
          {String(state.error)}
        </p>
        <p style={{ marginTop: 16 }}>
          {t('components.errorBoundary.instructions')}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
