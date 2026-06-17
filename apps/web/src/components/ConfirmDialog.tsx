import { Modal } from "./Modal";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Eliminar",
  onConfirm,
  onClose,
  busy = false,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p className="dialog-message">{message}</p>
      <div className="modal-actions">
        <button
          className="button button-secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </button>
        <button
          className="button button-danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Procesando…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
