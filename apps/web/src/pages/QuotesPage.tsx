import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  FileDown,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { Quote } from "../types";
import { formatDate, formatMoney } from "../utils/format";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { BusinessDocumentEditor } from "../components/BusinessDocumentEditor";
import { useToast } from "../context/ToastContext";

export function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Quote | null | "new">(null);
  const [deleting, setDeleting] = useState<Quote | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  async function load() {
    try {
      setQuotes(await api.get<Quote[]>("/quotes"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los presupuestos",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      quotes.filter((quote) => {
        const matchesSearch =
          !search ||
          `${quote.number} ${quote.clientName}`
            .toLowerCase()
            .includes(search.toLowerCase());
        return matchesSearch && (!status || quote.status === status);
      }),
    [quotes, search, status],
  );

  async function edit(quote: Quote) {
    setBusyId(quote.id);
    try {
      setEditing(await api.get<Quote>(`/quotes/${quote.id}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir");
    } finally {
      setBusyId(null);
    }
  }

  async function convert(quote: Quote) {
    setBusyId(quote.id);
    try {
      await api.post(`/quotes/${quote.id}/convert`);
      toast.success("Presupuesto convertido en factura");
      navigate("/facturas");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo convertir",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api.delete(`/quotes/${deleting.id}`);
      setQuotes((items) => items.filter((item) => item.id !== deleting.id));
      setDeleting(null);
      toast.success("Presupuesto eliminado");
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
          <span className="eyebrow">Actividad comercial</span>
          <h1>Presupuestos</h1>
          <p>Cree propuestas, controle su estado y conviértalas en factura.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setEditing("new")}
        >
          <Plus size={18} />
          Nuevo presupuesto
        </button>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="toolbar-group">
            <div className="search-box">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar número o cliente"
              />
            </div>
            <select
              className="filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="sent">Enviado</option>
              <option value="accepted">Aceptado</option>
              <option value="rejected">Rechazado</option>
              <option value="expired">Caducado</option>
            </select>
          </div>
          <span className="record-count">{filtered.length} presupuestos</span>
        </div>
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search || status ? "Sin resultados" : "No hay presupuestos"}
            description={
              search || status
                ? "Cambie los filtros para ampliar los resultados."
                : "Prepare una propuesta profesional para su próximo cliente."
            }
            action={
              !search && !status ? (
                <button
                  className="button button-primary"
                  onClick={() => setEditing("new")}
                >
                  <Plus size={18} />
                  Crear presupuesto
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Emisión</th>
                  <th>Validez</th>
                  <th>Estado</th>
                  <th className="align-right">Total</th>
                  <th className="actions-column">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <strong>{quote.number}</strong>
                    </td>
                    <td>{quote.clientName}</td>
                    <td>{formatDate(quote.issueDate)}</td>
                    <td>{formatDate(quote.expiryDate)}</td>
                    <td>
                      <StatusBadge status={quote.status} />
                    </td>
                    <td className="align-right">
                      <strong>{formatMoney(quote.total)}</strong>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          title="Descargar PDF"
                          onClick={() =>
                            api
                              .download(
                                `/quotes/${quote.id}/pdf`,
                                `${quote.number}.pdf`,
                              )
                              .catch((e) => toast.error(e.message))
                          }
                        >
                          <FileDown size={17} />
                        </button>
                        <button
                          className="icon-button"
                          title="Editar"
                          disabled={busyId === quote.id}
                          onClick={() => edit(quote)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button"
                          title="Convertir en factura"
                          disabled={busyId === quote.id}
                          onClick={() => convert(quote)}
                        >
                          <ArrowRightLeft size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          title="Eliminar"
                          onClick={() => setDeleting(quote)}
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
        <BusinessDocumentEditor
          kind="quote"
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            const quote = saved as Quote;
            setQuotes((items) =>
              editing === "new"
                ? [quote, ...items]
                : items.map((item) => (item.id === quote.id ? quote : item)),
            );
            setEditing(null);
            toast.success(
              editing === "new"
                ? "Presupuesto creado"
                : "Presupuesto actualizado",
            );
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Eliminar presupuesto"
          message={`Se eliminará ${deleting.number}. Esta acción no se puede deshacer.`}
          onClose={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
