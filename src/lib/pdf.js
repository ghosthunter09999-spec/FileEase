import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function imagesToPdf(files, onProgress = () => {}) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const bytes = await file.arrayBuffer();
    const image = file.type === "image/png"
      ? await pdf.embedPng(bytes)
      : await pdf.embedJpg(bytes);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    onProgress(((index + 1) / files.length) * 90);
  }
  onProgress(95);
  return new Blob([await pdf.save()], { type: "application/pdf" });
}

export async function textToPdf(text) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const margin = 52;
  const pageWidth = 612;
  const pageHeight = 792;
  const lineHeight = 15;
  const maxWidth = pageWidth - margin * 2;
  const lines = [];

  for (const paragraph of text.replace(/\r\n/g, "\n").split("\n")) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  for (const line of lines) {
    if (y < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0.12, 0.15, 0.2),
      maxWidth,
    });
    y -= lineHeight;
  }
  return new Blob([await pdf.save()], { type: "application/pdf" });
}
