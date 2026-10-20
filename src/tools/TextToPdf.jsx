import { useState } from "react";
import { Download, FileText, Type } from "lucide-react";
import UploadZone from "../components/UploadZone.jsx";
import { textToPdf } from "../lib/pdf.js";
import { downloadBlob, readFileAsText } from "../utils/files.js";

export default function TextToPdf({ notify }) {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("document");
  const [busy, setBusy] = useState(false);

  async function loadFiles(files) {
    const file = files[0];
    if (!file?.name.toLowerCase().endsWith(".txt") && file?.type !== "text/plain") {
      notify("Choose a plain text (.txt) file.", "error");
      return;
    }
    try {
      setText(await readFileAsText(file));
      setFilename(file.name.replace(/\.txt$/i, ""));
      notify("Text file loaded.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't read this text file.", "error");
    }
  }

  async function createPdf() {
    setBusy(true);
    try {
      const blob = await textToPdf(text);
      downloadBlob(blob, `${filename || "document"}.pdf`);
      notify("Your PDF has been downloaded.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Couldn't create the PDF.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><Type size={14} /> PDF TOOL</span>
        <h1>Text to PDF</h1>
        <p>Turn plain text into a clean, paginated PDF document in seconds.</p>
      </div>
      <div className="workspace-card text-workspace">
        <div className="section-heading"><div><h2>Your document</h2><p>Paste your text or open a .txt file from your device.</p></div></div>
        <label className="sr-only" htmlFor="document-name">PDF file name</label>
        <div className="document-name-field"><FileText size={16} /><input id="document-name" className="form-control" value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="document" /><span>.pdf</span></div>
        <label className="sr-only" htmlFor="document-text">Document text</label>
        <textarea id="document-text" className="form-control document-textarea" value={text} onChange={(event) => setText(event.target.value)} placeholder="Start typing or paste your document here…" />
        <div className="text-footer"><span>{text.length.toLocaleString()} characters</span><button className="text-upload-link" onClick={() => document.getElementById("text-file-input")?.click()}>Open a .txt file</button>
          <input id="text-file-input" className="visually-hidden" type="file" accept=".txt,text/plain" onChange={(event) => { loadFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        </div>
        <div className="tool-actions"><button className="btn btn-primary" onClick={createPdf} disabled={busy || !text.trim()}><Download size={16} /> {busy ? "Creating PDF…" : "Create PDF"}</button></div>
      </div>
      {!text && <div className="text-upload-secondary"><UploadZone compact accept=".txt,text/plain" onFiles={loadFiles} title="Have a text file?" description="Drop a .txt file here or browse" /> </div>}
      <div className="trust-note"><span>✓</span> Your files never leave your device.</div>
    </div>
  );
}
