import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import i18n from "./i18n";

import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";

// 旧前端的页面
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
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
const DocsPage = lazy(() =>
  import("./pages/DocsPage").then((m) => ({ default: m.DocsPage }))
);

// 新前端的仿真主界面（你已经把原来的 App 改名为 SimulationPage.tsx，并 default export）
import SimulationPage from "./pages/SimulationPage";
import { ErrorBoundary } from "./components/ErrorBoundary";

const App: React.FC = () => {
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
            <Layout>
              <LandingPage />
            </Layout>
          }
        />
        <Route
          path="/login"
          element={
            <Layout>
              <LoginPage />
            </Layout>
          }
        />
        <Route
          path="/register"
          element={
            <Layout>
              <RegisterPage />
            </Layout>
          }
        />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Layout>
                <DashboardPage />
              </Layout>
            </RequireAuth>
          }
        />

        <Route
          path="/docs/*"
          element={
            <Layout>
              <DocsPage />
            </Layout>
          }
        />

        {/* SimulationPage 有自己的全屏布局，不需要 Layout 包裹 */}
        <Route
          path="/simulations/new/*"
          element={
            <RequireAuth>
              <ErrorBoundary>
                <SimulationPage />
              </ErrorBoundary>
            </RequireAuth>
          }
        />
        <Route
          path="/simulations/saved"
          element={
            <RequireAuth>
              <Layout>
                <SavedSimulationsPage />
              </Layout>
            </RequireAuth>
          }
        />
        <Route
          path="/simulations/:id"
          element={
            <RequireAuth>
              <ErrorBoundary>
                <SimulationPage />
              </ErrorBoundary>
            </RequireAuth>
          }
        />

        <Route
          path="/settings/*"
          element={
            <RequireAuth>
              <Layout>
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
