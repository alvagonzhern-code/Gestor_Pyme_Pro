import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { api } from "../services/api";
import type { Client } from "../types";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";
import { useToast } from "../context/ToastContext";

type ClientForm = {
  type: "company" | "person";
  name: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  notes: string;
};

const emptyClient: ClientForm = {
  type: "company",
  name: "",
  taxId: "",
  email: "",
  phone: "",
  address: "",
  postalCode: "",
  city: "",
  country: "España",
  notes: "",
};

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null | "new">(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const toast = useToast();

  async function load() {
    try {
      setClients(await api.get<Client[]>("/clients"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los clientes",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return clients;
    return clients.filter((client) =>
      [client.name, client.taxId, client.email, client.phone].some((value) =>
        value.toLowerCase().includes(term),
      ),
    );
  }, [clients, search]);

  async function remove() {
    if (!deleting) return;
    try {
      await api.delete(`/clients/${deleting.id}`);
      setClients((items) => items.filter((item) => item.id !== deleting.id));
      setDeleting(null);
      toast.success("Cliente eliminado");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar",
      );
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Base comercial</span>
          <h1>Clientes</h1>
          <p>Datos fiscales, contacto e histórico asociado.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setEditing("new")}
        >
          <Plus size={18} />
          Nuevo cliente
        </button>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, NIF o email"
            />
          </div>
          <span className="record-count">{filtered.length} clientes</span>
        </div>
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "Sin resultados" : "No hay clientes"}
            description={
              search
                ? "Pruebe con otro criterio de búsqueda."
                : "Registre su primer cliente para crear presupuestos y facturas."
            }
            action={
              !search ? (
                <button
                  className="button button-primary"
                  onClick={() => setEditing("new")}
                >
                  <Plus size={18} />
                  Crear cliente
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Ubicación</th>
                  <th>NIF/CIF</th>
                  <th className="actions-column">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className="entity-cell">
                        <span className="entity-avatar">
                          {client.type === "company" ? (
                            <Building2 size={18} />
                          ) : (
                            client.name.charAt(0).toUpperCase()
                          )}
                        </span>
                        <div>
                          <strong>{client.name}</strong>
                          <small>
                            {client.type === "company"
                              ? "Empresa"
                              : "Particular"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="detail-lines">
                        {client.email && (
                          <span>
                            <Mail size={14} />
                            {client.email}
                          </span>
                        )}
                        {client.phone && (
                          <span>
                            <Phone size={14} />
                            {client.phone}
                          </span>
                        )}
                        {!client.email && !client.phone && "—"}
                      </div>
                    </td>
                    <td>
                      {client.city ? (
                        <span className="inline-detail">
                          <MapPin size={14} />
                          {client.city}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{client.taxId || "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          title="Editar"
                          onClick={() => setEditing(client)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          title="Eliminar"
                          onClick={() => setDeleting(client)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <ClientEditor
          client={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(client) => {
            setClients((items) =>
              editing === "new"
                ? [...items, client].sort((a, b) =>
                    a.name.localeCompare(b.name),
                  )
                : items.map((item) => (item.id === client.id ? client : item)),
            );
            setEditing(null);
            toast.success(
              editing === "new" ? "Cliente creado" : "Cliente actualizado",
            );
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Eliminar cliente"
          message={`Se eliminará “${deleting.name}”. Esta acción solo es posible si no tiene documentos comerciales asociados.`}
          onClose={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}

function ClientEditor({
  client,
  onClose,
  onSaved,
}: {
  client: Client | null;
  onClose: () => void;
  onSaved: (client: Client) => void;
}) {
  const [form, setForm] = useState<ClientForm>(
    client
      ? {
          type: client.type,
          name: client.name,
          taxId: client.taxId,
          email: client.email,
          phone: client.phone,
          address: client.address,
          postalCode: client.postalCode,
          city: client.city,
          country: client.country,
          notes: client.notes,
        }
      : emptyClient,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (field: keyof ClientForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = client
        ? await api.put<Client>(`/clients/${client.id}`, form)
        : await api.post<Client>("/clients", form);
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={client ? "Editar cliente" : "Nuevo cliente"}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>
            Tipo
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
            >
              <option value="company">Empresa</option>
              <option value="person">Particular</option>
            </select>
          </label>
          <label>
            Nombre o razón social
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            NIF / CIF
            <input
              value={form.taxId}
              onChange={(e) => set("taxId", e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </label>
          <label className="span-2">
            Dirección
            <input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </label>
          <label>
            Código postal
            <input
              value={form.postalCode}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </label>
          <label>
            Ciudad
            <input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </label>
          <label>
            País
            <input
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </label>
          <label className="span-2">
            Notas
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar cliente"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
