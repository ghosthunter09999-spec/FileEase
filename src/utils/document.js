import JSZip from "jszip";

export async function readDocxText(file) {
  const archive = await JSZip.loadAsync(file);
  const documentEntry = archive.file("word/document.xml");
  if (!documentEntry) throw new Error("This Word file doesn't contain a readable document.");

  const xml = await documentEntry.async("text");
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  if (parsed.querySelector("parsererror")) throw new Error("This Word file couldn't be read. Try saving it as a new .docx file.");

  const body = Array.from(parsed.getElementsByTagName("*")).find((element) => element.localName === "body");
  if (!body) throw new Error("This Word file doesn't contain readable document text.");
  const paragraphs = Array.from(body.getElementsByTagName("*"))
    .filter((element) => element.localName === "p")
    .map((paragraph) => {
      const parts = [];
      function collect(node) {
        for (const child of node.children) {
          if (child.localName === "t") parts.push(child.textContent ?? "");
          else if (child.localName === "tab") parts.push("\t");
          else if (child.localName === "br" || child.localName === "cr") parts.push("\n");
          else collect(child);
        }
      }
      collect(paragraph);
      return parts.join("");
    });
  return paragraphs.join("\n");
}
