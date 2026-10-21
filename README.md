# FileEase

FileEase is a private, browser-only toolkit for common image and PDF tasks. Files are read and processed locally; the application has no upload API or backend.

## Features

- Compress JPG, PNG, and WebP images with adjustable quality and a before/after size comparison.
- Combine and reorder JPG/PNG images into a PDF.
- Compress PDFs by rendering pages into optimized images. This can significantly reduce file size, but text selection, forms, and vector content are not retained.
- Convert PDF pages into PNG/JPG images and download them as a ZIP.
- Create a paginated PDF from text or a `.txt` file.
- Scan, auto-crop and perspective-flatten document photos, manually adjust crop corners, enhance pages in four modes, reorder pages, and export a PDF.
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
| Home | FileEase — Free Private Image & PDF Tools | Free online image and PDF compressor and converter tools. Compress images, create PDFs, and convert documents privately in your browser. |
| Image Compressor | Free Image Compressor (JPG, PNG, WebP) — FileEase | Compress JPG, PNG, and WebP images online for free. Adjust image quality, compare file sizes, and download privately in your browser. |
| Images to PDF | Images to PDF Converter — Combine Photos Free \| FileEase | Combine and reorder JPG or PNG images into one PDF online for free. Your images are processed locally and never uploaded. |
| PDF Compressor | Free PDF Compressor — Reduce PDF File Size \| FileEase | Reduce PDF file size with adjustable image quality. Compress documents locally in your browser without uploading your files. |
| PDF to Images | PDF to JPG & PNG Converter — Download ZIP \| FileEase | Convert PDF pages to PNG or JPG images and download them as a ZIP. Fast, free, and processed privately in your browser. |
| Text to PDF | Text to PDF Converter — Create a PDF from TXT \| FileEase | Convert plain text or .txt files into paginated PDF documents for free. Create and download PDFs right in your browser. |

For tool pages to be independently indexed and included as individual sitemap entries, give each tool a real path (for example `/image-compressor/`) and configure hosting for SPA route fallback or prerender those routes. Changing metadata after client-side interaction alone does not create distinct crawlable URLs.

## Privacy

Your files never leave your device. File processing uses browser APIs and local JavaScript libraries. No file contents are sent to a server. The optional Google Fonts stylesheet can make a network request for fonts; use system fonts or self-host the fonts if your deployment must make no third-party requests.

Camera scanning requires browser camera permission and a secure context (HTTPS or `localhost`). If camera access is unavailable, add document photos from your device instead. Automatic crop detection works best when the page contrasts with the surface behind it; when it cannot identify page edges confidently, adjust the four crop handles manually. All detection, perspective correction, and enhancement run locally in Canvas without uploading images.
