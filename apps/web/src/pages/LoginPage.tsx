import { useState, type FormEvent } from "react";
import { Building2, LockKeyhole, User } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo iniciar sesión",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <Building2 size={26} />
        </div>
        <span className="eyebrow">Gestión operativa</span>
        <h1>Gestor Pyme Pro</h1>
        <p>Clientes, presupuestos, facturas y archivos en un único espacio.</p>
        <form onSubmit={submit} className="stack-form">
          <label>
            Usuario
            <div className="input-with-icon">
              <User size={18} />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </label>
          <label>
            Contraseña
            <div className="input-with-icon">
              <LockKeyhole size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                autoFocus
              />
            </div>
          </label>
          {error && <div className="form-error">{error}</div>}
          <button
            className="button button-primary button-block"
            disabled={busy}
          >
            {busy ? "Accediendo…" : "Acceder"}
          </button>
        </form>
        <small className="login-help">
          Las credenciales iniciales se configuran en el archivo{" "}
          <code>.env</code>.
        </small>
      </section>
    </main>
  );
}
