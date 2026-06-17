import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Save, Settings } from "lucide-react";
import { api } from "../services/api";
import type { CompanySettings } from "../types";
import { Loading } from "../components/Loading";
import { useToast } from "../context/ToastContext";

export function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api
      .get<CompanySettings>("/settings")
      .then(setSettings)
      .catch((error) => toast.error(error.message));
  }, []);

  if (!settings)
    return (
      <div className="page">
        <Loading />
      </div>
    );
  const update = (field: keyof CompanySettings, value: string | number) =>
    setSettings((current) =>
      current ? { ...current, [field]: value } : current,
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      setSettings(await api.put<CompanySettings>("/settings", settings));
      toast.success("Configuración guardada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Administración</span>
          <h1>Configuración</h1>
          <p>Datos de empresa, numeración e impuestos por defecto.</p>
        </div>
      </div>
      <form onSubmit={submit} className="settings-layout">
        <section className="panel settings-section">
          <div className="section-title">
            <span>
              <Settings size={20} />
            </span>
            <div>
              <h2>Datos de empresa</h2>
              <p>Información que aparecerá en los PDF.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Razón social
              <input
                value={settings.legalName}
                onChange={(e) => update("legalName", e.target.value)}
                required
              />
            </label>
            <label>
              NIF / CIF
              <input
                value={settings.taxId}
                onChange={(e) => update("taxId", e.target.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={settings.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </label>
            <label>
              Teléfono
              <input
                value={settings.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </label>
            <label className="span-2">
              Dirección
              <input
                value={settings.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </label>
            <label>
              Código postal
              <input
                value={settings.postalCode}
                onChange={(e) => update("postalCode", e.target.value)}
              />
            </label>
            <label>
              Ciudad
              <input
                value={settings.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </label>
            <label>
              País
              <input
                value={settings.country}
                onChange={(e) => update("country", e.target.value)}
              />
            </label>
            <label>
              IBAN
              <input
                value={settings.iban}
                onChange={(e) => update("iban", e.target.value)}
              />
            </label>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="section-title">
            <span>
              <Save size={20} />
            </span>
            <div>
              <h2>Facturación</h2>
              <p>Valores aplicados a nuevos documentos.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Prefijo presupuestos
              <input
                value={settings.quotePrefix}
                onChange={(e) =>
                  update("quotePrefix", e.target.value.toUpperCase())
                }
                required
                maxLength={10}
              />
            </label>
            <label>
              Prefijo facturas
              <input
                value={settings.invoicePrefix}
                onChange={(e) =>
                  update("invoicePrefix", e.target.value.toUpperCase())
                }
                required
                maxLength={10}
              />
            </label>
            <label>
              IVA por defecto (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={settings.defaultTax}
                onChange={(e) => update("defaultTax", Number(e.target.value))}
              />
            </label>
            <label>
              Vencimiento por defecto (días)
              <input
                type="number"
                min="0"
                max="365"
                value={settings.paymentTermsDays}
                onChange={(e) =>
                  update("paymentTermsDays", Number(e.target.value))
                }
              />
            </label>
            <label>
              Moneda
              <select
                value={settings.currency}
                onChange={(e) => update("currency", e.target.value)}
              >
                <option value="EUR">EUR — Euro</option>
                <option value="USD">USD — Dólar</option>
                <option value="GBP">GBP — Libra</option>
              </select>
            </label>
          </div>
          <div className="settings-actions">
            <button className="button button-primary" disabled={busy}>
              <Save size={18} />
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </section>
      </form>
      <PasswordPanel />
    </div>
  );
}

function PasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== repeatPassword)
      return toast.error("Las contraseñas nuevas no coinciden");
    setBusy(true);
    try {
      await api.put("/profile/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      toast.success("Contraseña actualizada");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cambiar",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel settings-section password-panel">
      <div className="section-title">
        <span>
          <KeyRound size={20} />
        </span>
        <div>
          <h2>Seguridad</h2>
          <p>Cambie la contraseña del usuario administrador.</p>
        </div>
      </div>
      <form onSubmit={submit} className="form-grid">
        <label>
          Contraseña actual
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Nueva contraseña
          <input
            type="password"
            minLength={10}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Repita la nueva contraseña
          <input
            type="password"
            minLength={10}
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            required
          />
        </label>
        <div className="align-end">
          <button className="button button-secondary" disabled={busy}>
            {busy ? "Actualizando…" : "Cambiar contraseña"}
          </button>
        </div>
      </form>
    </section>
  );
}
