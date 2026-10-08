"use client";

// The syllabus pane: pdf.js renders each page to a canvas with a selectable text layer on top, so a selection
// can be turned into heading nodes (button, or Mod+Shift+H in the editor).

import { useCallback, useEffect, useRef, useState } from "react";
import { shortcutLabel } from "@/lib/keys";

type Props = {
  url: string;
  onAddHeadings: (text: string) => void;
  onClose: () => void;
};

// The legacy build carries polyfills for newer JavaScript features the modern build relies on, so the pane
// also works in browsers a release or two behind.
type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<Pdfjs> | null = null;
function loadPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf-worker";
      return mod;
    });
  }
  return pdfjsPromise;
}

export function PdfPane({ url, onAddHeadings, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>("Loading…");
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    const cleanups: (() => void)[] = [];
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const task = pdfjs.getDocument({ url });
        cleanups.push(() => void task.destroy());
        const doc = await task.promise;
        if (cancelled) return;
        setPages(doc.numPages);
        container.replaceChildren();
        const first = await doc.getPage(1);
        const base = first.getViewport({ scale: 1 });
        const scale = (Math.max(320, container.clientWidth - 24) / base.width) * zoom;
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = i === 1 ? first : await doc.getPage(i);
          const viewport = page.getViewport({ scale });
          const pageDiv = document.createElement("div");
          pageDiv.className = "pdfPage";
          pageDiv.style.width = `${Math.floor(viewport.width)}px`;
          pageDiv.style.height = `${Math.floor(viewport.height)}px`;
          const canvas = document.createElement("canvas");
          const dpr = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          const textDiv = document.createElement("div");
          textDiv.className = "textLayer";
          for (const v of ["--scale-factor", "--total-scale-factor"]) textDiv.style.setProperty(v, String(viewport.scale));
          textDiv.style.setProperty("--user-unit", "1");
          pageDiv.append(canvas, textDiv);
          container.append(pageDiv);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvas, canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined }).promise;
          const textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textDiv, viewport });
          await textLayer.render();
          setStatus(i === doc.numPages ? "" : `Rendering ${i} / ${doc.numPages}…`);
        }
      } catch (e) {
        if (!cancelled) setStatus(`Could not load the PDF: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
      for (const c of cleanups) c();
    };
  }, [url, zoom]);

  const addSelection = useCallback(() => {
    const text = window.getSelection()?.toString().trim() ?? "";
    if (!text) {
      setStatus("Select some text in the PDF first.");
      setTimeout(() => setStatus(""), 2500);
      return;
    }
    onAddHeadings(text);
  }, [onAddHeadings]);

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-gray-200 bg-gray-100">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-2 py-1 text-xs">
        <span className="font-medium text-gray-700">Syllabus</span>
        {pages > 0 && <span className="text-gray-400">{pages} pages</span>}
        <button type="button" className="btn py-0 text-xs" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} title="Zoom out">
          −
        </button>
        <span className="w-10 text-center text-gray-500">{Math.round(zoom * 100)}%</span>
        <button type="button" className="btn py-0 text-xs" onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 10) / 10))} title="Zoom in">
          +
        </button>
        <button
          type="button"
          className="btn-primary py-0 text-xs"
          title={`Make a heading from the selected text (${shortcutLabel("Mod+Shift+H")}). Several lines make several headings.`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={addSelection}
        >
          Selection → heading ({shortcutLabel("Mod+Shift+H")})
        </button>
        <span className="ml-auto text-gray-500">{status}</span>
        <button type="button" className="text-gray-500 hover:text-gray-900" onClick={onClose} title="Close the pane">
          Close
        </button>
      </div>
      <div ref={containerRef} className="pdfPages min-h-0 flex-1 overflow-auto p-3" />
    </div>
  );
}
