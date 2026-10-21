import { useEffect, useMemo, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { Download, Image as ImageIcon, RotateCcw, Sparkles, Trash2, Upload } from "lucide-react";
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

function createImageId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export default function ImageCompressor({ notify }) {
  const [images, setImages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [quality, setQuality] = useState(84);
  const [mode, setMode] = useState("smart");
  const [format, setFormat] = useState("image/webp");
  const [results, setResults] = useState({});
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [runVersion, setRunVersion] = useState(0);
  const batchIdRef = useRef(0);
  const notifyRef = useRef(notify);

  const selectedImage = images.find((image) => image.id === selectedId) ?? null;
  const selectedResult = selectedImage ? results[selectedImage.id] : null;
  const outputFormat = OUTPUT_FORMATS.find((item) => item.type === format) ?? OUTPUT_FORMATS[0];
  const previewUrls = useMemo(() => images.map((image) => ({
    id: image.id,
    original: URL.createObjectURL(image.file),
    compressed: results[image.id] ? URL.createObjectURL(results[image.id]) : null,
  })), [images, results]);
  const selectedPreview = previewUrls.find((preview) => preview.id === selectedId);

  useEffect(() => () => previewUrls.forEach((preview) => {
    URL.revokeObjectURL(preview.original);
    if (preview.compressed) URL.revokeObjectURL(preview.compressed);
  }), [previewUrls]);

  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  useEffect(() => {
    if (!images.length) return undefined;
    const batchId = ++batchIdRef.current;
    const timeout = window.setTimeout(async () => {
      setResults({});
      setError("");
      setProgress({ value: 0, label: "Preparing batch compression…" });
      const completed = {};
      const failures = [];

      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        if (batchId !== batchIdRef.current) return;
        setProgress({ value: (index / images.length) * 100, label: `Compressing ${index + 1} of ${images.length}: ${image.file.name}` });
        try {
          const compressed = await imageCompression(image.file, {
            maxWidthOrHeight: 10000,
            maxIteration: 10,
            useWebWorker: true,
            preserveExif: false,
            initialQuality: quality / 100,
            fileType: format,
            onProgress: (imageProgress) => {
              if (batchId === batchIdRef.current) {
                setProgress({
                  value: ((index + imageProgress / 100) / images.length) * 100,
                  label: `Compressing ${index + 1} of ${images.length}: ${image.file.name}`,
                });
              }
            },
          });
          if (batchId !== batchIdRef.current) return;
          completed[image.id] = compressed;
          setResults((current) => ({ ...current, [image.id]: compressed }));
        } catch (cause) {
          if (batchId !== batchIdRef.current) return;
          failures.push(`${image.file.name}: ${cause instanceof Error ? cause.message : "Compression failed."}`);
        }
      }

      if (batchId !== batchIdRef.current) return;
      setProgress(null);
      if (failures.length) {
        const message = failures.join(" ");
        setError(message);
        notifyRef.current(`Compressed ${Object.keys(completed).length} of ${images.length} images. ${message}`, "error");
      } else {
        notifyRef.current(`Compressed all ${images.length} images with shared settings.`);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      batchIdRef.current += 1;
    };
  }, [images, quality, format, runVersion]);

  function chooseFiles(files) {
    const accepted = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (accepted.length !== files.length) notify("Some files were skipped. Choose JPG, PNG, or WebP images.", "error");
    if (!accepted.length) return;
    const added = accepted.map((file) => ({ id: createImageId(), file }));
    setImages((current) => [...current, ...added]);
    setSelectedId((current) => current ?? added[0].id);
    setError("");
  }

  function removeImage(id) {
    setImages((current) => {
      const next = current.filter((image) => image.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
    setResults((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function chooseMode(nextMode) {
    const selectedMode = MODES.find((item) => item.id === nextMode);
    if (!selectedMode) return;
    setMode(selectedMode.id);
    setQuality(selectedMode.quality);
  }

  function reset() {
    batchIdRef.current += 1;
    setImages([]);
    setSelectedId(null);
    setResults({});
    setError("");
    setProgress(null);
  }

  async function downloadAll() {
    const zip = new JSZip();
    let count = 0;
    for (const [index, image] of images.entries()) {
      const result = results[image.id];
      if (!result) continue;
      zip.file(`${index + 1}-${makeOutputName(image.file.name, "compressed", outputFormat.extension)}`, result);
      count += 1;
    }
    if (!count) {
      const message = "Wait for at least one image to finish compressing.";
      setError(message);
      notify(message, "error");
      return;
    }
    try {
      const archive = await zip.generateAsync({ type: "blob" }, (metadata) => {
        setProgress({ value: metadata.percent, label: "Creating ZIP archive…" });
      });
      downloadBlob(archive, "fileease-compressed-images.zip");
      notify(`Downloaded ${count} compressed image${count === 1 ? "" : "s"} as a ZIP.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't create the ZIP archive.";
      setError(message);
      notify(message, "error");
    } finally {
      setProgress(null);
    }
  }

  const totalOriginalSize = images.reduce((total, image) => total + image.file.size, 0);
  const completedImages = images.filter((image) => results[image.id]);
  const totalCompressedSize = completedImages.reduce((total, image) => total + results[image.id].size, 0);
  const selectedSaving = selectedImage && selectedResult
    ? Math.round(((selectedImage.file.size - selectedResult.size) / selectedImage.file.size) * 100)
    : null;
  const selectedCompressedWidth = selectedImage && selectedResult
    ? Math.min(100, Math.max(4, (selectedResult.size / selectedImage.file.size) * 100))
    : 4;

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><Sparkles size={14} /> IMAGE TOOL</span>
        <h1>Image compressor</h1>
        <p>Compress one or more images privately. Every setting is shared across the batch and previews update as each image finishes.</p>
      </div>
      {!images.length ? (
        <UploadZone accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple onFiles={chooseFiles}
          title="Drop your images here" description="Choose multiple JPG, PNG, or WebP files to compress together" />
      ) : (
        <div className="workspace-card compressor-card">
          <div className="section-heading">
            <div><h2>Batch compression <span className="count-badge">{images.length} images</span></h2><p>Settings apply to every image. Select a thumbnail to preview it.</p></div>
            <div className="batch-header-actions">
              <button className="btn btn-light subtle-button" type="button" disabled={progress !== null} onClick={reset}>
                <RotateCcw size={15} /> Clear images
              </button>
              <label className={`btn btn-light subtle-button ${progress !== null ? "disabled" : ""}`}>
                <Upload size={15} /> Add images
                <input className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple disabled={progress !== null}
                  onChange={(event) => { chooseFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
              </label>
            </div>
          </div>

          <div className="batch-thumbnail-grid" aria-label="Images to compress">
            {images.map((image, index) => {
              const preview = previewUrls.find((item) => item.id === image.id);
              return (
                <div className={`batch-thumbnail ${selectedId === image.id ? "selected" : ""}`} key={image.id}>
                  <button type="button" className="batch-thumbnail-select" aria-pressed={selectedId === image.id}
                    onClick={() => setSelectedId(image.id)} aria-label={`Preview image ${index + 1}: ${image.file.name}`}>
                    {preview && <img src={preview.original} alt="" />}
                    <span>{index + 1}. {image.file.name}</span>
                    <small>{results[image.id] ? "Compressed" : progress ? "Processing…" : "Waiting"}</small>
                  </button>
                  <button className="batch-thumbnail-delete" type="button" disabled={progress !== null} onClick={() => removeImage(image.id)}
                    aria-label={`Remove ${image.file.name}`}><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>

          <div className="batch-settings-banner"><Sparkles size={15} /><span><strong>Apply to all images</strong> — changes to mode, quality, or format automatically recompress the entire batch.</span></div>

          <fieldset className="compress-mode-fieldset" disabled={progress !== null}>
            <legend className="control-label">Compression mode</legend>
            <div className="compress-mode-grid">
              {MODES.map((item) => (
                <button key={item.id} type="button" className={`compress-mode-option ${mode === item.id ? "selected" : ""}`}
                  aria-pressed={mode === item.id} onClick={() => chooseMode(item.id)}>
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
              <div className="control-label"><label htmlFor="quality">Image quality</label><strong>{quality}% · applies to all</strong></div>
              <input id="quality" className="form-range" type="range" min="10" max="100" step="1" value={quality}
                disabled={format === "image/png" || progress !== null}
                onChange={(event) => setQuality(Number(event.target.value))} />
              <div className="range-hints"><span>Smaller file</span><span>Better quality</span></div>
              {format === "image/png" && <small className="compress-hint">PNG is lossless, so the quality slider does not apply.</small>}
            </div>
            <div className="control-block">
              <label className="control-label" htmlFor="format">Output format · applies to all</label>
              <select id="format" className="form-select" value={format} disabled={progress !== null}
                onChange={(event) => setFormat(event.target.value)}>
                {OUTPUT_FORMATS.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
              </select>
            </div>
          </div>

          {progress !== null && <ProgressBar value={progress.value} label={progress.label} />}
          {error && <div className="inline-error" role="alert">{error}</div>}

          {selectedImage && selectedPreview && (
            <>
              <div className={`compress-preview-grid ${selectedResult ? "" : "compress-preview-single"}`}>
                <figure className="compress-preview">
                  <figcaption>Original <span>{formatBytes(selectedImage.file.size)}</span></figcaption>
                  <div><img src={selectedPreview.original} alt={`Original ${selectedImage.file.name}`} /></div>
                </figure>
                <figure className="compress-preview">
                  <figcaption>Compressed preview <span>{selectedResult ? formatBytes(selectedResult.size) : progress ? "Processing…" : "Waiting"}</span></figcaption>
                  <div>{selectedPreview.compressed
                    ? <img src={selectedPreview.compressed} alt={`Compressed ${selectedImage.file.name}`} />
                    : <span className="batch-preview-placeholder">Live preview appears when this image is compressed</span>}</div>
                </figure>
              </div>

              {selectedResult && (
                <div className="comparison-panel">
                  <div className="comparison-label">SELECTED IMAGE SIZE COMPARISON</div>
                  <div className="comparison-row">
                    <div><span>Original</span><strong>{formatBytes(selectedImage.file.size)}</strong></div>
                    <div className="comparison-arrow">→</div>
                    <div><span>New image</span><strong>{formatBytes(selectedResult.size)}</strong></div>
                    <div className={`comparison-saving ${selectedSaving < 0 ? "comparison-increased" : ""}`}>
                      <strong>{selectedSaving > 0 ? `−${selectedSaving}%` : selectedSaving < 0 ? `+${Math.abs(selectedSaving)}%` : "0%"}</strong>
                      <span>{selectedSaving < 0 ? "larger" : "saved"}</span>
                    </div>
                  </div>
                  <div className="size-track"><span style={{ width: `${selectedCompressedWidth}%` }} /></div>
                </div>
              )}
            </>
          )}

          <div className="comparison-panel batch-total-comparison">
            <div className="comparison-label">BATCH SIZE · {completedImages.length} OF {images.length} READY</div>
            <div className="comparison-row">
              <div><span>Original batch</span><strong>{formatBytes(totalOriginalSize)}</strong></div>
              <div className="comparison-arrow">→</div>
              <div><span>Compressed images</span><strong>{formatBytes(totalCompressedSize)}</strong></div>
            </div>
          </div>

          <div className="tool-actions">
            <button className="btn btn-outline-primary" type="button" disabled={!completedImages.length || progress !== null} onClick={downloadAll}>
              <Download size={16} /> Download all as ZIP
            </button>
            <button className="btn btn-primary" type="button" disabled={progress !== null} onClick={() => setRunVersion((current) => current + 1)}>
              <Sparkles size={16} /> Recompress all
            </button>
          </div>
        </div>
      )}
      <div className="trust-note"><span>✓</span> Your files never leave your device — compression happens entirely in your browser.</div>
    </div>
  );
}
