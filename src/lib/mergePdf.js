import { PDFDocument } from "pdf-lib";
import { documentToPdf } from "./pdf.js";
import { readDocxText } from "../utils/document.js";
import { readFileAsText } from "../utils/files.js";

function getExtension(name) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function toPdfDocument(file) {
  const extension = getExtension(file.name);
  if (extension === "pdf") {
    try {
      return await PDFDocument.load(await file.arrayBuffer());
    } catch (error) {
      throw new Error(`Couldn't open ${file.name}. It may be damaged or password-protected.`);
    }
  }

  if (extension === "docx" || extension === "txt") {
    const text = extension === "docx" ? await readDocxText(file) : await readFileAsText(file);
    return PDFDocument.load(await (await documentToPdf(text)).arrayBuffer());
  }

  if (extension === "png" || extension === "jpg" || extension === "jpeg") {
    const pdf = await PDFDocument.create();
    const bytes = await file.arrayBuffer();
    const image = extension === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    return pdf;
  }

  throw new Error(`${file.name} is not a supported file. Choose PDF, DOCX, TXT, JPG, or PNG.`);
}

export async function mergeDocuments(items, onProgress = () => {}) {
  if (items.length < 2) throw new Error("Add at least two files to merge.");
  const output = await PDFDocument.create();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const source = await toPdfDocument(item.file);
    const pageOrder = item.pageOrder ?? source.getPageIndices();
    const pages = await output.copyPages(source, pageOrder);
    pages.forEach((page) => output.addPage(page));
    onProgress(((index + 1) / items.length) * 90);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  onProgress(95);
  return new Blob([await output.save()], { type: "application/pdf" });
}
