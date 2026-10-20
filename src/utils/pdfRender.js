import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export async function rasterizePdf(file, {
  scale = 1.5,
  quality = 0.78,
  imageType = "image/jpeg",
  onProgress = () => {},
} = {}) {
  const pdfDocument = await getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Your browser couldn't prepare a canvas for PDF rendering.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise((resolve, reject) => canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("Couldn't encode a PDF page.")),
        imageType,
        imageType === "image/jpeg" ? quality : undefined,
      ));
      pages.push({ bytes: await blob.arrayBuffer(), width: viewport.width / scale, height: viewport.height / scale });
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
      onProgress(pageNumber / pdfDocument.numPages);
    }
  } finally {
    await pdfDocument.destroy();
  }
  return pages;
}
