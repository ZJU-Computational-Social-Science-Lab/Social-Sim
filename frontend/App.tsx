import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import i18n from "./i18n";

import { Layout } from "./components/Layout";
import { AuthLayout } from "./components/layout/AuthLayout";
import { RequireAuth } from "./components/RequireAuth";
import { useSimulationStore } from "./store";
import { useThemeStore } from "./store/theme";
import { ErrorBoundary } from "./components/ErrorBoundary";

// 旧前端的页面
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const LandingPage = lazy(() =>
  import("./pages/LandingPage").then((m) => ({ default: m.LandingPage }))
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import("./pages/RegisterPage").then((m) => ({ default: m.RegisterPage }))
);
const SavedSimulationsPage = lazy(() =>
  import("./pages/SavedSimulationsPage").then((m) => ({
    default: m.SavedSimulationsPage,
  }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((m) => ({ default: m.AdminPage }))
);
const CreateExperimentPage = lazy(() =>
  import("./pages/CreateExperimentPage").then((m) => ({ default: m.CreateExperimentPage }))
);
const DocsPage = lazy(() =>
  import("./pages/DocsPage").then((m) => ({ default: m.DocsPage }))
);

// 新前端的仿真主界面（你已经把原来的 App 改名为 SimulationPage.tsx，并 default export）
const SimulationPage = lazy(() => import("./pages/SimulationPage"));

const App: React.FC = () => {
  const applyTheme = useThemeStore((state) => state.apply);
  const currentSimulationId = useSimulationStore((state) => state.currentSimulation?.id ?? null);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  return (
    <Suspense
      fallback={
        <div className="app-loading">{i18n.t("common.loading")}</div>
      }
    >
      <Routes>
        <Route
          path="/"
          element={
            <Layout navVariant="product">
              <LandingPage />
            </Layout>
          }
        />
        <Route
          path="/login"
          element={
            <AuthLayout>
              <LoginPage />
            </AuthLayout>
          }
        />
        <Route
          path="/register"
          element={
            <AuthLayout>
              <RegisterPage />
            </AuthLayout>
          }
        />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Layout navVariant="product">
                <DashboardPage />
              </Layout>
            </RequireAuth>
          }
        />

        <Route
          path="/docs/*"
          element={
            <Layout navVariant="product">
              <DocsPage />
            </Layout>
          }
        />

        <Route
          path="/simulations/create"
          element={
            <RequireAuth>
              <Layout navVariant="product">
                <CreateExperimentPage />
              </Layout>
            </RequireAuth>
          }
        />

        <Route
          path="/simulations/new/*"
          element={
            <RequireAuth>
              <Layout navVariant="product">
                <CreateExperimentPage />
              </Layout>
            </RequireAuth>
          }
        />
        <Route
          path="/simulations/workspace"
          element={
            <RequireAuth>
              {currentSimulationId ? (
                <Navigate to={`/simulations/${currentSimulationId}`} replace />
              ) : (
                <Layout navVariant="product">
                  <ErrorBoundary>
                    <SimulationPage />
                  </ErrorBoundary>
                </Layout>
              )}
            </RequireAuth>
          }
        />
        <Route
          path="/simulations/saved"
          element={
            <RequireAuth>
              <Layout navVariant="product">
                <SavedSimulationsPage />
              </Layout>
            </RequireAuth>
          }
        />
        <Route
          path="/simulations/:id"
          element={
            <RequireAuth>
              <Layout navVariant="product">
                <ErrorBoundary>
                  <SimulationPage />
                </ErrorBoundary>
              </Layout>
            </RequireAuth>
          }
        />

        <Route
          path="/settings/*"
          element={
            <RequireAuth>
              <Layout navVariant="product">
                <SettingsPage />
              </Layout>
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <Layout>
                <AdminPage />
              </Layout>
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
