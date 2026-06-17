import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Building2,
  FileText,
  FolderOpen,
  Gauge,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navigation = [
  { to: "/", label: "Panel", icon: Gauge, end: true },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/presupuestos", label: "Presupuestos", icon: FileText },
  { to: "/facturas", label: "Facturas", icon: ReceiptText },
  { to: "/documentos", label: "Documentos", icon: FolderOpen },
  { to: "/configuracion", label: "Configuración", icon: Settings },
];

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { username, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Building2 size={22} />
          </div>
          <div>
            <strong>Gestor Pyme</strong>
            <span>Control operativo</span>
          </div>
          <button
            className="icon-button sidebar-close"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span>{username?.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{username}</strong>
              <small>Administrador</small>
            </div>
          </div>
          <button className="nav-link logout-button" onClick={logout}>
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      )}
      <main className="main-content">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <strong>Gestor Pyme</strong>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
