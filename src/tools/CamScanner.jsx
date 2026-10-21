import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  Copy,
  Download,
  FilePlus2,
  FileText,
  ImagePlus,
  Languages,
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
import { createWorker } from "tesseract.js";
import ProgressBar from "../components/ProgressBar.jsx";
import UploadZone from "../components/UploadZone.jsx";
import { downloadBlob, formatBytes } from "../utils/files.js";
import {
  createPageId,
  decodeImage,
  detectDocumentCorners,
  enhanceDocument,
  normalizeImage,
  perspectiveCrop,
  rotateImage,
} from "../utils/documentScan.js";

const DEFAULT_CORNERS = (width, height) => [
  { x: width * 0.035, y: height * 0.035 },
  { x: width * 0.965, y: height * 0.035 },
  { x: width * 0.965, y: height * 0.965 },
  { x: width * 0.035, y: height * 0.965 },
];

function createPage(image, width, height) {
  return {
    id: createPageId(),
    original: image,
    working: image,
    image,
    originalWidth: width,
    originalHeight: height,
    width,
    height,
    sourceWidth: width,
    sourceHeight: height,
    corners: null,
  };
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
  const [cropEditing, setCropEditing] = useState(false);
  const [activeCorner, setActiveCorner] = useState(null);
  const [compareSide, setCompareSide] = useState("after");
  const [mode, setMode] = useState("enhanced");
  const [ocrLanguage, setOcrLanguage] = useState("eng");
  const [ocrProgress, setOcrProgress] = useState(null);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [ocrSource, setOcrSource] = useState(null);
  const [ocrError, setOcrError] = useState("");
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const uploadInputRef = useRef(null);
  const cropSvgRef = useRef(null);
  const selectedPage = pages.find((page) => page.id === selectedId) ?? null;
  const previews = useMemo(() => pages.map((page) => ({
    image: URL.createObjectURL(page.image),
    original: URL.createObjectURL(page.original),
    working: URL.createObjectURL(page.working),
  })), [pages]);

  useEffect(() => () => previews.forEach((preview) => {
    URL.revokeObjectURL(preview.image);
    URL.revokeObjectURL(preview.original);
    URL.revokeObjectURL(preview.working);
  }), [previews]);

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
    if (!video?.videoWidth || !video.videoHeight) return;
    setProcessing(true);
    setStatus("Preparing captured page…");
    try {
      const scale = Math.min(1, 3000 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Your browser couldn't prepare the camera image.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = await new Promise((resolve, reject) => canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Couldn't capture this page.")),
        "image/jpeg",
        0.98,
      ));
      if (retakeTarget) {
        const updated = createPage(image, canvas.width, canvas.height);
        updated.id = retakeTarget;
        setPages((current) => current.map((page) => page.id === retakeTarget ? updated : page));
        setSelectedId(retakeTarget);
        notify("Page retaken.");
      } else {
        const page = createPage(image, canvas.width, canvas.height);
        setPages((current) => [...current, page]);
        setSelectedId(page.id);
        notify("Page captured.");
      }
      setCropEditing(false);
      setCompareSide("after");
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
        const normalized = await normalizeImage(file);
        added.push(createPage(normalized.blob, normalized.width, normalized.height));
      }
      setPages((current) => [...current, ...added]);
      setSelectedId(added[0].id);
      setCompareSide("after");
      setCropEditing(false);
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

  async function autoCropSelected() {
    if (!selectedPage) return;
    setProcessing(true);
    setStatus("Detecting document edges…");
    setError("");
    try {
      const corners = await detectDocumentCorners(selectedPage.working);
      if (!corners) {
        setPages((current) => current.map((page) => page.id === selectedPage.id
          ? { ...page, corners: DEFAULT_CORNERS(page.sourceWidth, page.sourceHeight) }
          : page));
        setCropEditing(true);
        setCompareSide("before");
        setStatus("");
        notify("Couldn't confidently detect all page edges. Adjust the four corners, then apply the crop.");
        return;
      }
      const cropped = await perspectiveCrop(selectedPage.working, corners);
      setPages((current) => current.map((page) => page.id === selectedPage.id
        ? {
          ...page,
          working: cropped.blob,
          image: cropped.blob,
          width: cropped.width,
          height: cropped.height,
          sourceWidth: cropped.width,
          sourceHeight: cropped.height,
          corners: null,
        }
        : page));
      setCropEditing(false);
      setCompareSide("after");
      setStatus("");
      notify("Document detected, cropped, and perspective-corrected.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't crop this document.";
      setError(message);
      setStatus("");
      notify(message, "error");
    } finally {
      setProcessing(false);
    }
  }

  async function applyManualCrop() {
    if (!selectedPage?.corners) return;
    setProcessing(true);
    setStatus("Flattening selected page…");
    setError("");
    try {
      const cropped = await perspectiveCrop(selectedPage.working, selectedPage.corners);
      setPages((current) => current.map((page) => page.id === selectedPage.id
        ? {
          ...page,
          working: cropped.blob,
          image: cropped.blob,
          width: cropped.width,
          height: cropped.height,
          sourceWidth: cropped.width,
          sourceHeight: cropped.height,
          corners: null,
        }
        : page));
      setCropEditing(false);
      setCompareSide("after");
      setStatus("");
      notify("Page cropped and flattened.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't crop this page.";
      setError(message);
      setStatus("");
      notify(message, "error");
    } finally {
      setProcessing(false);
    }
  }

  function editCorners() {
    if (!selectedPage) return;
    setPages((current) => current.map((page) => page.id === selectedPage.id
      ? { ...page, corners: page.corners ?? DEFAULT_CORNERS(page.sourceWidth, page.sourceHeight) }
      : page));
    setCropEditing(true);
    setCompareSide("before");
  }

  function updateCorner(event) {
    if (activeCorner === null || !selectedPage || !cropSvgRef.current) return;
    const bounds = cropSvgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(selectedPage.sourceWidth, ((event.clientX - bounds.left) / bounds.width) * selectedPage.sourceWidth));
    const y = Math.max(0, Math.min(selectedPage.sourceHeight, ((event.clientY - bounds.top) / bounds.height) * selectedPage.sourceHeight));
    setPages((current) => current.map((page) => {
      if (page.id !== selectedPage.id || !page.corners) return page;
      const corners = [...page.corners];
      corners[activeCorner] = { x, y };
      return { ...page, corners };
    }));
  }

  async function enhanceSelected() {
    if (!selectedPage) return;
    if (mode === "original") {
      setPages((current) => current.map((page) => page.id === selectedPage.id ? { ...page, image: page.working } : page));
      setCompareSide("after");
      notify("Original scan restored.");
      return;
    }
    setProcessing(true);
    setStatus(mode === "bw" ? "Applying clean black & white scan…" : mode === "clean" ? "Cleaning stains and softening dark edges…" : "Removing shadows and enhancing page…");
    setError("");
    try {
      const enhanced = await enhanceDocument(selectedPage.working, mode);
      setPages((current) => current.map((page) => page.id === selectedPage.id ? { ...page, image: enhanced } : page));
      setCropEditing(false);
      setCompareSide("after");
      setStatus("");
      notify("Document enhancement complete.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't enhance this page.";
      setError(message);
      setStatus("");
      notify(message, "error");
    } finally {
      setProcessing(false);
    }
  }

  async function extractText() {
    if (!selectedPage || processing || ocrProgress !== null) return;
    setOcrProgress(0);
    setOcrStatus("Preparing text recognition…");
    setOcrError("");
    setOcrText("");
    setOcrSource(null);
    let worker;
    try {
      worker = await createWorker(ocrLanguage, undefined, {
        logger: ({ status: workerStatus, progress: workerProgress }) => {
          setOcrStatus(workerStatus === "recognizing text" ? "Reading text…" : "Loading OCR language data…");
          if (Number.isFinite(workerProgress)) setOcrProgress(Math.round(workerProgress * 100));
        },
      });
      const { data } = await worker.recognize(selectedPage.image);
      const text = data.text.trim();
      setOcrText(text);
      setOcrSource(selectedPage.image);
      if (text) notify("Text extracted successfully.");
      else notify("OCR finished, but no text was detected.", "error");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't extract text from this image.";
      setOcrError(message);
      notify(message, "error");
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Couldn't stop the OCR worker.";
          setOcrError((current) => current ? `${current} ${message}` : message);
          notify(message, "error");
        }
      }
      setOcrProgress(null);
      setOcrStatus("");
    }
  }

  async function copyExtractedText() {
    if (!ocrText || ocrSource !== selectedPage?.image) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ocrText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = ocrText;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.append(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("Clipboard access isn't available in this browser.");
      }
      notify("Extracted text copied.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't copy the extracted text.";
      setOcrError(message);
      notify(message, "error");
    }
  }

  function downloadExtractedText() {
    if (!ocrText || ocrSource !== selectedPage?.image) return;
    const filename = `fileease-page-${selectedIndex + 1}-text.txt`;
    downloadBlob(new Blob([`\uFEFF${ocrText}`], { type: "text/plain;charset=utf-8" }), filename);
    notify("Extracted text downloaded.");
  }

  async function rotateSelected() {
    if (!selectedPage) return;
    setProcessing(true);
    setStatus("Rotating page…");
    setError("");
    try {
      const rotated = await rotateImage(selectedPage.working, 90);
      setPages((current) => current.map((page) => page.id === selectedPage.id
        ? {
          ...page,
          working: rotated.blob,
          image: rotated.blob,
          width: rotated.width,
          height: rotated.height,
          sourceWidth: rotated.width,
          sourceHeight: rotated.height,
          corners: null,
        }
        : page));
      setCropEditing(false);
      setCompareSide("after");
      setStatus("");
      notify("Page rotated.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Couldn't rotate this page.";
      setError(message);
      setStatus("");
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
    setCropEditing(false);
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
        const pageData = pages[index];
        const embedded = await pdf.embedJpg(await pageData.image.arrayBuffer());
        const ratio = Math.min(612 / pageData.width, 792 / pageData.height);
        const width = pageData.width * ratio;
        const height = pageData.height * ratio;
        const page = pdf.addPage([width, height]);
        page.drawImage(embedded, { x: 0, y: 0, width, height });
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

  const selectedIndex = pages.findIndex((page) => page.id === selectedId);
  const selectedPreview = previews[selectedIndex];
  const previewUrl = cropEditing ? selectedPreview?.working : compareSide === "before" ? selectedPreview?.original : selectedPreview?.image;
  const previewWidth = cropEditing
    ? selectedPage?.sourceWidth
    : compareSide === "before" ? selectedPage?.originalWidth : selectedPage?.width;
  const previewHeight = cropEditing
    ? selectedPage?.sourceHeight
    : compareSide === "before" ? selectedPage?.originalHeight : selectedPage?.height;
  const cropPath = selectedPage?.corners?.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ") + " Z";
  const canUseCamera = Boolean(navigator.mediaDevices?.getUserMedia);

  return (
    <div className="tool-page scanner-page">
      <div className="tool-heading">
        <span className="page-kicker"><ScanLine size={14} /> DOCUMENT TOOL</span>
        <h1>Cam Scanner</h1>
        <p>Scan paper documents, flatten page perspective, enhance the image, and save a clear PDF on your device.</p>
      </div>

      {!pages.length && !cameraEnabled && (
        <div className="scanner-start-card workspace-card">
          <div className="scanner-start-icon"><Camera size={25} /></div>
          <h2>Start scanning</h2>
          <p>Use your device camera for a new scan, or add existing document photos.</p>
          <div className="scanner-start-actions">
            <button className="btn btn-primary" onClick={() => openCamera()}><Camera size={16} /> Open camera</button>
            <button className="btn btn-outline-primary" onClick={() => uploadInputRef.current?.click()}><ImagePlus size={16} /> Upload images</button>
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
            {cameraReady && <><div className="scanner-frame-corner corner-tl" /><div className="scanner-frame-corner corner-tr" /><div className="scanner-frame-corner corner-bl" /><div className="scanner-frame-corner corner-br" /></>}
          </div>
          {cameraError && <div className="scanner-upload-fallback"><UploadZone compact accept="image/*" multiple onFiles={addImages} title="Use a document photo instead" description="Drop images here or browse your device" /></div>}
          <div className="scanner-camera-actions">
            <button className="btn btn-outline-primary" onClick={() => uploadInputRef.current?.click()}><ImagePlus size={16} /> Upload image</button>
            <button className="btn btn-primary scanner-capture-button" disabled={!cameraReady || processing} onClick={capturePage}><Camera size={18} /> Capture</button>
          </div>
        </section>
      )}

      {pages.length > 0 && !cameraEnabled && (
        <section className="workspace-card scanner-editor">
          <div className="section-heading">
            <div><h2>Scanned pages <span className="count-badge">{pages.length}</span></h2><p>Drag thumbnails to reorder. Select a page to edit.</p></div>
            <button className="btn btn-light subtle-button" disabled={processing} onClick={() => openCamera()}><FilePlus2 size={15} /> Add page</button>
          </div>

          {selectedPage && (
            <>
              {!cropEditing && selectedPreview && (
                <div className="scanner-compare-tabs" role="group" aria-label="Compare original and processed page">
                  <button className={compareSide === "before" ? "active" : ""} onClick={() => setCompareSide("before")}><span>Before</span> Original</button>
                  <button className={compareSide === "after" ? "active" : ""} onClick={() => setCompareSide("after")}><span>After</span> Scanned</button>
                </div>
              )}
              <div className={`scanner-preview ${cropEditing ? "scanner-preview-editing" : ""}`}>
                {previewUrl && (
                  <div
                    className="scanner-image-wrap"
                    style={{
                      aspectRatio: `${previewWidth} / ${previewHeight}`,
                      width: `min(100%, ${Math.min(780, 500 * previewWidth / previewHeight)}px)`,
                    }}
                  >
                    <img src={previewUrl} alt={cropEditing ? "Adjust the document crop corners" : `Page ${selectedIndex + 1} ${compareSide === "before" ? "original" : "processed"}`} />
                    {cropEditing && selectedPage.corners && (
                      <svg
                        ref={cropSvgRef}
                        className="scanner-crop-overlay"
                        viewBox={`0 0 ${selectedPage.sourceWidth} ${selectedPage.sourceHeight}`}
                        onPointerMove={updateCorner}
                        onPointerUp={() => setActiveCorner(null)}
                        onPointerCancel={() => setActiveCorner(null)}
                      >
                        <defs>
                          <mask id="scanner-crop-mask">
                            <rect width={selectedPage.sourceWidth} height={selectedPage.sourceHeight} fill="white" />
                            <path d={cropPath} fill="black" />
                          </mask>
                        </defs>
                        <rect width={selectedPage.sourceWidth} height={selectedPage.sourceHeight} fill="rgba(12,16,26,.55)" mask="url(#scanner-crop-mask)" />
                        <path d={cropPath} className="scanner-crop-outline" />
                        {selectedPage.corners.map((point, index) => (
                          <circle
                            key={`crop-corner-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r={Math.max(selectedPage.sourceWidth, selectedPage.sourceHeight) * 0.018}
                            className="scanner-crop-handle"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                              setActiveCorner(index);
                            }}
                          />
                        ))}
                      </svg>
                    )}
                  </div>
                )}
              </div>

              <div className="scanner-page-meta">
                <span>{cropEditing ? "Drag the four handles to the page corners." : `Page ${selectedIndex + 1} · ${formatBytes(selectedPage.image.size)}`}</span>
                <div className="scanner-page-actions">
                  <button type="button" onClick={() => downloadBlob(selectedPage.image, `fileease-page-${selectedIndex + 1}.jpg`)}><Download size={14} /> Download image</button>
                  <button type="button" onClick={() => openCamera(selectedPage.id)}><Camera size={14} /> Retake</button>
                  <button type="button" className="scanner-delete-action" onClick={() => deletePage(selectedPage.id)}><Trash2 size={14} /> Delete</button>
                </div>
              </div>

              {cropEditing ? (
                <div className="scanner-crop-actions">
                  <p>Move each handle to the document's corners in clockwise order.</p>
                  <button className="btn btn-outline-primary" disabled={processing} onClick={autoCropSelected}><ScanLine size={15} /> Detect again</button>
                  <button className="btn btn-outline-primary" disabled={processing} onClick={() => setCropEditing(false)}>Cancel</button>
                  <button className="btn btn-primary" disabled={processing} onClick={applyManualCrop}><Check size={15} /> Apply crop</button>
                </div>
              ) : (
                <>
                  <div className="scanner-settings">
                    <div className="scanner-settings-title"><SlidersHorizontal size={15} /><strong>Document enhancement</strong></div>
                    <div className="scanner-mode-grid" role="group" aria-label="Enhancement mode">
                      {[
                        ["original", "Original", "Keep the image unchanged"],
                        ["clean", "Document cleaner", "Lift stains and soften dark edges"],
                        ["bw", "Black & white (strong)", "Clean binary document scan"],
                        ["gray", "Grayscale", "Balanced monochrome"],
                        ["enhanced", "Enhanced color", "Remove shadows and sharpen"],
                      ].map(([value, label, description]) => (
                        <button type="button" key={value} aria-pressed={mode === value} className={`scanner-mode-option ${mode === value ? "selected" : ""}`} onClick={() => setMode(value)}>
                          <span className="scanner-mode-radio" />
                          <span><strong>{label}</strong><small>{description}</small></span>
                        </button>
                      ))}
                    </div>
                    <div className="scanner-edit-actions">
                      <button className="btn btn-outline-primary" disabled={processing} onClick={autoCropSelected}><ScanLine size={15} /> Auto Crop</button>
                      <button className="btn btn-outline-primary" disabled={processing} onClick={editCorners}><ScanLine size={15} /> Adjust corners</button>
                      <button className="btn btn-outline-primary" disabled={processing} onClick={rotateSelected}><RotateCw size={15} /> Rotate</button>
                      <button className="btn btn-primary" disabled={processing} onClick={enhanceSelected}>
                        {mode === "original"
                          ? <><Check size={15} /> Restore original</>
                          : mode === "clean"
                            ? <><WandSparkles size={15} /> Clean Document</>
                            : <><WandSparkles size={15} /> Enhance</>}
                      </button>
                    </div>
                    <p className="scanner-hint">Cleaning lifts uneven backgrounds, improves text contrast, and gently lightens dark pixels near the outer edge. Black &amp; white uses adaptive thresholding; all processing stays on-device.</p>
                  </div>
                </>
              )}
              {!cropEditing && (
                <section className="scanner-ocr" aria-labelledby="scanner-ocr-title">
                  <div className="scanner-settings-title"><FileText size={15} /><strong id="scanner-ocr-title">Text extractor (OCR)</strong></div>
                  <p className="scanner-hint scanner-ocr-intro">Recognize text from this page on your device. The first run downloads the selected OCR language data for local processing.</p>
                  <div className="scanner-ocr-controls">
                    <label className="scanner-ocr-language">
                      <Languages size={14} />
                      <span className="sr-only">OCR language</span>
                      <select
                        className="form-select"
                        value={ocrLanguage}
                        disabled={processing || ocrProgress !== null}
                        onChange={(event) => setOcrLanguage(event.target.value)}
                      >
                        <option value="eng">English</option>
                        <option value="eng+urd">English + Urdu</option>
                      </select>
                    </label>
                    <button className="btn btn-primary" type="button" disabled={processing || ocrProgress !== null} onClick={extractText}>
                      <FileText size={15} /> {ocrProgress !== null ? "Extracting…" : "Extract Text"}
                    </button>
                  </div>
                  {ocrProgress !== null && <ProgressBar value={ocrProgress} label={ocrStatus || "Extracting text…"} />}
                  {ocrError && <div className="inline-error" role="alert">{ocrError}</div>}
                  {ocrText && ocrSource === selectedPage.image && (
                    <div className="scanner-ocr-result">
                      <label htmlFor="scanner-ocr-text">Extracted text</label>
                      <textarea id="scanner-ocr-text" dir="auto" readOnly value={ocrText} />
                      <div className="scanner-ocr-actions">
                        <button className="btn btn-outline-primary" type="button" onClick={copyExtractedText}><Copy size={14} /> Copy Text</button>
                        <button className="btn btn-outline-primary" type="button" onClick={downloadExtractedText}><Download size={14} /> Download .txt</button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

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
                <button className="scanner-thumbnail-select" type="button" onClick={() => { setSelectedId(page.id); setCropEditing(false); setCompareSide("after"); }} aria-label={`Select page ${index + 1}`}>
                  <img src={previews[index].image} alt="" />
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
            <button className="btn btn-primary" type="button" disabled={processing || !pages.length} onClick={createPdf}><FilePlus2 size={16} /> Create PDF</button>
          </div>
        </section>
      )}

      <input ref={uploadInputRef} className="visually-hidden" type="file" accept="image/*" multiple onChange={(event) => { addImages(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <div className="scanner-privacy-note"><span><Check size={14} /></span><strong>Camera is only used on your device. No image is uploaded.</strong></div>
      <div className="scanner-processing-status" aria-live="polite">{processing && <><span className="scanner-spinner" />{status || "Processing…"}</>}</div>
    </div>
  );
}
