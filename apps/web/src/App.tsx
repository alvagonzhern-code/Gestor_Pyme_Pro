import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Loading } from "./components/Loading";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const ClientsPage = lazy(() =>
  import("./pages/ClientsPage").then((module) => ({
    default: module.ClientsPage,
  })),
);
const QuotesPage = lazy(() =>
  import("./pages/QuotesPage").then((module) => ({
    default: module.QuotesPage,
  })),
);
const InvoicesPage = lazy(() =>
  import("./pages/InvoicesPage").then((module) => ({
    default: module.InvoicesPage,
  })),
);
const DocumentsPage = lazy(() =>
  import("./pages/DocumentsPage").then((module) => ({
    default: module.DocumentsPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

function ProtectedLayout() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="page">
            <Loading />
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="presupuestos" element={<QuotesPage />} />
            <Route path="facturas" element={<InvoicesPage />} />
            <Route path="documentos" element={<DocumentsPage />} />
            <Route path="configuracion" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
