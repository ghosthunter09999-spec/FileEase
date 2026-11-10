# FileFlow

FileFlow is a private, browser-only toolkit for common image and PDF tasks. Files are read and processed locally; the application has no upload API or backend.

## Features

- Batch-compress JPG, PNG, and WebP images with shared presets, live previews, clear size comparisons, and ZIP downloads.
- Combine, drag-reorder, and fit JPG/PNG images into original-size, A4, or US Letter PDFs.
- Compress PDFs with adjustable image quality and resolution. This can significantly reduce file size, but text selection, forms, and vector content are not retained.
- Compress arbitrary files into a DEFLATE ZIP archive with selectable compression level. Already-compressed media may not shrink further.
- Compress PDF documents by reducing page image quality/resolution, or recompress DOCX package contents. PDF text/forms/vectors are rasterized; DOCX image assets are not resized, so savings can be modest.
- Convert PDF pages into PNG/JPG images, preview the results, choose output resolution, and download them as a ZIP.
- Convert `.txt` and `.docx` documents into paginated PDFs, with A4 and Letter page sizes.
- Merge multiple PDFs, DOCX/TXT documents, and JPG/PNG images into one PDF. Reorder inputs and pages, preview the selected file, and download the result locally. Word documents are converted as readable text; their original styling is not preserved.
- Split PDFs into comma-separated page ranges and download individual PDFs or a ZIP of all ranges.
- Scan multiple pages without reopening the camera, auto-crop and perspective-flatten document photos, batch-apply shared cleaning settings, reorder pages, and export A4/Letter PDFs or image ZIPs.
- Responsive interface with a persistent light/dark theme.

## Requirements

- Node.js 18 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Vite prints a local URL (usually `http://localhost:5173`) after the development server starts.

## Production build

```bash
npm run build
npm run preview
```

The production-ready static site is generated in `dist/`.

## Deploy

Build with `npm run build`, then deploy the contents of `dist/` to any static hosting provider (for example, GitHub Pages, Netlify, Cloudflare Pages, or Vercel). Configure the provider to serve `index.html` for the site root. No backend or environment variables are required.

## SEO setup

The deployment domain is currently set to `https://fileease.app/` in `index.html`, `public/robots.txt`, and `public/sitemap.xml`. Replace that example origin with your real canonical domain before launch. The sitemap currently lists the homepage only: tool views are client-side states within the same SPA URL, not separately crawlable routes.

Suggested page titles and descriptions (also applied when a visitor opens a tool):

| Page | Suggested title | Suggested meta description |
| --- | --- | --- |
| Home | FileFlow — Private file tools, made simple | Compress, convert, and organize files with simple browser-based tools. Your files stay on your device. |
| Image Compressor | Image Compressor — FileFlow | Compress JPG, PNG, and WebP images. Adjust image quality, compare file sizes, and download privately in your browser. |
| Images to PDF | Images to PDF — FileFlow | Combine and reorder JPG or PNG images into one PDF. Your images are processed locally. |
| PDF Compressor | PDF Compressor — FileFlow | Reduce PDF file size with adjustable image quality. Compress documents locally in your browser without uploading your files. |
| PDF to Images | PDF to Images — FileFlow | Convert PDF pages to PNG or JPG images and download them as a ZIP. Processed privately in your browser. |
| Document to PDF | Document to PDF — FileFlow | Convert DOCX and plain text documents to clean PDFs in your browser. |
| Document Merger | Document Merger — FileFlow | Combine and reorder PDFs, Word documents, text, and images into a PDF directly in your browser. |
| PDF Splitter | PDF Splitter — FileFlow | Extract page ranges from a PDF into separate downloadable PDF files, processed locally. |
| File Compressor | File Compressor — FileFlow | Compress multiple files locally into a downloadable ZIP archive. |
| Document Compressor | Document Compressor — FileFlow | Compress PDF pages or recompress a DOCX package directly in your browser. |

For tool pages to be independently indexed and included as individual sitemap entries, give each tool a real path (for example `/image-compressor/`) and configure hosting for SPA route fallback or prerender those routes. Changing metadata after client-side interaction alone does not create distinct crawlable URLs.

## Privacy

Your files never leave your device. File processing uses browser APIs and local JavaScript libraries; no file contents or analytics are sent to a server. The interface uses system fonts and does not require third-party font requests.

Camera scanning requires browser camera permission and a secure context (HTTPS or `localhost`). If camera access is unavailable, add document photos from your device instead. Automatic crop detection works best when the page contrasts with the surface behind it; when it cannot identify page edges confidently, adjust the four crop handles manually. Detection, perspective correction, and enhancement run locally in your browser. The document converter reads DOCX and plain text files locally; legacy binary DOC files should be saved as DOCX or TXT before conversion.
