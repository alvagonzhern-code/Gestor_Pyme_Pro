import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Download,
  File,
  FileArchive,
  FolderOpen,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { api } from "../services/api";
import type { Client, ManagedDocument } from "../types";
import { formatBytes, formatDate } from "../utils/format";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState } from "../components/EmptyState";
import { Loading } from "../components/Loading";
import { useToast } from "../context/ToastContext";

const categoryLabels: Record<string, string> = {
  general: "General",
  contract: "Contrato",
  tax: "Fiscal",
  proposal: "Propuesta",
  delivery: "Entregable",
  other: "Otro",
};

export function DocumentsPage() {
  const [documents, setDocuments] = useState<ManagedDocument[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<ManagedDocument | null>(null);
  const toast = useToast();

  useEffect(() => {
    Promise.all([
      api.get<ManagedDocument[]>("/documents"),
      api.get<Client[]>("/clients"),
    ])
      .then(([docs, clientRows]) => {
        setDocuments(docs);
        setClients(clientRows);
      })
      .catch((error) =>
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los documentos",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return !term
      ? documents
      : documents.filter((doc) =>
          `${doc.filename} ${doc.clientName ?? ""} ${doc.category} ${doc.notes}`
            .toLowerCase()
            .includes(term),
        );
  }, [documents, search]);

  async function remove() {
    if (!deleting) return;
    try {
      await api.delete(`/documents/${deleting.id}`);
      setDocuments((items) => items.filter((item) => item.id !== deleting.id));
      setDeleting(null);
      toast.success("Documento eliminado");
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
          <span className="eyebrow">Archivo digital</span>
          <h1>Documentos</h1>
          <p>Contratos, entregables y documentación vinculada a clientes.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setUploading(true)}
        >
          <Plus size={18} />
          Subir documento
        </button>
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar archivo, cliente o categoría"
            />
          </div>
          <span className="record-count">{filtered.length} archivos</span>
        </div>
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={search ? "Sin resultados" : "No hay documentos"}
            description={
              search
                ? "Pruebe otra búsqueda."
                : "Centralice los archivos relevantes de cada cliente."
            }
            action={
              !search ? (
                <button
                  className="button button-primary"
                  onClick={() => setUploading(true)}
                >
                  <UploadCloud size={18} />
                  Subir archivo
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="document-grid">
            {filtered.map((document) => (
              <article className="document-card" key={document.id}>
                <div className="file-icon">
                  {document.mimeType.includes("zip") ? (
                    <FileArchive size={24} />
                  ) : (
                    <File size={24} />
                  )}
                </div>
                <div className="document-card-body">
                  <strong title={document.filename}>{document.filename}</strong>
                  <span>
                    {document.clientName || "Sin cliente"} ·{" "}
                    {categoryLabels[document.category] ?? document.category}
                  </span>
                  <small>
                    {formatBytes(document.sizeBytes)} ·{" "}
                    {formatDate(document.uploadedAt)}
                  </small>
                  {document.notes && <p>{document.notes}</p>}
                </div>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    title="Descargar"
                    onClick={() =>
                      api
                        .download(
                          `/documents/${document.id}/download`,
                          document.filename,
                        )
                        .catch((e) => toast.error(e.message))
                    }
                  >
                    <Download size={17} />
                  </button>
                  <button
                    className="icon-button danger"
                    title="Eliminar"
                    onClick={() => setDeleting(document)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {uploading && (
        <UploadDocument
          clients={clients}
          onClose={() => setUploading(false)}
          onUploaded={(document) => {
            setDocuments((items) => [document, ...items]);
            setUploading(false);
            toast.success("Documento subido");
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Eliminar documento"
          message={`Se eliminarán el registro y el archivo “${deleting.filename}”.`}
          onClose={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}

function UploadDocument({
  clients,
  onClose,
  onUploaded,
}: {
  clients: Client[];
  onClose: () => void;
  onUploaded: (document: ManagedDocument) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState("");
  const [category, setCategory] = useState("general");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return setError("Seleccione un archivo");
    const data = new FormData();
    data.append("file", file);
    data.append("clientId", clientId);
    data.append("category", category);
    data.append("notes", notes);
    setBusy(true);
    setError("");
    try {
      onUploaded(await api.post<ManagedDocument>("/documents", data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo subir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Subir documento" onClose={onClose} size="md">
      <form onSubmit={submit}>
        <label className="file-drop">
          <UploadCloud size={30} />
          <strong>{file ? file.name : "Seleccione un archivo"}</strong>
          <span>PDF, imágenes, Word, Excel, CSV o texto · máximo 10 MB</span>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </label>
        <div className="form-grid form-grid-spaced">
          <label>
            Cliente asociado
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Sin cliente</option>
              {clients.map((client) => (
                <option value={client.id} key={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoría
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Notas
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            {busy ? "Subiendo…" : "Subir documento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
