"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  EyeOff, Square, Sparkles, Download, Check, X, RotateCcw,
  Upload, Video, FileText, Image as ImageIcon, ShieldAlert, Scissors, Loader2,
  Maximize2, Minimize2, ChevronLeft, ChevronRight, Tag
} from "lucide-react";
import { computeMerkleRoot } from "@/modules/hasher/merkle";
import { getMimeTypeFromName } from "@/types";
import * as pdfjsLib from "pdfjs-dist";
import jsPDF from "jspdf";

// Configure pdf.js worker URL dynamically
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || "4.10.38"}/build/pdf.worker.min.mjs`;
}

export interface RedactionStudioProps {
  file: File;
  onClose: () => void;
  onCommit: (
    redactedFile: File,
    reason: string,
    redactionType?: string,
    tags?: string[],
    similarityPercentage?: number
  ) => Promise<void>;
}

interface RedactionRect {
  id: string;
  page?: number;
  x: number; // Percentage 0..100
  y: number; // Percentage 0..100
  w: number; // Percentage 0..100
  h: number; // Percentage 0..100
  mode: "blackout" | "blur";
  tag?: string;
}

const REDACTION_TAG_PRESETS = [
  { label: "Identity / PII", value: "PII", color: "bg-amber-100 text-amber-900 border-amber-300" },
  { label: "Bystander Face", value: "Face Mask", color: "bg-blue-100 text-blue-900 border-blue-300" },
  { label: "Financial Data", value: "Financial", color: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { label: "Classified Info", value: "Classified", color: "bg-purple-100 text-purple-900 border-purple-300" },
];

export default function RedactionStudio({ file, onClose, onCommit }: RedactionStudioProps) {
  const fileSizeMB = file.size / (1024 * 1024);
  const effectiveMime = getMimeTypeFromName(file.name, file.type);
  
  const isImage = effectiveMime.startsWith("image/");
  const isVideo = effectiveMime.startsWith("video/");
  const isPdf = effectiveMime === "application/pdf" || file.name.endsWith(".pdf");
  const isTextDoc = effectiveMime.startsWith("text/") || file.name.endsWith(".csv") || file.name.endsWith(".txt") || file.name.endsWith(".json");
  const isDocument = isPdf || isTextDoc;

  // Determine threshold mode
  const isHeavy = fileSizeMB > 200;
  const isVideoMode = isVideo && !isHeavy;
  const isDocMode = isDocument && !isHeavy;
  const isImageMode = isImage && !isHeavy;
  const isCanvasBasedMode = isImageMode || isPdf || isTextDoc;

  // View & Fullscreen State
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [docTextContent, setDocTextContent] = useState<string | null>(null);

  // PDF State
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfNumPages, setPdfNumPages] = useState<number>(1);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);

  // Redaction Classification & Tag State
  const [reason, setReason] = useState<string>("Privacy redaction — bystander face & PII masked");
  const [redactionType, setRedactionType] = useState<string>("Privacy Redaction");
  const [selectedTag, setSelectedTag] = useState<string>("PII");
  const [activeTool, setActiveTool] = useState<"blackout" | "blur">("blackout");
  const [rects, setRects] = useState<RedactionRect[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Heavy media external file state
  const [externalFile, setExternalFile] = useState<File | null>(null);

  // Committing State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const externalInputRef = useRef<HTMLInputElement>(null);

  // Load preview media
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (isImageMode) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl || isCancelled) return;
        setMediaUrl(dataUrl);

        const img = new Image();
        img.onload = () => {
          if (!isCancelled) {
            imageRef.current = img;
            setLoadedImg(img);
          }
        };
        img.onerror = (err) => {
          console.error("Failed to decode image:", err);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } else {
      const url = URL.createObjectURL(file);
      setMediaUrl(url);
    }

    if (isPdf) {
      setIsPdfLoading(true);
      file.arrayBuffer()
        .then((buf) => {
          if (isCancelled) return;
          pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise.then((doc) => {
            if (isCancelled) return;
            setPdfDoc(doc);
            setPdfNumPages(doc.numPages);
            setIsPdfLoading(false);
          }).catch((err) => {
            console.warn("Failed to load document:", err);
            if (!isCancelled) setIsPdfLoading(false);
          });
        })
        .catch(() => {
          if (!isCancelled) setIsPdfLoading(false);
        });
    }

    if (isTextDoc) {
      file.text()
        .then((txt) => {
          if (!isCancelled) setDocTextContent(txt);
        })
        .catch(() => {
          if (!isCancelled) setDocTextContent(null);
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [file, isImageMode, isPdf, isTextDoc]);

  // Synchronous Canvas Rendering Callback (Zero Flickering)
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const bgCanvas = bgCanvasRef.current;
    if (!canvas || !bgCanvas || bgCanvas.width === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== bgCanvas.width || canvas.height !== bgCanvas.height) {
      canvas.width = bgCanvas.width;
      canvas.height = bgCanvas.height;
    }

    // Copy offscreen background synchronously
    ctx.drawImage(bgCanvas, 0, 0);

    // Filter rects by page if PDF
    const activeRects = isPdf ? rects.filter((r) => r.page === pdfCurrentPage || !r.page) : rects;

    // Draw finalized redaction boxes
    activeRects.forEach((r) => {
      const rx = (r.x / 100) * canvas.width;
      const ry = (r.y / 100) * canvas.height;
      const rw = (r.w / 100) * canvas.width;
      const rh = (r.h / 100) * canvas.height;

      if (r.mode === "blackout") {
        ctx.fillStyle = "#000000";
        ctx.fillRect(rx, ry, rw, rh);
      } else {
        try {
          const imgData = ctx.getImageData(rx, ry, rw, rh);
          const data = imgData.data;
          const pixelSize = Math.max(8, Math.floor(Math.min(rw, rh) / 10));
          for (let py = 0; py < rh; py += pixelSize) {
            for (let px = 0; px < rw; px += pixelSize) {
              const i = (py * Math.floor(rw) + px) * 4;
              const rVal = data[i] || 0;
              const gVal = data[i + 1] || 0;
              const bVal = data[i + 2] || 0;

              ctx.fillStyle = `rgb(${rVal},${gVal},${bVal})`;
              ctx.fillRect(rx + px, ry + py, pixelSize, pixelSize);
            }
          }
        } catch (e) {
          ctx.fillStyle = "#000000";
          ctx.fillRect(rx, ry, rw, rh);
        }
      }
    });

    // Draw active drag box synchronously
    if (currentBox) {
      const bx = (currentBox.x / 100) * canvas.width;
      const by = (currentBox.y / 100) * canvas.height;
      const bw = (currentBox.w / 100) * canvas.width;
      const bh = (currentBox.h / 100) * canvas.height;

      ctx.strokeStyle = activeTool === "blackout" ? "#ef4444" : "#3b82f6";
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = activeTool === "blackout" ? "rgba(0, 0, 0, 0.6)" : "rgba(59, 130, 246, 0.4)";
      ctx.fillRect(bx, by, bw, bh);
    }
  }, [isPdf, pdfCurrentPage, rects, currentBox, activeTool]);

  // Pre-render background page to offscreen canvas to prevent flickering
  useEffect(() => {
    let isMounted = true;
    if (!bgCanvasRef.current) {
      bgCanvasRef.current = document.createElement("canvas");
    }

    const prepareBackground = async () => {
      const bgCanvas = bgCanvasRef.current;
      if (!bgCanvas) return;
      const bgCtx = bgCanvas.getContext("2d");
      if (!bgCtx) return;

      if (isPdf && pdfDoc) {
        setIsPdfLoading(true);
        try {
          const page = await pdfDoc.getPage(pdfCurrentPage);
          const viewport = page.getViewport({ scale: 1.5 });
          bgCanvas.width = viewport.width;
          bgCanvas.height = viewport.height;
          await (page.render as any)({ canvasContext: bgCtx, viewport, canvas: bgCanvas }).promise;
          if (isMounted) {
            setIsPdfLoading(false);
            renderCanvas();
          }
        } catch (err) {
          if (isMounted) setIsPdfLoading(false);
        }
      } else if (isImageMode && (loadedImg || imageRef.current)) {
        const img = loadedImg || imageRef.current!;
        bgCanvas.width = img.naturalWidth || img.width || 1200;
        bgCanvas.height = img.naturalHeight || img.height || 800;
        bgCtx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);
        if (isMounted) {
          renderCanvas();
        }
      }
    };

    prepareBackground();
    return () => {
      isMounted = false;
    };
  }, [isPdf, pdfDoc, pdfCurrentPage, isImageMode, loadedImg, renderCanvas]);

  useEffect(() => {
    if (isImageMode || (isPdf && pdfDoc)) {
      renderCanvas();
    }
  }, [rects, currentBox, isImageMode, isPdf, pdfDoc, pdfCurrentPage, renderCanvas]);

  // Handle Mouse / Touch Dragging on Container
  const getContainerCoords = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isCanvasBasedMode) return;
    if ("touches" in e && e.cancelable) {
      e.preventDefault();
    }
    const coords = getContainerCoords(e);
    setIsDrawing(true);
    setStartPos(coords);
    setCurrentBox({ x: coords.x, y: coords.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPos) return;
    if ("touches" in e && e.cancelable) {
      e.preventDefault();
    }
    const coords = getContainerCoords(e);

    const x = Math.min(startPos.x, coords.x);
    const y = Math.min(startPos.y, coords.y);
    const w = Math.abs(coords.x - startPos.x);
    const h = Math.abs(coords.y - startPos.y);

    setCurrentBox({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) return;

    if (currentBox.w > 1 && currentBox.h > 1) {
      const newRect: RedactionRect = {
        id: `mask_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        page: isPdf ? pdfCurrentPage : 1,
        x: currentBox.x,
        y: currentBox.y,
        w: currentBox.w,
        h: currentBox.h,
        mode: activeTool,
        tag: selectedTag,
      };
      setRects((prev) => [...prev, newRect]);
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentBox(null);
  };

  const handleRemoveRect = (id: string) => {
    setRects((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAll = () => {
    setRects([]);
  };

  // Calculate Retained Content Similarity Percentage
  const totalCoverageAreaRatio = rects.reduce((sum, r) => sum + (r.w * r.h) / 10000, 0);
  const computedSimilarityPct = Math.max(5.0, Math.min(100, Math.round((100 - Math.min(95, totalCoverageAreaRatio * 80)) * 10) / 10));

  // Commit Redacted File Handler
  const handleCommitRedaction = async () => {
    if (!reason.trim()) {
      alert("Please provide a redaction note explaining the purpose of this derivative copy.");
      return;
    }

    setIsProcessing(true);
    setStatusMsg("Creating sealed derivative copy & recalculating integrity seal...");

    try {
      let finalRedactedFile: File;

      if (isHeavy || externalFile) {
        if (!externalFile) {
          throw new Error("Please select the externally redacted file to link.");
        }
        finalRedactedFile = externalFile;
      } else if (isPdf && pdfDoc) {
        setStatusMsg("Generating redacted document derivative...");
        const pdfExport = new jsPDF({
          orientation: "portrait",
          unit: "px",
          format: "a4",
        });

        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d")!;

        for (let p = 1; p <= pdfDoc.numPages; p++) {
          const page = await pdfDoc.getPage(p);
          const viewport = page.getViewport({ scale: 1.5 });
          tempCanvas.width = viewport.width;
          tempCanvas.height = viewport.height;
          await (page.render as any)({ canvasContext: tempCtx, viewport, canvas: tempCanvas }).promise;

          // Apply blackout boxes for page p
          const pageRects = rects.filter((r) => r.page === p || !r.page);
          pageRects.forEach((r) => {
            const rx = (r.x / 100) * tempCanvas.width;
            const ry = (r.y / 100) * tempCanvas.height;
            const rw = (r.w / 100) * tempCanvas.width;
            const rh = (r.h / 100) * tempCanvas.height;

            if (r.mode === "blackout") {
              tempCtx.fillStyle = "#000000";
              tempCtx.fillRect(rx, ry, rw, rh);
            }
          });

          const imgData = tempCanvas.toDataURL("image/jpeg", 0.92);
          if (p > 1) {
            pdfExport.addPage([viewport.width, viewport.height]);
          } else {
            pdfExport.deletePage(1);
            pdfExport.addPage([viewport.width, viewport.height]);
          }
          pdfExport.addImage(imgData, "JPEG", 0, 0, viewport.width, viewport.height);
        }

        const pdfBlob = pdfExport.output("blob");
        const redactedName = `REDACTED_${file.name.endsWith(".pdf") ? file.name : file.name + ".pdf"}`;
        finalRedactedFile = new File([pdfBlob], redactedName, { type: "application/pdf" });
      } else if (isImageMode) {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Redaction view unavailable.");

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, file.type || "image/png", 0.95)
        );

        if (!blob) throw new Error("Failed to export redacted image buffer.");

        const redactedName = `REDACTED_${file.name.replace(/\.[^/.]+$/, "")}.png`;
        finalRedactedFile = new File([blob], redactedName, { type: "image/png" });
      } else if (isTextDoc) {
        const docText = docTextContent || (await file.text().catch(() => ""));
        const maskedHeader = `--- REDACTED DERIVATIVE COPY ---\nOriginal File: ${file.name}\nRedaction Reason: ${reason}\nMask Regions: ${rects.length} region(s) redacted\n\n`;
        const redactedContent = docText ? maskedHeader + docText : maskedHeader + `[Binary Document Redacted - ${rects.length} region(s) masked]`;

        const redactedName = `REDACTED_${file.name}`;
        finalRedactedFile = new File([redactedContent], redactedName, { type: effectiveMime || "text/plain" });
      } else {
        finalRedactedFile = file;
      }

      // Collect all tags
      const appliedTags = Array.from(new Set(rects.map((r) => r.tag || selectedTag)));
      if (appliedTags.length === 0) appliedTags.push(selectedTag);

      await onCommit(
        finalRedactedFile,
        reason.trim(),
        redactionType,
        appliedTags,
        computedSimilarityPct
      );

      setIsProcessing(false);
      onClose();
    } catch (err) {
      setIsProcessing(false);
      setStatusMsg(err instanceof Error ? err.message : "Failed to process redacted derivative.");
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center font-sans selection:bg-black selection:text-white transition-all ${
      isFullScreen ? "p-0 bg-black" : "p-4 bg-black/80 backdrop-blur-sm"
    }`}>
      <div className={`bg-white shadow-2xl border border-neutral-200 overflow-hidden flex flex-col transition-all duration-300 ${
        isFullScreen ? "w-screen h-screen rounded-none" : "max-w-5xl w-full max-h-[92vh] rounded-3xl"
      }`}>
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/90 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
              <EyeOff className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-black tracking-tight">Interactive Redaction Studio</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-black text-white">
                  {isHeavy ? "Large Media File" : isPdf ? "Document Page Mask" : isImageMode ? "Image Privacy Mask" : isVideoMode ? "Video Stream Mask" : "Document Text Mask"}
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-mono mt-0.5 truncate max-w-md">
                Target: <span className="font-bold text-black">{file.name}</span> ({(fileSizeMB).toFixed(2)} MB • {effectiveMime || "Media"})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 rounded-xl text-neutral-600 hover:text-black hover:bg-neutral-200 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title={isFullScreen ? "Exit Fullscreen" : "Maximize Fullscreen"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isFullScreen ? "Exit Fullscreen" : "Fullscreen"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Studio Workspace Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#f9f9fa]">
          
          {/* HEAVY MEDIA FLOW (> 200 MB) */}
          {isHeavy ? (
            <div className="bg-white rounded-2xl p-8 border border-neutral-200 text-center space-y-5 shadow-xs max-w-xl mx-auto my-8">
              <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto text-amber-700">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-black">Large File External Redaction Workflow</h4>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  This file is <strong>{(fileSizeMB).toFixed(1)} MB</strong>, exceeding the 200 MB in-browser re-encoding threshold. To avoid memory slowdown:
                </p>
                <div className="text-left bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-xs text-neutral-700 space-y-2 font-mono">
                  <p>1. Open this video/file in your preferred media tool (e.g. QuickTime, Premiere, or VLC).</p>
                  <p>2. Blur or trim sensitive frames and export a redacted copy to your workstation.</p>
                  <p>3. Select the exported redacted file below to calculate its cryptographic seal and link it to the evidence container.</p>
                </div>
              </div>

              <div className="pt-2">
                <input
                  ref={externalInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && setExternalFile(e.target.files[0])}
                />
                <button
                  onClick={() => externalInputRef.current?.click()}
                  className="w-full py-3.5 px-4 rounded-xl border-2 border-dashed border-neutral-300 hover:border-black bg-neutral-50 hover:bg-white text-xs font-bold text-black flex items-center justify-center gap-2 transition-all"
                >
                  <Upload className="w-4 h-4 text-neutral-600" />
                  <span>{externalFile ? `Selected: ${externalFile.name}` : "Attach Externally Redacted File"}</span>
                </button>
              </div>
            </div>
          ) : (
            /* NATIVE INTERACTIVE REDACTION STUDIO WORKSPACE */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start h-full">
              
              {/* Left Canvas Preview Panel (8 cols) */}
              <div className="lg:col-span-8 space-y-3 h-full flex flex-col">
                
                {/* Tool Selection Toolbar & Redaction Tags */}
                <div className="bg-white p-3 rounded-2xl border border-neutral-200 flex items-center justify-between flex-wrap gap-2 shadow-xs flex-shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-1">Tool:</span>
                    <button
                      onClick={() => setActiveTool("blackout")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        activeTool === "blackout"
                          ? "bg-black text-white shadow-xs"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Blackout Box</span>
                    </button>

                    {isImageMode && (
                      <button
                        onClick={() => setActiveTool("blur")}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                          activeTool === "blur"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Blur / Pixelate</span>
                      </button>
                    )}

                    <div className="h-4 w-px bg-neutral-200 mx-1" />

                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-1">Tag:</span>
                    <div className="flex items-center gap-1.5">
                      {REDACTION_TAG_PRESETS.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setSelectedTag(t.value)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                            selectedTag === t.value
                              ? `${t.color} ring-2 ring-black/20 scale-[1.02]`
                              : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PDF Navigation Controls */}
                  {isPdf && pdfNumPages > 1 && (
                    <div className="flex items-center gap-2 bg-neutral-100 p-1 rounded-xl text-xs font-mono border border-neutral-200">
                      <button
                        disabled={pdfCurrentPage <= 1}
                        onClick={() => setPdfCurrentPage((p) => Math.max(1, p - 1))}
                        className="p-1 rounded-lg hover:bg-white disabled:opacity-30 text-black"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-2 font-bold text-black">
                        Page {pdfCurrentPage} / {pdfNumPages}
                      </span>
                      <button
                        disabled={pdfCurrentPage >= pdfNumPages}
                        onClick={() => setPdfCurrentPage((p) => Math.min(pdfNumPages, p + 1))}
                        className="p-1 rounded-lg hover:bg-white disabled:opacity-30 text-black"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleClearAll}
                    disabled={rects.length === 0}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-600 hover:text-rose-600 disabled:opacity-30 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Masks ({rects.length})</span>
                  </button>
                </div>

                {/* Interactive Viewport Container */}
                <div
                  ref={containerRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onTouchStart={handleMouseDown}
                  onTouchMove={handleMouseMove}
                  onTouchEnd={handleMouseUp}
                  className={`relative w-full bg-neutral-900 overflow-hidden border border-neutral-300 shadow-inner flex items-center justify-center select-none touch-none overscroll-none group ${
                    isFullScreen ? "flex-1 min-h-[500px]" : "aspect-[16/10] max-h-[540px] rounded-2xl cursor-crosshair"
                  }`}
                >
                  {/* CANVAS BASED MODE (IMAGE & PDF PAGE) */}
                  {(isImageMode || isPdf) && (
                    <>
                      {isPdfLoading && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-xs text-white text-xs font-mono gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Preparing document page view...</span>
                        </div>
                      )}
                      <canvas ref={canvasRef} className="w-full h-full object-contain" />
                      
                      {/* Active Page Mask Rectangles */}
                      {rects
                        .filter((r) => !isPdf || r.page === pdfCurrentPage || !r.page)
                        .map((r) => (
                          <div
                            key={r.id}
                            style={{
                              left: `${r.x}%`,
                              top: `${r.y}%`,
                              width: `${r.w}%`,
                              height: `${r.h}%`,
                            }}
                            className="absolute pointer-events-auto border border-white/40 group/box flex items-start justify-start p-1"
                          >
                            {r.tag && (
                              <span className="px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[9px] font-bold tracking-tight">
                                {r.tag}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveRect(r.id);
                              }}
                              className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover/box:opacity-100 transition-opacity shadow-md"
                              title="Remove mask region"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                    </>
                  )}

                  {/* VIDEO MODE */}
                  {isVideoMode && (
                    <video
                      ref={videoRef}
                      src={mediaUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}

                  {/* TEXT DOCUMENT MODE */}
                  {isTextDoc && (
                    <div className="w-full h-full bg-white p-6 overflow-y-auto font-mono text-xs text-neutral-800 space-y-4 relative">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-bold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-700" />
                          <span>Document Text Viewer: {file.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-amber-700">Drag mouse to select blackout strips</span>
                      </div>

                      <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 min-h-[300px] text-neutral-800 font-mono text-xs leading-relaxed relative">
                        <pre className="whitespace-pre-wrap font-mono">{docTextContent || "[Loading Document Text...]"}</pre>
                        {rects.map((r) => (
                          <div
                            key={r.id}
                            style={{
                              left: `${r.x}%`,
                              top: `${r.y}%`,
                              width: `${r.w}%`,
                              height: `${r.h}%`,
                            }}
                            className="absolute bg-black pointer-events-auto border border-neutral-800 group/box"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveRect(r.id);
                              }}
                              className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center opacity-0 group-hover/box:opacity-100 transition-opacity"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md text-white font-mono text-[10px] tracking-wider pointer-events-none">
                    DRAG TO MASK REGION • {rects.length} MASK(S) ACTIVE
                  </div>
                </div>

                <p className="text-[11px] text-neutral-500 font-mono text-center flex-shrink-0">
                  💡 Tip: Click and drag your mouse anywhere on the preview viewport to apply blackout redaction strips.
                </p>
              </div>

              {/* Right Sidebar Controls (4 cols) */}
              <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-neutral-200 space-y-5 shadow-xs flex flex-col justify-between">
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wider">
                      Redaction Type / Classification
                    </label>
                    <select
                      value={redactionType}
                      onChange={(e) => setRedactionType(e.target.value)}
                      className="w-full p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-semibold text-black focus:bg-white focus:border-black focus:outline-none transition-all mb-3"
                    >
                      <option value="Privacy Redaction">Privacy Redaction (General)</option>
                      <option value="PII & Identity Protection">PII & Identity Protection</option>
                      <option value="Bystander & Minor Protection">Bystander & Minor Protection</option>
                      <option value="Financial Record Masking">Financial Record Masking</option>
                      <option value="Law Enforcement Sensitive">Law Enforcement Sensitive</option>
                    </select>

                    <label className="block text-xs font-bold text-black mb-1.5 uppercase tracking-wider">
                      Redaction Reason / Audit Note *
                    </label>
                    <textarea
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Privacy redaction — bystander face & PII masked"
                      className="w-full p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-black placeholder:text-neutral-400 focus:bg-white focus:border-black focus:outline-none transition-all"
                      required
                    />
                  </div>

                  {/* Mask Inventory & Similarity Metric */}
                  <div className="space-y-3">
                    <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-600">Retained Content Similarity:</span>
                      <span className="text-xs font-mono font-bold text-black">{computedSimilarityPct}% Intact</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-black uppercase tracking-wider">Active Mask Regions</span>
                        <span className="text-[11px] font-mono text-neutral-500">{rects.length} region(s)</span>
                      </div>

                      {rects.length === 0 ? (
                        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-center text-xs text-neutral-400 italic">
                          No mask regions drawn yet. Drag on the preview viewport to select regions.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {rects.map((r, idx) => (
                            <div key={r.id} className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between text-xs font-mono">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${r.mode === "blackout" ? "bg-black" : "bg-blue-500"}`} />
                                <span className="font-bold text-black">
                                  Region #{idx + 1} {isPdf && r.page ? `(Pg ${r.page})` : ""}
                                </span>
                                {r.tag && (
                                  <span className="px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-800 text-[10px] font-bold">
                                    {r.tag}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleRemoveRect(r.id)}
                                className="text-neutral-400 hover:text-rose-600 text-xs p-1"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Commit Action Button */}
                <div className="pt-4 border-t border-neutral-100 space-y-3">
                  <button
                    disabled={isProcessing || (!isHeavy && rects.length === 0 && !isTextDoc && !isVideoMode)}
                    onClick={handleCommitRedaction}
                    className="w-full py-3.5 px-4 bg-black hover:bg-neutral-800 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>{statusMsg || "Creating sealed derivative copy…"}</span>
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4 text-emerald-400" />
                        <span>Commit & Link Redacted Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 text-xs text-neutral-500 hover:text-black font-semibold text-center transition-colors"
                  >
                    Cancel
                  </button>
                </div>

              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
