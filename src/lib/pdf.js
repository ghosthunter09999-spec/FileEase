import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function imagesToPdf(files, {
  pageSize = "fit",
  margin = 36,
  onProgress = () => {},
} = {}) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const bytes = await file.arrayBuffer();
    const image = file.type === "image/png"
      ? await pdf.embedPng(bytes)
      : await pdf.embedJpg(bytes);
    if (pageSize === "fit") {
      const page = pdf.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    } else {
      const pageBounds = pageSize === "letter" ? [612, 792] : [595.28, 841.89];
      const [portraitWidth, portraitHeight] = pageBounds;
      const [width, height] = image.width > image.height
        ? [portraitHeight, portraitWidth]
        : pageBounds;
      const scale = Math.min((width - margin * 2) / image.width, (height - margin * 2) / image.height);
      const drawnWidth = image.width * scale;
      const drawnHeight = image.height * scale;
      const page = pdf.addPage([width, height]);
      page.drawImage(image, {
        x: (width - drawnWidth) / 2,
        y: (height - drawnHeight) / 2,
        width: drawnWidth,
        height: drawnHeight,
      });
    }
    onProgress(((index + 1) / files.length) * 90);
    if ((index + 1) % 4 === 0) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
  }
  onProgress(95);
  return new Blob([await pdf.save()], { type: "application/pdf" });
}

export async function documentToPdf(text, pageSize = "a4", onProgress = () => {}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const margin = pageSize === "letter" ? 54 : 52;
  const [pageWidth, pageHeight] = pageSize === "letter" ? [612, 792] : [595.28, 841.89];
  const lineHeight = 15;
  const maxWidth = pageWidth - margin * 2;
  const lines = [];

  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const pieces = [];
      let piece = "";
      for (const character of word) {
        if (piece && font.widthOfTextAtSize(piece + character, fontSize) > maxWidth) {
          pieces.push(piece);
          piece = character;
        } else {
          piece += character;
        }
      }
      if (piece) pieces.push(piece);
      for (const part of pieces) {
        const candidate = line ? `${line} ${part}` : part;
        if (font.widthOfTextAtSize(candidate, fontSize) > maxWidth && line) {
          lines.push(line);
          line = part;
        } else {
          line = candidate;
        }
      }
    }
    lines.push(line);
  }

  const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
  const pageCount = Math.max(1, Math.ceil(lines.length / linesPerPage));
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;
    const pageLines = lines.slice(pageIndex * linesPerPage, (pageIndex + 1) * linesPerPage);
    for (const line of pageLines) {
      if (line) {
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0.12, 0.15, 0.2),
          maxWidth,
        });
      }
      y -= lineHeight;
    }
    onProgress(((pageIndex + 1) / pageCount) * 90);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  }
  onProgress(95);
  return new Blob([await pdf.save()], { type: "application/pdf" });
}
