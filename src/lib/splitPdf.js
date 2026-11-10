import { PDFDocument } from "pdf-lib";

export function parsePageRanges(value, pageCount) {
  const entries = value.split(",").map((part) => part.trim());
  if (!entries.length || entries.some((part) => !part)) {
    throw new Error("Enter pages or ranges separated by commas, such as 1-3, 5.");
  }

  return entries.map((entry) => {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(entry);
    if (!match) throw new Error(`“${entry}” isn't a valid page or range. Use formats like 2 or 2-5.`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`Page range “${entry}” must be between 1 and ${pageCount}.`);
    }
    return Array.from({ length: end - start + 1 }, (_, index) => start + index - 1);
  });
}

export async function splitPdf(file, ranges, onProgress = () => {}) {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const groups = parsePageRanges(ranges, source.getPageCount());
  const outputs = [];

  for (let index = 0; index < groups.length; index += 1) {
    const document = await PDFDocument.create();
    const pages = await document.copyPages(source, groups[index]);
    pages.forEach((page) => document.addPage(page));
    outputs.push({
      pages: groups[index].map((page) => page + 1),
      bytes: await document.save(),
    });
    onProgress(((index + 1) / groups.length) * 95);
  }
  return outputs;
}
