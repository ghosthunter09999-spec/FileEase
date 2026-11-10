import { useEffect, useState } from "react";
import JSZip from "jszip";
import { Download, Files, Scissors } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import ProgressBar from "../components/ProgressBar.jsx";
import UploadZone from "../components/UploadZone.jsx";
import { splitPdf } from "../lib/splitPdf.js";
import { downloadBlob, formatBytes } from "../utils/files.js";

function safeFilename(name) {
  return name.replace(/\.pdf$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "document";
}

export default function PdfSplitter({ notify }) {
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [ranges, setRanges] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function loadFiles(files) {
    const pdfFile = files[0];
    if (!pdfFile) return;
    if (files.length > 1) notify("PDF Splitter uses one PDF at a time. The first file was selected.", "error");
    if (!/\.pdf$/i.test(pdfFile.name) && pdfFile.type !== "application/pdf") {
      notify("Choose a PDF file to split.", "error");
      return;
    }

    try {
      const pdf = await PDFDocument.load(await pdfFile.arrayBuffer());
      const nextPreviewUrl = URL.createObjectURL(pdfFile);
      setPreviewUrl(nextPreviewUrl);
      setFile(pdfFile);
      setPageCount(pdf.getPageCount());
      setRanges(`1-${pdf.getPageCount()}`);
      setStatus("");
    } catch (error) {
      notify(error instanceof Error ? `Couldn't open this PDF. It may be damaged or password-protected.` : "Couldn't open this PDF.", "error");
    }
  }

  async function downloadSplit() {
    if (!file || !ranges.trim()) return;
    setBusy(true);
    setProgress(0);
    setStatus("Preparing your page ranges…");
    try {
      const outputs = await splitPdf(file, ranges, (value) => {
        setProgress(value);
        setStatus("Creating your PDF files…");
      });
      const base = safeFilename(file.name);
      if (outputs.length === 1) {
        const pagesLabel = outputs[0].pages.length === 1
          ? `page-${outputs[0].pages[0]}`
          : `pages-${outputs[0].pages[0]}-${outputs[0].pages.at(-1)}`;
        downloadBlob(new Blob([outputs[0].bytes], { type: "application/pdf" }), `${base}-${pagesLabel}.pdf`);
      } else {
        const archive = new JSZip();
        outputs.forEach((output, index) => {
          const first = output.pages[0];
          const last = output.pages.at(-1);
          const pageLabel = first === last ? `page-${first}` : `pages-${first}-${last}`;
          archive.file(`${base}-${pageLabel}-${index + 1}.pdf`, output.bytes);
        });
        downloadBlob(await archive.generateAsync({ type: "blob" }), `${base}-split-files.zip`);
      }
      setProgress(100);
      setStatus(`${outputs.length} ${outputs.length === 1 ? "PDF is" : "PDFs are"} ready`);
      notify(outputs.length === 1 ? "Your split PDF has been downloaded." : `${outputs.length} split PDFs have been downloaded as a ZIP.`);
    } catch (error) {
      setProgress(0);
      setStatus("");
      notify(error instanceof Error ? error.message : "Couldn't split this PDF.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><Scissors size={14} /> PDF TOOL</span>
        <h1>PDF splitter</h1>
        <p>Extract page ranges into separate PDFs. Enter page numbers or ranges, and download one PDF or a ZIP of them.</p>
      </div>

      <section className="workspace-card splitter-workspace" aria-labelledby="splitter-upload-title">
        <div className="section-heading">
          <div><h2 id="splitter-upload-title">Choose a PDF</h2><p>Your document stays on this device. Password-protected PDFs aren't supported.</p></div>
        </div>
        <UploadZone
          accept=".pdf,application/pdf"
          onFiles={loadFiles}
          title={file ? "Choose a different PDF" : "Drop a PDF here"}
          description="Select one PDF file from your device"
          compact={Boolean(file)}
        />

        {file && (
          <div className="splitter-content">
            <div className="image-file-row">
              <span className="file-type-icon file-type-pdf"><Files size={17} /></span>
              <span className="file-info"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)} · {pageCount} {pageCount === 1 ? "page" : "pages"}</span></span>
              <span className="saved-pill">Ready</span>
            </div>
            <div className="splitter-preview"><iframe src={`${previewUrl}#toolbar=0`} title={`Preview of ${file.name}`} /></div>
            <label className="splitter-range-label" htmlFor="split-page-ranges">Page ranges <span>Use commas between files to create, for example, “1-3, 5, 7-9”.</span></label>
            <input
              id="split-page-ranges"
              className="form-control splitter-range-input"
              value={ranges}
              onChange={(event) => { setRanges(event.target.value); setStatus(""); }}
              placeholder="Example: 1-3, 5, 7-9"
              disabled={busy}
              aria-describedby="split-range-help"
            />
            <p id="split-range-help" className="splitter-help">Each comma-separated entry becomes a separate PDF. Page numbers must be between 1 and {pageCount}.</p>
          </div>
        )}

        {busy && <ProgressBar value={progress} label={status} />}
        {!busy && status && <p className="merger-status" role="status">{status}</p>}
        <div className="tool-actions">
          <button type="button" className="btn btn-primary" onClick={downloadSplit} disabled={!file || !ranges.trim() || busy}>
            {busy ? "Splitting…" : <><Download size={17} /> Split &amp; download</>}
          </button>
        </div>
        <p className="merger-privacy">Extracted pages keep their original content. Processing happens locally in your browser.</p>
      </section>
    </div>
  );
}
