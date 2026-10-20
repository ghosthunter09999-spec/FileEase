import { AlertCircle, CheckCircle2, X } from "lucide-react";

export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  const Icon = toast.type === "error" ? AlertCircle : CheckCircle2;
  return (
    <div className={`toast-message toast-${toast.type}`} role="status">
      <Icon size={19} />
      <span>{toast.message}</span>
      <button onClick={onClose} aria-label="Dismiss notification"><X size={16} /></button>
    </div>
  );
}
