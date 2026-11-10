import { FileStack, Menu, Moon, ShieldCheck, Sun, X } from "lucide-react";

const categories = [
  { id: "compress", label: "Compress" },
  { id: "convert", label: "Convert" },
  { id: "pdf", label: "PDF tools" },
  { id: "merge-split", label: "Merge & split" },
];

export default function Navbar({
  dark,
  onToggleTheme,
  onMenu,
  onHome,
  onSelectCategory,
  menuOpen = false,
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="brand" type="button" onClick={onHome} aria-label="FileFlow home">
          <span className="brand-mark"><FileStack size={21} strokeWidth={2} /></span>
          <span className="brand-wordmark">File<span>Flow</span></span>
        </button>

        <button
          className="mobile-menu icon-button"
          type="button"
          onClick={onMenu}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav id="primary-navigation" className={`primary-navigation ${menuOpen ? "navigation-open" : ""}`} aria-label="Tool categories">
          {categories.map((category) => (
            <button type="button" key={category.id} onClick={() => onSelectCategory(category.id)}>
              {category.label}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <span className="local-badge"><ShieldCheck size={16} /> Files stay on your device</span>
          <button
            className="icon-button theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
