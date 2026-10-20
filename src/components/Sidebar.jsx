import { Camera, FileImage, FilePlus2, FileText, Gauge, Images, LayoutDashboard, Minimize2 } from "lucide-react";

export const tools = [
  { id: "home", label: "Overview", icon: LayoutDashboard, group: "WORKSPACE" },
  { id: "image-compressor", label: "Image compressor", icon: Gauge, group: "IMAGE TOOLS", tag: "Popular" },
  { id: "image-to-pdf", label: "Images to PDF", icon: FilePlus2, group: "IMAGE TOOLS" },
  { id: "cam-scanner", label: "Cam Scanner", icon: Camera, group: "IMAGE TOOLS" },
  { id: "pdf-compressor", label: "PDF compressor", icon: Minimize2, group: "PDF TOOLS" },
  { id: "pdf-to-images", label: "PDF to images", icon: Images, group: "PDF TOOLS" },
  { id: "text-to-pdf", label: "Text to PDF", icon: FileText, group: "PDF TOOLS" },
];

export default function Sidebar({ activeTool, onSelect, open = false, onClose }) {
  const groups = [...new Set(tools.map((tool) => tool.group))];
  return (
    <>
      <div className={`sidebar-scrim ${open ? "visible" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="workspace-label"><span className="workspace-dot" /> PERSONAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-group-title">{group}</div>
              {tools.filter((tool) => tool.group === group).map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={`nav-link ${activeTool === tool.id ? "active" : ""}`}
                    onClick={() => {
                      onSelect(tool.id);
                      onClose?.();
                    }}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{tool.label}</span>
                    {tool.tag && <small>{tool.tag}</small>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-check">✓</span>
            <div><strong>Your privacy matters</strong><p>Files are processed locally and never uploaded.</p></div>
          </div>
          <div className="sidebar-version">FILEEASE · YOUR PRIVATE FILE TOOLKIT</div>
        </div>
      </aside>
    </>
  );
}
