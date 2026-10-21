import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, FileCheck2, LockKeyhole, Zap } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import Navbar from "./components/Navbar.jsx";
import Sidebar, { tools } from "./components/Sidebar.jsx";
import ToolCard from "./components/ToolCard.jsx";
import Toast from "./components/Toast.jsx";
const ImageCompressor = lazy(() => import("./tools/ImageCompressor.jsx"));
const ImageToPdf = lazy(() => import("./tools/ImageToPdf.jsx"));
const PdfCompressor = lazy(() => import("./tools/PdfCompressor.jsx"));
const PdfToImages = lazy(() => import("./tools/PdfToImages.jsx"));
const TextToPdf = lazy(() => import("./tools/TextToPdf.jsx"));
const CamScanner = lazy(() => import("./tools/CamScanner.jsx"));

const seoByTool = {
  home: {
    title: "FileEase — Free Private Image & PDF Tools",
    description: "Free online image and PDF compressor and converter tools. Compress images, create PDFs, and convert documents privately in your browser.",
  },
  "image-compressor": {
    title: "Free Image Compressor (JPG, PNG, WebP) — FileEase",
    description: "Compress JPG, PNG, and WebP images online for free. Adjust image quality, compare file sizes, and download privately in your browser.",
  },
  "image-to-pdf": {
    title: "Images to PDF Converter — Combine Photos Free | FileEase",
    description: "Combine and reorder JPG or PNG images into one PDF online for free. Your images are processed locally and never uploaded.",
  },
  "cam-scanner": {
    title: "Cam Scanner — Scan Documents to PDF Privately | FileEase",
    description: "Scan paper documents with your camera, enhance pages, and create a PDF on your device. No image is uploaded.",
  },
  "pdf-compressor": {
    title: "Free PDF Compressor — Reduce PDF File Size | FileEase",
    description: "Reduce PDF file size with adjustable image quality. Compress documents locally in your browser without uploading your files.",
  },
  "pdf-to-images": {
    title: "PDF to JPG & PNG Converter — Download ZIP | FileEase",
    description: "Convert PDF pages to PNG or JPG images and download them as a ZIP. Fast, free, and processed privately in your browser.",
  },
  "text-to-pdf": {
    title: "Text to PDF Converter — Create a PDF from TXT | FileEase",
    description: "Convert plain text or .txt files into paginated PDF documents for free. Create and download PDFs right in your browser.",
  },
};

const toolCards = [
  { id: "image-compressor", icon: Zap, eyebrow: "IMAGE TOOL", title: "Image compressor", description: "Shrink JPG, PNG, and WebP images with quality control.", color: "blue" },
  { id: "image-to-pdf", icon: FileCheck2, eyebrow: "IMAGE TOOL", title: "Images to PDF", description: "Combine and arrange images into one easy-to-share PDF.", color: "violet" },
  { id: "cam-scanner", icon: LockKeyhole, eyebrow: "IMAGE TOOL", title: "Cam Scanner", description: "Scan, enhance, reorder, and export document pages privately.", color: "blue" },
  { id: "pdf-compressor", icon: LockKeyhole, eyebrow: "PDF TOOL", title: "PDF compressor", description: "Make PDFs smaller for sharing and storage.", color: "mint" },
  { id: "pdf-to-images", icon: ArrowUpRight, eyebrow: "PDF TOOL", title: "PDF to images", description: "Convert every page into images in a handy ZIP.", color: "amber" },
  { id: "text-to-pdf", icon: FileCheck2, eyebrow: "PDF TOOL", title: "Text to PDF", description: "Create a simple, paginated PDF from plain text.", color: "rose" },
];

function Overview({ onSelect }) {
  return (
    <div className="overview-page">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="hero-pill"><span /> YOUR PRIVATE FILE TOOLKIT</div>
          <h1>Less file clutter.<br /><span>More room to work.</span></h1>
          <p>Compress, convert, and get on with your day. A thoughtful set of file tools that runs right here on your device.</p>
          <button className="btn btn-primary hero-button" onClick={() => onSelect("image-compressor")}>Try image compressor <ArrowRight size={16} /></button>
          <div className="hero-points"><span><Check size={14} /> No sign-up</span><span><Check size={14} /> No uploads</span><span><Check size={14} /> Always private</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-file file-back"><div className="art-file-icon purple">PDF</div><span /><span /><span /></div>
          <div className="art-file file-middle"><div className="art-file-icon green">IMG</div><span /><span /><span /></div>
          <div className="art-file file-front"><div className="art-image-preview"><div className="art-sun" /><div className="art-mountain mountain-one" /><div className="art-mountain mountain-two" /></div><strong>sunset-photo.jpg</strong><div className="art-progress"><span /></div><small>Optimized · 68% smaller</small></div>
          <div className="art-sparkle sparkle-a">✦</div><div className="art-sparkle sparkle-b">✳</div>
        </div>
        <div className="hero-footnote"><LockKeyhole size={14} /> Your files never leave your device</div>
      </section>

      <div className="section-heading tools-section-heading"><div><span className="page-kicker">THE TOOLKIT</span><h2>What would you like to do?</h2><p>Simple tools for your everyday file tasks.</p></div><span className="tools-count">05 TOOLS</span></div>
      <div className="tool-grid">
        {toolCards.map((card) => <ToolCard key={card.id} {...card} onClick={() => onSelect(card.id)} />)}
      </div>
      <section className="privacy-strip"><div className="privacy-strip-icon"><LockKeyhole size={19} /></div><div><strong>Private by design. Not just a promise.</strong><p>Your files are processed locally in your browser. They are never uploaded, stored, or shared.</p></div><span className="privacy-strip-badge"><span /> 100% on-device</span></section>
      <footer className="app-footer"><span>© {new Date().getFullYear()} FileEase. Made for simpler file days.</span><span>Private files. Peace of mind.</span></footer>
    </div>
  );
}

export default function App() {
  const [activeTool, setActiveTool] = useState("home");
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("fileease-theme") === "dark"; } catch { return false; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

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
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const notify = (message, type = "success") => setToast({ message, type, id: Date.now() });
  const pageTitle = activeTool === "home" ? "Welcome to your workspace" : tools.find((tool) => tool.id === activeTool)?.label ?? "FileEase";

  return (
    <div className="app-shell">
      <Navbar dark={dark} onToggleTheme={() => setDark((value) => !value)} onMenu={() => setMenuOpen((value) => !value)} onHome={() => setActiveTool("home")} />
      <Sidebar activeTool={activeTool} onSelect={setActiveTool} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="main-content">
        <div className="content-topline"><span>WORKSPACE</span><i />{pageTitle}</div>
        {activeTool === "home" && <Overview onSelect={setActiveTool} />}
        <Suspense fallback={<div className="workspace-card tool-loading" role="status">Preparing your private tool…</div>}>
          {activeTool === "image-compressor" && <ImageCompressor notify={notify} />}
          {activeTool === "image-to-pdf" && <ImageToPdf notify={notify} />}
          {activeTool === "cam-scanner" && <CamScanner notify={notify} />}
          {activeTool === "pdf-compressor" && <PdfCompressor notify={notify} />}
          {activeTool === "pdf-to-images" && <PdfToImages notify={notify} />}
          {activeTool === "text-to-pdf" && <TextToPdf notify={notify} />}
        </Suspense>
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <Analytics />
    </div>
  );
}
