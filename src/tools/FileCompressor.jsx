import { useState } from "react";
import JSZip from "jszip";
import { Archive, Download, FileUp, ShieldCheck, Trash2 } from "lucide-react";
import ProgressBar from "../components/ProgressBar.jsx";
import UploadZone from "../components/UploadZone.jsx";
import { downloadBlob, formatBytes } from "../utils/files.js";

function safeName(name) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "file";
}

export default function FileCompressor({ notify }) {
  const [files, setFiles] = useState([]);
  const [level, setLevel] = useState(6);
  const [filename, setFilename] = useState("compressed-files");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);

  function addFiles(incoming) {
    if (busy) return;
    setFiles((current) => [...current, ...incoming]);
    setResult(null);
    setStatus("");
  }

  function removeFile(index) {
    if (busy) return;
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setResult(null);
    setStatus("");
  }

  async function compress() {
    if (!files.length || busy) return;
    setBusy(true);
    setProgress(0);
    setStatus("Preparing your archive…");
    try {
      const archive = new JSZip();
      const usedNames = new Set();
      files.forEach((file, index) => {
        const baseName = safeName(file.name);
        let uniqueName = baseName;
        let suffix = 1;
        while (usedNames.has(uniqueName)) {
          uniqueName = `${index + 1}-${suffix}-${baseName}`;
          suffix += 1;
        }
        usedNames.add(uniqueName);
        archive.file(uniqueName, file);
      });

      const blob = await archive.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level },
      }, (metadata) => {
        setProgress(metadata.percent);
        setStatus("Compressing files into a ZIP archive…");
      });
      setResult(blob);
      setStatus("Your ZIP archive is ready");
      notify("Compressed archive created.");
    } catch (error) {
      setProgress(0);
      setStatus("");
      notify(error instanceof Error ? error.message : "Couldn't create the archive.", "error");
    } finally {
      setBusy(false);
    }
  }

  const originalSize = files.reduce((total, file) => total + file.size, 0);
  const saving = result ? Math.round((1 - result.size / originalSize) * 100) : null;

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><Archive size={14} /> FILE TOOL</span>
        <h1>File compressor</h1>
        <p>Bundle any files into a downloadable ZIP archive. Files are compressed locally and keep their original content.</p>
      </div>

      <section className="workspace-card file-compressor-workspace" aria-labelledby="file-compressor-title">
        <div className="section-heading">
          <div><h2 id="file-compressor-title">Choose files to bundle</h2><p>Already-compressed files like JPG, MP4, and many PDFs may not get smaller in a ZIP.</p></div>
        </div>
        <UploadZone
          multiple
          onFiles={addFiles}
          title={files.length ? "Add more files" : "Drop files to compress"}
          description="Any file type · Select one or more files"
          compact={files.length > 0}
        />
        {files.length ? (
          <div className="file-compressor-list" aria-label="Files to archive">
            <div className="file-compressor-list-heading"><strong>{files.length} {files.length === 1 ? "file" : "files"} selected</strong><span>Original total · {formatBytes(originalSize)}</span></div>
            <ul>
              {files.map((file, index) => (
                <li className="image-file-row" key={`${file.name}-${file.lastModified}-${index}`}>
                  <span className="file-type-icon"><FileUp size={16} /></span>
                  <span className="file-info"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)}</span></span>
                  <button type="button" className="merge-remove-button" disabled={busy} onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>

            <label className="file-compression-level" htmlFor="file-compression-level">
              <span><strong>Compression level</strong><span>Higher levels may take longer and usually help most with text and uncompressed files.</span></span>
              <strong className="file-level-value">{level}</strong>
            </label>
            <input id="file-compression-level" className="form-range" type="range" min="1" max="9" value={level} disabled={busy} onChange={(event) => { setLevel(Number(event.target.value)); setResult(null); setStatus(""); }} />
            <div className="range-hints"><span>Faster</span><span>Smaller ZIP</span></div>

            <label className="file-archive-name" htmlFor="file-archive-name"><span>Archive name</span><div><input id="file-archive-name" className="form-control" value={filename} disabled={busy} onChange={(event) => setFilename(event.target.value)} /><span>.zip</span></div></label>
            {result && (
              <div className="comparison-panel" role="status">
                <div className="comparison-label">ARCHIVE SIZE</div>
                <div className="comparison-row"><div><span>Original files</span><strong>{formatBytes(originalSize)}</strong></div><div className="comparison-arrow">→</div><div><span>ZIP archive</span><strong>{formatBytes(result.size)}</strong></div><div className={`comparison-saving ${saving < 0 ? "comparison-increased" : ""}`}><strong>{saving > 0 ? `${saving}%` : `${Math.abs(saving)}%`}</strong><span>{saving > 0 ? "smaller" : saving < 0 ? "larger" : "same size"}</span></div></div>
                <p className="pdf-result-note">{saving > 0 ? "Your archive is smaller than the selected files combined." : "These files don't compress much further in a ZIP; the archive may be slightly larger due to packaging."}</p>
              </div>
            )}
            {busy && <ProgressBar value={progress} label={status} />}
            {!busy && status && <p className="merger-status" role="status">{status}</p>}
            <div className="file-compressor-actions">
              {result && <button type="button" className="btn btn-outline-primary" onClick={() => downloadBlob(result, `${filename.trim().replace(/\.zip$/i, "") || "compressed-files"}.zip`)}><Download size={16} /> Download ZIP</button>}
              <button type="button" className="btn btn-primary" onClick={compress} disabled={busy || !files.length}>{busy ? "Compressing…" : result ? "Rebuild archive" : "Compress files"}</button>
            </div>
          </div>
        ) : (
          <div className="merge-empty-state"><Archive size={21} /><strong>Your file list is empty</strong><span>Select files to create one compressed ZIP download.</span></div>
        )}
        <p className="merger-privacy"><ShieldCheck size={14} /> Everything runs on your device. Your originals are never changed.</p>
      </section>
    </div>
  );
}
