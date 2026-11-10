import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Archive,
  Check,
  FileImage,
  FileText,
  Files,
  LockKeyhole,
  Minimize2,
  ScanLine,
  Scissors,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Navbar from "./components/Navbar.jsx";
import Toast from "./components/Toast.jsx";

const ImageCompressor = lazy(() => import("./tools/ImageCompressor.jsx"));
const ImageToPdf = lazy(() => import("./tools/ImageToPdf.jsx"));
const PdfCompressor = lazy(() => import("./tools/PdfCompressor.jsx"));
const PdfToImages = lazy(() => import("./tools/PdfToImages.jsx"));
const DocumentToPdf = lazy(() => import("./tools/DocumentToPdf.jsx"));
const CamScanner = lazy(() => import("./tools/CamScanner.jsx"));
const DocumentMerger = lazy(() => import("./tools/DocumentMerger.jsx"));
const PdfSplitter = lazy(() => import("./tools/PdfSplitter.jsx"));
const FileCompressor = lazy(() => import("./tools/FileCompressor.jsx"));
const DocumentCompressor = lazy(() => import("./tools/DocumentCompressor.jsx"));

const seoByTool = {
  home: {
    title: "FileFlow — Private file tools, made simple",
    description: "Compress, convert, and organize files with simple browser-based tools. Your files stay on your device.",
  },
  "image-compressor": {
    title: "Image Compressor — FileFlow",
    description: "Compress JPG, PNG, and WebP images online. Adjust quality and download your files privately in your browser.",
  },
  "image-to-pdf": {
    title: "Images to PDF — FileFlow",
    description: "Combine and reorder JPG or PNG images into one PDF. Your images are processed locally.",
  },
  "cam-scanner": {
    title: "Document Scanner — FileFlow",
    description: "Scan, crop, clean, and export document photos as PDFs privately in your browser.",
  },
  "pdf-compressor": {
    title: "PDF Compressor — FileFlow",
    description: "Reduce PDF file size with adjustable image quality. Process documents locally in your browser.",
  },
  "pdf-to-images": {
    title: "PDF to Images — FileFlow",
    description: "Convert PDF pages to PNG or JPG images and download them as a ZIP. Processed privately in your browser.",
  },
  "document-to-pdf": {
    title: "Document to PDF — FileFlow",
    description: "Turn Word and text documents into a clean PDF in your browser.",
  },
  "document-merger": {
    title: "Document Merger — FileFlow",
    description: "Combine and reorder PDFs, Word documents, text, and images into a PDF directly in your browser.",
  },
  "pdf-splitter": {
    title: "PDF Splitter — FileFlow",
    description: "Extract page ranges from a PDF into separate downloadable PDF files, processed locally.",
  },
  "file-compressor": {
    title: "File Compressor — FileFlow",
    description: "Compress multiple files locally into a downloadable ZIP archive.",
  },
  "document-compressor": {
    title: "Document Compressor — FileFlow",
    description: "Compress PDF pages or recompress a DOCX package directly in your browser.",
  },
};

const toolCards = [
  {
    id: "image-compressor",
    category: "compress",
    title: "Image compressor",
    description: "Shrink JPG, PNG, and WebP images without the guesswork.",
    icon: Minimize2,
    tone: "blue",
    formats: "JPG · PNG · WEBP",
  },
  {
    id: "pdf-compressor",
    category: "compress",
    title: "PDF compressor",
    description: "Choose a quality setting and make large PDFs easier to share.",
    icon: FileText,
    tone: "violet",
    formats: "PDF",
  },
  {
    id: "file-compressor",
    category: "compress",
    title: "File compressor",
    description: "Bundle multiple files as a downloadable ZIP archive.",
    icon: Archive,
    tone: "teal",
    formats: "ANY FILE TYPE → ZIP",
  },
  {
    id: "document-compressor",
    category: "compress",
    title: "Document compressor",
    description: "Reduce PDF size or recompress a Word DOCX package.",
    icon: Minimize2,
    tone: "orange",
    formats: "PDF · DOCX",
  },
  {
    id: "image-to-pdf",
    category: "convert",
    title: "Images to PDF",
    description: "Arrange photos in the right order and turn them into one PDF.",
    icon: FileImage,
    tone: "teal",
    formats: "JPG · PNG → PDF",
  },
  {
    id: "pdf-to-images",
    category: "convert",
    title: "PDF to images",
    description: "Preview PDF pages and save them as image files in a ZIP.",
    icon: Files,
    tone: "orange",
    formats: "PDF → JPG · PNG",
  },
  {
    id: "document-to-pdf",
    category: "convert",
    title: "Document to PDF",
    description: "Convert DOCX or text into a clean, shareable PDF.",
    icon: FileText,
    tone: "pink",
    formats: "DOCX · TXT → PDF",
  },
  {
    id: "cam-scanner",
    category: "pdf",
    title: "Document scanner",
    description: "Crop, clean, and export document photos as a PDF.",
    icon: ScanLine,
    tone: "green",
    formats: "CAMERA · IMAGE → PDF",
  },
  {
    id: "document-merger",
    category: "merge-split",
    title: "Document merger",
    description: "Combine PDFs, Word documents, text, and images in your chosen order.",
    icon: Files,
    tone: "teal",
    formats: "PDF · DOCX · TXT · IMAGES",
  },
  {
    id: "pdf-splitter",
    category: "merge-split",
    title: "PDF splitter",
    description: "Extract page ranges as separate PDFs or download them together as a ZIP.",
    icon: Scissors,
    tone: "violet",
    formats: "PDF",
  },
];

