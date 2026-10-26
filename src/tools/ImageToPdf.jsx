import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, FilePlus2, ImagePlus, Trash2 } from "lucide-react";
import UploadZone from "../components/UploadZone.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { imagesToPdf } from "../lib/pdf.js";
import { downloadBlob, formatBytes } from "../utils/files.js";

export default function ImageToPdf({ notify }) {
  const [files, setFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [pageSize, setPageSize] = useState("fit");
  const [margin, setMargin] = useState(36);
  const [filename, setFilename] = useState("fileease-images");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function addFiles(incoming) {
    const valid = incoming.filter((file) => ["image/jpeg", "image/png"].includes(file.type)
      || ["jpg", "jpeg", "png"].includes(file.name.split(".").pop()?.toLowerCase()));
    if (valid.length !== incoming.length) notify("Some files were skipped. Choose JPG or PNG images.", "error");
    if (valid.length) {
      setFiles((current) => [...current, ...valid]);
      setResult(null);
    }
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const updated = [...files];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setFiles(updated);
    setResult(null);
  }

  function reorder(from, to) {
    if (!Number.isInteger(from) || from === to || from < 0 || to < 0 || to >= files.length) return;
    const updated = [...files];
    const [file] = updated.splice(from, 1);
    updated.splice(to, 0, file);
    setFiles(updated);
    setResult(null);
  }

  async function createPdf() {
    if (!files.length || busy) return;
    setBusy(true);
    setProgress(0);
    setResult(null);
    try {
      const blob = await imagesToPdf(files, { pageSize, margin, onProgress: setProgress });
      setResult(blob);
      notify("Your PDF is ready. Download it whenever you're ready.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't create the PDF.", "error");
    } finally {
      setBusy(false);
    }
  }

  function downloadPdf() {
    const name = filename.trim().replace(/\.pdf$/i, "") || "fileease-images";
    downloadBlob(result, `${name}.pdf`);
  }

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><ImagePlus size={14} /> IMAGE TOOL</span>
        <h1>Images to PDF</h1>
        <p>Bring your images together in one PDF. Arrange the pages, choose a page size, and download your document.</p>
      </div>
      {!files.length ? (
        <UploadZone accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple onFiles={addFiles}
          title="Drop your images here" description="Choose JPG or PNG files — you can reorder the pages next" />
      ) : (
        <div className="workspace-card">
          <div className="section-heading">
            <div><h2>Your pages <span className="count-badge">{files.length}</span></h2><p>Drag a page to reorder it, or use the arrows.</p></div>
            <label className={`btn btn-light subtle-button ${busy ? "disabled" : ""}`}>
              <ImagePlus size={15} /> Add images
              <input className="visually-hidden" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple disabled={busy}
                onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
            </label>
          </div>
          <div className="image-list">
            {files.map((file, index) => (
              <div
                className={`image-list-row ${draggedIndex === index ? "is-reordering" : ""}`}
                key={`${file.name}-${file.lastModified}-${index}`}
                draggable={!busy}
                onDragStart={(event) => {
                  setDraggedIndex(index);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(index));
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const source = Number(event.dataTransfer.getData("text/plain"));
                  reorder(Number.isInteger(source) ? source : draggedIndex, index);
                  setDraggedIndex(null);
                }}
                onDragEnd={() => setDraggedIndex(null)}
              >
                <span className="page-number">{String(index + 1).padStart(2, "0")}</span>
                <img src={previews[index]} alt={`Page ${index + 1} preview`} />
                <div className="file-info"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)}</span></div>
                <div className="reorder-actions">
                  <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${file.name} earlier`}><ArrowUp size={16} /></button>
                  <button type="button" disabled={busy || index === files.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${file.name} later`}><ArrowDown size={16} /></button>
                  <button type="button" disabled={busy} onClick={() => { setFiles(files.filter((_, i) => i !== index)); setResult(null); }} aria-label={`Remove ${file.name}`}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="image-pdf-settings">
            <label htmlFor="image-pdf-page-size"><span>Page size</span>
              <select id="image-pdf-page-size" className="form-select" value={pageSize} disabled={busy} onChange={(event) => { setPageSize(event.target.value); setResult(null); }}>
                <option value="fit">Fit to image</option>
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
              </select>
            </label>
            {pageSize !== "fit" && <label htmlFor="image-pdf-margin"><span>Page margin</span>
              <select id="image-pdf-margin" className="form-select" value={margin} disabled={busy} onChange={(event) => { setMargin(Number(event.target.value)); setResult(null); }}>
                <option value="18">Narrow</option>
                <option value="36">Standard</option>
                <option value="54">Wide</option>
              </select>
            </label>}
            <label className="image-pdf-name" htmlFor="image-pdf-filename"><span>PDF file name</span>
              <div className="document-name-field"><input id="image-pdf-filename" className="form-control" value={filename} disabled={busy} onChange={(event) => setFilename(event.target.value)} /><span>.pdf</span></div>
            </label>
          </div>
          {busy && <ProgressBar value={progress} label="Building your PDF pages…" />}
          {result && <div className="result-banner"><span className="result-banner-icon"><FilePlus2 size={19} /></span><div><strong>Your {formatBytes(result.size)} PDF is ready</strong><span>{files.length} page{files.length === 1 ? "" : "s"} · {pageSize === "fit" ? "fitted to each image" : `${pageSize.toUpperCase()} paper`}</span></div></div>}
          <div className="tool-actions">
            {result && <button className="btn btn-outline-primary" onClick={downloadPdf}><Download size={16} /> Download PDF</button>}
            <button className="btn btn-primary" disabled={busy || !files.length} onClick={createPdf}><FilePlus2 size={16} /> {busy ? "Creating PDF…" : result ? "Rebuild PDF" : "Create PDF"}</button>
          </div>
        </div>
      )}
      <div className="trust-note"><span>✓</span> Your files never leave your device.</div>
    </div>
  );
}
