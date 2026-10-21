import { useEffect, useState } from "react";
import imageCompression from "browser-image-compression";
import { Download, Image as ImageIcon, RotateCcw, Sparkles } from "lucide-react";
import UploadZone from "../components/UploadZone.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { downloadBlob, formatBytes, makeOutputName } from "../utils/files.js";

const MODES = [
  { id: "smart", label: "Smart Compress", description: "Recommended balance of image quality and size.", quality: 84 },
  { id: "high", label: "High Quality", description: "Lighter compression for near-original detail.", quality: 92 },
  { id: "maximum", label: "Maximum Compression", description: "Smaller files with more visible compression.", quality: 72 },
];

const OUTPUT_FORMATS = [
  { type: "image/webp", label: "WebP — best balance of size and quality", extension: "webp" },
  { type: "image/jpeg", label: "JPG — compatible photo format", extension: "jpg" },
  { type: "image/png", label: "PNG — lossless format", extension: "png" },
];

export default function ImageCompressor({ notify }) {
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState(84);
  const [mode, setMode] = useState("smart");
  const [format, setFormat] = useState("image/webp");
  const [result, setResult] = useState(null);
  const [previewUrls, setPreviewUrls] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrls(null);
      return undefined;
    }

    const urls = {
      original: URL.createObjectURL(file),
      compressed: result ? URL.createObjectURL(result) : null,
    };
    setPreviewUrls(urls);
    return () => {
      URL.revokeObjectURL(urls.original);
      if (urls.compressed) URL.revokeObjectURL(urls.compressed);
    };
  }, [file, result]);

  async function compressImage() {
    if (!file) return;
    setProgress(0);
    setError("");
    setResult(null);
    try {
      const compressed = await imageCompression(file, {
        maxWidthOrHeight: 10000,
        maxIteration: 10,
        useWebWorker: true,
        preserveExif: false,
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
    if (!image || !["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      notify("Choose a JPG, PNG, or WebP image.", "error");
      return;
    }
    setFile(image);
    setResult(null);
    setError("");
  }

  function chooseMode(nextMode) {
    const selectedMode = MODES.find((item) => item.id === nextMode);
    if (!selectedMode) return;
    setMode(selectedMode.id);
    setQuality(selectedMode.quality);
    setResult(null);
  }

  function changeQuality(event) {
    setQuality(Number(event.target.value));
    setResult(null);
  }

  function changeFormat(event) {
    setFormat(event.target.value);
    setResult(null);
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
  }

  const difference = result && file ? Math.round(((file.size - result.size) / file.size) * 100) : 0;
  const outputFormat = OUTPUT_FORMATS.find((item) => item.type === format);
  const compressedWidth = result && file ? Math.min(100, Math.max(4, (result.size / file.size) * 100)) : 4;

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><Sparkles size={14} /> IMAGE TOOL</span>
        <h1>Image compressor</h1>
        <p>Reduce image size with high-quality, private compression right in your browser.</p>
      </div>
      {!file ? (
        <UploadZone accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onFiles={chooseFiles} />
      ) : (
        <div className="workspace-card compressor-card">
          <div className="section-heading">
            <div><h2>Compression settings</h2><p>Choose a compression level and compare the result.</p></div>
            <button className="btn btn-light subtle-button" onClick={reset} disabled={progress !== null}>
              <RotateCcw size={15} /> Change image
            </button>
          </div>
          <div className="image-file-row">
            <div className="file-type-icon"><ImageIcon size={20} /></div>
            <div className="file-info"><strong>{file.name}</strong><span>{formatBytes(file.size)} · {file.type.split("/")[1]?.toUpperCase()}</span></div>
            {result && <span className={`saved-pill ${difference < 0 ? "saved-pill-increased" : ""}`}>
              {difference > 0 ? `${difference}% smaller` : difference < 0 ? `${Math.abs(difference)}% larger` : "Same size"}
            </span>}
          </div>

          <fieldset className="compress-mode-fieldset" disabled={progress !== null}>
            <legend className="control-label">Compression mode</legend>
            <div className="compress-mode-grid">
              {MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`compress-mode-option ${mode === item.id ? "selected" : ""}`}
                  aria-pressed={mode === item.id}
                  onClick={() => chooseMode(item.id)}
                >
                  <span className="compress-mode-heading">
                    <strong>{item.label}</strong>
                    {item.id === "smart" && <span className="compress-recommended">Recommended</span>}
                  </span>
                  <small>{item.description}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="compress-options">
            <div className="control-block">
              <div className="control-label"><label htmlFor="quality">Image quality</label><strong>{quality}%</strong></div>
              <input id="quality" className="form-range" type="range" min="10" max="100" step="1" value={quality}
                disabled={format === "image/png" || progress !== null}
                onChange={changeQuality} />
              <div className="range-hints"><span>Smaller file</span><span>Better quality</span></div>
              {format === "image/png" && <small className="compress-hint">PNG is lossless, so the quality slider does not apply.</small>}
            </div>
            <div className="control-block">
              <label className="control-label" htmlFor="format">Output format</label>
              <select id="format" className="form-select" value={format} disabled={progress !== null} onChange={changeFormat}>
                {OUTPUT_FORMATS.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
              </select>
            </div>
          </div>

          {progress !== null && <ProgressBar value={progress} label="Compressing image…" />}
          {error && <div className="inline-error">{error}</div>}

          {previewUrls && (
            <div className={`compress-preview-grid ${result ? "" : "compress-preview-single"}`}>
              <figure className="compress-preview">
                <figcaption>Original <span>{formatBytes(file.size)}</span></figcaption>
                <div><img src={previewUrls.original} alt={`Original ${file.name}`} /></div>
              </figure>
              {result && previewUrls.compressed && (
                <figure className="compress-preview">
                  <figcaption>Compressed <span>{formatBytes(result.size)}</span></figcaption>
                  <div><img src={previewUrls.compressed} alt={`Compressed ${file.name}`} /></div>
                </figure>
              )}
            </div>
          )}

          {result && (
            <div className="comparison-panel">
              <div className="comparison-label">SIZE COMPARISON</div>
              <div className="comparison-row">
                <div><span>Original</span><strong>{formatBytes(file.size)}</strong></div>
                <div className="comparison-arrow">→</div>
                <div><span>New image</span><strong>{formatBytes(result.size)}</strong></div>
                <div className={`comparison-saving ${difference < 0 ? "comparison-increased" : ""}`}>
                  <strong>{difference > 0 ? `−${difference}%` : difference < 0 ? `+${Math.abs(difference)}%` : "0%"}</strong>
                  <span>{difference < 0 ? "larger" : "saved"}</span>
                </div>
              </div>
              <div className="size-track"><span style={{ width: `${compressedWidth}%` }} /></div>
            </div>
          )}

          <div className="tool-actions">
            {result && <button className="btn btn-outline-primary" onClick={() => downloadBlob(result, makeOutputName(file.name, "compressed", outputFormat.extension))}>
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
