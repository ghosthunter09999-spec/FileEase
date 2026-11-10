import JSZip from "jszip";

export async function compressDocxDocument(file, level = 9, onProgress = () => {}) {
  const packageZip = await JSZip.loadAsync(file);
  if (!packageZip.file("word/document.xml")) {
    throw new Error("This Word file doesn't contain a readable document.");
  }
  return packageZip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
    compressionOptions: { level },
  }, (metadata) => onProgress(metadata.percent));
}
