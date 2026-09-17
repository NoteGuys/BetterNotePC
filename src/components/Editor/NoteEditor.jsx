import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EditorToolbar } from './EditorToolbar';
import { PageNavigation } from './PageNavigation';
import { ThumbnailSidebar } from './ThumbnailSidebar';
import { CanvasBoard } from './CanvasBoard';
import { ExportModal } from '../Common/ExportModal';
import { 
  getPagesByNotebookId, 
  savePage, 
  deletePage, 
  saveNotebook,
  duplicateNotebook 
} from '../../services/db';
import { renderPageToCanvasDataUrl, exportSinglePageToPdf } from '../../utils/pdfExportEngine';
import { loadEditorPreferences, saveEditorPreferences } from '../../services/userPreferences';
import { AddPageModal } from './AddPageModal';
import { getPaperSize } from '../../data/templates';
import { RotateCcw } from 'lucide-react';
import { useLanguage } from '../../services/i18n';

export const NoteEditor = ({ 
  notebook, 
  onBackToLibrary, 
  onNotebookUpdated, 
  initialPageIndex = 0,
  onPageChanged 
}) => {
  const { t, language } = useLanguage();
  const [pages, setPages] = useState([]);
  const pagesRef = useRef([]);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  const [currentPageIndex, setCurrentPageIndex] = useState(initialPageIndex);
  const initialPageRef = useRef(initialPageIndex);
  const [isLoading, setIsLoading] = useState(true);

  // Sync active page index to parent tab state so returning to this tab opens exact page
  useEffect(() => {
    if (!isLoading && currentPageIndex >= 0 && onPageChanged) {
      onPageChanged(currentPageIndex);
    }
  }, [currentPageIndex, isLoading, onPageChanged]);

  // Sync when parent changes target page (e.g. from tab selection)
  const lastPropPageIndexRef = useRef(initialPageIndex);
  useEffect(() => {
    if (!isLoading && initialPageIndex !== undefined && initialPageIndex !== null && initialPageIndex !== lastPropPageIndexRef.current) {
      lastPropPageIndexRef.current = initialPageIndex;
      if (initialPageIndex !== currentPageIndex) {
        handleSelectPage(initialPageIndex);
      }
    }
  }, [initialPageIndex, isLoading, currentPageIndex]);

  // Load persistent user preferences
  const [initialPrefs] = useState(() => loadEditorPreferences());

  // Tools state (Restored from persistent preferences)
  const [activeTool, setActiveTool] = useState(initialPrefs.activeTool || 'pen');
  const [activeColor, setActiveColor] = useState(initialPrefs.activeColor || '#2563eb');
  const [toolWidths, setToolWidths] = useState(() => initialPrefs.toolWidths || {
    pen: 4,
    highlighter: 18,
    eraser: 20,
    shape: 3
  });
  const activeWidth = toolWidths[activeTool] || 4;

  const handleToolWidthChange = (tool, width) => {
    setToolWidths(prev => {
      const updated = { ...prev, [tool]: width };
      saveEditorPreferences({ toolWidths: updated, activeWidth: updated[activeTool] || width });
      return updated;
    });
  };

  const [activeShape, setActiveShape] = useState(initialPrefs.activeShape || 'rectangle');
  const [penNib, setPenNib] = useState(initialPrefs.penNib || 'fountain');
  const [isTapered, setIsTapered] = useState(initialPrefs.isTapered ?? true);
  const [usePressure, setUsePressure] = useState(initialPrefs.usePressure ?? true);
  const [pressureSensitivity, setPressureSensitivity] = useState(initialPrefs.pressureSensitivity || 'medium');
  const [eraserMode, setEraserMode] = useState(initialPrefs.eraserMode || 'precision');
  const [scribbleToErase, setScribbleToErase] = useState(() => initialPrefs.scribbleToErase ?? true);
  const [penOnly, setPenOnly] = useState(initialPrefs.penOnly ?? true);
  const [scrollDirection, setScrollDirection] = useState(initialPrefs.scrollDirection || 'horizontal');
  const [zoom, setZoom] = useState(initialPrefs.zoom || 1.0);

  // Auto-save preferences whenever any tool or display setting changes
  useEffect(() => {
    saveEditorPreferences({
      activeTool,
      activeColor,
      activeWidth,
      toolWidths,
      activeShape,
      penNib,
      isTapered,
      usePressure,
      pressureSensitivity,
      eraserMode,
      scribbleToErase,
      penOnly,
      scrollDirection,
      zoom
    });
  }, [
    activeTool,
    activeColor,
    activeWidth,
    toolWidths,
    activeShape,
    penNib,
    isTapered,
    usePressure,
    pressureSensitivity,
    eraserMode,
    scribbleToErase,
    penOnly,
    scrollDirection,
    zoom
  ]);

  // Clipboard for Snipped Images
  const [clipboardImage, setClipboardImage] = useState(null); // { dataUrl, width, height }

  const [showThumbnails, setShowThumbnails] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);

  // Undo / Redo history for current page
  const [historyStack, setHistoryStack] = useState([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const historyStackRef = useRef([]);
  const historyPointerRef = useRef(-1);
  useEffect(() => {
    historyStackRef.current = historyStack;
    historyPointerRef.current = historyPointer;
  }, [historyStack, historyPointer]);

  // Floating Gesture Toast
  const [gestureToast, setGestureToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showGestureToast = useCallback((msg) => {
    setGestureToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setGestureToast(null);
    }, 1600);
  }, []);

  // Stage Ref and Zoom tracking for Touchpad & Touchscreen gestures
  const stageRef = useRef(null);
  const stageContentRef = useRef(null);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const lastWheelPageFlipRef = useRef(0);

  // Touchpad pinch (Ctrl + Wheel) listener and Horizontal Page Flip on stage
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        isPinchingActiveRef.current = true;
        if (pinchCooldownTimerRef.current) clearTimeout(pinchCooldownTimerRef.current);
        pinchCooldownTimerRef.current = setTimeout(() => {
          isPinchingActiveRef.current = false;
        }, 300);

        const delta = -e.deltaY * 0.003;
        setZoom(prev => Math.min(3.5, Math.max(0.35, Number((prev + delta).toFixed(2)))));
        return;
      }

      // PALM / PEN PROTECTION: If pen is active or recently used within 1200ms, IGNORE wheel flips completely!
      if (window.__bn_pen_active || (window.__bn_pen_last_time && Date.now() - window.__bn_pen_last_time < 1200)) {
        return;
      }

      // In Horizontal Mode: Mouse wheel or touchpad scroll flips pages smoothly
      if (scrollDirection === 'horizontal') {
        const now = Date.now();
        if (now - lastWheelPageFlipRef.current < 280) return;

        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(delta) > 15) {
          if (delta > 0 && currentPageIndexRef.current < pagesRef.current.length - 1) {
            lastWheelPageFlipRef.current = now;
            handleSelectPage(currentPageIndexRef.current + 1);
          } else if (delta < 0 && currentPageIndexRef.current > 0) {
            lastWheelPageFlipRef.current = now;
            handleSelectPage(currentPageIndexRef.current - 1);
          }
        }
      }
    };

    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      stage.removeEventListener('wheel', handleWheel);
    };
  }, [scrollDirection, isLoading]);

  // Multi-touch pinch tracking & Two-finger double-tap undo (GPU hardware-accelerated, zero-shake)
  const firstTouchRef = useRef(null);
  const lastTwoFingerTapTimeRef = useRef(0);
  const stagePanRef = useRef({ isPanning: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const stagePinchRef = useRef({
    isPinching: false,
    startTime: 0,
    startDist: 0,
    startZoom: 1,
    startMidX: 0,
    startMidY: 0,
    focalOffsetX: 0,
    focalOffsetY: 0,
    focalContentX: 0,
    focalContentY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    currentScale: 1,
    panX: 0,
    panY: 0,
    hasMoved: false,
    isTwoFingerTap: false
  });
  const pinchRafRef = useRef(null);

  const isPinchingActiveRef = useRef(false);
  const pinchCooldownTimerRef = useRef(null);

  const handleStageTouchStart = (e) => {
    // STRICT PALM REJECTION & OBJECT DRAG LOCK:
    if (window.__bn_pen_active || 
        (window.__bn_pen_last_time && Date.now() - window.__bn_pen_last_time < 1200) ||
        window.__bn_drag_active) {
      stagePanRef.current.isPanning = false;
      return;
    }

    if (e.touches.length === 1) {
      firstTouchRef.current = {
        time: Date.now(),
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
      const stage = stageRef.current;
      if (stage) {
        stagePanRef.current = {
          isPanning: false, // will engage on intentional movement > 16px
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          scrollLeft: stage.scrollLeft,
          scrollTop: stage.scrollTop
        };
      }
    } else if (e.touches.length === 2) {
      stagePanRef.current.isPanning = false;
      isPinchingActiveRef.current = true;
      if (pinchCooldownTimerRef.current) clearTimeout(pinchCooldownTimerRef.current);

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      const stage = stageRef.current;
      const contentEl = stageContentRef.current;
      if (!stage || !contentEl) return;

      const stageRect = stage.getBoundingClientRect();
      const contentRect = contentEl.getBoundingClientRect();
      const focalOffsetX = midX - stageRect.left;
      const focalOffsetY = midY - stageRect.top;
      const focalContentX = midX - contentRect.left;
      const focalContentY = midY - contentRect.top;

      // Anchor start time to first finger landing if within 160ms (natural asynchronous finger placement)
      let startTime = Date.now();
      if (firstTouchRef.current && (startTime - firstTouchRef.current.time < 160)) {
        startTime = firstTouchRef.current.time;
      }

      stagePinchRef.current = {
        isPinching: true,
        startTime,
        startDist: Math.max(10, dist),
        startZoom: zoomRef.current,
        startMidX: midX,
        startMidY: midY,
        focalOffsetX,
        focalOffsetY,
        focalContentX,
        focalContentY,
        startScrollLeft: stage.scrollLeft,
        startScrollTop: stage.scrollTop,
        currentScale: 1,
        panX: 0,
        panY: 0,
        hasMoved: false,
        isTwoFingerTap: true
      };

      contentEl.style.willChange = 'transform';
      contentEl.style.transformOrigin = `${focalContentX}px ${focalContentY}px`;
    } else {
      if (stagePinchRef.current?.isPinching) {
        handleStageTouchEnd(e);
      }
    }
  };

  const handleStageTouchMove = (e) => {
    // Palm Rejection & Object Drag Lock:
    if (window.__bn_pen_active || 
        (window.__bn_pen_last_time && Date.now() - window.__bn_pen_last_time < 1200) ||
        window.__bn_drag_active) {
      stagePanRef.current.isPanning = false;
      return;
    }

    // 1. Single Finger Panning on stage background
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - stagePanRef.current.startX;
      const dy = e.touches[0].clientY - stagePanRef.current.startY;
      const dist = Math.hypot(dx, dy);

      if (!stagePanRef.current.isPanning) {
        if (dist > 16) {
          stagePanRef.current.isPanning = true;
        } else {
          return;
        }
      }

      const stage = stageRef.current;
      if (stage) {
        stage.scrollLeft = stagePanRef.current.scrollLeft - dx;
        stage.scrollTop = stagePanRef.current.scrollTop - dy;
      }
      return;
    }

    // 2. Two-finger Pinch & Pan
    if (e.touches.length === 2 && stagePinchRef.current?.isPinching) {
      if (e.cancelable) e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      const pinch = stagePinchRef.current;
      const distDiff = Math.abs(dist - pinch.startDist);
      const panDist = Math.hypot(midX - pinch.startMidX, midY - pinch.startMidY);

      // Movement threshold for distinguishing Tap vs Pinch/Pan (18px)
      if (distDiff > 18 || panDist > 18) {
        pinch.hasMoved = true;
        pinch.isTwoFingerTap = false;
      }

      if (pinch.hasMoved) {
        const scaleRatio = dist / pinch.startDist;
        const clampedScale = Math.min(3.5 / pinch.startZoom, Math.max(0.35 / pinch.startZoom, scaleRatio));
        const panX = midX - pinch.startMidX;
        const panY = midY - pinch.startMidY;

        pinch.currentScale = clampedScale;
        pinch.panX = panX;
        pinch.panY = panY;

        if (!pinchRafRef.current) {
          pinchRafRef.current = requestAnimationFrame(() => {
            pinchRafRef.current = null;
            const contentEl = stageContentRef.current;
            if (contentEl && stagePinchRef.current?.isPinching) {
              const { currentScale, panX: px, panY: py } = stagePinchRef.current;
              contentEl.style.transform = `translate3d(${px}px, ${py}px, 0) scale(${currentScale})`;
            }
          });
        }
      }
    }
  };

  const handleStageTouchEnd = (e) => {
    stagePanRef.current.isPanning = false;

    if (stagePinchRef.current?.isPinching) {
      const pinch = stagePinchRef.current;
      pinch.isPinching = false;

      if (pinchRafRef.current) {
        cancelAnimationFrame(pinchRafRef.current);
        pinchRafRef.current = null;
      }

      const duration = Date.now() - pinch.startTime;
      // Two-Finger Double Tap Undo Detection (แตะ 2 นิ้ว 2 ครั้งติดกันเพื่อย้อนกลับ):
      if (pinch.isTwoFingerTap && !pinch.hasMoved && duration < 450) {
        pinch.isTwoFingerTap = false;
        const now = Date.now();
        const tapInterval = now - lastTwoFingerTapTimeRef.current;
        if (tapInterval >= 40 && tapInterval <= 480) {
          // Confirmed Two-Finger Double Tap!
          lastTwoFingerTapTimeRef.current = 0;
          handleUndo();
          showGestureToast(t('twoFingerUndoToast', 'ย้อนกลับ (แตะ 2 นิ้ว 2 ครั้ง) ↶'));
        } else {
          // First tap recorded, awaiting second tap within 480ms
          lastTwoFingerTapTimeRef.current = now;
        }
      }

      const finalScale = pinch.currentScale || 1;
      const rawZoom = pinch.startZoom * finalScale;
      const finalZoom = Math.min(3.5, Math.max(0.35, Number(rawZoom.toFixed(2))));

      const stage = stageRef.current;
      const contentEl = stageContentRef.current;

      if (contentEl) {
        contentEl.style.transform = '';
        contentEl.style.transformOrigin = '';
        contentEl.style.willChange = '';
      }

      if (stage && pinch.hasMoved && pinch.startDist > 0) {
        const zoomRatio = finalZoom / pinch.startZoom;
        const contentX = pinch.startScrollLeft + pinch.focalOffsetX;
        const contentY = pinch.startScrollTop + pinch.focalOffsetY;

        stage.scrollLeft = contentX * zoomRatio - pinch.focalOffsetX - pinch.panX;
        stage.scrollTop = contentY * zoomRatio - pinch.focalOffsetY - pinch.panY;
        setZoom(finalZoom);
      }
    }

    firstTouchRef.current = null;

    if (pinchCooldownTimerRef.current) clearTimeout(pinchCooldownTimerRef.current);
    pinchCooldownTimerRef.current = setTimeout(() => {
      isPinchingActiveRef.current = false;
    }, 250);
  };

  // Load pages from database
  const loadPages = useCallback(async () => {
    setIsLoading(true);
    try {
      let loadedPages = await getPagesByNotebookId(notebook.id);
      if (loadedPages.length === 0) {
        const initialPage = {
          id: `${notebook.id}_page_0`,
          notebookId: notebook.id,
          pageIndex: 0,
          templateId: notebook.templateId || 'ruled',
          strokes: [],
          textElements: [],
          updatedAt: Date.now()
        };
        await savePage(initialPage);
        loadedPages = [initialPage];
      }
      setPages(loadedPages);
      const startIdx = Math.min(Math.max(0, initialPageRef.current), Math.max(0, loadedPages.length - 1));
      setCurrentPageIndex(startIdx);

      if (loadedPages[startIdx]) {
        setHistoryStack([{ 
          strokes: loadedPages[startIdx].strokes || [], 
          textElements: loadedPages[startIdx].textElements || [],
          imageElements: loadedPages[startIdx].imageElements || []
        }]);
        setHistoryPointer(0);
      }
    } catch (err) {
      console.error('Failed to load notebook pages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [notebook.id, notebook.templateId]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const currentPage = pages[currentPageIndex] || null;

  // Atomic Batch Update for Page Elements (Strokes, Texts, Images) - IMMEDIATELY PERSISTENT
  const handleBatchUpdatePage = async (updates, targetPageIndex = currentPageIndex) => {
    const prevPages = pagesRef.current;
    const targetPage = prevPages[targetPageIndex];
    if (!targetPage) return;

    const updatedPage = {
      ...targetPage,
      ...(updates.strokes !== undefined ? { strokes: updates.strokes } : {}),
      ...(updates.textElements !== undefined ? { textElements: updates.textElements } : {}),
      ...(updates.imageElements !== undefined ? { imageElements: updates.imageElements } : {}),
      updatedAt: Date.now()
    };

    const nextPages = prevPages.map((p, idx) => idx === targetPageIndex ? updatedPage : p);
    pagesRef.current = nextPages;
    setPages(nextPages);

    // Save directly to IndexedDB immediately without depending on React async batching!
    await savePage(updatedPage);

    if (targetPageIndex !== currentPageIndex) {
      setCurrentPageIndex(targetPageIndex);
    }
    const curStack = historyStackRef.current;
    const curPointer = historyPointerRef.current;
    const nextHistory = (curStack && curPointer >= 0) ? curStack.slice(0, curPointer + 1) : [];
    nextHistory.push({
      strokes: updatedPage.strokes || [],
      textElements: updatedPage.textElements || [],
      imageElements: updatedPage.imageElements || []
    });
    setHistoryStack(nextHistory);
    setHistoryPointer(nextHistory.length - 1);
    historyStackRef.current = nextHistory;
    historyPointerRef.current = nextHistory.length - 1;
  };

  // Handle Strokes Change for a specific page (Safe Functional State Update)
  const handleStrokesChange = async (newStrokes, targetPageIndex = currentPageIndex) => {
    await handleBatchUpdatePage({ strokes: newStrokes }, targetPageIndex);
  };

  // Handle Text Elements Change for a specific page (Safe Functional State Update)
  const handleTextElementsChange = async (newTextElements, targetPageIndex = currentPageIndex) => {
    await handleBatchUpdatePage({ textElements: newTextElements }, targetPageIndex);
  };

  // Handle Image Elements Change (Pasted Snippets / Images)
  const handleImageElementsChange = async (newImageElements, targetPageIndex = currentPageIndex) => {
    await handleBatchUpdatePage({ imageElements: newImageElements }, targetPageIndex);
  };

  // Snip Area Complete: stores crop in clipboard
  const handleSnipComplete = (dataUrl, width, height) => {
    setClipboardImage({ dataUrl, width, height });
    window.__bn_clipboard_image = { dataUrl, width, height };
  };

  // Capture Full Current Page
  const handleCaptureFullPage = async () => {
    if (!currentPage) return;
    try {
      const dataUrl = await renderPageToCanvasDataUrl(currentPage, notebook.templateId);
      setClipboardImage({ dataUrl, width: 600, height: 800 });
      window.__bn_clipboard_image = { dataUrl, width: 600, height: 800 };
      alert(t('fullPageSnipSuccess', 'แคปภาพทั้งหน้าเรียบร้อยแล้ว! กดปุ่ม "วางภาพ" หรือ Ctrl+V เพื่อวางในหน้านี้หรือหน้าอื่นได้เลย'));
    } catch (err) {
      console.error(err);
      alert(t('fullPageSnipError', 'เกิดข้อผิดพลาดในการแคปหน้า: {error}', { error: err.message }));
    }
  };

  // Paste Snipped / External Clipboard Image on Current Page
  const handlePasteClipboardImage = async (customPos = null) => {
    if (!currentPage) return;

    let imgDataUrl = null;
    let imgWidth = 400;
    let imgHeight = 300;

    // 1. Check Native Electron Clipboard (Windows Snipping Tool, Win+Shift+S, Explorer copy file)
    if (window.electronAPI?.readClipboardImage) {
      try {
        const res = await window.electronAPI.readClipboardImage();
        if (res && res.success && res.dataUrl) {
          imgDataUrl = res.dataUrl;
          imgWidth = res.width || 400;
          imgHeight = res.height || 300;
        }
      } catch (err) {
        console.warn('Native clipboard read error:', err);
      }
    }

    // 2. Check In-App Snipped Image
    if (!imgDataUrl && clipboardImage?.dataUrl) {
      imgDataUrl = clipboardImage.dataUrl;
      imgWidth = clipboardImage.width || 400;
      imgHeight = clipboardImage.height || 300;
    }

    // 3. Fallback to Web Clipboard API
    if (!imgDataUrl && navigator.clipboard?.read) {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find(t => t.startsWith('image/'));
          if (type) {
            const blob = await item.getType(type);
            imgDataUrl = await new Promise((res) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result);
              reader.readAsDataURL(blob);
            });
            break;
          }
        }
      } catch (err) {
        console.warn('Web clipboard error:', err);
      }
    }

    if (!imgDataUrl) {
      alert(t('noImageInClipboard', 'ไม่พบรูปภาพในคลิปบอร์ด (กรุณาคัดลอกภาพก่อน หรือใช้ Win+Shift+S แคปภาพแล้วกดวาง)'));
      return;
    }

    const img = new Image();
    img.onload = async () => {
      let w = img.naturalWidth || imgWidth || 400;
      let h = img.naturalHeight || imgHeight || 300;

      const maxDim = 650;
      if (w > maxDim || h > maxDim) {
        const r = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }

      const pWidth = currentPage.pageWidth || 1200;
      const pHeight = currentPage.pageHeight || 1600;

      let posX = customPos ? customPos.x - w / 2 : (pWidth - w) / 2;
      let posY = customPos ? customPos.y - h / 2 : (pHeight - h) / 2;

      posX = Math.max(20, Math.min(pWidth - w - 20, Math.round(posX)));
      posY = Math.max(20, Math.min(pHeight - h - 20, Math.round(posY)));

      const newImg = {
        id: `img-${Date.now()}`,
        src: imgDataUrl,
        x: posX,
        y: posY,
        width: w,
        height: h
      };

      const existingImgs = currentPage.imageElements || [];
      await handleImageElementsChange([...existingImgs, newImg]);
    };
    img.src = imgDataUrl;
  };

  // Duplicate Current Notebook
  const handleDuplicateCurrentNotebook = async () => {
    try {
      const cloned = await duplicateNotebook(notebook.id);
      alert(language === 'en' ? `Duplicated successfully! Created new notebook: "${cloned.name}"` : `ทำสำเนาสำเร็จ! สร้างสมุดเล่มใหม่: "${cloned.name}"`);
      if (onNotebookUpdated) onNotebookUpdated(cloned);
    } catch (err) {
      console.error(err);
      alert(language === 'en' ? `Could not duplicate: ${err.message}` : `ไม่สามารถทำสำเนาได้: ${err.message}`);
    }
  };

  // Export Current Page Only as PDF
  const handleExportCurrentPagePdf = async () => {
    if (!currentPage) return;
    try {
      await exportSinglePageToPdf(notebook, currentPage, currentPageIndex);
      alert(language === 'en' ? `Exported page ${currentPageIndex + 1} to PDF successfully!` : `ส่งออกหน้า ${currentPageIndex + 1} เป็น PDF เรียบร้อยแล้ว!`);
    } catch (err) {
      console.error(err);
      alert(language === 'en' ? `Error exporting PDF: ${err.message}` : `เกิดข้อผิดพลาดในการส่งออก PDF: ${err.message}`);
    }
  };

  // Undo / Redo
  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < historyStack.length - 1;

  const handleUndo = useCallback(async () => {
    const curPointer = historyPointerRef.current;
    const curStack = historyStackRef.current;
    if (curPointer <= 0 || !curStack || curStack.length <= 1) return;

    const newPointer = curPointer - 1;
    const state = curStack[newPointer];
    if (!state) return;

    setHistoryPointer(newPointer);
    historyPointerRef.current = newPointer;

    const prevPages = pagesRef.current;
    const targetPage = prevPages[currentPageIndex];
    if (!targetPage) return;

    const updatedPage = {
      ...targetPage,
      strokes: state.strokes || [],
      textElements: state.textElements || [],
      imageElements: state.imageElements || targetPage.imageElements || [],
      updatedAt: Date.now()
    };
    const nextPages = prevPages.map((p, idx) => idx === currentPageIndex ? updatedPage : p);
    pagesRef.current = nextPages;
    setPages(nextPages);

    await savePage(updatedPage);
  }, [currentPageIndex]);

  const handleRedo = useCallback(async () => {
    const curPointer = historyPointerRef.current;
    const curStack = historyStackRef.current;
    if (curPointer < 0 || !curStack || curPointer >= curStack.length - 1) return;

    const newPointer = curPointer + 1;
    const state = curStack[newPointer];
    if (!state) return;

    setHistoryPointer(newPointer);
    historyPointerRef.current = newPointer;

    const prevPages = pagesRef.current;
    const targetPage = prevPages[currentPageIndex];
    if (!targetPage) return;

    const updatedPage = {
      ...targetPage,
      strokes: state.strokes || [],
      textElements: state.textElements || [],
      imageElements: state.imageElements || targetPage.imageElements || [],
      updatedAt: Date.now()
    };
    const nextPages = prevPages.map((p, idx) => idx === currentPageIndex ? updatedPage : p);
    pagesRef.current = nextPages;
    setPages(nextPages);

    await savePage(updatedPage);
  }, [currentPageIndex]);

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+V)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteClipboardImage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Global native window paste handler
    const handleWindowPaste = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      e.preventDefault();
      handlePasteClipboardImage();
    };
    window.addEventListener('paste', handleWindowPaste);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [canUndo, canRedo, historyPointer, historyStack, currentPageIndex, pages, clipboardImage]);

  // Programmatic scroll state lock to prevent IntersectionObserver fighting
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef(null);
  const observerRef = useRef(null);

  // Scoped scroll to page inside stage - strictly prevents window/ancestor layout scrolling
  const scrollToPageInStage = useCallback((pageIndex, behavior = 'smooth') => {
    if (scrollDirection !== 'vertical') return;
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const targetEl = document.getElementById(`vertical-page-${pageIndex}`);
    if (!targetEl) return;

    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, behavior === 'smooth' ? 900 : 120);

    const stageRect = stageEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const delta = targetRect.top - stageRect.top;
    const targetScrollTop = stageEl.scrollTop + delta - 20;

    try {
      stageEl.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior
      });
    } catch {
      stageEl.scrollTop = Math.max(0, targetScrollTop);
    }
  }, [scrollDirection]);

  // Switch Page & Smooth Scroll to target page in vertical continuous mode
  const handleSelectPage = (index) => {
    if (index >= 0 && index < pages.length) {
      setCurrentPageIndex(index);
      const targetPage = pages[index];
      setHistoryStack([{ 
        strokes: targetPage?.strokes || [], 
        textElements: targetPage?.textElements || [],
        imageElements: targetPage?.imageElements || [] 
      }]);
      setHistoryPointer(0);

      // In continuous vertical scroll mode, smoothly warp to the chosen page!
      if (scrollDirection === 'vertical') {
        scrollToPageInStage(index, 'smooth');
      } else {
        if (stageRef.current) {
          stageRef.current.scrollTop = 0;
          stageRef.current.scrollLeft = 0;
        }
      }
    }
  };

  // Initial auto-scroll to requested page (e.g. when opening from Favorites view or tabs)
  const hasInitialNavigatedRef = useRef(false);
  useEffect(() => {
    if (!isLoading && pages.length > 0 && initialPageRef.current > 0 && !hasInitialNavigatedRef.current) {
      hasInitialNavigatedRef.current = true;
      const targetIdx = Math.min(initialPageRef.current, pages.length - 1);
      setCurrentPageIndex(targetIdx);
      setTimeout(() => {
        scrollToPageInStage(targetIdx, 'auto');
      }, 100);
    }
  }, [isLoading, pages.length, scrollToPageInStage]);

  // Track latest currentPageIndex in ref for stable IntersectionObserver
  const currentPageIndexRef = useRef(currentPageIndex);
  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);

  // Sync active page indicator with scroll position in continuous vertical mode
  useEffect(() => {
    if (isLoading || scrollDirection !== 'vertical' || pages.length === 0) return;

    let isUnmounted = false;
    const timer = setTimeout(() => {
      if (isUnmounted) return;
      const stageEl = stageRef.current;

      const observer = new IntersectionObserver((entries) => {
        // STRICT: Never switch pages while user is actively pinching to zoom, during initial page navigation, or during programmatic scroll!
        if (isPinchingActiveRef.current || stagePinchRef.current?.isPinching) return;
        if (!hasInitialNavigatedRef.current && initialPageRef.current > 0) return;
        if (isProgrammaticScrollRef.current) return;

        let maxRatio = 0;
        let mostVisibleIdx = -1;

        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const pageIdxAttr = entry.target.getAttribute('data-page-index');
            if (pageIdxAttr !== null) {
              mostVisibleIdx = parseInt(pageIdxAttr, 10);
            }
          }
        });

        if (mostVisibleIdx !== -1 && mostVisibleIdx !== currentPageIndexRef.current) {
          setCurrentPageIndex(mostVisibleIdx);
        }
      }, {
        root: stageEl,
        threshold: [0.2, 0.5, 0.8]
      });

      pages.forEach((_, idx) => {
        const el = document.getElementById(`vertical-page-${idx}`);
        if (el) observer.observe(el);
      });

      observerRef.current = observer;
    }, 60);

    return () => {
      isUnmounted = true;
      clearTimeout(timer);
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isLoading, scrollDirection, pages.length]);

  // Add Page with custom size (A2, A3, A4), orientation, and template
  const handleAddPage = async (pageConfig = {}) => {
    const sizeId = pageConfig.sizeId || 'A4';
    const orientation = pageConfig.orientation || 'portrait';
    const sizeDim = getPaperSize(sizeId, orientation);
    const templateId = pageConfig.templateId || notebook.templateId || 'ruled';
    const insertPosition = pageConfig.insertPosition || 'after';

    let targetIndex = pages.length;
    if (insertPosition === 'after' && currentPageIndex >= 0 && currentPageIndex < pages.length) {
      targetIndex = currentPageIndex + 1;
    }

    const newPage = {
      id: `${notebook.id}_page_${Date.now()}`,
      notebookId: notebook.id,
      pageIndex: targetIndex,
      templateId,
      sizeId,
      orientation,
      pageWidth: pageConfig.pageWidth || sizeDim.width,
      pageHeight: pageConfig.pageHeight || sizeDim.height,
      strokes: [],
      textElements: [],
      imageElements: [],
      updatedAt: Date.now()
    };

    const nextPages = [...pages];
    nextPages.splice(targetIndex, 0, newPage);
    const reindexedPages = nextPages.map((p, idx) => ({ ...p, pageIndex: idx }));

    // Shift existing pages from end backwards down to targetIndex + 1 to prevent unique index collisions in IndexedDB
    for (let i = reindexedPages.length - 1; i > targetIndex; i--) {
      await savePage(reindexedPages[i]);
    }
    // Now targetIndex slot is free in IndexedDB! Save the new page:
    await savePage(reindexedPages[targetIndex]);

    setPages(reindexedPages);
    setCurrentPageIndex(targetIndex);

    const updatedNotebook = {
      ...notebook,
      pageCount: reindexedPages.length,
      updatedAt: Date.now()
    };
    await saveNotebook(updatedNotebook);
    if (onNotebookUpdated) onNotebookUpdated(updatedNotebook);

    setHistoryStack([{ strokes: [], textElements: [], imageElements: [] }]);
    setHistoryPointer(0);

    if (scrollDirection === 'vertical') {
      setTimeout(() => {
        scrollToPageInStage(targetIndex, 'smooth');
      }, 60);
    }
  };

  // Duplicate a specific page (from thumbnail 3-dots or wherever)
  const handleDuplicatePage = async (pageIndex = currentPageIndex) => {
    const currentPagesList = pagesRef.current;
    const sourcePage = currentPagesList[pageIndex];
    if (!sourcePage) return;

    const newPageId = `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const clonedPage = {
      ...sourcePage,
      id: newPageId,
      pageIndex: pageIndex + 1,
      strokes: JSON.parse(JSON.stringify(sourcePage.strokes || [])),
      textElements: JSON.parse(JSON.stringify(sourcePage.textElements || [])),
      imageElements: JSON.parse(JSON.stringify(sourcePage.imageElements || [])),
      updatedAt: Date.now()
    };

    const nextPages = [...currentPagesList];
    nextPages.splice(pageIndex + 1, 0, clonedPage);
    const reindexedPages = nextPages.map((p, idx) => ({ ...p, pageIndex: idx }));

    // Shift existing pages from end backwards down to pageIndex + 2 to prevent unique index collisions in IndexedDB
    for (let i = reindexedPages.length - 1; i > pageIndex + 1; i--) {
      await savePage(reindexedPages[i]);
    }
    // Now position pageIndex + 1 is vacated in DB! Save the cloned page:
    await savePage(reindexedPages[pageIndex + 1]);

    pagesRef.current = reindexedPages;
    setPages(reindexedPages);
    setCurrentPageIndex(pageIndex + 1);

    const updatedNotebook = {
      ...notebook,
      pageCount: reindexedPages.length,
      updatedAt: Date.now()
    };
    await saveNotebook(updatedNotebook);
    if (onNotebookUpdated) onNotebookUpdated(updatedNotebook);

    if (scrollDirection === 'vertical') {
      setTimeout(() => {
        scrollToPageInStage(pageIndex + 1, 'smooth');
      }, 60);
    }
  };

  // Insert Blank Page after a specific index
  const handleInsertPageAfter = async (pageIndex = currentPageIndex) => {
    const currentPagesList = pagesRef.current;
    const prevPage = currentPagesList[pageIndex];
    const newPage = {
      id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      notebookId: notebook.id,
      pageIndex: pageIndex + 1,
      templateId: prevPage ? prevPage.templateId : (notebook.templateId || 'blank'),
      paperColor: prevPage ? prevPage.paperColor : (notebook.paperColor || '#ffffff'),
      paperPattern: prevPage ? prevPage.paperPattern : (notebook.paperPattern || 'none'),
      pageSize: prevPage ? prevPage.pageSize : (notebook.pageSize || 'A4'),
      pageOrientation: prevPage ? prevPage.pageOrientation : (notebook.pageOrientation || 'portrait'),
      pageWidth: prevPage ? prevPage.pageWidth : 1200,
      pageHeight: prevPage ? prevPage.pageHeight : 1600,
      strokes: [],
      textElements: [],
      imageElements: [],
      updatedAt: Date.now()
    };

    const nextPages = [...currentPagesList];
    nextPages.splice(pageIndex + 1, 0, newPage);
    const reindexedPages = nextPages.map((p, idx) => ({ ...p, pageIndex: idx }));

    // Shift existing pages from end backwards down to pageIndex + 2 to prevent unique index collisions in IndexedDB
    for (let i = reindexedPages.length - 1; i > pageIndex + 1; i--) {
      await savePage(reindexedPages[i]);
    }
    // Now position pageIndex + 1 is vacated in DB! Save the new page:
    await savePage(reindexedPages[pageIndex + 1]);

    pagesRef.current = reindexedPages;
    setPages(reindexedPages);
    setCurrentPageIndex(pageIndex + 1);

    const updatedNotebook = {
      ...notebook,
      pageCount: reindexedPages.length,
      updatedAt: Date.now()
    };
    await saveNotebook(updatedNotebook);
    if (onNotebookUpdated) onNotebookUpdated(updatedNotebook);

    if (scrollDirection === 'vertical') {
      setTimeout(() => {
        scrollToPageInStage(pageIndex + 1, 'smooth');
      }, 60);
    }
  };

  // Delete Page
  const handleDeletePage = async (targetIndex = currentPageIndex) => {
    const currentPagesList = pagesRef.current;
    if (currentPagesList.length <= 1) {
      alert(language === 'en' ? 'Cannot delete the only remaining page of the notebook' : 'ไม่สามารถลบหน้าสุดท้ายของสมุดได้');
      return;
    }

    if (!confirm(language === 'en' ? `Are you sure you want to delete page ${targetIndex + 1}?` : `คุณต้องการลบหน้า ${targetIndex + 1} ใช่หรือไม่?`)) {
      return;
    }

    const pageToDelete = currentPagesList[targetIndex];
    if (!pageToDelete) return;
    await deletePage(pageToDelete.id);

    const remainingPages = currentPagesList.filter((_, idx) => idx !== targetIndex)
      .map((p, idx) => ({ ...p, pageIndex: idx }));

    for (const p of remainingPages) {
      await savePage(p);
    }

    pagesRef.current = remainingPages;
    setPages(remainingPages);
    const newIndex = Math.min(targetIndex, remainingPages.length - 1);
    setCurrentPageIndex(newIndex);

    const updatedNotebook = {
      ...notebook,
      pageCount: remainingPages.length,
      updatedAt: Date.now()
    };
    await saveNotebook(updatedNotebook);
    if (onNotebookUpdated) onNotebookUpdated(updatedNotebook);

    if (scrollDirection === 'vertical') {
      setTimeout(() => {
        scrollToPageInStage(newIndex, 'smooth');
      }, 60);
    }
  };

  // Change Template for Current Page
  const handleChangeTemplate = async (templateId) => {
    if (!currentPage) return;
    const updatedPage = {
      ...currentPage,
      templateId,
      updatedAt: Date.now()
    };
    const newPages = pages.map((p, idx) => idx === currentPageIndex ? updatedPage : p);
    setPages(newPages);
    await savePage(updatedPage);
  };

  // Toggle Favorite for a specific page (or current page)
  const handleToggleFavoritePage = async (pageIdxToToggle = currentPageIndex) => {
    const targetPage = pages[pageIdxToToggle];
    if (!targetPage) return;

    const newFavStatus = !targetPage.isFavorite;
    const updatedPage = {
      ...targetPage,
      isFavorite: newFavStatus,
      updatedAt: Date.now()
    };

    setPages(prevPages => prevPages.map((p, idx) => idx === pageIdxToToggle ? updatedPage : p));
    await savePage(updatedPage);
  };

  // Rename Notebook Title
  const handleRenameTitle = async (newTitle) => {
    const updated = { ...notebook, name: newTitle, updatedAt: Date.now() };
    await saveNotebook(updated);
    if (onNotebookUpdated) onNotebookUpdated(updated);
  };

  if (isLoading) {
    return (
      <div className="bn-loading-screen">
        <div className="bn-spinner"></div>
        <p className="text-zinc-400 mt-3 text-sm">{language === 'en' ? 'Opening notebook...' : 'กำลังเปิดสมุดบันทึก...'}</p>
      </div>
    );
  }

  return (
    <div className="bn-editor-container">
      {/* Top Studio Toolbar with Pen Nibs, Snip, Paste, and Duplicate */}
      <EditorToolbar 
        notebookTitle={notebook.name}
        onRenameTitle={handleRenameTitle}
        onBackToLibrary={onBackToLibrary}
        onDuplicateNotebook={handleDuplicateCurrentNotebook}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        activeColor={activeColor}
        setActiveColor={setActiveColor}
        activeWidth={activeWidth}
        setActiveWidth={(w) => handleToolWidthChange(activeTool, w)}
        toolWidths={toolWidths}
        onToolWidthChange={handleToolWidthChange}
        activeShape={activeShape}
        setActiveShape={setActiveShape}
        penNib={penNib}
        setPenNib={setPenNib}
        isTapered={isTapered}
        setIsTapered={setIsTapered}
        usePressure={usePressure}
        setUsePressure={setUsePressure}
        pressureSensitivity={pressureSensitivity}
        setPressureSensitivity={setPressureSensitivity}
        eraserMode={eraserMode}
        setEraserMode={setEraserMode}
        scribbleToErase={scribbleToErase}
        setScribbleToErase={setScribbleToErase}
        penOnly={penOnly}
        setPenOnly={setPenOnly}
        scrollDirection={scrollDirection}
        setScrollDirection={setScrollDirection}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        zoom={zoom}
        onZoomIn={() => setZoom(prev => Math.min(3.5, Number((prev + 0.15).toFixed(2))))}
        onZoomOut={() => setZoom(prev => Math.max(0.35, Number((prev - 0.15).toFixed(2))))}
        onResetZoom={() => setZoom(1.0)}
        onOpenExport={() => setIsExportModalOpen(true)}
        onExportCurrentPagePdf={handleExportCurrentPagePdf}
        showThumbnails={showThumbnails}
        setShowThumbnails={setShowThumbnails}
        onOpenAddPage={() => setIsAddPageModalOpen(true)}
        isCurrentPageFavorite={!!currentPage?.isFavorite}
        onToggleFavoriteCurrentPage={() => handleToggleFavoritePage(currentPageIndex)}
        hasClipboardImage={!!clipboardImage}
        onPasteClipboardImage={handlePasteClipboardImage}
        onCaptureFullPage={handleCaptureFullPage}
      />

      {/* Main Workspace Area */}
      <div className="bn-editor-workspace">
        {/* Thumbnail Sidebar */}
        {showThumbnails && (
          <ThumbnailSidebar 
            pages={pages}
            currentPageIndex={currentPageIndex}
            onSelectPage={handleSelectPage}
            onToggleFavoritePage={handleToggleFavoritePage}
            onDuplicatePage={handleDuplicatePage}
            onInsertAfter={handleInsertPageAfter}
            onInsertPageAfter={handleInsertPageAfter}
            onDeletePage={handleDeletePage}
            onAddPage={() => setIsAddPageModalOpen(true)}
            onClose={() => setShowThumbnails(false)}
          />
        )}

        {/* Canvas & Inking Board */}
        <main 
          ref={stageRef}
          className={`bn-editor-canvas-stage ${scrollDirection === 'vertical' ? 'bn-stage-vertical' : ''}`}
          onTouchStart={handleStageTouchStart}
          onTouchMove={handleStageTouchMove}
          onTouchEnd={handleStageTouchEnd}
          onTouchCancel={handleStageTouchEnd}
        >
          {/* Floating Gesture Toast for Two-Finger Tap Undo */}
          {gestureToast && (
            <div className="bn-gesture-toast">
              <RotateCcw size={16} className="text-amber-400 animate-spin" />
              <span>{gestureToast}</span>
            </div>
          )}

          {scrollDirection === 'vertical' ? (
            /* Vertical Continuous Scroll Mode with Viewport Virtualization */
            <div ref={stageContentRef} className="bn-vertical-pages-stack">
              {pages.map((p, idx) => {
                const isMounted = Math.abs(idx - currentPageIndex) <= 2;
                const pWidth = p.pageWidth || 1200;
                const pHeight = p.pageHeight || 1600;

                return (
                  <div 
                    key={p.id} 
                    id={`vertical-page-${idx}`} 
                    data-page-index={idx}
                    className="bn-vertical-page-wrapper"
                  >
                    <div className="bn-vertical-page-badge">{t('page', 'หน้า')} {idx + 1}</div>
                    {isMounted ? (
                      <CanvasBoard 
                        key={p.id}
                        page={p}
                        templateId={notebook.templateId}
                        activeTool={activeTool}
                        activeColor={activeColor}
                        activeWidth={activeWidth}
                        activeShape={activeShape}
                        penNib={penNib}
                        isTapered={isTapered}
                        usePressure={usePressure}
                        pressureSensitivity={pressureSensitivity}
                        eraserMode={eraserMode}
                        scribbleToErase={scribbleToErase}
                        penOnly={penOnly}
                        zoom={zoom}
                        onZoomChange={setZoom}
                        onToolChange={setActiveTool}
                        onBatchUpdatePage={(updates) => handleBatchUpdatePage(updates, idx)}
                        onStrokesChange={(newStrokes) => handleStrokesChange(newStrokes, idx)}
                        onTextElementsChange={(newTexts) => handleTextElementsChange(newTexts, idx)}
                        onImageElementsChange={(newImgs) => handleImageElementsChange(newImgs, idx)}
                        onSnipComplete={handleSnipComplete}
                        onUndo={handleUndo}
                      />
                    ) : (
                      /* Lightweight Virtual Placeholder: preserves exact scroll position with zero GPU memory */
                      <div 
                        className="bn-vertical-page-placeholder"
                        style={{
                          width: `${pWidth * zoom}px`,
                          height: `${pHeight * zoom}px`,
                          background: p.paperColor || '#ffffff',
                          borderRadius: '6px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {(p.thumbnailUrl || p.pdfPageImage) ? (
                          <img 
                            src={p.thumbnailUrl || p.pdfPageImage} 
                            alt={`${t('page', 'หน้า')} ${idx + 1}`} 
                            style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.95 }}
                            loading="lazy"
                          />
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '15px', fontWeight: 600 }}>
                            {t('page', 'หน้า')} {idx + 1}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Single Page Flip Mode (แนวนอน) */
            currentPage && (
              <div ref={stageContentRef} className="bn-horizontal-page-container flex items-center justify-center min-w-full min-h-full">
                <CanvasBoard 
                  key={currentPage.id || `horizontal-page-${currentPageIndex}`}
                  page={currentPage}
                  templateId={notebook.templateId}
                  activeTool={activeTool}
                  activeColor={activeColor}
                  activeWidth={activeWidth}
                  activeShape={activeShape}
                  penNib={penNib}
                  isTapered={isTapered}
                  usePressure={usePressure}
                  pressureSensitivity={pressureSensitivity}
                  eraserMode={eraserMode}
                  scribbleToErase={scribbleToErase}
                  penOnly={penOnly}
                  zoom={zoom}
                  onZoomChange={setZoom}
                  onToolChange={setActiveTool}
                  onBatchUpdatePage={(updates) => handleBatchUpdatePage(updates, currentPageIndex)}
                  onStrokesChange={(newStrokes) => handleStrokesChange(newStrokes, currentPageIndex)}
                  onTextElementsChange={(newTexts) => handleTextElementsChange(newTexts, currentPageIndex)}
                  onImageElementsChange={(newImgs) => handleImageElementsChange(newImgs, currentPageIndex)}
                  onSnipComplete={handleSnipComplete}
                  onUndo={handleUndo}
                />
              </div>
            )
          )}

          {/* Bottom Floating Compact Page Navigation */}
          <PageNavigation 
            currentPageIndex={currentPageIndex}
            totalPageCount={pages.length}
            onPrevPage={() => handleSelectPage(currentPageIndex - 1)}
            onNextPage={() => handleSelectPage(currentPageIndex + 1)}
          />
        </main>
      </div>

      {/* Export Modal */}
      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        notebook={notebook}
        pages={pages}
        currentPageIndex={currentPageIndex}
      />

      {/* Add Page Modal (A2, A3, A4 & Dotted, Narrow Ruled, Wide Ruled) */}
      <AddPageModal 
        isOpen={isAddPageModalOpen}
        onClose={() => setIsAddPageModalOpen(false)}
        onAddPage={handleAddPage}
        currentPageIndex={currentPageIndex}
        totalPages={pages.length}
      />
    </div>
  );
};
