import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  Download,
  FileImage,
  FilePlus2,
  ImagePlus,
  MoveLeft,
  MoveRight,
  RotateCw,
  ScanLine,
  SlidersHorizontal,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import ProgressBar from "../components/ProgressBar.jsx";
import UploadZone from "../components/UploadZone.jsx";
import { downloadBlob, formatBytes } from "../utils/files.js";

const MAX_IMAGE_SIDE = 3200;

function createPageId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

async function imageFromBlob(blob) {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't save this scanned page as an image."))),
      "image/jpeg",
      0.96,
    );
  });
}

async function normalizeImage(blob) {
  const image = await imageFromBlob(blob);
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Your browser couldn't prepare an image canvas.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await canvasToJpeg(canvas);
  } finally {
    image.close?.();
  }
}

function findDocumentBounds(imageData, width, height) {
  const { data } = imageData;
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const background = [0, 0, 0];
  for (const [x, y] of corners) {
    const offset = (y * width + x) * 4;
    for (let channel = 0; channel < 3; channel += 1) background[channel] += data[offset + channel] / 4;
  }

  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 500));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const offset = (y * width + x) * 4;
      const difference = Math.abs(data[offset] - background[0])
        + Math.abs(data[offset + 1] - background[1])
        + Math.abs(data[offset + 2] - background[2]);
      if (difference > 105) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < 0 || (right - left) < width * 0.5 || (bottom - top) < height * 0.5) {
    return { x: 0, y: 0, width, height };
  }
  const padding = Math.round(Math.min(width, height) * 0.015);
  const x = Math.max(0, left - padding);
  const y = Math.max(0, top - padding);
  return {
    x,
    y,
    width: Math.min(width - x, right - left + padding * 2),
    height: Math.min(height - y, bottom - top + padding * 2),
  };
}

function sharpenPixels(context, width, height, amount) {
  if (amount <= 0 || width < 3 || height < 3) return;
  const frame = context.getImageData(0, 0, width, height);
  const source = new Uint8ClampedArray(frame.data);
  const strength = amount / 100;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const average = (
          source[offset - 4 + channel]
          + source[offset + 4 + channel]
          + source[offset - width * 4 + channel]
          + source[offset + width * 4 + channel]
        ) / 4;
        frame.data[offset + channel] = source[offset + channel] + (source[offset + channel] - average) * strength;
      }
    }
  }
  context.putImageData(frame, 0, 0);
}

