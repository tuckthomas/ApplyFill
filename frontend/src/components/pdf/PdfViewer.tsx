import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

// ApplyFill-native adaptation of the SkiaMime PDF viewer interaction model:
// https://github.com/tuckthomas/Pyrick-Workspace/tree/main/addons/SkiaMime
type PdfViewerProps = {
  className?: string;
  downloadName?: string;
  file: Blob | string | null;
  title?: string;
};

type PageCanvasProps = {
  document: PDFDocumentProxy;
  onRendered?: (page: PDFPageProxy) => void;
  pageNumber: number;
  scale: number;
  thumbnail?: boolean;
};

function PageCanvas({ document, onRendered, pageNumber, scale, thumbnail = false }: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let task: RenderTask | null = null;
    let disposed = false;
    void document.getPage(pageNumber).then(async (page) => {
      if (disposed || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const outputScale = thumbnail ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;
      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      task = page.render({
        canvas,
        canvasContext: context,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        viewport,
      });
      try {
        await task.promise;
        if (!disposed) onRendered?.(page);
      } catch (error) {
        if (!disposed && !(error instanceof Error && error.name === 'RenderingCancelledException')) throw error;
      }
    });
    return () => {
      disposed = true;
      task?.cancel();
    };
  }, [document, onRendered, pageNumber, scale, thumbnail]);

  return <canvas aria-label={`Page ${pageNumber}`} className={thumbnail ? 'pdf-thumbnail-canvas' : 'pdf-page-canvas'} ref={canvasRef} />;
}

