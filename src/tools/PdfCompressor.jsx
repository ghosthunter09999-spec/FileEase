import { useState } from "react";
import { Download, FileText, FileUp, Minimize2, Sparkles } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import UploadZone from "../components/UploadZone.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { downloadBlob, formatBytes, makeOutputName } from "../utils/files.js";
import { rasterizePdf } from "../utils/pdfRender.js";

export default function PdfCompressor({ notify }) {
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState(65);
  const [resolution, setResolution] = useState(1.5);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function compress() {
    setBusy(true);
    setProgress(0);
    setResult(null);
    try {
      const pages = await rasterizePdf(file, {
        scale: resolution,
        quality: quality / 100,
        onProgress: (value) => setProgress(value * 0.8),
      });
      const output = await PDFDocument.create();
      for (let index = 0; index < pages.length; index += 1) {
        const pageImage = await output.embedJpg(pages[index].bytes);
        const page = output.addPage([pages[index].width, pages[index].height]);
        page.drawImage(pageImage, { x: 0, y: 0, width: pages[index].width, height: pages[index].height });
        setProgress(80 + ((index + 1) / pages.length) * 20);
      }
      setResult(new Blob([await output.save({ useObjectStreams: true })], { type: "application/pdf" }));
      notify("PDF compression complete.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't compress the PDF.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function choose(files) {
    const pdf = files[0];
    if (pdf?.type !== "application/pdf" && !pdf?.name.toLowerCase().endsWith(".pdf")) {
      notify("Choose a PDF file.", "error");
      return;
    }
    try {
      await PDFDocument.load(await pdf.arrayBuffer());
      setFile(pdf);
      setResult(null);
    } catch {
      notify("This PDF could not be opened. It may be damaged or password-protected.", "error");
    }
  }

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><Minimize2 size={14} /> PDF TOOL</span>
        <h1>PDF compressor</h1>
        <p>Make a smaller PDF for sharing. Choose a resolution and image quality that balance file size with readable pages.</p>
      </div>
      {!file ? <UploadZone accept="application/pdf,.pdf" onFiles={choose} title="Drop a PDF here" description="Choose a PDF file from your device" /> : (
        <div className="workspace-card">
          <div className="section-heading"><div><h2>Compression settings</h2><p>Choose how crisp your pages should look. Preview the file size before downloading.</p></div></div>
          <div className="image-file-row">
            <div className="file-type-icon file-type-pdf"><FileText size={20} /></div>
            <div className="file-info"><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div>
            <label className={`btn btn-light subtle-button ${busy ? "disabled" : ""}`}>
              <FileUp size={15} /> Choose another
              <input className="visually-hidden" type="file" accept="application/pdf,.pdf" disabled={busy}
                onChange={(event) => { choose(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
            </label>
          </div>
          <div className="control-block pdf-quality">
            <div className="control-label"><label htmlFor="pdf-quality">Image quality</label><strong>{quality}%</strong></div>
            <input id="pdf-quality" className="form-range" type="range" min="35" max="95" value={quality} disabled={busy} onChange={(event) => { setQuality(Number(event.target.value)); setResult(null); }} />
            <div className="range-hints"><span>Smaller file</span><span>Sharper pages</span></div>
          </div>
          <div className="control-block pdf-resolution">
            <label className="control-label" htmlFor="pdf-resolution">Page resolution</label>
            <select id="pdf-resolution" className="form-select" value={resolution} disabled={busy} onChange={(event) => { setResolution(Number(event.target.value)); setResult(null); }}>
              <option value="1">Standard — smaller output</option>
              <option value="1.5">Balanced — recommended</option>
              <option value="2.5">High — sharper details</option>
            </select>
            <small className="compress-hint">Higher resolution keeps more detail but can make the PDF larger.</small>
          </div>
          <div className="notice-box"><strong>Heads up:</strong> To reduce file size, each page is converted to an image. Selectable text, forms, and vector content won't be preserved.</div>
          {busy && <ProgressBar value={progress} label="Compressing PDF pages…" />}
          {result && (() => {
            const difference = Math.round((1 - result.size / file.size) * 100);
            const smaller = difference > 0;
            return <div className="comparison-panel" role="status">
              <div className="comparison-label">BEFORE &amp; AFTER</div>
              <div className="comparison-row"><div><span>Original</span><strong>{formatBytes(file.size)}</strong></div><div className="comparison-arrow">→</div><div><span>New PDF</span><strong>{formatBytes(result.size)}</strong></div><div className={`comparison-saving ${smaller ? "" : "comparison-increased"}`}><strong>{smaller ? `${difference}%` : `${Math.abs(difference)}%`}</strong><span>{smaller ? "smaller" : difference < 0 ? "larger" : "same size"}</span></div></div>
              <p className="pdf-result-note">{smaller ? "Your optimized PDF is smaller and ready to download." : "This version isn't smaller than the original. Try a lower resolution or quality before downloading."}</p>
            </div>;
          })()}
          <div className="tool-actions">
            {result && <button className="btn btn-outline-primary" onClick={() => downloadBlob(result, makeOutputName(file.name, "compressed", "pdf"))}><Download size={16} /> Download optimized PDF</button>}
            <button className="btn btn-primary" onClick={compress} disabled={busy}><Sparkles size={16} /> {busy ? "Compressing…" : result ? "Try these settings" : "Compress PDF"}</button>
          </div>
        </div>
      )}
      <div className="trust-note"><span>✓</span> Your files never leave your device.</div>
    </div>
  );
}