async function enhancePage(blob, settings) {
  const image = await imageFromBlob(blob);
  try {
    const source = document.createElement("canvas");
    source.width = image.width;
    source.height = image.height;
    const sourceContext = source.getContext("2d", { willReadFrequently: settings.autoCrop });
    if (!sourceContext) throw new Error("Your browser couldn't prepare an image canvas.");
    sourceContext.drawImage(image, 0, 0);
    const bounds = settings.autoCrop
      ? findDocumentBounds(sourceContext.getImageData(0, 0, source.width, source.height), source.width, source.height)
      : { x: 0, y: 0, width: source.width, height: source.height };
    const rotated = settings.rotation % 180 !== 0;
    const canvas = document.createElement("canvas");
    canvas.width = rotated ? bounds.height : bounds.width;
    canvas.height = rotated ? bounds.width : bounds.height;
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: settings.sharpness > 0 });
    if (!context) throw new Error("Your browser couldn't prepare an image canvas.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((settings.rotation * Math.PI) / 180);
    context.filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%)${settings.mode === "color" ? "" : " grayscale(1)"}`;
    context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height, -bounds.width / 2, -bounds.height / 2, bounds.width, bounds.height);
    context.restore();
    if (settings.mode === "bw") {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const luminance = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
        const value = luminance >= 155 ? 255 : 0;
        pixels.data[index] = value;
        pixels.data[index + 1] = value;
        pixels.data[index + 2] = value;
      }
      context.putImageData(pixels, 0, 0);
    }
    sharpenPixels(context, canvas.width, canvas.height, settings.sharpness);
    return await canvasToJpeg(canvas);
  } finally {
    image.close?.();
  }
}

export default function CamScanner({ notify }) {
  const [pages, setPages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState(null);
  const [retakeTarget, setRetakeTarget] = useState(null);
  const [settings, setSettings] = useState({
    mode: "color",
    brightness: 100,
    contrast: 115,
    sharpness: 20,
    rotation: 0,
    autoCrop: false,
  });
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const uploadInputRef = useRef(null);
  const selectedPage = pages.find((page) => page.id === selectedId) ?? null;
  const previews = useMemo(() => pages.map((page) => URL.createObjectURL(page.image)), [pages]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  useEffect(() => {
    if (!cameraEnabled) {
      setCameraReady(false);
      return undefined;
    }
    let cancelled = false;
    async function openCamera() {
      setCameraError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access isn't available here. Use HTTPS or localhost, or add images from your device.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (!cancelled) setCameraReady(true);
        }
      } catch (cause) {
        if (cancelled) return;
        cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
        const name = cause instanceof Error ? cause.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCameraError("Camera permission was denied. Allow camera access in your browser settings, or add an image instead.");
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          setCameraError("No camera was found. You can still scan by adding an image from your device.");
        } else {
          setCameraError("Couldn't open the camera. Check that it isn't being used by another app, or add an image instead.");
        }
      }
    }
    openCamera();
    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraEnabled]);

  function openCamera(targetId = null) {
    setError("");
    setCameraError("");
    setRetakeTarget(targetId);
    setCameraReady(false);
    setCameraEnabled(true);
  }

  function stopCamera() {
    setCameraEnabled(false);
    setCameraReady(false);
    setRetakeTarget(null);
  }

  async function capturePage() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    setProcessing(true);
    setStatus("Preparing captured page…");
    try {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Your browser couldn't prepare the camera image.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = await canvasToJpeg(canvas);
      const id = retakeTarget;
      if (id) {
        setPages((current) => current.map((page) => page.id === id ? { ...page, original: image, image } : page));
        setSelectedId(id);
        notify("Page retaken.");
      } else {
        const page = { id: createPageId(), original: image, image };
        setPages((current) => [...current, page]);
        setSelectedId(page.id);
        notify("Page captured.");
      }
      setSettings((current) => ({ ...current, rotation: 0 }));
      stopCamera();
      setStatus("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't capture this page.";
      setError(message);
      notify(message, "error");
    } finally {
      setProcessing(false);
    }
  }

  async function addImages(files) {
    const accepted = files.filter((file) => file.type.startsWith("image/"));
    if (accepted.length !== files.length) notify("Choose image files to add scanned pages.", "error");
    if (!accepted.length) return;
    setProcessing(true);
    setStatus("Adding images…");
    setError("");
    try {
      const added = [];
      for (const file of accepted) {
        const image = await normalizeImage(file);
        added.push({ id: createPageId(), original: image, image });
      }
      setPages((current) => [...current, ...added]);
      setSelectedId(added[0].id);
      setStatus("");
      if (cameraEnabled) stopCamera();
      notify(`${added.length} page${added.length === 1 ? "" : "s"} added.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't load the selected image.";
      setError(message);
      notify(message, "error");
    } finally {
      setProcessing(false);
    }
  }

  async function enhanceSelected() {
    if (!selectedPage) return;
    setProcessing(true);
    setStatus("Enhancing page…");
    setError("");
    try {
      const image = await enhancePage(selectedPage.original, settings);
      setPages((current) => current.map((page) => page.id === selectedPage.id ? { ...page, image } : page));
      setStatus("");
      notify("Page enhanced.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't enhance this page.";
      setError(message);
      notify(message, "error");
    } finally {
      setProcessing(false);
    }
  }

  function movePage(sourceId, targetId) {
    if (!sourceId || sourceId === targetId) return;
    setPages((current) => {
      const from = current.findIndex((page) => page.id === sourceId);
      const to = current.findIndex((page) => page.id === targetId);
      if (from < 0 || to < 0) return current;
      const updated = [...current];
      const [page] = updated.splice(from, 1);
      updated.splice(to, 0, page);
      return updated;
    });
  }

  function movePageBy(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    movePage(pages[index].id, pages[target].id);
  }

  function deletePage(id) {
    const index = pages.findIndex((page) => page.id === id);
    const updated = pages.filter((page) => page.id !== id);
    setPages(updated);
    if (selectedId === id) setSelectedId(updated[Math.min(index, updated.length - 1)]?.id ?? null);
  }

  async function createPdf() {
    if (!pages.length) return;
    setProcessing(true);
    setProgress(0);
    setStatus("Creating high-quality PDF…");
    setError("");
    try {
      const pdf = await PDFDocument.create();
      for (let index = 0; index < pages.length; index += 1) {
        const image = await imageFromBlob(pages[index].image);
        try {
          const embedded = await pdf.embedJpg(await pages[index].image.arrayBuffer());
          const ratio = Math.min(612 / image.width, 792 / image.height);
          const width = image.width * ratio;
          const height = image.height * ratio;
          const page = pdf.addPage([width, height]);
          page.drawImage(embedded, { x: 0, y: 0, width, height });
        } finally {
          image.close?.();
        }
        setProgress(((index + 1) / pages.length) * 100);
      }
      downloadBlob(new Blob([await pdf.save({ useObjectStreams: true })], { type: "application/pdf" }), "fileease-scan.pdf");
      setStatus("");
      notify("Your scanned PDF has been downloaded.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't create a PDF from these pages.";
      setError(message);
      setStatus("");
      notify(message, "error");
    } finally {
      setProcessing(false);
    }
  }

  const currentPreview = previews[pages.findIndex((page) => page.id === selectedId)];
  const canUseCamera = Boolean(navigator.mediaDevices?.getUserMedia);

  return (
    <div className="tool-page scanner-page">
      <div className="tool-heading">
        <span className="page-kicker"><ScanLine size={14} /> DOCUMENT TOOL</span>
        <h1>Cam Scanner</h1>
        <p>Scan paper documents, enhance each page, and save a clear PDF without sending files anywhere.</p>
      </div>

      {!pages.length && !cameraEnabled && (
        <div className="scanner-start-card workspace-card">
          <div className="scanner-start-icon"><Camera size={25} /></div>
          <h2>Start scanning</h2>
          <p>Use your device camera for a new scan, or add existing document photos.</p>
          <div className="scanner-start-actions">
            <button className="btn btn-primary" onClick={() => openCamera()}><Camera size={16} /> Open camera</button>
            <button className="btn btn-outline-primary" onClick={() => uploadInputRef.current?.click()}><ImagePlus size={16} /> Upload images</button>
            <input ref={uploadInputRef} className="visually-hidden" type="file" accept="image/*" multiple onChange={(event) => { addImages(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          </div>
          {!canUseCamera && <p className="scanner-secure-hint">Camera access requires HTTPS or localhost. You can upload images instead.</p>}
        </div>
      )}

      {cameraEnabled && (
        <section className="workspace-card scanner-camera-card" aria-label="Camera preview">
          <div className="section-heading">
            <div><h2>{retakeTarget ? "Retake page" : "Camera preview"}</h2><p>Position the full document inside the frame.</p></div>
            <button className="scanner-icon-button" type="button" onClick={stopCamera} aria-label="Close camera"><X size={18} /></button>
          </div>
          <div className={`scanner-video-frame ${cameraReady ? "camera-ready" : ""}`}>
            <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview" />
            {!cameraReady && !cameraError && <div className="scanner-camera-placeholder"><span className="scanner-spinner" />Opening camera…</div>}
            {cameraError && <div className="scanner-camera-error"><Camera size={24} /><strong>Camera unavailable</strong><span>{cameraError}</span></div>}
            {cameraReady && <div className="scanner-frame-corner corner-tl" />}
            {cameraReady && <div className="scanner-frame-corner corner-tr" />}
            {cameraReady && <div className="scanner-frame-corner corner-bl" />}
            {cameraReady && <div className="scanner-frame-corner corner-br" />}
          </div>
          {cameraError && (
            <div className="scanner-upload-fallback">
              <UploadZone compact accept="image/*" multiple onFiles={addImages} title="Use a document photo instead" description="Drop images here or browse your device" />
            </div>
          )}
          <div className="scanner-camera-actions">
            <button className="btn btn-outline-primary" onClick={() => uploadInputRef.current?.click()}><ImagePlus size={16} /> Upload image</button>
            <input ref={uploadInputRef} className="visually-hidden" type="file" accept="image/*" multiple onChange={(event) => { addImages(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
            <button className="btn btn-primary scanner-capture-button" disabled={!cameraReady || processing} onClick={capturePage}><Camera size={18} /> Capture</button>
          </div>
        </section>
      )}

      {pages.length > 0 && !cameraEnabled && (
        <div className="scanner-workspace">
          <section className="workspace-card scanner-editor">
            <div className="section-heading">
              <div><h2>Scanned pages <span className="count-badge">{pages.length}</span></h2><p>Drag thumbnails to reorder. Select a page to edit.</p></div>
              <button className="btn btn-light subtle-button" disabled={processing} onClick={() => openCamera()}><FilePlus2 size={15} /> Add page</button>
            </div>
            <div className="scanner-preview">
              {currentPreview
                ? <img src={currentPreview} alt={`Scanned page ${pages.findIndex((page) => page.id === selectedId) + 1}`} />
                : <div className="scanner-empty-preview"><FileImage size={28} /><span>Select a page to preview</span></div>}
            </div>
            {selectedPage && (
              <div className="scanner-page-meta">
                <span>Page {pages.findIndex((page) => page.id === selectedId) + 1} · {formatBytes(selectedPage.image.size)}</span>
                <div className="scanner-page-actions">
                  <button type="button" onClick={() => downloadBlob(selectedPage.image, `fileease-page-${pages.findIndex((page) => page.id === selectedId) + 1}.jpg`)}><Download size={14} /> Download image</button>
                  <button type="button" onClick={() => openCamera(selectedPage.id)}><Camera size={14} /> Retake</button>
                  <button type="button" className="scanner-delete-action" onClick={() => deletePage(selectedPage.id)}><Trash2 size={14} /> Delete</button>
                </div>
              </div>
            )}

            <div className="scanner-settings">
              <div className="scanner-settings-title"><SlidersHorizontal size={15} /><strong>Enhance selected page</strong></div>
              <div className="scanner-control-grid">
                <label className="scanner-field" htmlFor="scanner-mode"><span>Color mode</span>
                  <select id="scanner-mode" className="form-select" value={settings.mode} onChange={(event) => setSettings((current) => ({ ...current, mode: event.target.value }))}>
                    <option value="color">Color</option><option value="gray">Grayscale</option><option value="bw">Black &amp; white</option>
                  </select>
                </label>
                {[
                  ["brightness", "Brightness"],
                  ["contrast", "Contrast"],
                  ["sharpness", "Sharpness"],
                ].map(([key, label]) => (
                  <label className="scanner-field" htmlFor={`scanner-${key}`} key={key}>
                    <span>{label} <strong>{settings[key]}{key === "sharpness" ? "" : "%"}</strong></span>
                    <input id={`scanner-${key}`} className="form-range" type="range" min={key === "sharpness" ? "0" : "50"} max={key === "sharpness" ? "100" : "160"} value={settings[key]} onChange={(event) => setSettings((current) => ({ ...current, [key]: Number(event.target.value) }))} />
                  </label>
                ))}
              </div>
              <div className="scanner-edit-actions">
                <button className={`btn ${settings.autoCrop ? "btn-primary" : "btn-outline-primary"}`} type="button" onClick={() => setSettings((current) => ({ ...current, autoCrop: !current.autoCrop }))}><ScanLine size={15} /> Auto crop {settings.autoCrop ? "on" : "off"}</button>
                <button className="btn btn-outline-primary" type="button" onClick={() => setSettings((current) => ({ ...current, rotation: (current.rotation + 90) % 360 }))}><RotateCw size={15} /> Rotate 90°</button>
                <button className="btn btn-primary" type="button" disabled={processing || !selectedPage} onClick={enhanceSelected}><WandSparkles size={15} /> Enhance</button>
              </div>
              <p className="scanner-hint">Auto crop trims margins with a contrasting background. Automatic perspective correction isn't available; check page alignment before capture.</p>
            </div>

            {processing && <ProgressBar value={progress || 60} label={status || "Processing page…"} />}
            {error && <div className="inline-error" role="alert">{error}</div>}

            <div className="scanner-thumbnails" aria-label="Scanned page thumbnails">
              {pages.map((page, index) => (
                <div
                  className={`scanner-thumbnail ${selectedId === page.id ? "selected" : ""} ${draggedId === page.id ? "dragging" : ""}`}
                  key={page.id}
                  draggable={!processing}
                  onDragStart={(event) => {
                    setDraggedId(page.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", page.id);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    movePage(event.dataTransfer.getData("text/plain") || draggedId, page.id);
                    setDraggedId(null);
                  }}
                  onDragEnd={() => setDraggedId(null)}
                >
                  <button className="scanner-thumbnail-select" type="button" onClick={() => setSelectedId(page.id)} aria-label={`Select page ${index + 1}`}>
                    <img src={previews[index]} alt="" />
                    <span>Page {index + 1}</span>
                  </button>
                  <div className="scanner-thumbnail-order">
                    <button type="button" disabled={index === 0} onClick={() => movePageBy(index, -1)} aria-label={`Move page ${index + 1} earlier`}><MoveLeft size={12} /></button>
                    <button type="button" disabled={index === pages.length - 1} onClick={() => movePageBy(index, 1)} aria-label={`Move page ${index + 1} later`}><MoveRight size={12} /></button>
                  </div>
                  <button className="scanner-thumbnail-delete" type="button" onClick={() => deletePage(page.id)} aria-label={`Delete page ${index + 1}`}><X size={13} /></button>
                </div>
              ))}
            </div>
            <div className="scanner-bottom-actions">
              <button className="btn btn-outline-primary" type="button" disabled={processing} onClick={() => uploadInputRef.current?.click()}><ImagePlus size={15} /> Add images</button>
              <input ref={uploadInputRef} className="visually-hidden" type="file" accept="image/*" multiple onChange={(event) => { addImages(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
              <button className="btn btn-primary" type="button" disabled={processing || !pages.length} onClick={createPdf}><FilePlus2 size={16} /> Create PDF</button>
            </div>
          </section>
        </div>
      )}

      <div className="scanner-privacy-note"><span><Check size={14} /></span><strong>Camera is only used on your device. No image is uploaded.</strong></div>
      <div className="scanner-processing-status" aria-live="polite">{processing && <><span className="scanner-spinner" />{status || "Processing…"}</>}</div>
    </div>
  );
}
