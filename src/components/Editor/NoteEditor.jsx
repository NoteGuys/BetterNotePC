import { loadPdfRaster } from '../../services/pdfRasterService.js';
import { cachedPagePreview } from '../../services/pagePreviewService.js';
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react';
import { EditorToolbar } from './EditorToolbar';
import { PageNavigation } from './PageNavigation';
import { ThumbnailSidebar } from './ThumbnailSidebar';
import { CanvasBoard } from './CanvasBoard';
import { WhiteboardBoard } from './WhiteboardBoard';
import { isWhiteboardPage } from '../../utils/whiteboard';
import { createTouchGuard, createTwoFingerTap, touchSnapshot, normalizeWheel, createWheelPageGate } from '../../utils/touchNavigation';
import { ExportModal } from '../Common/ExportModal';
import { 
  getPagesByNotebookId, getPage,
  savePage, 
  mutateNotebookPages,
  saveNotebook,
  duplicateNotebook 
} from '../../services/db';
import { loadPageManifest, loadPdfOwnerPage, exportPortableNotebook } from '../../services/editorPagesService.js';
import { createPagePreviewSession } from '../../services/pagePreviewService.js';
import { pageSummary, trimPageWindow, windowPageIds, editorPageView } from '../../utils/pageWindow.js';
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
  const manifestAbortRef = useRef(null);

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


  const isPinchingActiveRef = useRef(false);
  const navigationRef = useRef(null);
  if (!navigationRef.current) navigationRef.current = {
    guard: createTouchGuard(), tap: createTwoFingerTap(), wheelGate: createWheelPageGate(),
    pan: null, pinch: null, frame: null, momentum: null, wheelFrame: null, wheelZoom: null, anchor: null
  };
  const nav = navigationRef.current;
  const navigationLocked = () => !!(window.__bn_pen_active || window.__bn_drag_active);
  const clearNavigationPreview = () => {
    const content = stageContentRef.current;
    if (content) { content.style.transform = ''; content.style.transformOrigin = ''; content.style.willChange = ''; }
  };
  const stopNavigationFrames = () => {
    for (const key of ['frame', 'momentum', 'wheelFrame']) {
      if (nav[key] !== null) cancelAnimationFrame(nav[key]);
      nav[key] = null;
    }
    nav.wheelZoom = null;
    if (!nav.pinch) isPinchingActiveRef.current = false;
  };
  const resetNavigation = () => {
    stopNavigationFrames(); clearNavigationPreview();
    nav.guard.suspend(); nav.tap.cancel(); nav.pan = null; nav.pinch = null; nav.anchor = null;
    isPinchingActiveRef.current = false;
  };
  const resetNavigationRef = useRef(resetNavigation);
  resetNavigationRef.current = resetNavigation;

  // Keep the same page point under the fingers after React applies the final zoom,
  // including centered pages and the fixed spacing between vertically stacked pages.
  const applyNavigationAnchor = anchor => {
    const stage = stageRef.current;
    const element=anchor?.wrapper?.querySelector('.bn-canvas-container, .bn-vertical-page-placeholder') || anchor?.element;
    if (!stage || !element?.isConnected) return;
    const rect = element.getBoundingClientRect();
    stage.scrollLeft += rect.left + anchor.x * zoomRef.current - anchor.screenX;
    stage.scrollTop += rect.top + anchor.y * zoomRef.current - anchor.screenY;
  };
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    if (nav.anchor) { applyNavigationAnchor(nav.anchor); nav.anchor = null; }
    if (!nav.pinch) isPinchingActiveRef.current = false;
  }, [zoom]);

  useLayoutEffect(() => () => resetNavigationRef.current(), [
    notebook.id, scrollDirection, activeTool,
    scrollDirection === 'horizontal' ? pages[currentPageIndex]?.id : null
  ]);
  useEffect(() => {
    const interrupt = () => resetNavigationRef.current();
    const hidden = () => { if (document.hidden) interrupt(); };
    const pointer = event => {
      if (event.pointerType !== 'touch' || !stageRef.current?.contains(event.target) || navigationTargetIsControl(event.target)) interrupt();
    };
    const outsideRelease = event => {
      if (!stageRef.current?.contains(event.target)) { nav.guard.update(event.touches, navigationLocked()); interrupt(); }
    };
    window.addEventListener('touchend', outsideRelease);
    window.addEventListener('touchcancel', outsideRelease);
    window.addEventListener('blur', interrupt);
    window.addEventListener('pointerdown', pointer, true);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      interrupt(); window.removeEventListener('touchend', outsideRelease); window.removeEventListener('touchcancel', outsideRelease);
      window.removeEventListener('blur', interrupt);
      window.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);

  const chooseNavigationAnchor = (x, y) => {
    const stage = stageRef.current;
    const hit = document.elementFromPoint(x, y)?.closest('.bn-canvas-container, .bn-vertical-page-placeholder');
    // The pointer/viewport center may land in the fixed gap between pages.
    // Choose the nearest visible sheet, never the first sheet in a long notebook.
    const element = hit && stage?.contains(hit) ? hit : [...(stage?.querySelectorAll('.bn-canvas-container, .bn-vertical-page-placeholder') || [])].sort((a,b)=>{
      const distance=el=>{const r=el.getBoundingClientRect();return Math.max(r.top-y,0,y-r.bottom)+Math.max(r.left-x,0,x-r.right);};
      return distance(a)-distance(b);
    })[0];
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { element, wrapper:element.closest('.bn-vertical-page-wrapper'), x: (x - rect.left) / zoomRef.current, y: (y - rect.top) / zoomRef.current, screenX: x, screenY: y };
  };
  const changeToolbarZoom = next => {
    const stage=stageRef.current;
    resetNavigationRef.current();
    if (!stage || isWhiteboardPage(pagesRef.current[currentPageIndexRef.current], notebook.templateId)) { setZoom(next); return; }
    const rect=stage.getBoundingClientRect();
    nav.anchor=chooseNavigationAnchor(rect.left+rect.width/2,rect.top+rect.height/2);
    const index=Number(nav.anchor?.wrapper?.dataset.pageIndex);
    if(nav.anchor?.wrapper && Number.isInteger(index) && index!==currentPageIndexRef.current){currentPageIndexRef.current=index;setCurrentPageIndex(index);}
    isProgrammaticScrollRef.current=true;
    if(programmaticScrollTimerRef.current)clearTimeout(programmaticScrollTimerRef.current);
    programmaticScrollTimerRef.current=setTimeout(()=>{isProgrammaticScrollRef.current=false;},350);
    if(next===zoomRef.current){nav.anchor=null;return;}
    setZoom(next);
  };
  const settlePinch = () => {
    const pinch = nav.pinch;
    if (!pinch) return;
    if (nav.frame !== null) cancelAnimationFrame(nav.frame);
    nav.frame = null; nav.pinch = null; clearNavigationPreview();
    if (pinch.moved && pinch.anchor) {
      const finalZoom = Math.min(3.5, Math.max(0.35, Number((pinch.zoom * pinch.scale).toFixed(2))));
      const anchor = { ...pinch.anchor, screenX: pinch.x + pinch.panX, screenY: pinch.y + pinch.panY };
      if (finalZoom === zoomRef.current) applyNavigationAnchor(anchor);
      else { nav.anchor = anchor; setZoom(finalZoom); }
    }
    isPinchingActiveRef.current = false;
  };
  const navigationTargetIsControl = target => !!target?.closest?.(
    'input, textarea, select, button, [contenteditable="true"], .bn-modal-backdrop, .bn-lasso-menu, .bn-whiteboard-viewport'
  );
  const handleStageTouchStart = e => {
    if (scrollDirection === 'horizontal' && isWhiteboardPage(pagesRef.current[currentPageIndexRef.current], notebook.templateId)) return;
    if (navigationTargetIsControl(e.target)) return;
    stopNavigationFrames();
    const touches = nav.guard.update(e.touches, navigationLocked());
    if (navigationLocked() || touches.length !== e.touches.length) { nav.tap.cancel(); return; }
    nav.tap.start(touches);
    if (touches.length > 2) { settlePinch(); nav.pan = null; nav.tap.cancel(); nav.guard.block(); return; }
    const stage = stageRef.current;
    if (!stage) return;
    if (touches.length === 1) {
      const point = touches[0];
      nav.pan = { id: point.identifier, x: point.clientX, y: point.clientY, left: stage.scrollLeft, top: stage.scrollTop,
        moved: false, vx: 0, vy: 0, time: performance.now(), lastX: point.clientX, lastY: point.clientY };
    } else if (touches.length === 2) {
      nav.pan = null; settlePinch();
      const point = touchSnapshot(touches), content = stageContentRef.current;
      if (!content) return;
      const rect = content.getBoundingClientRect();
      nav.pinch = { ...point, zoom: zoomRef.current, scale: 1, panX: 0, panY: 0, moved: false,
        anchor: chooseNavigationAnchor(point.x, point.y) };
      content.style.transformOrigin = (point.x - rect.left) + 'px ' + (point.y - rect.top) + 'px';
      content.style.willChange = 'transform';
      isPinchingActiveRef.current = true;
    }
  };
  const handleStageTouchMove = e => {
    if (navigationTargetIsControl(e.target)) return;
    const touches = nav.guard.update(e.touches, navigationLocked());
    if (navigationLocked()) { resetNavigation(); return; }
    nav.tap.move(touches);
    if (touches.length !== e.touches.length) return;
    if (touches.length === 2 && nav.pinch) {
      if (e.cancelable) e.preventDefault();
      const point = touchSnapshot(touches), pinch = nav.pinch;
      if (Math.hypot(point.x - pinch.x, point.y - pinch.y) > 8 || Math.abs(point.distance - pinch.distance) > 8) pinch.moved = true;
      if (!pinch.moved) return;
      nav.tap.cancel();
      pinch.scale = Math.min(3.5 / pinch.zoom, Math.max(0.35 / pinch.zoom, point.distance / pinch.distance));
      pinch.panX = point.x - pinch.x; pinch.panY = point.y - pinch.y;
      if (nav.frame === null) nav.frame = requestAnimationFrame(() => {
        nav.frame = null; const p = nav.pinch, content = stageContentRef.current;
        if (p && content && !navigationLocked()) content.style.transform = 'translate3d(' + p.panX + 'px,' + p.panY + 'px,0) scale(' + p.scale + ')';
      });
    } else if (touches.length === 1 && nav.pan && activeTool !== 'snip') {
      const point = touches[0], pan = nav.pan;
      if (point.identifier !== pan.id) return;
      const dx = point.clientX - pan.x, dy = point.clientY - pan.y;
      if (!pan.moved && Math.hypot(dx, dy) <= 8) return;
      pan.moved = true;
      if (e.cancelable) e.preventDefault();
      const time = performance.now(), dt = Math.max(1, time - pan.time);
      pan.vx = (point.clientX - pan.lastX) / dt; pan.vy = (point.clientY - pan.lastY) / dt;
      pan.time = time; pan.lastX = point.clientX; pan.lastY = point.clientY;
      pan.nextLeft = pan.left - dx; pan.nextTop = pan.top - dy;
      if (nav.frame === null) nav.frame = requestAnimationFrame(() => {
        nav.frame = null; const stage = stageRef.current;
        if (nav.pan && stage && !navigationLocked()) { stage.scrollLeft = nav.pan.nextLeft; stage.scrollTop = nav.pan.nextTop; }
      });
    }
  };
  const finishStageTouch = (e, cancelled) => {
    if (navigationTargetIsControl(e.target)) return;
    const locked = navigationLocked();
    nav.guard.update(e.touches, locked);
    if (cancelled || locked) nav.tap.cancel();
    else nav.tap.move(e.changedTouches);
    const pan = nav.pan;
    if (nav.pinch && e.touches.length < 2) {
      const moved = nav.pinch.moved;
      settlePinch(); nav.pan = null;
      if (moved) nav.guard.block();
    }
    if (e.touches.length) return;
    if (!cancelled && !locked && nav.tap.end(e.touches)) {
      handleUndo(); showGestureToast(t('twoFingerUndoToast', 'ย้อนกลับ (แตะ 2 นิ้ว 2 ครั้ง) ↶'));
    }
    nav.pan = null;
    if (nav.frame !== null) cancelAnimationFrame(nav.frame);
    nav.frame = null;
    const stage = stageRef.current;
    if (pan?.moved && stage && !locked) {
      stage.scrollLeft = pan.nextLeft; stage.scrollTop = pan.nextTop;
      // Only a recent, intentional release carries momentum. Cancellation never does.
      if (!cancelled && performance.now() - pan.time < 80) {
        let vx = Math.max(-2.5, Math.min(2.5, pan.vx)), vy = Math.max(-2.5, Math.min(2.5, pan.vy)), last = performance.now();
        const momentum = time => {
          nav.momentum = null;
          if (navigationLocked() || nav.guard.size) return;
          const dt = Math.min(32, Math.max(1, time - last)); last = time;
          const left = stage.scrollLeft, top = stage.scrollTop, decay = Math.pow(0.95, dt / 16);
          vx *= decay; vy *= decay; stage.scrollLeft -= vx * dt; stage.scrollTop -= vy * dt;
          if ((stage.scrollLeft !== left || stage.scrollTop !== top) && Math.hypot(vx, vy) > 0.05) nav.momentum = requestAnimationFrame(momentum);
        };
        if (Math.hypot(vx, vy) > 0.25) nav.momentum = requestAnimationFrame(momentum);
      }
    }
  };
  const handleStageTouchEnd = e => finishStageTouch(e, false);
  const handleStageTouchCancel = e => {
    nav.guard.update(e.touches, true); resetNavigation();
  };

  // Touchpad zoom is anchored and batched; one inertial scroll gesture flips at most one page.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const wheel = e => {
      if (isWhiteboardPage(pagesRef.current[currentPageIndexRef.current], notebook.templateId) || navigationTargetIsControl(e.target)) return;
      if (navigationLocked() || nav.guard.size) { e.preventDefault(); return; }
      if (nav.momentum !== null) cancelAnimationFrame(nav.momentum);
      nav.momentum = null; nav.tap.cancel();
      const delta = normalizeWheel(e, stage.clientHeight);
      if (e.ctrlKey) {
        e.preventDefault(); isPinchingActiveRef.current = true;
        const current = nav.wheelZoom?.zoom ?? zoomRef.current;
        nav.wheelZoom = { zoom: Math.min(3.5, Math.max(0.35, current * Math.exp(-delta.y * 0.002))),
          anchor: chooseNavigationAnchor(e.clientX, e.clientY) };
        if (nav.wheelFrame === null) nav.wheelFrame = requestAnimationFrame(() => {
          nav.wheelFrame = null; const pending = nav.wheelZoom; nav.wheelZoom = null;
          if (!pending || navigationLocked()) return;
          nav.anchor = pending.anchor;
          const next = Number(pending.zoom.toFixed(2));
          if (next === zoomRef.current) { applyNavigationAnchor(nav.anchor); nav.anchor = null; isPinchingActiveRef.current = false; }
          else setZoom(next);
        });
        return;
      }
      if (scrollDirection !== 'horizontal') return;
      e.preventDefault();
      const horizontal = stage.scrollWidth > stage.clientWidth + 2, vertical = stage.scrollHeight > stage.clientHeight + 2;
      if (horizontal || vertical) {
        stage.scrollLeft += e.shiftKey ? delta.y : delta.x || (!vertical ? delta.y : 0);
        stage.scrollTop += e.shiftKey ? 0 : vertical ? delta.y : 0;
        nav.wheelGate.reset(); return;
      }
      const direction = nav.wheelGate.push(Math.abs(delta.x) > Math.abs(delta.y) ? delta.x : delta.y);
      const target = currentPageIndexRef.current + direction;
      if (direction && target >= 0 && target < pagesRef.current.length) handleSelectPage(target);
    };
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => stage.removeEventListener('wheel', wheel);
  }, [scrollDirection, isLoading, notebook.id]);

  // Wait for this notebook's pending page operation before opening its view.
  const loadPages = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    manifestAbortRef.current?.abort();
    const manifestController = new AbortController(); manifestAbortRef.current = manifestController;
    setIsLoading(true);
    setLoadError(false);
    try {
      await historySession.wait();
      let loadedPages = await loadPageManifest(notebook.id, { signal: manifestController.signal, templateId: notebook.templateId });
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
      const start = Math.min(Math.max(0, initialPageRef.current), Math.max(0, loadedPages.length - 1));
      if (loadedPages[start]?.__unloaded) {
        const active = loadedPages[start].__pdfOriginalOwner
          ? await loadPdfOwnerPage(notebook.id, loadedPages[start].id, { signal: manifestController.signal })
          : await getPage(loadedPages[start].id);
        if (!active) throw Error('Page unavailable');
        loadedPages[start] = active;
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
    return () => { loadGenerationRef.current++; manifestAbortRef.current?.abort(); };
  }, [loadPages]);

  const pageLoadsRef = useRef(new Map());
  const ensurePage = useCallback(async pageId => {
    const live = pagesRef.current.find(page => page.id === pageId);
    if (!live || !live.__unloaded) return live;
    const key = notebook.id + ':' + pageId;
    if (pageLoadsRef.current.has(key)) return pageLoadsRef.current.get(key);
    const generation = loadGenerationRef.current;
    const task = (async () => {
      const stored = live.__pdfOriginalOwner ? await loadPdfOwnerPage(notebook.id, pageId, { signal: manifestAbortRef.current?.signal }) : await getPage(pageId);
      if (!stored || stored.notebookId !== notebook.id) throw Error('Page unavailable');
      if (generation !== loadGenerationRef.current) return null;
      const current = pagesRef.current.find(page => page.id === pageId);
      if (!current) return null;
      if (!current.__unloaded) return current;
      const result = pageSaveQueue.overlay([{ ...stored, pageIndex: current.pageIndex }], notebook.id)[0];
      const next = pagesRef.current.map(page => page.id === pageId ? result : page);
      pagesRef.current = next; setPages(next);
      return result;
    })().finally(() => {
      pageLoadsRef.current.delete(key);
      setTimeout(() => {
        if (generation !== loadGenerationRef.current) return;
        const next = trimPageWindow(pagesRef.current, windowPageIds(pagesRef.current, currentPageIndexRef.current, 2));
        if (next.some((page,i) => page !== pagesRef.current[i])) { pagesRef.current = next; setPages(next); }
      }, 0);
    });
    pageLoadsRef.current.set(key, task);
    return task;
  }, [notebook.id]);
  const [pageLoadError, setPageLoadError] = useState(null);
  const wantedPageIds = useMemo(() => windowPageIds(pages, currentPageIndex, scrollDirection === 'vertical' ? 2 : 1), [pages.length, currentPageIndex, scrollDirection]);
  useEffect(() => {
    if (isLoading || loadError || !pages.length) return;
    let cancelled = false;
    const wanted = windowPageIds(pagesRef.current, currentPageIndex, scrollDirection === 'vertical' ? 2 : 1);
    const trimmed = trimPageWindow(pagesRef.current, wanted);
    if (trimmed.some((page,i) => page !== pagesRef.current[i])) { pagesRef.current = trimmed; setPages(trimmed); }
    setPageLoadError(null);
    (async () => {
      const activeId = pagesRef.current[currentPageIndex]?.id;
      try { if (activeId) await ensurePage(activeId); } catch (_) { if (!cancelled) setPageLoadError(activeId); }
      for (const id of wanted) {
        if (cancelled) break;
        if (id !== activeId && !window.__bn_pen_active && !window.__bn_drag_active) { try { await ensurePage(id); } catch (_) { /* Neighbors retry when selected. */ } }
      }
      if (!cancelled) {
        const next = trimPageWindow(pagesRef.current, wanted);
        if (next.some((page,i) => page !== pagesRef.current[i])) { pagesRef.current = next; setPages(next); }
      }
    })();
    return () => { cancelled = true; };
  }, [isLoading, loadError, currentPageIndex, pages.length, scrollDirection, ensurePage]);
  useEffect(()=>{
    if(isLoading||loadError)return;
    let cancelled=false,timer;const controller=new AbortController();
    const nearby=pagesRef.current.slice(Math.max(0,currentPageIndex-3),currentPageIndex+4).filter(p=>p.pdfLazyRaster);
    const prepare=async()=>{
      for(const page of nearby){
        if(cancelled)return;
        if(window.__bn_pen_active||window.__bn_drag_active){timer=setTimeout(prepare,150);return;}
        try{await loadPdfRaster(page,{signal:controller.signal,priority:1});}catch(_){ /* The ready small page stays visible. */ }
      }
    };
    timer=setTimeout(prepare,80);
    return()=>{cancelled=true;controller.abort();clearTimeout(timer);};
  },[isLoading,loadError,currentPageIndex,notebook.id,pages.length]);

  const loadExportPages = useCallback(async () => {
    await pageSaveQueue.flush(notebook.id);
    return getPagesByNotebookId(notebook.id);
  }, [notebook.id]);

  const loadExportPage = useCallback(async index => {
    const pageId = pagesRef.current[index]?.id;
    await pageSaveQueue.flush(notebook.id);
    const page = await ensurePage(pageId);
    if (!page || page.__unloaded) throw Error('Page unavailable');
    return page;
  }, [notebook.id, ensurePage]);

  // Read only the exported page, without mounting it or retaining the entire notebook.
  const loadExportPdfPage = useCallback(async index => {
    if (index === 0) await pageSaveQueue.flush(notebook.id);
    const summary = pagesRef.current[index];
    if (!summary) throw Error('Page unavailable');
    const page = summary.__pdfOriginalOwner || summary.__pdfOriginalOmitted
      ? await loadPdfOwnerPage(notebook.id, summary.id) : await getPage(summary.id);
    if (!page || page.notebookId !== notebook.id) throw Error('Page unavailable');
    return page;
  }, [notebook.id]);

  const loadBNoteExport = useCallback(async () => { await pageSaveQueue.flush(notebook.id); return exportPortableNotebook(notebook.id); }, [notebook.id]);

  const previewSessionRef = useRef(null);
  useEffect(() => {
    const session = createPagePreviewSession(); previewSessionRef.current = session;
    return () => { session.dispose(); if (previewSessionRef.current === session) previewSessionRef.current = null; };
  }, [notebook.id]);
  useEffect(() => {
    if (!isLoading && !loadError) previewSessionRef.current?.update(pages, notebook.templateId);
  }, [pages, notebook.templateId, isLoading, loadError]);

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
    if (targetPage.__unloaded) return ensurePage(targetPage.id).then(page => page ? applyBatchUpdatePage(updates, page.id, options) : false);
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
    if (historySession.getSnapshot().busy || pagesRef.current.find(page => page.id === pageId)?.__unloaded) {
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
      const completePage = await ensurePage(currentPage.id);
      const dataUrl = await renderPageToCanvasDataUrl(completePage, notebook.templateId);
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
        const currentPage = await ensurePage(targetPageId);
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
      resetNavigationRef.current();
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
      return live && !live.__unloaded ? editorPageView({ ...page, strokes: live.strokes, textElements: live.textElements, imageElements: live.imageElements }) : pageSummary(page);
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
      const candidate = pagesRef.current[targetIdx];
      const targetPage = candidate.__unloaded ? await ensurePage(candidate.id) : candidate;
      if (!targetPage) return false;
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
    const needsLoad = pagesRef.current.find(page => page.id === entry?.pageId)?.__unloaded;
    const result = busy || isStructural || needsLoad ? historySession.run(perform) : perform();
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
        if (isPinchingActiveRef.current || navigationRef.current.pinch) return;
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
    const candidate = pagesRef.current[pageIndex];
    let sourcePage;
    try { sourcePage = candidate?.__unloaded ? await ensurePage(candidate.id) : candidate; }
    catch (_) { alert(t('localSavePageChangeFailed')); return false; }
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
    if (historySession.getSnapshot().busy || pagesRef.current.find(page => page.id === pageId)?.__unloaded) return historySession.run(() => handleChangeTemplateNow(templateId, pageId)).catch(() => { alert(t('localSavePageChangeFailed')); return false; });
    return handleChangeTemplateNow(templateId, pageId);
  };
  const handleChangeTemplateNow = (templateId, pageId) => {
    const target = pagesRef.current.find(page => page.id === pageId);
    if (target?.__unloaded) return ensurePage(pageId).then(page => page ? handleChangeTemplateNow(templateId, pageId) : false);
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
    if (historySession.getSnapshot().busy || pagesRef.current.find(page => page.id === pageId)?.__unloaded) return historySession.run(() => handleToggleFavoritePageNow(pageId)).catch(() => { alert(t('localSavePageChangeFailed')); return false; });
    return handleToggleFavoritePageNow(pageId);
  };
  const handleToggleFavoritePageNow = pageId => {
    const target = pagesRef.current.find(page => page.id === pageId);
    if (target?.__unloaded) return ensurePage(pageId).then(page => page ? handleToggleFavoritePageNow(pageId) : false);
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
        onZoomIn={() => changeToolbarZoom(Math.min(3.5, Number((zoomRef.current + 0.15).toFixed(2))))}
        onZoomOut={() => changeToolbarZoom(Math.max(0.35, Number((zoomRef.current - 0.15).toFixed(2))))}
        onResetZoom={() => changeToolbarZoom(1.0)}
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
          <ThumbnailSidebar templateId={notebook.templateId}
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
          onTouchCancel={handleStageTouchCancel}
        >
          {/* Floating Gesture Toast for Two-Finger Tap Undo */}
          {gestureToast && (
            <div className="bn-gesture-toast">
              <RotateCcw size={16} className="text-amber-400 animate-spin" />
              <span>{gestureToast}</span>
            </div>
          )}

          {currentPage?.__unloaded && (scrollDirection !== 'vertical' || isWhiteboardPage(currentPage, notebook.templateId)) ? (
            currentPage.pdfLazyRaster && cachedPagePreview(currentPage,notebook.templateId) ? (
              <div ref={stageContentRef} className="bn-horizontal-page-container flex items-center justify-center min-w-full min-h-full">
                <div className="bn-paper-sheet" style={{width:(currentPage.pageWidth||1200)*zoom,height:(currentPage.pageHeight||1600)*zoom}}>
                  <img className="bn-pdf-ready-page" src={cachedPagePreview(currentPage,notebook.templateId)} alt={t('page')+' '+(currentPageIndex+1)}
                    decoding="sync" style={{width:'100%',height:'100%',objectFit:'fill'}} />
                  {pageLoadError===currentPage.id && <button style={{position:'absolute',bottom:12,right:12}}
                    onClick={()=>{setPageLoadError(null);ensurePage(currentPage.id).catch(()=>setPageLoadError(currentPage.id));}}>{t('localLoadRetry')}</button>}
                </div>
              </div>
            ) : <div className="bn-loading-screen" role="status">{pageLoadError === currentPage.id ? <button onClick={() => { setPageLoadError(null); ensurePage(currentPage.id).catch(() => setPageLoadError(currentPage.id)); }}>{t('localLoadRetry')}</button> : t('loadingApp')}</div>
          ) : currentPage && isWhiteboardPage(currentPage, notebook.templateId) ? (
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
                const isMounted = wantedPageIds.has(p.id) && !p.__unloaded;
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
                        rasterBudget={(idx === currentPageIndex ? 96 : 12) * 1024 * 1024}
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
                        {(cachedPagePreview(p,notebook.templateId) || p.pdfPageImage) ? (
                          <img 
                            src={cachedPagePreview(p,notebook.templateId) || p.pdfPageImage}
                            alt={`${t('page', 'หน้า')} ${idx + 1}`} 
                            style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.95 }}
                            loading={Math.abs(idx-currentPageIndex)<=4 ? "eager" : "lazy"}
                            decoding="sync"
                          />
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '15px', fontWeight: 600 }}>
                            {pageLoadError === p.id ? <button onClick={() => { setPageLoadError(null); ensurePage(p.id).catch(() => setPageLoadError(p.id)); }}>{t('localLoadRetry')}</button> : <>{t('page', 'หน้า')} {idx + 1}</>}
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
        loadPages={loadExportPages}
        loadPdfPage={loadExportPdfPage}
        loadPage={loadExportPage}
        loadBNote={loadBNoteExport}
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
