import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileDown,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
} from "lucide-react";
import { api } from "../services/api";
import type { Invoice, InvoiceStatus } from "../types";
import { formatDate, formatMoney } from "../utils/format";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { BusinessDocumentEditor } from "../components/BusinessDocumentEditor";
import { useToast } from "../context/ToastContext";

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Invoice | null | "new">(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const toast = useToast();

  async function load() {
    try {
      setInvoices(await api.get<Invoice[]>("/invoices"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las facturas",
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
      invoices.filter((invoice) => {
        const matchesSearch =
          !search ||
          `${invoice.number} ${invoice.clientName}`
            .toLowerCase()
            .includes(search.toLowerCase());
        return matchesSearch && (!status || invoice.status === status);
      }),
    [invoices, search, status],
  );

  async function edit(invoice: Invoice) {
    setBusyId(invoice.id);
    try {
      setEditing(await api.get<Invoice>(`/invoices/${invoice.id}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir");
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(invoice: Invoice, nextStatus: InvoiceStatus) {
    setBusyId(invoice.id);
    try {
      const updated = await api.patch<Invoice>(
        `/invoices/${invoice.id}/status`,
        { status: nextStatus },
      );
      setInvoices((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success(
        nextStatus === "paid"
          ? "Factura marcada como pagada"
          : "Estado actualizado",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo actualizar",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api.delete(`/invoices/${deleting.id}`);
      setInvoices((items) => items.filter((item) => item.id !== deleting.id));
      setDeleting(null);
      toast.success("Factura eliminada");
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
          <span className="eyebrow">Facturación</span>
          <h1>Facturas</h1>
          <p>Emisión, vencimientos y control de cobros.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setEditing("new")}
        >
          <Plus size={18} />
          Nueva factura
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
              <option value="sent">Enviada</option>
              <option value="paid">Pagada</option>
              <option value="overdue">Vencida</option>
              <option value="cancelled">Anulada</option>
            </select>
          </div>
          <span className="record-count">{filtered.length} facturas</span>
        </div>
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={search || status ? "Sin resultados" : "No hay facturas"}
            description={
              search || status
                ? "Cambie los filtros para ampliar los resultados."
                : "Cree una factura manualmente o convierta un presupuesto aceptado."
            }
            action={
              !search && !status ? (
                <button
                  className="button button-primary"
                  onClick={() => setEditing("new")}
                >
                  <Plus size={18} />
                  Crear factura
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
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th className="align-right">Total</th>
                  <th className="actions-column">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.number}</strong>
                      {invoice.quoteId && (
                        <small className="subtle-tag">Desde presupuesto</small>
                      )}
                    </td>
                    <td>{invoice.clientName}</td>
                    <td>{formatDate(invoice.issueDate)}</td>
                    <td>{formatDate(invoice.dueDate)}</td>
                    <td>
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="align-right">
                      <strong>{formatMoney(invoice.total)}</strong>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          title="Descargar PDF"
                          onClick={() =>
                            api
                              .download(
                                `/invoices/${invoice.id}/pdf`,
                                `${invoice.number}.pdf`,
                              )
                              .catch((e) => toast.error(e.message))
                          }
                        >
                          <FileDown size={17} />
                        </button>
                        {invoice.status !== "paid" &&
                          invoice.status !== "cancelled" && (
                            <button
                              className="icon-button success"
                              title="Marcar como pagada"
                              disabled={busyId === invoice.id}
                              onClick={() => changeStatus(invoice, "paid")}
                            >
                              <CheckCircle2 size={17} />
                            </button>
                          )}
                        <button
                          className="icon-button"
                          title="Editar"
                          disabled={busyId === invoice.id}
                          onClick={() => edit(invoice)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          title="Eliminar"
                          onClick={() => setDeleting(invoice)}
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
          kind="invoice"
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            const invoice = saved as Invoice;
            setInvoices((items) =>
              editing === "new"
                ? [invoice, ...items]
                : items.map((item) =>
                    item.id === invoice.id ? invoice : item,
                  ),
            );
            setEditing(null);
            toast.success(
              editing === "new" ? "Factura creada" : "Factura actualizada",
            );
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Eliminar factura"
          message={`Se eliminará ${deleting.number}. Las facturas pagadas no se eliminan para conservar la trazabilidad.`}
          onClose={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
