import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { Loading } from "./Loading";
import { api } from "../services/api";
import type {
  Client,
  CompanySettings,
  Invoice,
  InvoiceStatus,
  LineItem,
  Quote,
  QuoteStatus,
} from "../types";
import { addDaysIso, formatMoney, todayIso } from "../utils/format";

type Kind = "quote" | "invoice";
type DocumentValue = Quote | Invoice;

type FormState = {
  clientId: number;
  issueDate: string;
  secondaryDate: string;
  status: QuoteStatus | InvoiceStatus;
  notes: string;
  paymentMethod: string;
  items: LineItem[];
};

export function BusinessDocumentEditor({
  kind,
  initial,
  onClose,
  onSaved,
}: {
  kind: Kind;
  initial: DocumentValue | null;
  onClose: () => void;
  onSaved: (value: DocumentValue) => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Client[]>("/clients"),
      api.get<CompanySettings>("/settings"),
    ])
      .then(([clientRows, company]) => {
        setClients(clientRows);
        setSettings(company);
        const date = initial?.issueDate ?? todayIso();
        setForm({
          clientId: initial?.clientId ?? clientRows[0]?.id ?? 0,
          issueDate: date,
          secondaryDate:
            kind === "quote"
              ? ((initial as Quote | null)?.expiryDate ?? addDaysIso(date, 30))
              : ((initial as Invoice | null)?.dueDate ??
                addDaysIso(date, company.paymentTermsDays)),
          status: initial?.status ?? "draft",
          notes: initial?.notes ?? "",
          paymentMethod:
            (initial as Invoice | null)?.paymentMethod ??
            "Transferencia bancaria",
          items: initial?.items?.length
            ? initial.items.map((item) => ({ ...item }))
            : [
                {
                  description: "",
                  quantity: 1,
                  unitPrice: 0,
                  taxRate: company.defaultTax,
                },
              ],
        });
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo preparar el formulario",
        ),
      );
  }, [kind, initial]);

  const totals = useMemo(() => {
    const items = form?.items ?? [];
    const subtotal = items.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );
    const taxTotal = items.reduce(
      (sum, item) =>
        sum +
        (Number(item.quantity || 0) *
          Number(item.unitPrice || 0) *
          Number(item.taxRate || 0)) /
          100,
      0,
    );
    return { subtotal, taxTotal, total: subtotal + taxTotal };
  }, [form?.items]);

  if (!form || !settings)
    return (
      <Modal title="Preparando documento" onClose={onClose} size="xl">
        {error ? <div className="form-error">{error}</div> : <Loading />}
      </Modal>
    );

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [field]: value } : current));
  const updateItem = (
    index: number,
    field: keyof LineItem,
    value: string | number,
  ) => {
    update(
      "items",
      form.items.map((item, position) =>
        position === index ? { ...item, [field]: value } : item,
      ),
    );
  };
  const addItem = () =>
    update("items", [
      ...form.items,
      {
        description: "",
        quantity: 1,
        unitPrice: 0,
        taxRate: settings.defaultTax,
      },
    ]);
  const removeItem = (index: number) => {
    if (form.items.length === 1) return;
    update(
      "items",
      form.items.filter((_, position) => position !== index),
    );
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const current = form;
    if (!current) return;
    if (!current.clientId) return setError("Debe seleccionar un cliente");
    if (current.items.some((item) => !item.description.trim()))
      return setError("Todos los conceptos deben tener descripción");
    setBusy(true);
    setError("");
    const payload = {
      clientId: Number(current.clientId),
      issueDate: current.issueDate,
      [kind === "quote" ? "expiryDate" : "dueDate"]: current.secondaryDate,
      status: current.status,
      notes: current.notes,
      ...(kind === "invoice" ? { paymentMethod: current.paymentMethod } : {}),
      items: current.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
      })),
    };
    try {
      const endpoint = kind === "quote" ? "/quotes" : "/invoices";
      const saved = initial
        ? await api.put<DocumentValue>(`${endpoint}/${initial.id}`, payload)
        : await api.post<DocumentValue>(endpoint, payload);
      onSaved(saved);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar el documento",
      );
    } finally {
      setBusy(false);
    }
  }

  const title = `${initial ? "Editar" : "Nuevo"} ${kind === "quote" ? "presupuesto" : "factura"}`;
  const quoteStatuses: Array<[QuoteStatus, string]> = [
    ["draft", "Borrador"],
    ["sent", "Enviado"],
    ["accepted", "Aceptado"],
    ["rejected", "Rechazado"],
    ["expired", "Caducado"],
  ];
  const invoiceStatuses: Array<[InvoiceStatus, string]> = [
    ["draft", "Borrador"],
    ["sent", "Enviada"],
    ["paid", "Pagada"],
    ["overdue", "Vencida"],
    ["cancelled", "Anulada"],
  ];
  const statuses = kind === "quote" ? quoteStatuses : invoiceStatuses;

  return (
    <Modal title={title} onClose={onClose} size="xl">
      <form onSubmit={submit}>
        {clients.length === 0 && (
          <div className="form-warning">
            Debe crear al menos un cliente antes de guardar el documento.
          </div>
        )}
        <div className="document-form-header">
          <label>
            Cliente
            <select
              value={form.clientId}
              onChange={(e) => update("clientId", Number(e.target.value))}
              required
            >
              <option value={0}>Seleccione un cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha de emisión
            <input
              type="date"
              value={form.issueDate}
              onChange={(e) => update("issueDate", e.target.value)}
              required
            />
          </label>
          <label>
            {kind === "quote" ? "Válido hasta" : "Fecha de vencimiento"}
            <input
              type="date"
              value={form.secondaryDate}
              onChange={(e) => update("secondaryDate", e.target.value)}
              required
            />
          </label>
          <label>
            Estado
            <select
              value={form.status}
              onChange={(e) =>
                update("status", e.target.value as FormState["status"])
              }
            >
              {statuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="line-items">
          <div className="line-items-header">
            <h3>Conceptos</h3>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={addItem}
            >
              <Plus size={16} />
              Añadir línea
            </button>
          </div>
          <div className="line-table-head">
            <span>Descripción</span>
            <span>Cantidad</span>
            <span>Precio unitario</span>
            <span>IVA %</span>
            <span>Total</span>
            <span />
          </div>
          {form.items.map((item, index) => {
            const total =
              Number(item.quantity || 0) *
              Number(item.unitPrice || 0) *
              (1 + Number(item.taxRate || 0) / 100);
            return (
              <div className="line-item-row" key={index}>
                <input
                  value={item.description}
                  onChange={(e) =>
                    updateItem(index, "description", e.target.value)
                  }
                  placeholder="Servicio, horas, licencia…"
                  required
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(index, "quantity", Number(e.target.value))
                  }
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateItem(index, "unitPrice", Number(e.target.value))
                  }
                  required
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={item.taxRate}
                  onChange={(e) =>
                    updateItem(index, "taxRate", Number(e.target.value))
                  }
                  required
                />
                <strong>{formatMoney(total, settings.currency)}</strong>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => removeItem(index)}
                  disabled={form.items.length === 1}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="document-bottom-grid">
          <div className="document-notes">
            {kind === "invoice" && (
              <label>
                Forma de pago
                <input
                  value={form.paymentMethod}
                  onChange={(e) => update("paymentMethod", e.target.value)}
                />
              </label>
            )}
            <label>
              Observaciones
              <textarea
                rows={5}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Condiciones, alcance o información adicional"
              />
            </label>
          </div>
          <div className="totals-card">
            <div>
              <span>Base imponible</span>
              <strong>{formatMoney(totals.subtotal, settings.currency)}</strong>
            </div>
            <div>
              <span>Impuestos</span>
              <strong>{formatMoney(totals.taxTotal, settings.currency)}</strong>
            </div>
            <div className="grand-total">
              <span>Total</span>
              <strong>{formatMoney(totals.total, settings.currency)}</strong>
            </div>
          </div>
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
          <button
            className="button button-primary"
            disabled={busy || clients.length === 0}
          >
            {busy ? "Guardando…" : "Guardar documento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