export default function PdfViewer({ className = '', downloadName = 'document.pdf', file, title = 'PDF preview' }: PdfViewerProps) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [thumbnailRailWidth, setThumbnailRailWidth] = useState(160);
  const [pageWidth, setPageWidth] = useState(612);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fitAnimationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let current = true;
    setDocument(null);
    setError('');
    setPageNumber(1);
    if (!file) return;
    const source = typeof file === 'string' ? file : URL.createObjectURL(file);
    if (typeof file !== 'string') objectUrlRef.current = source;
    const loadingTask = getDocument({ url: source });
    void loadingTask.promise
      .then((value) => {
        if (current) setDocument(value);
      })
      .catch(() => {
        if (current) setError('The PDF could not be displayed.');
      });
    return () => {
      current = false;
      void loadingTask.destroy();
      if (objectUrlRef.current === source) {
        URL.revokeObjectURL(source);
        objectUrlRef.current = null;
      }
    };
  }, [file]);

  useEffect(() => {
    if (!fitWidth || !viewportRef.current) return;
    const update = () => {
      if (fitAnimationFrameRef.current !== null) cancelAnimationFrame(fitAnimationFrameRef.current);
      fitAnimationFrameRef.current = requestAnimationFrame(() => {
        const available = viewportRef.current?.clientWidth ?? pageWidth;
        const nextScale = Math.max(0.25, Math.min(3, (available - 48) / pageWidth));
        setScale((current) => Math.abs(current - nextScale) < 0.01 ? current : nextScale);
        fitAnimationFrameRef.current = null;
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewportRef.current);
    update();
    return () => {
      observer.disconnect();
      if (fitAnimationFrameRef.current !== null) cancelAnimationFrame(fitAnimationFrameRef.current);
      fitAnimationFrameRef.current = null;
    };
  }, [fitWidth, pageWidth, showThumbnails]);

  const onRendered = useCallback((page: PDFPageProxy) => {
    const width = page.getViewport({ scale: 1 }).width;
    setPageWidth((current) => Math.abs(current - width) < 0.01 ? current : width);
  }, []);

  const changeScale = (next: number) => {
    setFitWidth(false);
    setScale(Math.max(0.25, Math.min(3, next)));
  };

  const startThumbnailResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = thumbnailRailWidth;
    const updateWidth = (pointerEvent: PointerEvent) => {
      setThumbnailRailWidth(Math.max(140, Math.min(360, startWidth + pointerEvent.clientX - startX)));
    };
    const finishResize = () => {
      window.removeEventListener('pointermove', updateWidth);
      window.removeEventListener('pointerup', finishResize);
    };
    window.addEventListener('pointermove', updateWidth);
    window.addEventListener('pointerup', finishResize, { once: true });
  };

  const download = () => {
    if (!file) return;
    const url = typeof file === 'string' ? file : URL.createObjectURL(file);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = downloadName;
    anchor.click();
    if (typeof file !== 'string') URL.revokeObjectURL(url);
  };

  return (
    <div className={`applyfill-pdf-viewer ${className}`.trim()} ref={rootRef}>
      <div className="pdf-viewer-toolbar" aria-label="PDF controls">
        <button className="icon-button" onClick={() => setShowThumbnails((value) => !value)} type="button" aria-label={showThumbnails ? 'Hide page thumbnails' : 'Show page thumbnails'}>
          {showThumbnails ? <PanelLeftClose aria-hidden="true" size={19} /> : <PanelLeftOpen aria-hidden="true" size={19} />}
        </button>
        <span className="pdf-viewer-title">{title}</span>
        <div className="pdf-viewer-page-controls">
          <button className="icon-button" disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => value - 1)} type="button" aria-label="Previous page"><ChevronLeft aria-hidden="true" size={19} /></button>
          <label><span className="visually-hidden">Page</span><input aria-label="Page number" max={document?.numPages ?? 1} min={1} onChange={(event) => setPageNumber(Math.max(1, Math.min(document?.numPages ?? 1, Number(event.target.value) || 1)))} type="number" value={pageNumber} /></label>
          <span>of {document?.numPages ?? '—'}</span>
          <button className="icon-button" disabled={!document || pageNumber >= document.numPages} onClick={() => setPageNumber((value) => value + 1)} type="button" aria-label="Next page"><ChevronRight aria-hidden="true" size={19} /></button>
        </div>
        <div className="pdf-viewer-zoom-controls">
          <button className="icon-button" onClick={() => changeScale(scale - 0.1)} type="button" aria-label="Zoom out"><ZoomOut aria-hidden="true" size={19} /></button>
          <button className={`pdf-viewer-zoom-value${fitWidth ? ' is-active' : ''}`} onClick={() => setFitWidth(true)} type="button">{fitWidth ? 'Fit width' : `${Math.round(scale * 100)}%`}</button>
          <button className="icon-button" onClick={() => changeScale(scale + 0.1)} type="button" aria-label="Zoom in"><ZoomIn aria-hidden="true" size={19} /></button>
          <button className="icon-button" onClick={() => { setFitWidth(false); setScale(1); }} type="button" aria-label="Actual size"><RotateCcw aria-hidden="true" size={18} /></button>
        </div>
        <button className="icon-button" onClick={() => void rootRef.current?.requestFullscreen()} type="button" aria-label="Full screen"><Expand aria-hidden="true" size={18} /></button>
        <button className="icon-button" disabled={!file} onClick={download} type="button" aria-label="Download PDF"><Download aria-hidden="true" size={18} /></button>
      </div>
      <div className="pdf-viewer-body">
        {showThumbnails && document ? (
          <>
            <aside className="pdf-thumbnail-rail" aria-label="PDF pages" style={{ width: thumbnailRailWidth }}>
              {Array.from({ length: document.numPages }, (_, index) => index + 1).map((number) => (
                <button className={number === pageNumber ? 'is-active' : ''} key={number} onClick={() => setPageNumber(number)} type="button">
                  <PageCanvas document={document} pageNumber={number} scale={0.18} thumbnail />
                  <span>{number}</span>
                </button>
              ))}
            </aside>
            <div
              aria-label="Resize page thumbnails"
              aria-orientation="vertical"
              aria-valuemax={360}
              aria-valuemin={140}
              aria-valuenow={thumbnailRailWidth}
              className="pdf-thumbnail-resizer"
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') setThumbnailRailWidth((width) => Math.max(140, width - 10));
                if (event.key === 'ArrowRight') setThumbnailRailWidth((width) => Math.min(360, width + 10));
              }}
              onPointerDown={startThumbnailResize}
              role="separator"
              tabIndex={0}
            />
          </>
        ) : null}
        <div className="pdf-page-viewport" ref={viewportRef}>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          {!file ? <p className="field-hint">No PDF is available.</p> : null}
          {file && !document && !error ? <p className="field-hint" role="status">Opening PDF…</p> : null}
          {document ? <PageCanvas document={document} onRendered={onRendered} pageNumber={pageNumber} scale={scale} /> : null}
        </div>
      </div>
    </div>
  );
}