const categories = [
  { id: "compress", label: "Compress" },
  { id: "convert", label: "Convert" },
  { id: "pdf", label: "PDF tools" },
  { id: "merge-split", label: "Merge & split" },
];

function ToolCard({ tool, onSelect }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      className="tool-card card"
      onClick={() => onSelect(tool.id)}
      aria-label={`Open ${tool.title}`}
    >
      <span className={`tool-icon tool-icon-${tool.tone}`}><Icon size={21} strokeWidth={1.8} /></span>
      <span className="tool-card-content">
        <span className="tool-formats">{tool.formats}</span>
        <strong>{tool.title}</strong>
        <span className="tool-description">{tool.description}</span>
      </span>
      <span className="tool-card-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
    </button>
  );
}

function ToolSection({ id, title, description, selectedTools, onSelect }) {
  return (
    <section className="tool-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="section-heading">
        <div>
          <span className="section-eyebrow">EXPLORE TOOLS</span>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="section-count">{String(selectedTools.length).padStart(2, "0")} TOOLS</span>
      </div>
      <div className="tool-grid">
        {selectedTools.map((tool) => <ToolCard key={tool.id} tool={tool} onSelect={onSelect} />)}
      </div>
    </section>
  );
}

function Overview({ onSelect, activeCategory, onCategoryChange }) {
  const categoryToolIds = {
    compress: ["image-compressor", "pdf-compressor", "file-compressor", "document-compressor"],
    convert: ["image-to-pdf", "pdf-to-images", "document-to-pdf"],
    pdf: ["pdf-compressor", "pdf-to-images", "document-to-pdf", "cam-scanner", "pdf-splitter", "document-compressor"],
    "merge-split": ["image-to-pdf", "document-merger", "pdf-splitter"],
  };
  const categoryTools = toolCards.filter((tool) => categoryToolIds[activeCategory]?.includes(tool.id));
  const categoryLabel = categories.find((category) => category.id === activeCategory)?.label ?? "Tools";
  const descriptions = {
    compress: "Make large files lighter and easier to share.",
    convert: "Turn everyday files into the format you need.",
    pdf: "Useful tools for working with documents and PDFs.",
    "merge-split": "Combine documents and images, or extract pages into separate PDFs.",
  };
  const mergeTools = toolCards.filter((tool) => categoryToolIds["merge-split"].includes(tool.id));
  const displayedTools = activeCategory === "merge-split" ? mergeTools : categoryTools;

  return (
    <div className="overview-page">
      <section className="hero-panel" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="hero-pill"><Sparkles size={14} /> YOUR EVERYDAY FILE TOOLKIT</span>
          <h1 id="hero-title">Your files, <span>flowing freely.</span></h1>
          <p>Compress, convert, and organize files in a few clicks. No complicated setup, and your files never leave your device.</p>
          <button type="button" className="btn btn-primary hero-button" onClick={() => onSelect("image-compressor")}>
            Explore the tools <ArrowRight size={17} />
          </button>
          <div className="hero-trust"><span><Check size={15} /> Free to use</span><span><Check size={15} /> No account needed</span></div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-glow" />
          <div className="hero-file hero-file-back"><FileText size={28} /><span>PDF</span></div>
          <div className="hero-file hero-file-front"><FileImage size={28} /><span>photo.png</span><i><b /></i><small>File ready</small></div>
          <div className="hero-success"><Check size={17} /></div>
          <div className="hero-visual-note"><LockKeyhole size={15} /> Stays on your device</div>
        </div>
        <div className="hero-private"><LockKeyhole size={15} /> Private processing, right in your browser</div>
      </section>

      <div className="home-section-intro">
        <div><span className="section-eyebrow">THE FILEFLOW TOOLKIT</span><h2>What do you need to do?</h2><p>Pick a task to get started. It only takes a moment.</p></div>
        <span className="tool-count-pill">{toolCards.length} simple tools</span>
      </div>

      <nav className="category-nav" aria-label="Tool categories">
        {categories.map((category) => (
          <button
            type="button"
            className={`category-button ${activeCategory === category.id ? "active" : ""}`}
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
            aria-pressed={activeCategory === category.id}
          >
            {category.label}
          </button>
        ))}
      </nav>

      <ToolSection
        id={`category-${activeCategory}`}
        title={activeCategory === "merge-split" ? "Merge & split files" : categoryLabel}
        description={descriptions[activeCategory]}
        selectedTools={displayedTools}
        onSelect={onSelect}
      />
      <section className="how-section" aria-labelledby="how-title">
        <div className="section-heading">
          <div><span className="section-eyebrow">NO FUSS, JUST FILES</span><h2 id="how-title">How it works</h2><p>Simple steps. Your files stay yours.</p></div>
        </div>
        <div className="how-grid">
          <article className="how-card"><span className="how-number">01</span><div className="how-icon"><ArrowDownToLine size={20} /></div><h3>Choose a tool</h3><p>Pick what you want to do from the simple tool categories.</p></article>
          <article className="how-card"><span className="how-number">02</span><div className="how-icon"><WandSparkles size={20} /></div><h3>Make it yours</h3><p>Add your files and adjust the settings to suit your needs.</p></article>
          <article className="how-card"><span className="how-number">03</span><div className="how-icon"><ArrowRight size={20} /></div><h3>Save your result</h3><p>Download your finished file directly to your device.</p></article>
        </div>
      </section>

      <section className="privacy-strip">
        <span className="privacy-strip-icon"><LockKeyhole size={19} /></span>
        <div><strong>Private by design</strong><p>Your files are handled in your browser and are never uploaded to a server.</p></div>
        <span className="privacy-strip-badge"><span /> On-device processing</span>
      </section>
      <footer className="app-footer">
        <a className="footer-brand" href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>FileFlow</a>
        <span>Simple file tools. More room to flow.</span>
      </footer>
    </div>
  );
}

