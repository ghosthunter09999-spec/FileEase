import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, FilePlus2, ImagePlus, Trash2 } from "lucide-react";
import UploadZone from "../components/UploadZone.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { imagesToPdf } from "../lib/pdf.js";
import { downloadBlob, formatBytes } from "../utils/files.js";

export default function ImageToPdf({ notify }) {
  const [files, setFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function addFiles(incoming) {
    const valid = incoming.filter((file) => ["image/jpeg", "image/png"].includes(file.type));
    if (valid.length !== incoming.length) notify("Only JPG and PNG images can be added to a PDF.", "error");
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
  async function createPdf() {
    setBusy(true);
    setProgress(0);
    try {
      setResult(await imagesToPdf(files, setProgress));
      notify("Your PDF is ready to download.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't create the PDF.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><ImagePlus size={14} /> IMAGE TOOL</span>
        <h1>Images to PDF</h1>
        <p>Bring your images together in a single PDF. Arrange the pages in the order you want.</p>
      </div>
      {!files.length ? <UploadZone accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple onFiles={addFiles} title="Drop your images here" description="Add JPG or PNG files — the order can be changed later" /> : (
        <div className="workspace-card">
          <div className="section-heading"><div><h2>Your pages <span className="count-badge">{files.length}</span></h2><p>Use the arrows to change page order.</p></div>
            <button className="btn btn-light subtle-button" onClick={() => document.getElementById("add-images-input")?.click()}><ImagePlus size={15} /> Add images</button>
            <input id="add-images-input" className="visually-hidden" type="file" accept="image/jpeg,image/png" multiple onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          </div>
          <div className="image-list">
            {files.map((file, index) => (
              <div className="image-list-row" key={`${file.name}-${file.lastModified}-${index}`}>
                <span className="page-number">{String(index + 1).padStart(2, "0")}</span>
                <img src={previews[index]} alt="" />
                <div className="file-info"><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div>
                <div className="reorder-actions">
                  <button disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move page up"><ArrowUp size={16} /></button>
                  <button disabled={index === files.length - 1} onClick={() => move(index, 1)} aria-label="Move page down"><ArrowDown size={16} /></button>
                  <button onClick={() => { setFiles(files.filter((_, i) => i !== index)); setResult(null); }} aria-label={`Remove ${file.name}`}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
          {busy && <ProgressBar value={progress} label="Building your PDF…" />}
          <div className="tool-actions">
            {result && <button className="btn btn-outline-primary" onClick={() => downloadBlob(result, "fileease-images.pdf")}><Download size={16} /> Download PDF</button>}
            <button className="btn btn-primary" disabled={busy || !files.length} onClick={createPdf}><FilePlus2 size={16} /> Create PDF</button>
          </div>
        </div>
      )}
      <div className="trust-note"><span>✓</span> Your files never leave your device.</div>
    </div>
  );
}
