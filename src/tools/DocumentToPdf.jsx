import { useState } from "react";
import { Download, FileText, FileUp, Type } from "lucide-react";
import ProgressBar from "../components/ProgressBar.jsx";
import UploadZone from "../components/UploadZone.jsx";
import { documentToPdf } from "../lib/pdf.js";
import { downloadBlob, formatBytes, readFileAsText } from "../utils/files.js";
import { readDocxText } from "../utils/document.js";

export default function DocumentToPdf({ notify }) {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("document");
  const [fileDetails, setFileDetails] = useState(null);
  const [pageSize, setPageSize] = useState("a4");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  async function loadFiles(files) {
    const file = files[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "doc") {
      notify("Legacy .doc files aren't supported. Save the file as .docx or .txt and try again.", "error");
      return;
    }
    if (extension !== "txt" && extension !== "docx" && file.type !== "text/plain") {
      notify("Choose a .txt or .docx document.", "error");
      return;
    }

    setBusy(true);
    setProgress(0);
    setStatus("Reading your document…");
    try {
      const loadedText = extension === "docx" ? await readDocxText(file) : await readFileAsText(file);
      setText(loadedText);
      setFilename(file.name.replace(/\.(docx|txt)$/i, ""));
      setFileDetails({ name: file.name, size: file.size });
      setProgress(100);
      setStatus("Document ready to convert");
      notify("Document loaded. Review the text, then create your PDF.");
    } catch (error) {
      setProgress(0);
      setStatus("");
      const message = error instanceof Error ? error.message : "Couldn't read this document.";
      notify(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function createPdf() {
    if (!text.trim()) return;
    setBusy(true);
    setProgress(0);
    setStatus("Preparing your PDF…");
    try {
      const blob = await documentToPdf(text, pageSize, (value) => {
        setProgress(value);
        setStatus(value < 90 ? "Creating PDF pages…" : "Finishing your PDF…");
      });
      const outputName = filename.trim().replace(/\.pdf$/i, "") || "document";
      downloadBlob(blob, `${outputName}.pdf`);
      setProgress(100);
      setStatus("PDF downloaded");
      notify("Your PDF has been downloaded.");
    } catch (error) {
      setProgress(0);
      setStatus("");
      notify(error instanceof Error ? error.message : "Couldn't create the PDF.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><Type size={14} /> PDF TOOL</span>
        <h1>Document to PDF</h1>
        <p>Convert a Word or text document into a clean, ready-to-share PDF. Your files stay on this device.</p>
      </div>
      <div className="workspace-card document-workspace">
        <div className="section-heading">
          <div><h2>Start with a document</h2><p>Choose a Word (.docx) or plain text (.txt) file, or type directly below.</p></div>
        </div>
        <UploadZone
          accept=".txt,.docx,.doc,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onFiles={loadFiles}
          title="Drop your document here"
          description="Word .docx and plain text .txt files"
        />
        <p className="document-help">Have an older .doc file? Open it in Word and save a copy as .docx first.</p>
        {fileDetails && (
          <div className="image-file-row document-file-row">
            <span className="file-type-icon"><FileUp size={17} /></span>
            <span className="file-info"><strong title={fileDetails.name}>{fileDetails.name}</strong><span>{formatBytes(fileDetails.size)} · ready on your device</span></span>
          </div>
        )}
        <div className="document-settings">
          <label className="document-name-control" htmlFor="document-name">
            <span>PDF file name</span>
            <div className="document-name-field"><FileText size={16} /><input id="document-name" className="form-control" value={filename} onChange={(event) => { setFilename(event.target.value); setStatus(""); }} placeholder="document" /><span>.pdf</span></div>
          </label>
          <label className="document-page-size" htmlFor="document-page-size">
            <span>Page size</span>
            <select id="document-page-size" className="form-select" value={pageSize} onChange={(event) => { setPageSize(event.target.value); setStatus(""); }}>
              <option value="a4">A4</option>
              <option value="letter">US Letter</option>
            </select>
          </label>
        </div>
        <label className="sr-only" htmlFor="document-text">Document text</label>
        <textarea id="document-text" className="form-control document-textarea" value={text} onChange={(event) => { setText(event.target.value); setStatus(""); }} placeholder="Your document text will appear here. You can edit it, or type or paste text directly…" />
        <div className="text-footer"><span>{text.length.toLocaleString()} characters</span><span>Text-only conversion · layout is optimized for readability</span></div>
        {busy && <ProgressBar value={progress} label={status || "Processing document…"} />}
        {!busy && status && progress === 100 && <div className="document-status" role="status">{status}</div>}
        <div className="tool-actions">
          <button className="btn btn-primary" onClick={createPdf} disabled={busy || !text.trim()}><Download size={17} /> {busy ? "Creating PDF…" : "Create PDF"}</button>
        </div>
        <p className="document-privacy">No sign-up required. Documents are processed locally and never uploaded.</p>
      </div>
    </div>
  );
}
