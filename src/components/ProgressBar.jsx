export default function ProgressBar({ value, label = "Processing…" }) {
  const progress = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div className="progress-wrap" aria-live="polite">
      <div className="progress-label"><span>{label}</span><span>{Math.round(progress)}%</span></div>
      <div className="progress" role="progressbar" aria-label={label} aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