export default function App() {
  const [activeTool, setActiveTool] = useState("home");
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("fileease-theme") === "dark"; } catch { return false; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState(null);
  const [homeCategory, setHomeCategory] = useState("compress");
  const [toast, setToast] = useState(null);

  const selectTool = (toolId) => {
    setActiveTool(toolId);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectCategory = (categoryId) => {
    setHomeCategory(categoryId);
    setPendingCategory(categoryId);
    setActiveTool("home");
    setMenuOpen(false);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("fileease-theme", dark ? "dark" : "light"); } catch { /* storage may be disabled */ }
  }, [dark]);

  useEffect(() => {
    const metadata = seoByTool[activeTool] ?? seoByTool.home;
    document.title = metadata.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", metadata.description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", metadata.title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", metadata.description);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", metadata.title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", metadata.description);
  }, [activeTool]);

  useEffect(() => {
    if (!pendingCategory || activeTool !== "home") return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`category-${pendingCategory}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingCategory(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTool, homeCategory, pendingCategory]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const notify = (message, type = "success") => setToast({ message, type, id: Date.now() });
  const pageTitle = activeTool === "home" ? "Home" : toolCards.find((tool) => tool.id === activeTool)?.title ?? "FileFlow";

  return (
    <div className="app-shell" id="top">
      <Navbar
        dark={dark}
        onToggleTheme={() => setDark((value) => !value)}
        onMenu={() => setMenuOpen((value) => !value)}
        onHome={() => selectTool("home")}
        onSelectCategory={selectCategory}
        menuOpen={menuOpen}
      />
      <main className="main-content">
        {activeTool !== "home" && <div className="content-topline"><span>FILEFLOW</span><i aria-hidden="true" />{pageTitle}</div>}
        {activeTool === "home" && (
          <Overview
            onSelect={selectTool}
            activeCategory={homeCategory}
            onCategoryChange={setHomeCategory}
          />
        )}
        <Suspense fallback={<div className="workspace-card tool-loading" role="status"><span className="spinner-border spinner-border-sm text-primary me-2" aria-hidden="true" />Preparing your private tool…</div>}>
          {activeTool === "image-compressor" && <ImageCompressor notify={notify} />}
          {activeTool === "image-to-pdf" && <ImageToPdf notify={notify} />}
          {activeTool === "cam-scanner" && <CamScanner notify={notify} />}
          {activeTool === "pdf-compressor" && <PdfCompressor notify={notify} />}
          {activeTool === "pdf-to-images" && <PdfToImages notify={notify} />}
          {activeTool === "document-to-pdf" && <DocumentToPdf notify={notify} />}
          {activeTool === "document-merger" && <DocumentMerger notify={notify} />}
          {activeTool === "pdf-splitter" && <PdfSplitter notify={notify} />}
          {activeTool === "file-compressor" && <FileCompressor notify={notify} />}
          {activeTool === "document-compressor" && <DocumentCompressor notify={notify} />}
        </Suspense>
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
