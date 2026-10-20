export default function ProgressBar({ value, label = "Processing…" }) {
  return (
    <div className="progress-wrap" aria-live="polite">
      <div className="progress-label"><span>{label}</span><span>{Math.round(value)}%</span></div>
      <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin="0" aria-valuemax="100">
        <div className="progress-bar" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
