export default function ToolCard({ icon: Icon, eyebrow, title, description, onClick, color = "blue" }) {
  return (
    <button className={`tool-card tool-card-${color}`} onClick={onClick} type="button">
      <span className="tool-card-icon"><Icon size={21} strokeWidth={1.8} /></span>
      <span className="tool-card-body">
        <span className="tool-card-eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
        <span className="tool-card-description">{description}</span>
      </span>
      <span className="tool-card-arrow" aria-hidden="true">↗</span>
    </button>
  );
}
