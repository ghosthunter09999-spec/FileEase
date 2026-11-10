import { useState } from "react";
import { Download, FileText, FileUp, Minimize2, Sparkles } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import UploadZone from "../components/UploadZone.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { compressDocxDocument } from "../lib/documentCompression.js";
import { downloadBlob, formatBytes, makeOutputName } from "../utils/files.js";
import { rasterizePdf } from "../utils/pdfRender.js";

export default function DocumentCompressor({ notify }) {
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState(65);
  const [resolution, setResolution] = useState(1.5);
  const [docxLevel, setDocxLevel] = useState(9);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const extension = file?.name.split(".").pop()?.toLowerCase();

  async function compress() {
    if (!file || busy) return;
    setBusy(true);
    setProgress(0);
    setResult(null);
    try {
      let blob;
      if (extension === "pdf") {
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
        blob = new Blob([await output.save({ useObjectStreams: true })], { type: "application/pdf" });
      } else {
        blob = await compressDocxDocument(file, docxLevel, setProgress);
      }
      setResult(blob);
      notify("Document compression complete.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't compress this document.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function choose(files) {
    const document = files[0];
    if (!document) return;
    const type = document.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx"].includes(type)) {
      notify("Choose a PDF or DOCX document.", "error");
      return;
    }
    try {
      if (type === "pdf") await PDFDocument.load(await document.arrayBuffer());
      else {
        const JSZip = (await import("jszip")).default;
        const archive = await JSZip.loadAsync(document);
        if (!archive.file("word/document.xml")) throw new Error("This Word file doesn't contain a readable document.");
      }
      setFile(document);
      setResult(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : "This document could not be opened.", "error");
    }
  }

  function download() {
    if (!result || !file) return;
    const extensionName = extension === "docx" ? "docx" : "pdf";
    downloadBlob(result, makeOutputName(file.name, "compressed", extensionName));
  }

  const sizeChange = result ? Math.round((1 - result.size / file.size) * 100) : null;
  const pdf = extension === "pdf";

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><Minimize2 size={14} /> DOCUMENT TOOL</span>
        <h1>Document compressor</h1>
        <p>Reduce PDF size by tuning page quality, or recompress a DOCX package. Processing stays in your browser.</p>
      </div>
      {!file ? (
        <UploadZone
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onFiles={choose}
          title="Drop a document here"
          description="PDF or Word .docx file"
        />
      ) : (
        <div className="workspace-card">
          <div className="section-heading"><div><h2>Compression settings</h2><p>{pdf ? "Tune image quality and resolution to balance size with readability." : "Repackage the Word document using strong ZIP compression."}</p></div></div>
          <div className="image-file-row">
            <div className={`file-type-icon ${pdf ? "file-type-pdf" : ""}`}><FileText size={20} /></div>
            <div className="file-info"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)} · {pdf ? "PDF document" : "Word document"}</span></div>
            <label className={`btn btn-light subtle-button ${busy ? "disabled" : ""}`}>
              <FileUp size={15} /> Choose another
              <input className="visually-hidden" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy}
                onChange={(event) => { choose(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
            </label>
          </div>

          {pdf ? (
            <>
              <div className="control-block pdf-quality">
                <div className="control-label"><label htmlFor="document-pdf-quality">Image quality</label><strong>{quality}%</strong></div>
                <input id="document-pdf-quality" className="form-range" type="range" min="35" max="95" value={quality} disabled={busy} onChange={(event) => { setQuality(Number(event.target.value)); setResult(null); }} />
                <div className="range-hints"><span>Smaller file</span><span>Sharper pages</span></div>
              </div>
              <div className="control-block pdf-resolution">
                <label className="control-label" htmlFor="document-pdf-resolution">Page resolution</label>
                <select id="document-pdf-resolution" className="form-select" value={resolution} disabled={busy} onChange={(event) => { setResolution(Number(event.target.value)); setResult(null); }}>
                  <option value="1">Standard — smaller output</option>
                  <option value="1.5">Balanced — recommended</option>
                  <option value="2.5">High — sharper details</option>
                </select>
                <small className="compress-hint">Higher resolution keeps more detail but can make the PDF larger.</small>
              </div>
              <div className="notice-box"><strong>PDF note:</strong> Pages are converted to images to reduce size. Selectable text, forms, and vector content won't be preserved.</div>
            </>
          ) : (
            <>
              <div className="control-block pdf-quality">
                <div className="control-label"><label htmlFor="docx-compression-level">Package compression</label><strong>Level {docxLevel}</strong></div>
                <input id="docx-compression-level" className="form-range" type="range" min="1" max="9" value={docxLevel} disabled={busy} onChange={(event) => { setDocxLevel(Number(event.target.value)); setResult(null); }} />
                <div className="range-hints"><span>Faster</span><span>Smaller package</span></div>
              </div>
              <div className="notice-box"><strong>DOCX note:</strong> This recompresses the document package without changing its contents. Already-compressed embedded images are not resized, so savings may be small.</div>
            </>
          )}

          {busy && <ProgressBar value={progress} label={`Compressing ${pdf ? "PDF pages" : "Word package"}…`} />}
          {result && (
            <div className="comparison-panel" role="status">
              <div className="comparison-label">BEFORE &amp; AFTER</div>
              <div className="comparison-row"><div><span>Original</span><strong>{formatBytes(file.size)}</strong></div><div className="comparison-arrow">→</div><div><span>Compressed</span><strong>{formatBytes(result.size)}</strong></div><div className={`comparison-saving ${sizeChange < 0 ? "comparison-increased" : ""}`}><strong>{sizeChange > 0 ? `${sizeChange}%` : `${Math.abs(sizeChange)}%`}</strong><span>{sizeChange > 0 ? "smaller" : sizeChange < 0 ? "larger" : "same size"}</span></div></div>
              <p className="pdf-result-note">{sizeChange > 0 ? "The compressed document is smaller and ready to download." : "This document didn't get smaller with these settings. You can still download it, or try different settings."}</p>
            </div>
          )}
          <div className="tool-actions">
            {result && <button className="btn btn-outline-primary" onClick={download}><Download size={16} /> Download compressed {extension?.toUpperCase()}</button>}
            <button className="btn btn-primary" onClick={compress} disabled={busy}><Sparkles size={16} /> {busy ? "Compressing…" : result ? "Try these settings" : "Compress document"}</button>
          </div>
        </div>
      )}
      <div className="trust-note"><span>✓</span> Your documents never leave your device.</div>
    </div>
  );
}
