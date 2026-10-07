import React, { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react';
import { EditorToolbar } from './EditorToolbar';
import { PageNavigation } from './PageNavigation';
import { ThumbnailSidebar } from './ThumbnailSidebar';
import { CanvasBoard } from './CanvasBoard';
import { WhiteboardBoard } from './WhiteboardBoard';
import { isWhiteboardPage } from '../../utils/whiteboard';
import { ExportModal } from '../Common/ExportModal';
import { 
  getPagesByNotebookId, 
  savePage, 
  mutateNotebookPages,
  saveNotebook,
  duplicateNotebook 
} from '../../services/db';
import { pageSaveQueue } from '../../services/localSaveService';
import { pageContentSnapshot, findHistoryPageIndex } from '../../utils/pageHistory';
import { notebookHistoryStore } from '../../services/notebookHistoryService';
import { renderPageToCanvasDataUrl, exportSinglePageToPdf } from '../../utils/pdfExportEngine';
import { loadEditorPreferences, saveEditorPreferences, loadQuickColorSlots } from '../../services/userPreferences';
import { AddPageModal } from './AddPageModal';
import { getPaperSize } from '../../data/templates';
import { RotateCcw } from 'lucide-react';
import { useLanguage } from '../../services/i18n';
import { localizeNotebookCopyName } from '../../utils/notebookNames';
import { queueNotebookCover } from '../../services/notebookCoverService';
import { THUMBNAIL_COVER_ID } from '../../data/covers';

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
  const currentPageIndexRef = useRef(initialPageIndex);
  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex;
  }, [currentPageIndex]);
  const initialPageRef = useRef(initialPageIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

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

  const [colorSlots, setColorSlots] = useState(loadQuickColorSlots);
  const handleCustomColorChange = (newColor) => {
    const updated = [...colorSlots];
    const matchIdx = updated.findIndex(color => color.toLowerCase() === activeColor.toLowerCase());
    updated[matchIdx === -1 ? updated.length - 1 : matchIdx] = newColor;
    setActiveColor(newColor);
    setColorSlots(updated);
    try {
      localStorage.setItem('betternote_quick_color_slots', JSON.stringify(updated));
    } catch (_) {}
  };

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
  const [highlighterTip, setHighlighterTip] = useState(initialPrefs.highlighterTip === 'round' ? 'round' : 'square');
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
      highlighterTip,
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
    highlighterTip,
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
  const [pastedImageSelection, setPastedImageSelection] = useState(null); // { pageId, imageId }
  const imageFileInputRef = useRef(null);
  const imageImportPendingRef = useRef(false);

  const [showThumbnails, setShowThumbnails] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);

  // History is shared by notebook for this app session, independent of this view.
  const historySession = useMemo(() => notebookHistoryStore.forNotebook(notebook.id), [notebook.id]);
  const { stack: historyStack, pointer: historyPointer, busy: historyBusy } = useSyncExternalStore(
    historySession.subscribe, historySession.getSnapshot, historySession.getSnapshot
  );
  const loadGenerationRef = useRef(0);

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
  const whiteboardViewportRef = useRef(null);
  const handleWhiteboardViewportChange = useCallback(viewport => { whiteboardViewportRef.current = viewport; }, []);
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
      if (isWhiteboardPage(pagesRef.current[currentPageIndexRef.current], notebook.templateId)) return;
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

  // Wait for this notebook's pending page operation before opening its view.
  const loadPages = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setIsLoading(true);
    setLoadError(false);
    try {
      await historySession.wait();
      let loadedPages = await getPagesByNotebookId(notebook.id);
      if (generation !== loadGenerationRef.current) return;
      if (loadedPages.length === 0) {
        const initialPage = {
          id: notebook.id + '_page_0', notebookId: notebook.id, pageIndex: 0,
          templateId: notebook.templateId || 'ruled', strokes: [], textElements: [], imageElements: [],
          updatedAt: Date.now()
        };
        await savePage(initialPage);
        loadedPages = [initialPage];
      }
      if (generation !== loadGenerationRef.current) return;
      loadedPages = pageSaveQueue.overlay(loadedPages, notebook.id);
      pagesRef.current = loadedPages;
      setPages(loadedPages);
      const startIdx = Math.min(Math.max(0, initialPageRef.current), Math.max(0, loadedPages.length - 1));
      currentPageIndexRef.current = startIdx;
      setCurrentPageIndex(startIdx);
      historySession.reconcile(loadedPages);
    } catch (err) {
      if (generation !== loadGenerationRef.current) return;
      setLoadError(true);
      console.error('Failed to load notebook pages:', err);
    } finally {
      if (generation === loadGenerationRef.current) setIsLoading(false);
    }
  }, [notebook.id, notebook.templateId, historySession]);

  useEffect(() => {
    loadPages();
    return () => { loadGenerationRef.current++; };
  }, [loadPages]);

  const firstCoverPage = pages[0];
  useEffect(() => {
    if (notebook.coverId !== THUMBNAIL_COVER_ID || !firstCoverPage || isLoading || loadError) return;
    const cached = notebook.firstPageThumbnail;
    if (cached?.dataUrl && cached.pageId === firstCoverPage.id && cached.pageUpdatedAt === firstCoverPage.updatedAt) return;
    // Mark the notebook only; App starts the preview when Documents is visible.
    queueNotebookCover(notebook.id);
  }, [notebook.id, notebook.coverId, notebook.firstPageThumbnail, firstCoverPage, isLoading, loadError]);

  const currentPage = pages[currentPageIndex] || null;
  const persistPage = useCallback(page => pageSaveQueue.enqueue(page).then(() => true, () => false), []);

  // Atomic Batch Update for Page Elements (Strokes, Texts, Images) - IMMEDIATELY PERSISTENT
  const applyBatchUpdatePage = (updates, target = currentPageIndexRef.current, options = {}) => {
    const prevPages = pagesRef.current;
    const targetIndex = typeof target === 'string' ? prevPages.findIndex(page => page.id === target) : target;
    const targetPage = prevPages[targetIndex];
    if (!targetPage) return Promise.resolve(false);
    const updatedPage = {
      ...targetPage,
      ...(updates.strokes !== undefined ? { strokes: updates.strokes } : {}),
      ...(updates.textElements !== undefined ? { textElements: updates.textElements } : {}),
      ...(updates.imageElements !== undefined ? { imageElements: updates.imageElements } : {}),
      updatedAt: Date.now()
    };
    const nextPages = prevPages.map(page => page.id === targetPage.id ? updatedPage : page);
    pagesRef.current = nextPages;
    setPages(nextPages);

    // Record immediately, so slow saves cannot reorder Undo.
    historySession.append({
      kind: 'content', pageId: targetPage.id,
      before: pageContentSnapshot(targetPage),
      after: pageContentSnapshot(updatedPage)
    });
    if (!options.preservePageSelection && targetIndex !== currentPageIndexRef.current) {
      currentPageIndexRef.current = targetIndex;
      setCurrentPageIndex(targetIndex);
    }
    return persistPage(updatedPage);
  };

  const handleBatchUpdatePage = (updates, target = currentPageIndexRef.current, options = {}) => {
    const pageId = typeof target === 'string' ? target : pagesRef.current[target]?.id;
    if (!pageId) return Promise.resolve(false);
    if (historySession.getSnapshot().busy) {
      return historySession.run(() => applyBatchUpdatePage(updates, pageId, options));
    }
    return applyBatchUpdatePage(updates, pageId, options);
  };

  // Handle Strokes Change for a specific page (Safe Functional State Update)
  const handleStrokesChange = async (newStrokes, targetPageIndex = currentPageIndex, options = {}) => {
    await handleBatchUpdatePage({ strokes: newStrokes }, targetPageIndex, options);
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

  // Shared image placement: the existing Paste geometry, persistence and selection.
  const insertImageOnPage = (imgDataUrl, customPos = null, imgWidth = 400, imgHeight = 300, targetPageId = currentPage?.id) => new Promise((resolve, reject) => {
    if (!pagesRef.current.some(page => page.id === targetPageId)) { resolve(); return; }
    const img = new Image();
    img.onerror = () => reject(new Error('invalid-image'));
    img.onload = async () => {
      try {
        const targetPageIndex = pagesRef.current.findIndex(page => page.id === targetPageId);
        const currentPage = pagesRef.current[targetPageIndex];
        if (!currentPage) { resolve(); return; }
        let w = img.naturalWidth || imgWidth || 400;
        let h = img.naturalHeight || imgHeight || 300;

        const maxDim = 650;
        if (w > maxDim || h > maxDim) {
          const r = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }

        const imageViewport = isWhiteboardPage(currentPage, notebook.templateId) && whiteboardViewportRef.current?.pageId === currentPage.id
          ? whiteboardViewportRef.current : null;
        const pWidth = imageViewport?.width || currentPage.pageWidth || 1200;
        const pHeight = imageViewport?.height || currentPage.pageHeight || 1600;

        const hasCustomPos = Number.isFinite(customPos?.x) && Number.isFinite(customPos?.y);
        let posX = hasCustomPos ? customPos.x - (imageViewport?.x || 0) - w / 2 : (pWidth - w) / 2;
        let posY = hasCustomPos ? customPos.y - (imageViewport?.y || 0) - h / 2 : (pHeight - h) / 2;

        posX = Math.max(20, Math.min(pWidth - w - 20, Math.round(posX)));
        posY = Math.max(20, Math.min(pHeight - h - 20, Math.round(posY)));

        if (imageViewport) { posX += imageViewport.x; posY += imageViewport.y; }

        const newImg = {
          id: `img-${Date.now()}`,
          src: imgDataUrl,
          x: posX,
          y: posY,
          width: w,
          height: h
        };

        const existingImgs = pagesRef.current[targetPageIndex]?.imageElements || [];
        await handleImageElementsChange([...existingImgs, newImg], targetPageIndex);
        setPastedImageSelection({ pageId: currentPage.id, imageId: newImg.id });
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    img.src = imgDataUrl;
  });

  const handleImportImage = async () => {
    if (!currentPage || imageImportPendingRef.current) return;
    if (!window.electronAPI?.selectImage) {
      if (imageFileInputRef.current) {
        imageFileInputRef.current.value = '';
        imageFileInputRef.current.click();
      }
      return;
    }
    imageImportPendingRef.current = true;
    try {
      const result = await window.electronAPI.selectImage({
        title: t('insertImage', 'Insert image from computer'),
        allImagesLabel: t('supportedImages', 'All supported images')
      });
      if (result?.canceled) return;
      if (!result?.success || !result.dataUrl) throw new Error('image-read-failed');
      await insertImageOnPage(result.dataUrl);
    } catch (_) {
      alert(t('imageImportError', 'Unable to open this image. Please choose a supported image file.'));
    } finally {
      imageImportPendingRef.current = false;
    }
  };

  // Browser preview fallback uses the same insertion path without Electron IPC.
  const handleImageFileChange = async (e) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file || imageImportPendingRef.current) return;
    imageImportPendingRef.current = true;
    try {
      if (!/\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name)) throw new Error('unsupported-image');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('image-read-failed'));
        reader.readAsDataURL(file);
      });
      await insertImageOnPage(dataUrl);
    } catch (_) {
      alert(t('imageImportError', 'Unable to open this image. Please choose a supported image file.'));
    } finally {
      imageImportPendingRef.current = false;
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

    try {
      await insertImageOnPage(imgDataUrl, customPos, imgWidth, imgHeight);
    } catch (_) {
      alert(t('imageImportError', 'Unable to open this image. Please choose a supported image file.'));
    }
  };

  // Duplicate Current Notebook
  const handleDuplicateCurrentNotebook = async () => {
    try {
      const cloned = await duplicateNotebook(notebook.id, { copySuffix: t('notebookCopySuffix') });
      alert(t('duplicateSuccess') + ' "' + localizeNotebookCopyName(cloned.name, t('notebookCopySuffix')) + '"');
      if (onNotebookUpdated) onNotebookUpdated(cloned);
    } catch (err) {
      console.error(err);
      alert(t('cannotDuplicate') + ': ' + (err.code === 'NOTEBOOK_NOT_FOUND' ? t('duplicateNotebookNotFound') : err.message));
    }
  };

  // Export Current Page Only as PDF
  const handleExportCurrentPagePdf = async () => {
    if (!currentPage) return;
    try {
      await exportSinglePageToPdf(notebook, currentPage, currentPageIndex);
      alert(t('exportPdfSuccess', 'ส่งออกเอกสารเป็น PDF เรียบร้อยแล้ว! 📄'));
    } catch (err) {
      console.error(err);
      alert(`${t('exportPdfError', 'เกิดข้อผิดพลาดในการส่งออก PDF')}: ${err.message}`);
    }
  };

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
    }, behavior === 'smooth' ? 900 : 350);

    const stageRect = stageEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const delta = targetRect.top - stageRect.top;
    const targetScrollTop = stageEl.scrollTop + delta - 20;

    if (behavior === 'auto') {
      stageEl.scrollTop = Math.max(0, targetScrollTop);
    } else {
      try {
        stageEl.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      } catch {
        stageEl.scrollTop = Math.max(0, targetScrollTop);
      }
    }
  }, [scrollDirection]);

  // Switch Page & Jump / Smooth Scroll to target page in vertical continuous mode
  const handleSelectPage = useCallback((index) => {
    const allPages = pagesRef.current;
    if (index >= 0 && index < allPages.length) {
      const prevIndex = currentPageIndexRef.current;
      const isDistantJump = Math.abs(index - prevIndex) > 1;

      // Immediately lock programmatic scroll to prevent IntersectionObserver storms during jump
      isProgrammaticScrollRef.current = true;
      if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
      programmaticScrollTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, isDistantJump ? 400 : 900);

      setCurrentPageIndex(index);
      currentPageIndexRef.current = index;

      if (scrollDirection === 'vertical') {
        if (isDistantJump) {
          // Distant jumps (e.g. page 1 to 40) jump instantly without unmounting/mounting 40 intermediate canvases!
          requestAnimationFrame(() => {
            scrollToPageInStage(index, 'auto');
          });
        } else {
          scrollToPageInStage(index, 'smooth');
        }
      } else {
        if (stageRef.current) {
          stageRef.current.scrollTop = 0;
          stageRef.current.scrollLeft = 0;
        }
      }
    }
  }, [scrollDirection, scrollToPageInStage]);

  // Commit page layout and notebook count together. Restore the complete page
  // snapshot (including PDF/background/media), without cloning the whole book.
  const commitPageStructure = useCallback(async (change, selectedPageId) => {
    await pageSaveQueue.flush(notebook.id);
    const result = await mutateNotebookPages(notebook.id, change);
    if (change.kind === 'delete') pageSaveQueue.forgetDeletedPage(change.pageId);
    const livePages = new Map(pagesRef.current.map(page => [page.id, page]));
    const nextPages = result.pages.map(page => {
      const live = livePages.get(page.id);
      return live ? { ...page, ...live, pageIndex: page.pageIndex } : page;
    });
    pagesRef.current = nextPages;
    setPages(nextPages);
    const selectedIndex = Math.max(0, nextPages.findIndex(page => page.id === selectedPageId));
    currentPageIndexRef.current = selectedIndex;
    setCurrentPageIndex(selectedIndex);
    if (onNotebookUpdated) onNotebookUpdated(result.notebook);
    if (scrollDirection === 'vertical') setTimeout(() => scrollToPageInStage(selectedIndex, 'smooth'), 60);
    return result;
  }, [notebook.id, onNotebookUpdated, scrollDirection, scrollToPageInStage]);

  const canUndo = !isLoading && !loadError && !historyBusy && historyPointer >= 0;
  const canRedo = !isLoading && !loadError && !historyBusy && historyPointer < historyStack.length - 1;

  const replayHistory = useCallback(direction => {
    // A hotkey during load/retry must not invalidate an existing session's
    // history against this view's temporary empty pages array.
    if (isLoading || loadError || !pagesRef.current.length) return Promise.resolve(false);
    const perform = async () => {
      const { stack, pointer } = historySession.getSnapshot();
      const entry = stack[direction === 'undo' ? pointer : pointer + 1];
      if (!entry) return false;
      if (entry.kind === 'insert-page' || entry.kind === 'delete-page') {
        const removes = entry.kind === 'insert-page' ? direction === 'undo' : direction === 'redo';
        const change = removes
          ? { kind: 'delete', pageId: entry.pageId }
          : { kind: 'insert', page: entry.page, atIndex: entry.pageIndex };
        const selectedId = direction === 'undo' ? entry.selectedBefore : entry.selectedAfter;
        const result = await commitPageStructure(change, selectedId || entry.pageId);
        // Keep changes such as favorite/template made since insertion; a later
        // Redo restores the latest removed page instead of its original blank copy.
        const replacement = removes ? { ...entry, page: result.changedPage } : entry;
        historySession.step(direction, entry, replacement);
        return true;
      }
      const targetIdx = findHistoryPageIndex(pagesRef.current, entry);
      if (targetIdx < 0) { historySession.reconcile(pagesRef.current); return false; }
      const targetPage = pagesRef.current[targetIdx];
      const updatedPage = {
        ...targetPage, ...(direction === 'undo' ? entry.before : entry.after), updatedAt: Date.now()
      };
      const nextPages = pagesRef.current.map(page => page.id === targetPage.id ? updatedPage : page);
      historySession.step(direction, entry);
      pagesRef.current = nextPages;
      setPages(nextPages);
      if (targetIdx !== currentPageIndexRef.current) handleSelectPage(targetIdx);
      return persistPage(updatedPage);
    };
    const { stack, pointer, busy } = historySession.getSnapshot();
    const entry = stack[direction === 'undo' ? pointer : pointer + 1];
    const isStructural = entry?.kind === 'insert-page' || entry?.kind === 'delete-page';
    const result = busy || isStructural ? historySession.run(perform) : perform();
    return result.catch(error => {
      console.error('History replay failed:', error);
      alert(t('localSavePageChangeFailed'));
      return false;
    });
  }, [historySession, commitPageStructure, handleSelectPage, persistPage, t, isLoading, loadError]);

  const handleUndo = useCallback(() => replayHistory('undo'), [replayHistory]);
  const handleRedo = useCallback(() => replayHistory('redo'), [replayHistory]);

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
  }, [canUndo, canRedo, historyPointer, historyStack, currentPageIndex, pages, clipboardImage, handleUndo, handleRedo]);

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

  // Sync active page indicator with scroll position in continuous vertical mode
  useEffect(() => {
    if (isLoading || scrollDirection !== 'vertical' || pages.length === 0) return;

    let isUnmounted = false;
    const timer = setTimeout(() => {
      if (isUnmounted) return;
      const stageEl = stageRef.current;

      const observer = new IntersectionObserver((entries) => {
        if (isWhiteboardPage(pagesRef.current[currentPageIndexRef.current], notebook.templateId)) return;
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

  const changePageStructure = (change, selectedPageId) => historySession.run(async () => {
    const selectedBefore = pagesRef.current[currentPageIndexRef.current]?.id;
    const result = await commitPageStructure(change, selectedPageId);
    historySession.append({
      kind: change.kind === 'insert' ? 'insert-page' : 'delete-page',
      pageId: result.changedPage.id, page: result.changedPage,
      pageIndex: result.changedPage.pageIndex,
      selectedBefore, selectedAfter: pagesRef.current[currentPageIndexRef.current]?.id
    });
    return true;
  }).catch(error => {
    console.error('Page operation failed:', error);
    alert(t('localSavePageChangeFailed'));
    return false;
  });

  // Add Page with custom size (A2, A3, A4), orientation, and template
  const handleAddPage = async (pageConfig = {}) => {
    const sizeId = pageConfig.sizeId || 'A4';
    const orientation = pageConfig.orientation || 'portrait';
    const sizeDim = getPaperSize(sizeId, orientation);
    const newPage = {
      id: notebook.id + '_page_' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2)),
      notebookId: notebook.id, pageIndex: 0,
      templateId: pageConfig.templateId || notebook.templateId || 'ruled',
      sizeId, orientation,
      pageWidth: pageConfig.pageWidth || sizeDim.width,
      pageHeight: pageConfig.pageHeight || sizeDim.height,
      strokes: [], textElements: [], imageElements: [], updatedAt: Date.now()
    };
    const afterPageId = (pageConfig.insertPosition || 'after') === 'after'
      ? pagesRef.current[currentPageIndexRef.current]?.id : null;
    return changePageStructure({ kind: 'insert', page: newPage, afterPageId }, newPage.id);
  };

  // Duplicate a specific page (from thumbnail 3-dots or wherever)
  const handleDuplicatePage = async (pageIndex = currentPageIndexRef.current) => {
    const sourcePage = pagesRef.current[pageIndex];
    if (!sourcePage) return;
    const clonedPage = {
      ...sourcePage,
      id: 'page-' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2)),
      strokes: structuredClone(sourcePage.strokes || []),
      textElements: structuredClone(sourcePage.textElements || []),
      imageElements: structuredClone(sourcePage.imageElements || []),
      updatedAt: Date.now()
    };
    return changePageStructure({ kind: 'insert', page: clonedPage, afterPageId: sourcePage.id }, clonedPage.id);
  };

  // Insert Blank Page after a specific index
  const handleInsertPageAfter = async (pageIndex = currentPageIndexRef.current) => {
    const previous = pagesRef.current[pageIndex];
    if (!previous) return;
    const newPage = {
      id: 'page-' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2)),
      notebookId: notebook.id, pageIndex: 0,
      templateId: previous.templateId || notebook.templateId || 'blank',
      paperColor: previous.paperColor || notebook.paperColor || '#ffffff',
      paperPattern: previous.paperPattern || notebook.paperPattern || 'none',
      pageSize: previous.pageSize || notebook.pageSize || 'A4',
      pageOrientation: previous.pageOrientation || notebook.pageOrientation || 'portrait',
      pageWidth: previous.pageWidth || 1200, pageHeight: previous.pageHeight || 1600,
      strokes: [], textElements: [], imageElements: [], updatedAt: Date.now()
    };
    return changePageStructure({ kind: 'insert', page: newPage, afterPageId: previous.id }, newPage.id);
  };

  // Delete Page
  const handleDeletePage = async (targetIndex = currentPageIndexRef.current) => {
    const currentPagesList = pagesRef.current;
    if (currentPagesList.length <= 1) {
      alert(t('cannotDeleteOnlyPage', 'Cannot delete the only page'));
      return;
    }
    const pageToDelete = currentPagesList[targetIndex];
    if (!pageToDelete || !confirm(t('confirmDeletePageNum', 'Delete page {page}?', { page: targetIndex + 1 }))) return;
    const activePage = currentPagesList[currentPageIndexRef.current];
    const selectedPageId = activePage?.id !== pageToDelete.id
      ? activePage?.id : (currentPagesList[targetIndex + 1] || currentPagesList[targetIndex - 1])?.id;
    return changePageStructure({ kind: 'delete', pageId: pageToDelete.id }, selectedPageId);
  };

  // Change Template for Current Page
  const handleChangeTemplate = (templateId, pageId = pagesRef.current[currentPageIndexRef.current]?.id) => {
    if (historySession.getSnapshot().busy) return historySession.run(() => handleChangeTemplateNow(templateId, pageId));
    return handleChangeTemplateNow(templateId, pageId);
  };
  const handleChangeTemplateNow = (templateId, pageId) => {
    const target = pagesRef.current.find(page => page.id === pageId);
    if (!target) return;
    const updated = { ...target, templateId, updatedAt: Date.now() };
    const nextPages = pagesRef.current.map(page => page.id === target.id ? updated : page);
    pagesRef.current = nextPages;
    setPages(nextPages);
    return persistPage(updated);
  };

  // Toggle Favorite for a specific page (or current page)
  const handleToggleFavoritePage = (pageIndex = currentPageIndexRef.current) => {
    const pageId = pagesRef.current[pageIndex]?.id;
    if (historySession.getSnapshot().busy) return historySession.run(() => handleToggleFavoritePageNow(pageId));
    return handleToggleFavoritePageNow(pageId);
  };
  const handleToggleFavoritePageNow = pageId => {
    const target = pagesRef.current.find(page => page.id === pageId);
    if (!target) return;
    const updated = { ...target, isFavorite: !target.isFavorite, updatedAt: Date.now() };
    const nextPages = pagesRef.current.map(page => page.id === target.id ? updated : page);
    pagesRef.current = nextPages;
    setPages(nextPages);
    return persistPage(updated);
  };

  // Rename Notebook Title
  const handleRenameTitle = async (newTitle) => {
    const updated = { ...notebook, name: newTitle, updatedAt: Date.now() };
    const savedNotebook = await saveNotebook(updated, { ensureUniqueName: true });
    if (onNotebookUpdated) onNotebookUpdated(savedNotebook);
  };

  if (isLoading) {
    return (
      <div className="bn-loading-screen">
        <div className="bn-spinner"></div>
        <p className="text-zinc-400 mt-3 text-sm">{t('loadingApp', 'กำลังเปิดสมุดบันทึก...')}</p>
      </div>
    );
  }

  if (loadError) return (
    <div className="bn-local-load-error" role="alert">
      <p>{t('localLoadFailed')}</p>
      <button type="button" onClick={loadPages}>{t('localLoadRetry')}</button>
    </div>
  );

  return (
    <div className="bn-editor-container">
      <input
        ref={imageFileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.avif"
        hidden
        onChange={handleImageFileChange}
      />
      {/* Top Studio Toolbar with Pen Nibs, Snip, Paste, and Duplicate */}
      <EditorToolbar 
        notebookTitle={notebook.name}
        onRenameTitle={handleRenameTitle}
        onBackToLibrary={onBackToLibrary}
        onDuplicateNotebook={handleDuplicateCurrentNotebook}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        activeColor={activeColor}
        colorSlots={colorSlots}
        onCustomColorChange={handleCustomColorChange}
        setActiveColor={setActiveColor}
        activeWidth={activeWidth}
        setActiveWidth={(w) => handleToolWidthChange(activeTool, w)}
        toolWidths={toolWidths}
        onToolWidthChange={handleToolWidthChange}
        activeShape={activeShape}
        setActiveShape={setActiveShape}
        penNib={penNib}
        highlighterTip={highlighterTip}
        setPenNib={setPenNib}
        setHighlighterTip={setHighlighterTip}
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
        onImportImage={handleImportImage}
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
          className={`bn-editor-canvas-stage ${scrollDirection === 'vertical' ? 'bn-stage-vertical' : ''} ${isWhiteboardPage(currentPage, notebook.templateId) ? 'bn-stage-whiteboard' : ''}`}
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

          {currentPage && isWhiteboardPage(currentPage, notebook.templateId) ? (
            <div ref={stageContentRef} className="bn-whiteboard-page">
                <WhiteboardBoard
                  key={currentPage.id || `horizontal-page-${currentPageIndex}`}
                  page={currentPage}
                  newlyPastedImageId={pastedImageSelection?.pageId === currentPage.id ? pastedImageSelection.imageId : null}
                  onViewportChange={handleWhiteboardViewportChange}
                  templateId={notebook.templateId}
                  activeTool={activeTool}
                  activeColor={activeColor}
                  colorSlots={colorSlots}
                  onColorChange={setActiveColor}
                  onCustomColorChange={handleCustomColorChange}
                  activeWidth={activeWidth}
                  activeShape={activeShape}
                  penNib={penNib}
                  highlighterTip={highlighterTip}
                  isTapered={isTapered}
                  usePressure={usePressure}
                  pressureSensitivity={pressureSensitivity}
                  eraserMode={eraserMode}
                  scribbleToErase={scribbleToErase}
                  penOnly={penOnly}
                  zoom={zoom}
                  onZoomChange={setZoom}
                  onToolChange={setActiveTool}
                  onBatchUpdatePage={(updates, options) => handleBatchUpdatePage(updates, currentPage.id, options)}
                  onStrokesChange={(newStrokes, options) => handleStrokesChange(newStrokes, currentPage.id, options)}
                  onTextElementsChange={(newTexts) => handleTextElementsChange(newTexts, currentPage.id)}
                  onImageElementsChange={(newImgs) => handleImageElementsChange(newImgs, currentPage.id)}
                  onSnipComplete={handleSnipComplete}
                  onUndo={handleUndo}
                />
            </div>
          ) : scrollDirection === 'vertical' ? (
            /* Vertical Continuous Scroll Mode with Viewport Virtualization */
            <div ref={stageContentRef} className="bn-vertical-pages-stack">
              {pages.map((p, idx) => {
                const PageBoard = isWhiteboardPage(p, notebook.templateId) ? WhiteboardBoard : CanvasBoard;
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
                      <PageBoard
                        key={p.id}
                        page={p}
                        newlyPastedImageId={pastedImageSelection?.pageId === p.id ? pastedImageSelection.imageId : null}
                        onViewportChange={handleWhiteboardViewportChange}
                        templateId={notebook.templateId}
                        activeTool={activeTool}
                        activeColor={activeColor}
                        colorSlots={colorSlots}
                        onColorChange={setActiveColor}
                        onCustomColorChange={handleCustomColorChange}
                        activeWidth={activeWidth}
                        activeShape={activeShape}
                        penNib={penNib}
                        highlighterTip={highlighterTip}
                        isTapered={isTapered}
                        usePressure={usePressure}
                        pressureSensitivity={pressureSensitivity}
                        eraserMode={eraserMode}
                        scribbleToErase={scribbleToErase}
                        penOnly={penOnly}
                        zoom={zoom}
                        onZoomChange={setZoom}
                        onToolChange={setActiveTool}
                        onBatchUpdatePage={(updates, options) => handleBatchUpdatePage(updates, p.id, options)}
                        selectedPageId={currentPage?.id}
                        onStrokesChange={(newStrokes, options) => handleStrokesChange(newStrokes, p.id, options)}
                        onTextElementsChange={(newTexts) => handleTextElementsChange(newTexts, p.id)}
                        onImageElementsChange={(newImgs) => handleImageElementsChange(newImgs, p.id)}
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
                  newlyPastedImageId={pastedImageSelection?.pageId === currentPage.id ? pastedImageSelection.imageId : null}
                  templateId={notebook.templateId}
                  activeTool={activeTool}
                  activeColor={activeColor}
                  colorSlots={colorSlots}
                  onColorChange={setActiveColor}
                  onCustomColorChange={handleCustomColorChange}
                  activeWidth={activeWidth}
                  activeShape={activeShape}
                  penNib={penNib}
                  highlighterTip={highlighterTip}
                  isTapered={isTapered}
                  usePressure={usePressure}
                  pressureSensitivity={pressureSensitivity}
                  eraserMode={eraserMode}
                  scribbleToErase={scribbleToErase}
                  penOnly={penOnly}
                  zoom={zoom}
                  onZoomChange={setZoom}
                  onToolChange={setActiveTool}
                  onBatchUpdatePage={(updates, options) => handleBatchUpdatePage(updates, currentPage.id, options)}
                  onStrokesChange={(newStrokes, options) => handleStrokesChange(newStrokes, currentPage.id, options)}
                  onTextElementsChange={(newTexts) => handleTextElementsChange(newTexts, currentPage.id)}
                  onImageElementsChange={(newImgs) => handleImageElementsChange(newImgs, currentPage.id)}
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
