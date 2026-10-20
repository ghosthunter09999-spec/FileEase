import { useState } from "react";
import imageCompression from "browser-image-compression";
import { Download, Image as ImageIcon, RotateCcw, Sparkles } from "lucide-react";
import UploadZone from "../components/UploadZone.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { downloadBlob, formatBytes, makeOutputName } from "../utils/files.js";

export default function ImageCompressor({ notify }) {
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState("image/jpeg");
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  async function compressImage() {
    if (!file) return;
    setProgress(0);
    setError("");
    setResult(null);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 100,
        maxWidthOrHeight: 10000,
        useWebWorker: true,
        initialQuality: quality / 100,
        fileType: format,
        onProgress: setProgress,
      });
      setResult(compressed);
      notify("Image compressed successfully.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The image couldn't be compressed.";
      setError(message);
      notify(message, "error");
    } finally {
      setProgress(null);
    }
  }

  function chooseFiles(files) {
    const image = files[0];
    if (!image?.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      notify("Choose a JPG, PNG, or WebP image.", "error");
      return;
    }
    setFile(image);
    setResult(null);
    setError("");
  }

  const saving = result && file ? Math.max(0, Math.round((1 - result.size / file.size) * 100)) : 0;
  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><Sparkles size={14} /> IMAGE TOOL</span>
        <h1>Image compressor</h1>
        <p>Make your images lighter without leaving your browser. Fine-tune quality to find the right balance.</p>
      </div>
      {!file ? (
        <UploadZone accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onFiles={chooseFiles} />
      ) : (
        <div className="workspace-card compressor-card">
          <div className="section-heading">
            <div><h2>Compression settings</h2><p>Adjust your output and preview the size savings.</p></div>
            <button className="btn btn-light subtle-button" onClick={() => { setFile(null); setResult(null); setError(""); }}>
              <RotateCcw size={15} /> Change image
            </button>
          </div>
          <div className="image-file-row">
            <div className="file-type-icon"><ImageIcon size={20} /></div>
            <div className="file-info"><strong>{file.name}</strong><span>{formatBytes(file.size)} · {file.type.split("/")[1]?.toUpperCase()}</span></div>
            {result && <span className="saved-pill">{saving > 0 ? `${saving}% smaller` : "Ready"}</span>}
          </div>
          <div className="compress-options">
            <div className="control-block">
              <div className="control-label"><label htmlFor="quality">Image quality</label><strong>{quality}%</strong></div>
              <input id="quality" className="form-range" type="range" min="10" max="100" step="1" value={quality}
                onChange={(event) => { setQuality(Number(event.target.value)); setResult(null); }} />
              <div className="range-hints"><span>Smaller file</span><span>Better quality</span></div>
            </div>
            <div className="control-block">
              <label className="control-label" htmlFor="format">Output format</label>
              <select id="format" className="form-select" value={format} onChange={(event) => { setFormat(event.target.value); setResult(null); }}>
                <option value="image/jpeg">JPG — best for photos</option>
                <option value="image/webp">WebP — modern & compact</option>
                <option value="image/png">PNG — lossless</option>
              </select>
            </div>
          </div>
          {progress !== null && <ProgressBar value={progress} label="Compressing image…" />}
          {error && <div className="inline-error">{error}</div>}
          {result && (
            <div className="comparison-panel">
              <div className="comparison-label">SIZE COMPARISON</div>
              <div className="comparison-row">
                <div><span>Original</span><strong>{formatBytes(file.size)}</strong></div>
                <div className="comparison-arrow">→</div>
                <div><span>Compressed</span><strong>{formatBytes(result.size)}</strong></div>
                <div className="comparison-saving"><strong>{saving > 0 ? `−${saving}%` : "0%"}</strong><span>saved</span></div>
              </div>
              <div className="size-track"><span style={{ width: `${Math.max(4, (result.size / file.size) * 100)}%` }} /></div>
            </div>
          )}
          <div className="tool-actions">
            {result && <button className="btn btn-outline-primary" onClick={() => downloadBlob(result, makeOutputName(file.name, "compressed", format.split("/")[1] === "jpeg" ? "jpg" : format.split("/")[1]))}>
              <Download size={16} /> Download image
            </button>}
            <button className="btn btn-primary" onClick={compressImage} disabled={progress !== null}>
              <Sparkles size={16} /> {result ? "Compress again" : "Compress image"}
            </button>
          </div>
        </div>
      )}
      <div className="trust-note"><span>✓</span> Your files never leave your device — compression happens entirely in your browser.</div>
    </div>
  );
}
