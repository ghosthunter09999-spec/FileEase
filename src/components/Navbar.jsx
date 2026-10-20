import { FileStack, Menu, Moon, Sun } from "lucide-react";

export default function Navbar({ dark, onToggleTheme, onMenu, onHome }) {
  return (
    <header className="topbar">
      <button className="mobile-menu icon-button" onClick={onMenu} aria-label="Open navigation">
        <Menu size={20} />
      </button>
      <button className="brand" type="button" onClick={onHome} aria-label="FileEase home">
        <span className="brand-mark"><FileStack size={20} /></span>
        <span>file<span>ease</span><small>WORKSPACE</small></span>
      </button>
      <div className="topbar-right">
        <span className="local-badge"><span /> 100% local processing</span>
        <button
          className="icon-button theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="avatar" title="Your private workspace">F</div>
      </div>
    </header>
  );
}
