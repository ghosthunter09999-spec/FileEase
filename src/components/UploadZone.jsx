import { useRef, useState } from "react";
import { FileUp, FolderOpen, ShieldCheck } from "lucide-react";

export default function UploadZone({
  accept,
  multiple = false,
  onFiles,
  title = "Drop your files here",
  description = "or click to browse from your device",
  compact = false,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function deliver(fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length) onFiles(files);
  }

  return (
    <div
      className={`upload-zone ${dragging ? "is-dragging" : ""} ${compact ? "upload-zone-compact" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        deliver(event.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
      }}
      role="button"
      tabIndex={0}
      aria-label="Choose files or drop them here"
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          deliver(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="upload-icon"><FileUp size={compact ? 20 : 25} /></div>
      <div className="upload-copy">
        <strong>{title}</strong>
        <span>{description}</span>
        <span className="upload-privacy"><ShieldCheck size={14} /> Your files never leave your device</span>
      </div>
      <span className="btn btn-primary browse-button">
        <FolderOpen size={16} /> Browse files
      </span>
    </div>
  );
}
