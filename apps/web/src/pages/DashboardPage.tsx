import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  ReceiptText,
  Users,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { formatDate, formatMoney } from "../utils/format";
import { Loading } from "../components/Loading";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";

type DashboardData = {
  summary: {
    clientCount: number;
    openQuoteCount: number;
    openQuoteValue: number;
    pendingInvoiceCount: number;
    pendingInvoiceValue: number;
    paidThisYear: number;
    overdueCount: number;
    overdueValue: number;
  };
  recentInvoices: Array<{
    id: number;
    number: string;
    clientName: string;
    issueDate: string;
    dueDate: string;
    status: string;
    total: number;
  }>;
  recentQuotes: Array<{
    id: number;
    number: string;
    clientName: string;
    issueDate: string;
    expiryDate: string;
    status: string;
    total: number;
  }>;
  monthlyRevenue: Array<{ month: string; total: number }>;
};

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const toast = useToast();

  useEffect(() => {
    api
      .get<DashboardData>("/dashboard")
      .then(setData)
      .catch((error) => toast.error(error.message));
  }, []);

  if (!data)
    return (
      <div className="page">
        <Loading />
      </div>
    );
  const { summary } = data;
  const chartData = data.monthlyRevenue.map((entry) => ({
    ...entry,
    label: entry.month.split("-").reverse().join("/"),
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Visión general</span>
          <h1>Panel de control</h1>
          <p>Situación comercial y de cobros actualizada.</p>
        </div>
        <div className="header-actions">
          <Link className="button button-secondary" to="/presupuestos">
            Nuevo presupuesto
          </Link>
          <Link className="button button-primary" to="/facturas">
            Nueva factura
          </Link>
        </div>
      </div>

      <section className="metric-grid">
        <article className="metric-card">
          <span className="metric-icon">
            <Users size={20} />
          </span>
          <div>
            <small>Clientes</small>
            <strong>{summary.clientCount}</strong>
            <span>registrados</span>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-icon">
            <FileText size={20} />
          </span>
          <div>
            <small>Presupuestos abiertos</small>
            <strong>{formatMoney(summary.openQuoteValue)}</strong>
            <span>{summary.openQuoteCount} documentos</span>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-icon">
            <ReceiptText size={20} />
          </span>
          <div>
            <small>Pendiente de cobro</small>
            <strong>{formatMoney(summary.pendingInvoiceValue)}</strong>
            <span>{summary.pendingInvoiceCount} facturas</span>
          </div>
        </article>
        <article
          className={`metric-card ${summary.overdueCount ? "metric-warning" : ""}`}
        >
          <span className="metric-icon">
            <AlertTriangle size={20} />
          </span>
          <div>
            <small>Vencido</small>
            <strong>{formatMoney(summary.overdueValue)}</strong>
            <span>{summary.overdueCount} facturas</span>
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>Ingresos cobrados</h2>
              <p>Últimos seis meses</p>
            </div>
            <div className="panel-kpi">
              <WalletCards size={18} />
              {formatMoney(summary.paidThisYear)} este año
            </div>
          </div>
          <RevenueChart data={chartData} />
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Facturas recientes</h2>
              <p>Últimos movimientos</p>
            </div>
            <Link to="/facturas" className="text-link">
              Ver todas <ArrowRight size={15} />
            </Link>
          </div>
          <div className="compact-list">
            {data.recentInvoices.length === 0 && (
              <p className="muted">Todavía no hay facturas.</p>
            )}
            {data.recentInvoices.map((invoice) => (
              <Link to="/facturas" key={invoice.id} className="compact-row">
                <div>
                  <strong>{invoice.number}</strong>
                  <span>
                    {invoice.clientName} · {formatDate(invoice.issueDate)}
                  </span>
                </div>
                <div>
                  <strong>{formatMoney(invoice.total)}</strong>
                  <StatusBadge status={invoice.status} />
                </div>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Presupuestos recientes</h2>
            <p>Seguimiento comercial</p>
          </div>
          <Link to="/presupuestos" className="text-link">
            Ver todos <ArrowRight size={15} />
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Validez</th>
                <th>Estado</th>
                <th className="align-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.recentQuotes.map((quote) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RevenueChart({
  data,
}: {
  data: Array<{ label: string; total: number }>;
}) {
  const maximum = Math.max(...data.map((entry) => entry.total), 1);
  return (
    <div
      className="revenue-chart"
      role="img"
      aria-label="Ingresos cobrados de los últimos seis meses"
    >
      {data.map((entry) => (
        <div className="revenue-column" key={entry.label}>
          <div className="revenue-value">{formatMoney(entry.total)}</div>
          <div className="revenue-track">
            <span
              style={{
                height: `${Math.max((entry.total / maximum) * 100, entry.total ? 6 : 2)}%`,
              }}
            />
          </div>
          <strong>{entry.label}</strong>
        </div>
      ))}
    </div>
  );
}
