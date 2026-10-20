import { useState } from "react";
import { Download, FileImage, Images, Package } from "lucide-react";
import JSZip from "jszip";
import UploadZone from "../components/UploadZone.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { downloadBlob, formatBytes } from "../utils/files.js";
import { rasterizePdf } from "../utils/pdfRender.js";

export default function PdfToImages({ notify }) {
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState("png");
  const [pages, setPages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  function choose(files) {
    const pdf = files[0];
    if (pdf?.type !== "application/pdf" && !pdf?.name.toLowerCase().endsWith(".pdf")) {
      notify("Choose a PDF file.", "error");
      return;
    }
    setFile(pdf);
    setPages([]);
  }

  async function convert() {
    setBusy(true);
    setProgress(0);
    try {
      const rendered = await rasterizePdf(file, {
        scale: 2,
        quality: 0.9,
        imageType: format === "png" ? "image/png" : "image/jpeg",
        onProgress: setProgress,
      });
      setPages(rendered);
      notify(`${rendered.length} page${rendered.length === 1 ? "" : "s"} converted.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't convert this PDF.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function downloadZip() {
    try {
      const zip = new JSZip();
      pages.forEach((page, index) => {
        zip.file(`page-${String(index + 1).padStart(3, "0")}.${format}`, page.bytes);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "fileease-pages.zip");
      notify("Your ZIP archive is ready.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't create the ZIP archive.", "error");
    }
  }

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><FileImage size={14} /> PDF TOOL</span>
        <h1>PDF to images</h1>
        <p>Turn every PDF page into a crisp image and download them together in a ZIP.</p>
      </div>
      {!file ? <UploadZone accept="application/pdf,.pdf" onFiles={choose} title="Drop a PDF here" description="Choose a PDF to convert its pages into images" /> : (
        <div className="workspace-card">
          <div className="section-heading"><div><h2>Convert pages</h2><p>All pages will be rendered and packaged in a ZIP archive.</p></div></div>
          <div className="image-file-row"><div className="file-type-icon file-type-pdf"><FileImage size={20} /></div><div className="file-info"><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div></div>
          <div className="control-block pdf-quality">
            <label className="control-label" htmlFor="image-format">Image format</label>
            <select id="image-format" className="form-select" value={format} onChange={(event) => { setFormat(event.target.value); setPages([]); }}>
              <option value="png">PNG — lossless</option>
              <option value="jpg">JPG — smaller archive</option>
            </select>
          </div>
          {busy && <ProgressBar value={progress} label="Rendering PDF pages…" />}
          {pages.length > 0 && <div className="result-banner"><span className="result-banner-icon"><Images size={19} /></span><div><strong>{pages.length} pages are ready</strong><span>Images will be saved together as a ZIP.</span></div></div>}
          <div className="tool-actions">
            {pages.length > 0 && <button className="btn btn-outline-primary" onClick={downloadZip}><Package size={16} /> Download ZIP</button>}
            <button className="btn btn-primary" onClick={convert} disabled={busy}><Images size={16} /> Convert to images</button>
          </div>
        </div>
      )}
      <div className="trust-note"><span>✓</span> Your files never leave your device.</div>
    </div>
  );
}
