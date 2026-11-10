import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileImage,
  FileText,
  GripVertical,
  Trash2,
} from "lucide-react";
import ProgressBar from "../components/ProgressBar.jsx";
import UploadZone from "../components/UploadZone.jsx";
import { mergeDocuments } from "../lib/mergePdf.js";
import { downloadBlob, formatBytes } from "../utils/files.js";

const ACCEPTED_EXTENSIONS = new Set(["pdf", "docx", "txt", "jpg", "jpeg", "png"]);

function extensionOf(name) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export default function DocumentMerger({ notify }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filename, setFilename] = useState("merged-document");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const urls = useRef(new Set());

  useEffect(() => () => {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function addFiles(files) {
    if (loading || busy) {
      notify("Wait for the current file operation to finish first.", "error");
      return;
    }
    const accepted = files.filter((file) => ACCEPTED_EXTENSIONS.has(extensionOf(file.name)));
    if (accepted.length !== files.length) {
      notify("Some files weren't added. Choose PDF, DOCX, TXT, JPG, JPEG, or PNG files.", "error");
    }
    if (!accepted.length) return;

    setLoading(true);
    const newUrls = [];
    try {
      const additions = [];
      for (const file of accepted) {
        const extension = extensionOf(file.name);
        let previewBlob = file;
        let pageCount = extension === "pdf" ? null : 1;
        if (extension === "pdf") {
          const { PDFDocument } = await import("pdf-lib");
          const pdf = await PDFDocument.load(await file.arrayBuffer());
          pageCount = pdf.getPageCount();
        } else if (extension === "docx" || extension === "txt") {
          const { documentToPdf } = await import("../lib/pdf.js");
          const { readDocxText } = await import("../utils/document.js");
          const text = extension === "docx" ? await readDocxText(file) : await file.text();
          previewBlob = await documentToPdf(text);
          const { PDFDocument } = await import("pdf-lib");
          pageCount = (await PDFDocument.load(await previewBlob.arrayBuffer())).getPageCount();
        }

        const previewUrl = URL.createObjectURL(previewBlob);
        urls.current.add(previewUrl);
        newUrls.push(previewUrl);
        additions.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          file,
          extension,
          pageCount,
          pageOrder: Array.from({ length: pageCount }, (_, index) => index),
          previewUrl,
        });
      }

      setItems((current) => [...current, ...additions]);
      if (additions.length) setSelectedId(additions[0].id);
      setStatus("");
    } catch (error) {
      newUrls.forEach((url) => {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      });
      notify(error instanceof Error ? error.message : "Couldn't read one of those files.", "error");
    } finally {
      setLoading(false);
    }
  }

  function moveItem(sourceIndex, targetIndex) {
    if (targetIndex < 0 || targetIndex >= items.length || sourceIndex === targetIndex) return;
    setItems((current) => {
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function movePage(itemId, sourceIndex, targetIndex) {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId || targetIndex < 0 || targetIndex >= item.pageOrder.length) return item;
      const pageOrder = [...item.pageOrder];
      const [moved] = pageOrder.splice(sourceIndex, 1);
      pageOrder.splice(targetIndex, 0, moved);
      return { ...item, pageOrder };
    }));
  }

  function removeItem(item) {
    URL.revokeObjectURL(item.previewUrl);
    urls.current.delete(item.previewUrl);
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    if (selectedId === item.id) setSelectedId(items.find((entry) => entry.id !== item.id)?.id ?? null);
    setStatus("");
  }

  async function merge() {
    if (items.length < 2 || loading || busy) return;
    setBusy(true);
    setProgress(0);
    setStatus("Preparing your merged PDF…");
    try {
      const blob = await mergeDocuments(items, (value) => {
        setProgress(value);
        setStatus(value < 90 ? "Adding files in order…" : "Finishing your PDF…");
      });
      const outputName = filename.trim().replace(/\.pdf$/i, "") || "merged-document";
      downloadBlob(blob, `${outputName}.pdf`);
      setProgress(100);
      setStatus("Your merged PDF is ready");
      notify("Merged PDF downloaded.");
    } catch (error) {
      setProgress(0);
      setStatus("");
      notify(error instanceof Error ? error.message : "Couldn't merge these files.", "error");
    } finally {
      setBusy(false);
    }
  }

  const selected = items.find((item) => item.id === selectedId);

  return (
    <div className="tool-page">
      <div className="tool-heading">
        <span className="page-kicker"><FileText size={14} /> PDF TOOL</span>
        <h1>Document merger</h1>
        <p>Combine PDFs, Word documents, text, and images into one PDF. Arrange your files first; everything is processed on your device.</p>
      </div>

      <section className="workspace-card merger-workspace" aria-labelledby="merger-add-title">
        <div className="section-heading">
          <div><h2 id="merger-add-title">1. Add your files</h2><p>PDF, DOCX, TXT, JPG, JPEG, and PNG. Word and text files are converted to simple text PDFs.</p></div>
        </div>
        <UploadZone
          accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png"
          multiple
          onFiles={addFiles}
          title="Drop files to merge"
          description="Select two or more files — you can add more later"
          compact={items.length > 0}
        />
        {loading && <div className="merger-loading" role="status"><span className="spinner-border spinner-border-sm text-primary" aria-hidden="true" /> Reading files on your device…</div>}

        {items.length > 0 ? (
          <div className="merger-layout">
            <section aria-labelledby="merger-order-title">
              <div className="merger-subheading"><h3 id="merger-order-title">2. Set the order</h3><span>{items.length} {items.length === 1 ? "file" : "files"} · {items.reduce((sum, item) => sum + item.pageCount, 0)} pages</span></div>
              <ol className="merge-file-list" aria-label="Files in merge order">
                {items.map((item, index) => (
                  <li className="merge-file-item-wrap" key={item.id}>
                    <div
                      className={`merge-file-item ${selectedId === item.id ? "selected" : ""}`}
                      draggable={!busy && !loading}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(index));
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceIndex = Number(event.dataTransfer.getData("text/plain"));
                        moveItem(sourceIndex, index);
                      }}
                    >
                      <GripVertical className="merge-grip" size={17} aria-hidden="true" />
                      <button className="merge-file-select" type="button" onClick={() => setSelectedId(item.id)} aria-pressed={selectedId === item.id}>
                        <span className={`file-type-icon ${item.extension === "pdf" ? "file-type-pdf" : ""}`}>
                          {["png", "jpg", "jpeg"].includes(item.extension) ? <FileImage size={17} /> : <FileText size={17} />}
                        </span>
                        <span className="file-info"><strong title={item.file.name}>{item.file.name}</strong><span>{formatBytes(item.file.size)} · {item.pageCount} {item.pageCount === 1 ? "page" : "pages"}</span></span>
                      </button>
                      <div className="merge-file-actions">
                        <button type="button" className="merge-order-button" onClick={() => moveItem(index, index - 1)} disabled={index === 0 || busy || loading} aria-label={`Move ${item.file.name} up`}><ArrowUp size={15} /></button>
                        <button type="button" className="merge-order-button" onClick={() => moveItem(index, index + 1)} disabled={index === items.length - 1 || busy || loading} aria-label={`Move ${item.file.name} down`}><ArrowDown size={15} /></button>
                        <button type="button" className="merge-remove-button" onClick={() => removeItem(item)} disabled={busy || loading} aria-label={`Remove ${item.file.name}`}><Trash2 size={15} /></button>
                      </div>
                    </div>
                    {item.pageCount > 1 && (
                      <details className="merge-page-details">
                        <summary>Reorder {item.pageCount} pages</summary>
                        <ol className="merge-page-list" aria-label={`${item.file.name} page order`}>
                          {item.pageOrder.map((pageNumber, pageIndex) => (
                            <li
                              className="merge-page-item"
                              key={`${item.id}-page-${pageNumber}`}
                              draggable={!busy && !loading}
                              onDragStart={(event) => {
                                event.stopPropagation();
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", String(pageIndex));
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                movePage(item.id, Number(event.dataTransfer.getData("text/plain")), pageIndex);
                              }}
                            >
                              <GripVertical size={14} aria-hidden="true" />
                              <span>Page {pageNumber + 1}</span>
                              <div className="merge-file-actions">
                                <button type="button" className="merge-order-button" onClick={() => movePage(item.id, pageIndex, pageIndex - 1)} disabled={pageIndex === 0 || busy || loading} aria-label={`Move page ${pageNumber + 1} up`}><ArrowUp size={14} /></button>
                                <button type="button" className="merge-order-button" onClick={() => movePage(item.id, pageIndex, pageIndex + 1)} disabled={pageIndex === item.pageOrder.length - 1 || busy || loading} aria-label={`Move page ${pageNumber + 1} down`}><ArrowDown size={14} /></button>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
              <p className="merge-hint"><GripVertical size={14} /> Drag files and pages to reorder them, or use the arrow buttons.</p>
            </section>

            {selected && (
              <section className="merge-preview" aria-labelledby="merge-preview-title">
                <div className="merger-subheading"><h3 id="merge-preview-title">Preview</h3><span>{selected.file.name}</span></div>
                {["jpg", "jpeg", "png"].includes(selected.extension)
                  ? <img src={selected.previewUrl} alt={`Preview of ${selected.file.name}`} />
                  : <iframe src={`${selected.previewUrl}#page=1&toolbar=0`} title={`Preview of ${selected.file.name}`} />}
              </section>
            )}
          </div>
        ) : !loading && (
          <div className="merge-empty-state"><FileText size={21} /><strong>Your merge list is empty</strong><span>Add two or more files to see the order and preview them here.</span></div>
        )}

        <div className="merge-output-row">
          <label htmlFor="merge-output-name">Name your new PDF</label>
          <div className="merge-output-control"><input id="merge-output-name" className="form-control" value={filename} onChange={(event) => setFilename(event.target.value)} /><span>.pdf</span></div>
          <button type="button" className="btn btn-primary" onClick={merge} disabled={busy || loading || items.length < 2}>
            {busy ? "Merging…" : <><Check size={17} /> Merge &amp; download</>}
          </button>
        </div>
        {busy && <ProgressBar value={progress} label={status} />}
        {!busy && status && <p className="merger-status" role="status">{status}</p>}
        <p className="merger-privacy">Files are processed locally. Word layout and complex formatting are simplified to readable text in the merged PDF.</p>
      </section>
    </div>
  );
}
