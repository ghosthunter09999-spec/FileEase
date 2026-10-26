import { useEffect, useMemo, useState } from "react";
import { FileImage, FileUp, Images, Package } from "lucide-react";
import JSZip from "jszip";
import UploadZone from "../components/UploadZone.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { downloadBlob, formatBytes } from "../utils/files.js";
import { rasterizePdf } from "../utils/pdfRender.js";

export default function PdfToImages({ notify }) {
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState("png");
  const [scale, setScale] = useState(2);
  const [quality, setQuality] = useState(90);
  const [pages, setPages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const previewUrls = useMemo(() => pages.slice(0, 12).map((page) => URL.createObjectURL(
    new Blob([page.bytes], { type: format === "png" ? "image/png" : "image/jpeg" }),
  )), [pages, format]);

  useEffect(() => () => previewUrls.forEach((url) => URL.revokeObjectURL(url)), [previewUrls]);

  function choose(files) {
    const pdf = files[0];
    if (pdf?.type !== "application/pdf" && !pdf?.name.toLowerCase().endsWith(".pdf")) {
      notify("Choose a PDF file.", "error");
      return;
    }
    setFile(pdf);
    setPages([]);
    setStatus("");
    setProgress(0);
  }

  async function convert() {
    setBusy(true);
    setProgress(0);
    setStatus("Rendering PDF pages…");
    try {
      const rendered = await rasterizePdf(file, {
        scale,
        quality: quality / 100,
        imageType: format === "png" ? "image/png" : "image/jpeg",
        onProgress: (value) => setProgress(value * 100),
      });
      setPages(rendered);
      setProgress(100);
      setStatus("Images are ready");
      notify(`${rendered.length} page${rendered.length === 1 ? "" : "s"} converted.`);
    } catch (error) {
      setPages([]);
      setStatus("");
      notify(error instanceof Error ? error.message : "Couldn't convert this PDF.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function downloadZip() {
    setBusy(true);
    setProgress(0);
    setStatus("Creating ZIP archive…");
    try {
      const zip = new JSZip();
      pages.forEach((page, index) => {
        zip.file(`page-${String(index + 1).padStart(3, "0")}.${format}`, page.bytes);
      });
      const blob = await zip.generateAsync({ type: "blob" }, (metadata) => setProgress(metadata.percent));
      downloadBlob(blob, "fileease-pages.zip");
      setProgress(100);
      notify("Your ZIP archive is ready.");
    } catch (error) {
      setStatus("");
      notify(error instanceof Error ? error.message : "Couldn't create the ZIP archive.", "error");
    } finally {
      setBusy(false);
      setStatus("");
      setProgress(0);
    }
  }

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><FileImage size={14} /> PDF TOOL</span>
        <h1>PDF to images</h1>
        <p>Preview PDF pages as images, choose the detail level, and download all pages together in a ZIP.</p>
      </div>
      {!file ? <UploadZone accept="application/pdf,.pdf" onFiles={choose} title="Drop a PDF here" description="Choose a PDF to convert its pages into images" /> : (
        <div className="workspace-card">
          <div className="section-heading"><div><h2>Convert pages</h2><p>All pages are processed on your device and packaged in a ZIP archive.</p></div></div>
          <div className="image-file-row"><div className="file-type-icon file-type-pdf"><FileImage size={20} /></div><div className="file-info"><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div>
            <label className={`btn btn-light subtle-button ${busy ? "disabled" : ""}`}>
              <FileUp size={15} /> Choose another
              <input className="visually-hidden" type="file" accept="application/pdf,.pdf" disabled={busy}
                onChange={(event) => { choose(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
            </label>
          </div>
          <div className="pdf-image-options">
            <label className="control-block" htmlFor="image-format">
              <span className="control-label">Image format</span>
              <select id="image-format" className="form-select" value={format} disabled={busy} onChange={(event) => { setFormat(event.target.value); setPages([]); }}>
                <option value="png">PNG — lossless, larger</option>
                <option value="jpg">JPG — smaller archive</option>
              </select>
            </label>
            <label className="control-block" htmlFor="pdf-image-scale">
              <span className="control-label">Image resolution</span>
              <select id="pdf-image-scale" className="form-select" value={scale} disabled={busy} onChange={(event) => { setScale(Number(event.target.value)); setPages([]); }}>
                <option value="1.5">Standard — faster, smaller files</option>
                <option value="2">High — recommended</option>
                <option value="3">Maximum — extra detail</option>
              </select>
            </label>
          </div>
          {format === "jpg" && <div className="control-block pdf-quality">
            <div className="control-label"><label htmlFor="pdf-image-quality">JPG quality</label><strong>{quality}%</strong></div>
            <input id="pdf-image-quality" className="form-range" type="range" min="50" max="100" value={quality} disabled={busy} onChange={(event) => { setQuality(Number(event.target.value)); setPages([]); }} />
            <div className="range-hints"><span>Smaller ZIP</span><span>Clearer images</span></div>
          </div>}
          {busy && <ProgressBar value={progress} label={status} />}
          {pages.length > 0 && <>
            <div className="result-banner"><span className="result-banner-icon"><Images size={19} /></span><div><strong>{pages.length} {format.toUpperCase()} images are ready</strong><span>Preview below · {scale}× resolution · download all pages together in a ZIP.</span></div></div>
            <div className="pdf-page-preview-grid" aria-label="Converted page previews">
              {previewUrls.map((url, index) => <figure className="pdf-page-preview" key={`${index}-${url}`}>
                <img src={url} alt={`Preview of converted page ${index + 1}`} loading="lazy" />
                <figcaption>Page {index + 1}</figcaption>
              </figure>)}
            </div>
            {pages.length > previewUrls.length && <p className="pdf-preview-hint">Showing the first {previewUrls.length} pages. All {pages.length} pages will be included in the ZIP.</p>}
          </>}
          <div className="tool-actions">
            {pages.length > 0 && <button className="btn btn-outline-primary" disabled={busy} onClick={downloadZip}><Package size={16} /> {busy && status.includes("ZIP") ? "Preparing ZIP…" : "Download ZIP"}</button>}
            <button className="btn btn-primary" onClick={convert} disabled={busy}><Images size={16} /> {busy ? "Processing…" : pages.length ? "Convert again" : "Convert to images"}</button>
          </div>
        </div>
      )}
      <div className="trust-note"><span>✓</span> Your files never leave your device.</div>
    </div>
  );
}
