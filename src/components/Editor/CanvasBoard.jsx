import React, { useRef, useEffect, useState, useCallback } from 'react';
import { renderPaperBackground } from '../../utils/paperRenderer';
import { 
  renderStroke, 
  renderAllStrokes, 
  classifyGeometricShape,
  generateVectorShapePoints,
  renderShapePreview,
  isStrokeHitByEraser, 
  eraseStrokesPrecision, 
  detectScribble,
  isPointInPolygon,
  isStrokeSelectedByLasso,
  getStrokeBounds,
  transformStroke
} from '../../utils/inkingEngine';
import { PAPER_TEMPLATES } from '../../data/templates';
import { 
  Trash2, 
  Sparkles, 
  Scissors, 
  ClipboardPaste, 
  X, 
  Check,
  Crop,
  Move,
  Copy,
  Palette,
  LassoSelect,
  Maximize2,
  ZoomIn,
  ImagePlus
} from 'lucide-react';
import { ImageCropModal } from './ImageCropModal';
import { SnipModal } from './SnipModal';

const PAGE_WIDTH = 1200;
const PAGE_HEIGHT = 1600;

export const CanvasBoard = ({
  page,
  templateId,
  activeTool,
  activeColor,
  activeWidth,
  activeShape,
  penNib = 'fountain',
  isTapered = true,
  usePressure = true,
  pressureSensitivity = 'medium',
  eraserMode = 'precision',
  scribbleToErase = true,
  penOnly = true,
  zoom = 1.0,
  onZoomChange,
  onToolChange,
  onBatchUpdatePage,
  onStrokesChange,
  onTextElementsChange,
  onImageElementsChange,
  onSnipComplete,
  onUndo
}) => {
  const containerRef = useRef(null);
  const sheetRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const staticCanvasRef = useRef(null);
  const activeCanvasRef = useRef(null);

  // Inking state
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef([]);
  const startPointRef = useRef(null);
  const [activeTextId, setActiveTextId] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null);

  // Snipping Tool State
  const isSnippingRef = useRef(false);
  const snipStartRef = useRef(null);
  const [snipBox, setSnipBox] = useState(null); // { x, y, width, height }
  const [lastSnippedImage, setLastSnippedImage] = useState(null); // { dataUrl, width, height }
  const [snipModalData, setSnipModalData] = useState(null); // Instant interactive Snip & Crop Modal
  const [showSnipPreview, setShowSnipPreview] = useState(false); // Pre-paste preview modal
  const [snipResizeW, setSnipResizeW] = useState(0);
  const [snipResizeH, setSnipResizeH] = useState(0);

  // Image Element Interactive Drag, Resize, Crop State
  const imageDragRef = useRef({
    isDragging: false,
    isResizing: false,
    handle: null,
    startX: 0,
    startY: 0,
    initialImg: null
  });
  const [cropModalImg, setCropModalImg] = useState(null);
  const [imageTransformOffset, setImageTransformOffset] = useState(null); // { id, x, y, width, height }

  // Long-Press Floating Paste Menu State & Timer
  const [floatingPasteMenu, setFloatingPasteMenu] = useState(null); // { x, y, canvasX, canvasY }
  const longPressTimerRef = useRef(null);
  const longPressStartPosRef = useRef({ clientX: 0, clientY: 0, canvasX: 0, canvasY: 0 });

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  // Draw & Hold QuickShape State & Timer
  const holdTimerRef = useRef(null);
  const heldShapeRef = useRef(null);
  const lastHoldPosRef = useRef({ x: 0, y: 0 });

  // Lasso Selection Tool State (Precision Standard)
  const isLassoingRef = useRef(false);
  const lassoPointsRef = useRef([]);
  const [lassoSelection, setLassoSelection] = useState(null); // { strokeIndices, textIds, imageIds, bbox: { x, y, width, height } }
  const [showLassoColorPicker, setShowLassoColorPicker] = useState(false);
  const lassoBoxRef = useRef(null);
  const lassoRafRef = useRef(null);
  const lassoDragRef = useRef({
    isDragging: false,
    isResizing: false,
    handle: null,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    initialBbox: null,
    initialStrokes: [],
    selectedStrokes: [],
    unselectedStrokes: [],
    initialTexts: [],
    initialImages: []
  });

  // Touch Panning, Pinch-to-Zoom & Inertial Momentum Scrolling State
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const touchVelocityRef = useRef({ vx: 0, vy: 0, lastX: 0, lastY: 0, lastTime: 0 });
  const momentumAnimRef = useRef(null);
  const touchStartDataRef = useRef(null);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Toast indicator for gestures
  const [gestureToast, setGestureToast] = useState('');
  const toastTimeoutRef = useRef(null);

  const strokes = page?.strokes || [];
  const textElements = page?.textElements || [];
  const imageElements = page?.imageElements || [];

  // Ref tracking latest committed strokes to prevent stale snapshots during rapid lasso interactions
  const latestStrokesRef = useRef(strokes);
  useEffect(() => {
    latestStrokesRef.current = strokes;
  }, [strokes]);

  const canvasWidth = page?.pageWidth || PAGE_WIDTH;
  const canvasHeight = page?.pageHeight || PAGE_HEIGHT;

  const showToast = (msg) => {
    setGestureToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setGestureToast(''), 1800);
  };

  const getDpr = () => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  // 1. Render Background Canvas with High-DPI
  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return;
    const dpr = getDpr();
    bgCanvas.width = canvasWidth * dpr;
    bgCanvas.height = canvasHeight * dpr;

    const ctx = bgCanvas.getContext('2d');
    ctx.scale(dpr, dpr);

    if (page?.pdfPageImage) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      };
      img.src = page.pdfPageImage;
    } else {
      const tmpl = PAPER_TEMPLATES.find(t => t.id === (page?.templateId || templateId)) || PAPER_TEMPLATES[0];
      renderPaperBackground(ctx, canvasWidth, canvasHeight, tmpl);
    }
  }, [page?.id, page?.pdfPageImage, page?.templateId, templateId, canvasWidth, canvasHeight]);

  // 2. Render Static Strokes Layer with High-DPI
  useEffect(() => {
    const staticCanvas = staticCanvasRef.current;
    if (!staticCanvas) return;
    const dpr = getDpr();
    staticCanvas.width = canvasWidth * dpr;
    staticCanvas.height = canvasHeight * dpr;

    const ctx = staticCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    renderAllStrokes(ctx, strokes);
  }, [page?.id, strokes, canvasWidth, canvasHeight]);

  // Initialize Active Canvas dimensions
  useEffect(() => {
    const activeCanvas = activeCanvasRef.current;
    if (!activeCanvas) return;
    const dpr = getDpr();
    activeCanvas.width = canvasWidth * dpr;
    activeCanvas.height = canvasHeight * dpr;
  }, [canvasWidth, canvasHeight]);

  // Transform client coordinates to canvas internal coordinates
  const getCanvasCoordinates = useCallback((e) => {
    const activeCanvas = activeCanvasRef.current;
    if (!activeCanvas) return { x: 0, y: 0, pressure: 0.5 };

    const rect = activeCanvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    return { x, y, pressure };
  }, [canvasWidth, canvasHeight]);

  // Touch Start: Strict Isolation between Pen, Snip, Touch Panning & Pinch-to-Zoom
  const handleTouchStart = (e) => {
    // If multiple touches detected (2 or more fingers), cancel any active in-progress drawing immediately
    if (e.touches.length >= 2) {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        currentPointsRef.current = [];
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        const activeCanvas = activeCanvasRef.current;
        if (activeCanvas) {
          const dpr = getDpr();
          const ctx = activeCanvas.getContext('2d');
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        }
      }
      isPanningRef.current = false;
      if (momentumAnimRef.current) {
        cancelAnimationFrame(momentumAnimRef.current);
        momentumAnimRef.current = null;
      }
      // Release any pointer capture on active canvas so multi-touch gestures work cleanly
      try { activeCanvasRef.current?.releasePointerCapture(); } catch (_) {}
      // DO NOT stopPropagation! Let touch bubble freely to NoteEditor for pinch-zoom and 2-finger tap undo!
      return;
    }

    // If drawing with pen or snipping, do not pan/scroll
    if ((isDrawingRef.current && e.touches.length < 2) || isSnippingRef.current || activeTool === 'snip') {
      isPanningRef.current = false;
      return;
    }

    // Cancel any active momentum scroll
    if (momentumAnimRef.current) {
      cancelAnimationFrame(momentumAnimRef.current);
      momentumAnimRef.current = null;
    }

    // Dismiss floating paste menu if open
    if (floatingPasteMenu) {
      setFloatingPasteMenu(null);
    }

    // Single Finger Touch Scrolling (STRICTLY limited to 'hand' tool)
    // Prevents resting palm while using pen/highlighter/eraser from accidentally panning the canvas
    if (e.touches.length === 1 && activeTool === 'hand' && !isDrawingRef.current && !isSnippingRef.current) {
      const scrollParent = containerRef.current?.closest('.bn-editor-canvas-stage') || window;
      isPanningRef.current = true;
      const t = e.touches[0];
      panStartRef.current = {
        x: t.clientX,
        y: t.clientY,
        scrollLeft: scrollParent.scrollLeft ?? 0,
        scrollTop: scrollParent.scrollTop ?? 0
      };

      touchVelocityRef.current = {
        vx: 0,
        vy: 0,
        lastX: t.clientX,
        lastY: t.clientY,
        lastTime: performance.now()
      };
    }
  };

  // Touch Move: Handle Single Finger Panning (2 fingers bubble to Stage for pinch-to-zoom)
  const handleTouchMove = (e) => {
    // Two or more fingers: let Stage handle pinch-to-zoom cleanly without interference
    if (e.touches.length >= 2) {
      isPanningRef.current = false;
      return;
    }

    // If tool is not 'hand' or pen is drawing or snipping, DO NOT SCROLL AT ALL!
    if (activeTool !== 'hand' || isDrawingRef.current || isSnippingRef.current || activeTool === 'snip') {
      isPanningRef.current = false;
      return;
    }

    // Single Finger Pan
    if (isPanningRef.current && e.touches.length === 1) {
      const scrollParent = containerRef.current?.closest('.bn-editor-canvas-stage');
      if (scrollParent) {
        const t = e.touches[0];
        const now = performance.now();
        const dt = Math.max(1, now - touchVelocityRef.current.lastTime);

        const deltaX = t.clientX - panStartRef.current.x;
        const deltaY = t.clientY - panStartRef.current.y;

        scrollParent.scrollLeft = panStartRef.current.scrollLeft - deltaX;
        scrollParent.scrollTop = panStartRef.current.scrollTop - deltaY;

        // Calculate velocity (pixels per ms)
        const vx = (t.clientX - touchVelocityRef.current.lastX) / dt;
        const vy = (t.clientY - touchVelocityRef.current.lastY) / dt;

        touchVelocityRef.current = {
          vx,
          vy,
          lastX: t.clientX,
          lastY: t.clientY,
          lastTime: now
        };
      }
    }
  };

  // Touch End: Handle Inertial Momentum Scrolling (Never stops propagation for multi-touch)
  const handleTouchEnd = (e) => {
    // If multi-touch in progress, cancel panning and allow touchend to bubble cleanly to NoteEditor
    if (e.touches.length >= 2) {
      isPanningRef.current = false;
      return;
    }

    // Single Finger Pan End (Momentum Scrolling)
    if (isPanningRef.current) {
      isPanningRef.current = false;
      const scrollParent = containerRef.current?.closest('.bn-editor-canvas-stage');
      if (scrollParent) {
        let { vx, vy } = touchVelocityRef.current;
        const speed = Math.hypot(vx, vy);

        if (speed > 0.2) {
          const friction = 0.95;
          const minVelocity = 0.05;

          const applyMomentum = () => {
            vx *= friction;
            vy *= friction;

            scrollParent.scrollLeft -= vx * 16;
            scrollParent.scrollTop -= vy * 16;

            if (Math.hypot(vx, vy) > minVelocity) {
              momentumAnimRef.current = requestAnimationFrame(applyMomentum);
            } else {
              momentumAnimRef.current = null;
            }
          };

          momentumAnimRef.current = requestAnimationFrame(applyMomentum);
        }
      }
    }
  };

  // Pointer Down (Pen / Mouse / Touch)
  const handlePointerDown = (e) => {
    // Dismiss floating paste menu if clicking outside it
    if (floatingPasteMenu) {
      setFloatingPasteMenu(null);
    }

    // 1. Strict Palm Rejection:
    // When palm rejection is active (penOnly), reject finger touch & palm contacts completely
    // Calling preventDefault() prevents Chromium from synthesizing mouse events (mousedown/mousemove)
    if (penOnly && e.pointerType === 'touch') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Reject large palm contacts (Windows sends contact geometry e.width, e.height)
    if (penOnly && e.pointerType !== 'pen' && (e.width > 25 || e.height > 25)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // STRICT: When pen touches the screen, halt any scrolling immediately!
    if (e.pointerType === 'pen') {
      isPanningRef.current = false;
      if (momentumAnimRef.current) {
        cancelAnimationFrame(momentumAnimRef.current);
        momentumAnimRef.current = null;
      }
    }

    if (activeTool === 'hand') return;

    // Deselect Lasso if clicking outside its bounding box
    if (selectedImageId) {
      setSelectedImageId(null);
    }

    const coords = getCanvasCoordinates(e);

    // 2. Long-Press Setup for Floating Paste Menu (Touch or Pen stationary hold ~450ms)
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressStartPosRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      canvasX: coords.x,
      canvasY: coords.y
    };

    if (activeTool !== 'hand' && activeTool !== 'snip' && activeTool !== 'lasso') {
      longPressTimerRef.current = setTimeout(() => {
        if (!isSnippingRef.current && !isLassoingRef.current && !imageDragRef.current.isDragging) {
          // Cancel active stroke if long press was triggered
          if (isDrawingRef.current) {
            isDrawingRef.current = false;
            currentPointsRef.current = [];
            const activeCanvas = activeCanvasRef.current;
            if (activeCanvas) {
              const dpr = getDpr();
              const ctx = activeCanvas.getContext('2d');
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            }
          }
          setFloatingPasteMenu({
            x: coords.x,
            y: coords.y,
            canvasX: coords.x,
            canvasY: coords.y
          });
        }
      }, 450);
    }

    if (lassoSelection) {
      const { x, y, width, height } = lassoSelection.bbox;
      if (coords.x < x || coords.x > x + width || coords.y < y || coords.y > y + height) {
        setLassoSelection(null);
        setShowLassoColorPicker(false);
      }
    }

    // Snipping Tool: start dragging rectangular crop marquee (Prevent screen scroll)
    if (activeTool === 'snip') {
      e.preventDefault();
      e.stopPropagation();
      isPanningRef.current = false;
      if (momentumAnimRef.current) {
        cancelAnimationFrame(momentumAnimRef.current);
        momentumAnimRef.current = null;
      }
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      isSnippingRef.current = true;
      snipStartRef.current = coords;
      setSnipBox({ x: coords.x, y: coords.y, width: 0, height: 0 });
      return;
    }

    // Lasso Tool: start drawing freeform marquee
    if (activeTool === 'lasso') {
      e.preventDefault();
      e.stopPropagation();
      isPanningRef.current = false;
      if (momentumAnimRef.current) {
        cancelAnimationFrame(momentumAnimRef.current);
        momentumAnimRef.current = null;
      }

      // Selection behavior: If an existing lasso selection exists,
      // check if the click is INSIDE the bbox → start DRAG, not new lasso
      if (lassoSelection) {
        const { x, y, width, height } = lassoSelection.bbox;
        if (coords.x >= x && coords.x <= x + width && coords.y >= y && coords.y <= y + height) {
          // Click is inside existing selection → delegate to drag handler
          return;
        } else {
          // Click is outside → deselect and start new lasso
          setLassoSelection(null);
          setShowLassoColorPicker(false);
        }
      }

      // Start new freeform lasso drawing
      isLassoingRef.current = true;
      lassoPointsRef.current = [coords];
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      return;
    }

    // Text tool
    if (activeTool === 'text') {
      const newText = {
        id: `txt-${Date.now()}`,
        x: coords.x,
        y: coords.y,
        text: 'พิมพ์ข้อความที่นี่...',
        fontSize: 20,
        fontFamily: 'Inter',
        color: activeColor,
        bold: false
      };
      onTextElementsChange([...textElements, newText]);
      setActiveTextId(newText.id);
      return;
    }

    // Drawing / Erasing: STRICT preventDefault to lock page scroll completely while pen writes
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    isDrawingRef.current = true;
    strokeStartTimeRef.current = Date.now();
    heldShapeRef.current = null;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    startPointRef.current = coords;
    currentPointsRef.current = [coords];

    if (activeTool === 'eraser') {
      handleEraserAction(coords);
      return;
    }

    const activeCanvas = activeCanvasRef.current;
    if (!activeCanvas) return;
    const dpr = getDpr();
    const ctx = activeCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      renderStroke(ctx, {
        tool: activeTool,
        color: activeColor,
        width: activeWidth,
        points: currentPointsRef.current,
        nibType: penNib,
        isTapered,
        usePressure,
        pressureSensitivity
      });
    }
  };

  // Pointer Move
  const handlePointerMove = (e) => {
    // 1. Long-Press Movement Check: Cancel long-press timer if pointer moved > 10px
    if (longPressTimerRef.current) {
      const dist = Math.hypot(
        e.clientX - longPressStartPosRef.current.clientX,
        e.clientY - longPressStartPosRef.current.clientY
      );
      if (dist > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // 2. Strict Palm Rejection on Move
    if (penOnly && e.pointerType === 'touch') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (penOnly && e.pointerType !== 'pen' && (e.width > 25 || e.height > 25)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // 3. Strict Scroll Lock during Active Inking: Prevent any page panning while pen is down
    if (isDrawingRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isSnippingRef.current && snipStartRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isPanningRef.current = false;
      const currentCoords = getCanvasCoordinates(e);
      const x = Math.min(snipStartRef.current.x, currentCoords.x);
      const y = Math.min(snipStartRef.current.y, currentCoords.y);
      const w = Math.abs(currentCoords.x - snipStartRef.current.x);
      const h = Math.abs(currentCoords.y - snipStartRef.current.y);
      setSnipBox({ x, y, width: w, height: h });
      return;
    }

    // Lasso Tool: record loop and render smooth dashed line with translucent fill
    if (activeTool === 'lasso' && isLassoingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      const coords = getCanvasCoordinates(e);
      lassoPointsRef.current.push(coords);

      const activeCanvas = activeCanvasRef.current;
      if (activeCanvas) {
        const dpr = getDpr();
        const ctx = activeCanvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2.0;
        ctx.setLineDash([7, 4]);
        ctx.beginPath();
        ctx.moveTo(lassoPointsRef.current[0].x, lassoPointsRef.current[0].y);
        for (let i = 1; i < lassoPointsRef.current.length; i++) {
          ctx.lineTo(lassoPointsRef.current[i].x, lassoPointsRef.current[i].y);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
        ctx.fill();
        ctx.restore();
      }
      return;
    }

    if (!isDrawingRef.current) return;
    if (penOnly && e.pointerType === 'touch') return;

    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

    if (activeTool === 'eraser') {
      for (const ev of events) {
        const coords = getCanvasCoordinates(ev);
        handleEraserAction(coords);
      }
      return;
    }

    const activeCanvas = activeCanvasRef.current;
    if (!activeCanvas) return;
    const dpr = getDpr();
    const ctx = activeCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // DRAW & HOLD QUICKSHAPE DYNAMIC RESIZE:
    // If shape is already held and user is still dragging pen, dynamically resize/rotate the shape
    if (activeTool === 'pen' && heldShapeRef.current) {
      const currentCoords = getCanvasCoordinates(e);
      heldShapeRef.current.endPt = currentCoords;
      if (heldShapeRef.current.type === 'circle' || heldShapeRef.current.type === 'ellipse') {
        const radX = Math.abs(currentCoords.x - heldShapeRef.current.startPt.x) / 2;
        const radY = Math.abs(currentCoords.y - heldShapeRef.current.startPt.y) / 2;
        heldShapeRef.current.rx = radX;
        heldShapeRef.current.ry = radY;
      } else if (heldShapeRef.current.type === 'triangle') {
        const s = heldShapeRef.current;
        const center = s.center || { x: (s.startPt.x + s.endPt.x) / 2, y: (s.startPt.y + s.endPt.y) / 2 };
        if (!s.origVertices && s.vertices) {
          s.origVertices = s.vertices.map(pt => ({ ...pt }));
        }
        if (!s.initDist) {
          const holdX = s.holdPt ? s.holdPt.x : currentCoords.x;
          const holdY = s.holdPt ? s.holdPt.y : currentCoords.y;
          s.initDist = Math.max(15, Math.hypot(holdX - center.x, holdY - center.y));
          s.initAngle = Math.atan2(holdY - center.y, holdX - center.x);
        }

        const currDist = Math.hypot(currentCoords.x - center.x, currentCoords.y - center.y);
        const scale = Math.max(0.08, currDist / Math.max(15, s.initDist));

        // Subtle rotation snap: only rotate if moved > 9 degrees (0.16 rad)
        const currAngle = Math.atan2(currentCoords.y - center.y, currentCoords.x - center.x);
        let dAngle = currAngle - (s.initAngle || 0);
        if (Math.abs(dAngle) < 0.16) dAngle = 0;

        const cos = Math.cos(dAngle);
        const sin = Math.sin(dAngle);

        if (s.origVertices && s.origVertices.length >= 3) {
          s.vertices = s.origVertices.map(v => {
            const dx = v.x - center.x;
            const dy = v.y - center.y;
            return {
              x: center.x + (dx * cos - dy * sin) * scale,
              y: center.y + (dx * sin + dy * cos) * scale
            };
          });
        }
      } else if (heldShapeRef.current.type === 'polyline' && heldShapeRef.current.vertices) {
        heldShapeRef.current.vertices[heldShapeRef.current.vertices.length - 1] = currentCoords;
      }
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      renderShapePreview(ctx, heldShapeRef.current, activeColor, activeWidth);
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      for (const ev of events) {
        const coords = getCanvasCoordinates(ev);
        currentPointsRef.current.push(coords);
      }
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      renderStroke(ctx, {
        tool: activeTool,
        color: activeColor,
        width: activeWidth,
        points: currentPointsRef.current,
        nibType: penNib,
        isTapered,
        usePressure,
        pressureSensitivity
      });

      // QuickShape Hold Detection: 380ms pause check
      if (activeTool === 'pen') {
        const latestCoord = currentPointsRef.current[currentPointsRef.current.length - 1];
        const distFromLastHold = Math.hypot(latestCoord.x - lastHoldPosRef.current.x, latestCoord.y - lastHoldPosRef.current.y);

        if (distFromLastHold > 8) {
          lastHoldPosRef.current = latestCoord;
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          holdTimerRef.current = setTimeout(() => {
            if (!isDrawingRef.current || heldShapeRef.current) return;
            const recognized = classifyGeometricShape(currentPointsRef.current);
            if (recognized) {
              const holdCoord = currentPointsRef.current[currentPointsRef.current.length - 1];
              recognized.holdPt = { ...holdCoord };
              const cx = (recognized.startPt.x + recognized.endPt.x) / 2;
              const cy = (recognized.startPt.y + recognized.endPt.y) / 2;
              recognized.center = recognized.center || { x: cx, y: cy };
              recognized.initDist = Math.max(15, Math.hypot(holdCoord.x - recognized.center.x, holdCoord.y - recognized.center.y));
              recognized.initAngle = Math.atan2(holdCoord.y - recognized.center.y, holdCoord.x - recognized.center.x);
              if (recognized.vertices) {
                recognized.origVertices = recognized.vertices.map(pt => ({ ...pt }));
              }
              heldShapeRef.current = recognized;
              showToast(`ปรับรูปทรงอัตโนมัติ: ${recognized.label} 📐`);
              ctx.clearRect(0, 0, canvasWidth, canvasHeight);
              renderShapePreview(ctx, recognized, activeColor, activeWidth);
            }
          }, 380);
        }
      }
    } else if (activeTool === 'shape') {
      // Standalone Shape Tool Live Preview
      const currentCoords = getCanvasCoordinates(e);
      const shapeInfo = {
        type: activeShape || 'rectangle',
        startPt: startPointRef.current,
        endPt: currentCoords
      };
      if (activeShape === 'line') {
        const rawAngle = Math.atan2(currentCoords.y - startPointRef.current.y, currentCoords.x - startPointRef.current.x);
        const d = Math.hypot(currentCoords.x - startPointRef.current.x, currentCoords.y - startPointRef.current.y);
        const snapped = snapAngle(rawAngle, 7);
        shapeInfo.endPt = {
          x: startPointRef.current.x + d * Math.cos(snapped),
          y: startPointRef.current.y + d * Math.sin(snapped)
        };
      } else if (activeShape === 'triangle') {
        const x0 = Math.min(startPointRef.current.x, currentCoords.x);
        const y0 = Math.min(startPointRef.current.y, currentCoords.y);
        const x1 = Math.max(startPointRef.current.x, currentCoords.x);
        const y1 = Math.max(startPointRef.current.y, currentCoords.y);
        shapeInfo.vertices = [
          { x: (x0 + x1) / 2, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 },
          { x: (x0 + x1) / 2, y: y0 }
        ];
      }
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      renderShapePreview(ctx, shapeInfo, activeColor, activeWidth);
    }
  };

  // Pointer Up
  const handlePointerUp = (e) => {
    // 1. Clear Long-Press Timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // 2. Strict Palm Rejection on Up
    if (penOnly && e.pointerType === 'touch') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (penOnly && e.pointerType !== 'pen' && (e.width > 25 || e.height > 25)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Snipping Tool Finalize Crop
    if (isSnippingRef.current && snipBox) {
      isSnippingRef.current = false;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}

      if (snipBox.width > 20 && snipBox.height > 20) {
        extractSnipImage(snipBox);
      }
      setSnipBox(null);
      snipStartRef.current = null;
      return;
    }

    // Lasso Tool Finalize Selection
    if (activeTool === 'lasso' && isLassoingRef.current) {
      isLassoingRef.current = false;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}

      const activeCanvas = activeCanvasRef.current;
      if (activeCanvas) {
        const dpr = getDpr();
        const ctx = activeCanvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      }

      const loop = [...lassoPointsRef.current];
      if (loop.length > 5) {
        // Close the loop if end is not at start
        if (Math.hypot(loop[0].x - loop[loop.length - 1].x, loop[0].y - loop[loop.length - 1].y) > 4) {
          loop.push({ x: loop[0].x, y: loop[0].y });
        }

        let lMinX = Infinity, lMaxX = -Infinity, lMinY = Infinity, lMaxY = -Infinity;
        for (const p of loop) {
          lMinX = Math.min(lMinX, p.x);
          lMaxX = Math.max(lMaxX, p.x);
          lMinY = Math.min(lMinY, p.y);
          lMaxY = Math.max(lMaxY, p.y);
        }
        const loopBbox = { minX: lMinX, maxX: lMaxX, minY: lMinY, maxY: lMaxY };

        const selectedStrokes = [];
        let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;

        strokes.forEach((s, idx) => {
          if (isStrokeSelectedByLasso(s, loop, loopBbox)) {
            selectedStrokes.push(idx);
            const b = getStrokeBounds(s);
            bMinX = Math.min(bMinX, b.minX);
            bMaxX = Math.max(bMaxX, b.maxX);
            bMinY = Math.min(bMinY, b.minY);
            bMaxY = Math.max(bMaxY, b.maxY);
          }
        });

        const selectedTexts = [];
        textElements.forEach(t => {
          const tW = 120;
          const tH = (t.fontSize || 20) * 1.6;
          const inside = isPointInPolygon({ x: t.x, y: t.y }, loop) ||
                         isPointInPolygon({ x: t.x + tW / 2, y: t.y + tH / 2 }, loop);
          if (inside) {
            selectedTexts.push(t.id);
            bMinX = Math.min(bMinX, t.x);
            bMaxX = Math.max(bMaxX, t.x + tW);
            bMinY = Math.min(bMinY, t.y);
            bMaxY = Math.max(bMaxY, t.y + tH);
          }
        });

        const selectedImgs = [];
        imageElements.forEach(img => {
          const inside = isPointInPolygon({ x: img.x + img.width / 2, y: img.y + img.height / 2 }, loop) ||
                         isPointInPolygon({ x: img.x, y: img.y }, loop);
          if (inside) {
            selectedImgs.push(img.id);
            bMinX = Math.min(bMinX, img.x);
            bMaxX = Math.max(bMaxX, img.x + img.width);
            bMinY = Math.min(bMinY, img.y);
            bMaxY = Math.max(bMaxY, img.y + img.height);
          }
        });

        const totalCount = selectedStrokes.length + selectedTexts.length + selectedImgs.length;
        if (totalCount > 0) {
          setLassoSelection({
            strokeIndices: selectedStrokes,
            textIds: selectedTexts,
            imageIds: selectedImgs,
            bbox: {
              x: bMinX - 12,
              y: bMinY - 12,
              width: Math.max(48, bMaxX - bMinX + 24),
              height: Math.max(48, bMaxY - bMinY + 24)
            }
          });
          showToast(`เลือก ${totalCount} รายการด้วย Lasso 🔗`);
        } else {
          setLassoSelection(null);
        }
      } else {
        setLassoSelection(null);
      }
      lassoPointsRef.current = [];
      return;
    }

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}

    const activeCanvas = activeCanvasRef.current;
    if (!activeCanvas) return;
    const dpr = getDpr();
    const ctx = activeCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (activeTool === 'pen') {
      // 1. SMART Scribble-to-Erase:
      // Evaluated first so scribbling vigorously over text always erases immediately
      const scribble = detectScribble(currentPointsRef.current, strokes, scribbleToErase);

      if (scribble && scribble.isScribble && scribble.hitCount > 0) {
        // Immediately clear hardware scratch canvas so scribble line vanishes from screen
        const activeCanvas = activeCanvasRef.current;
        if (activeCanvas) {
          const dpr = getDpr();
          const ctx = activeCanvas.getContext('2d');
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        }
        heldShapeRef.current = null;
        onStrokesChange(scribble.remainingStrokes);
        showToast(`ขยี้ลบ ${scribble.hitCount} เส้นแล้ว! (Scribble Erased) 🪄`);
        currentPointsRef.current = [];
        startPointRef.current = null;
        return;
      }

      // 2. Commit Draw & Hold recognized shape
      if (heldShapeRef.current) {
        const shapePts = generateVectorShapePoints(heldShapeRef.current, penNib);
        if (shapePts && shapePts.length > 0) {
          const shapeStroke = {
            tool: 'pen',
            color: activeColor,
            width: activeWidth,
            points: shapePts,
            nibType: penNib,
            isTapered: false
          };
          onStrokesChange([...strokes, shapeStroke]);
        }
        heldShapeRef.current = null;
        currentPointsRef.current = [];
        startPointRef.current = null;
        return;
      }

      // Normal stroke (or wavy/curly line where no underlying stroke exists)
      if (currentPointsRef.current.length > 0) {
        const newStroke = {
          tool: 'pen',
          color: activeColor,
          width: activeWidth,
          points: [...currentPointsRef.current],
          nibType: penNib,
          isTapered,
          usePressure,
          pressureSensitivity
        };
        onStrokesChange([...strokes, newStroke]);
      }
    } else if (activeTool === 'highlighter') {
      if (currentPointsRef.current.length > 0) {
        const newStroke = {
          tool: 'highlighter',
          color: activeColor,
          width: activeWidth,
          points: [...currentPointsRef.current]
        };
        onStrokesChange([...strokes, newStroke]);
      }
    } else if (activeTool === 'shape' && startPointRef.current) {
      const endCoords = getCanvasCoordinates(e);
      const shapeInfo = {
        type: activeShape || 'rectangle',
        startPt: startPointRef.current,
        endPt: endCoords
      };
      if (activeShape === 'line') {
        const rawAngle = Math.atan2(endCoords.y - startPointRef.current.y, endCoords.x - startPointRef.current.x);
        const d = Math.hypot(endCoords.x - startPointRef.current.x, endCoords.y - startPointRef.current.y);
        const snapped = snapAngle(rawAngle, 7);
        shapeInfo.endPt = {
          x: startPointRef.current.x + d * Math.cos(snapped),
          y: startPointRef.current.y + d * Math.sin(snapped)
        };
      } else if (activeShape === 'triangle') {
        const x0 = Math.min(startPointRef.current.x, endCoords.x);
        const y0 = Math.min(startPointRef.current.y, endCoords.y);
        const x1 = Math.max(startPointRef.current.x, endCoords.x);
        const y1 = Math.max(startPointRef.current.y, endCoords.y);
        shapeInfo.vertices = [
          { x: (x0 + x1) / 2, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 },
          { x: (x0 + x1) / 2, y: y0 }
        ];
      }
      const shapePts = generateVectorShapePoints(shapeInfo, penNib);
      if (shapePts && shapePts.length > 0) {
        const shapeStroke = {
          tool: 'pen',
          color: activeColor,
          width: activeWidth,
          points: shapePts,
          nibType: penNib,
          isTapered: false
        };
        onStrokesChange([...strokes, shapeStroke]);
      }
    }

    currentPointsRef.current = [];
    startPointRef.current = null;
  };

  // Extract Snip Region into an Image Data URL (Snipping Tool Engine)
  const extractSnipImage = (box) => {
    const dpr = getDpr();
    const offCanvas = document.createElement('canvas');
    offCanvas.width = box.width * dpr;
    offCanvas.height = box.height * dpr;
    const offCtx = offCanvas.getContext('2d');

    if (bgCanvasRef.current) {
      offCtx.drawImage(
        bgCanvasRef.current,
        box.x * dpr, box.y * dpr, box.width * dpr, box.height * dpr,
        0, 0, box.width * dpr, box.height * dpr
      );
    }

    if (staticCanvasRef.current) {
      offCtx.drawImage(
        staticCanvasRef.current,
        box.x * dpr, box.y * dpr, box.width * dpr, box.height * dpr,
        0, 0, box.width * dpr, box.height * dpr
      );
    }

    const dataUrl = offCanvas.toDataURL('image/png');
    const snipObj = { 
      dataUrl, 
      width: Math.round(box.width), 
      height: Math.round(box.height),
      x: Math.round(box.x),
      y: Math.round(box.y),
      boxWidth: Math.round(box.width),
      boxHeight: Math.round(box.height)
    };

    setLastSnippedImage(snipObj);
    // 2. Immediately popup the interactive Snip & Crop Modal!
    setSnipModalData(snipObj);

    // Copy to BetterNote clipboard and system clipboard
    if (onSnipComplete) {
      onSnipComplete(dataUrl, box.width, box.height);
    }

    // Try copying to OS Clipboard
    try {
      offCanvas.toBlob((blob) => {
        if (blob && navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
        }
      });
    } catch (_) {}
  };

  // Confirm and place snippet onto current page with exact dragged dimensions, then auto-revert to pen tool
  const handleConfirmSnipPlacement = (dataUrl, width, height, posX, posY) => {
    const pasteW = width || (snipModalData?.boxWidth || 400);
    const pasteH = height || (snipModalData?.boxHeight || 300);
    const finalX = posX !== undefined 
      ? Math.min(canvasWidth - pasteW - 20, Math.max(20, posX)) 
      : (snipModalData?.x !== undefined ? snipModalData.x : 140);
    const finalY = posY !== undefined 
      ? Math.min(canvasHeight - pasteH - 20, Math.max(20, posY)) 
      : (snipModalData?.y !== undefined ? snipModalData.y : 160);

    const newImg = {
      id: `img-${Date.now()}`,
      src: dataUrl,
      x: Math.round(finalX),
      y: Math.round(finalY),
      width: Math.round(pasteW),
      height: Math.round(pasteH)
    };

    const newImages = [...imageElements, newImg];
    if (onBatchUpdatePage) {
      onBatchUpdatePage({ imageElements: newImages });
    } else if (onImageElementsChange) {
      onImageElementsChange(newImages);
    }

    setSnipModalData(null);
    setLastSnippedImage(null);
    setSelectedImageId(newImg.id);
    
    // 4. Automatically switch back to Pen tool so Snipping Tool does not stay active!
    if (onToolChange) onToolChange('pen');
    showToast('วางภาพลงในหน้านี้เรียบร้อย! 📋');
  };

  // Close Snip Modal and return to Pen tool
  const handleCloseSnipModal = () => {
    setSnipModalData(null);
    setLastSnippedImage(null);
    if (onToolChange) onToolChange('pen');
  };

  // Right-Click Context Menu: Show Floating Paste Menu at mouse / stylus coordinate
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const coords = getCanvasCoordinates(e);
    setFloatingPasteMenu({
      x: coords.x,
      y: coords.y,
      canvasX: coords.x,
      canvasY: coords.y
    });
  };

  // Execute Paste Image from System / Windows Clipboard
  const handleExecutePaste = async (posX, posY) => {
    setFloatingPasteMenu(null);
    let imgDataUrl = null;
    let imgWidth = 0;
    let imgHeight = 0;

    // 1. Electron Native Clipboard IPC (Windows Snipping Tool, Win+Shift+S, external image copy)
    if (window.electronAPI?.readClipboardImage) {
      try {
        const res = await window.electronAPI.readClipboardImage();
        if (res && res.success && res.dataUrl) {
          imgDataUrl = res.dataUrl;
          imgWidth = res.width || 0;
          imgHeight = res.height || 0;
        }
      } catch (err) {
        console.warn('Native clipboard read error:', err);
      }
    }

    // 2. Web Clipboard API Fallback
    if (!imgDataUrl && navigator.clipboard && navigator.clipboard.read) {
      try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find(type => type.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            imgDataUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            break;
          }
        }
      } catch (err) {
        console.warn('Web clipboard read error:', err);
      }
    }

    if (!imgDataUrl) {
      showToast('ไม่พบรูปภาพในคลิปบอร์ด (กรุณาคัดลอกภาพก่อน) 📋');
      return;
    }

    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || imgWidth || 400;
      let h = img.naturalHeight || imgHeight || 300;

      // Scale down if oversized (e.g. 4K screenshots) while preserving aspect ratio
      const maxDimension = 650;
      if (w > maxDimension || h > maxDimension) {
        const ratio = Math.min(maxDimension / w, maxDimension / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const targetX = posX !== undefined ? posX - w / 2 : (canvasWidth - w) / 2;
      const targetY = posY !== undefined ? posY - h / 2 : (canvasHeight - h) / 2;
      const clampedX = Math.max(20, Math.min(canvasWidth - w - 20, Math.round(targetX)));
      const clampedY = Math.max(20, Math.min(canvasHeight - h - 20, Math.round(targetY)));

      const newImg = {
        id: `img-${Date.now()}`,
        src: imgDataUrl,
        x: clampedX,
        y: clampedY,
        width: w,
        height: h
      };

      const newImages = [...imageElements, newImg];
      if (onBatchUpdatePage) {
        onBatchUpdatePage({ imageElements: newImages });
      } else if (onImageElementsChange) {
        onImageElementsChange(newImages);
      }
      setSelectedImageId(newImg.id);
      showToast('วางรูปภาพสำเร็จ! 📋✨');
    };
    img.src = imgDataUrl;
  };

  // Eraser Action
  const handleEraserAction = (eraserPoint) => {
    const eraserRadius = activeWidth * 4;

    if (eraserMode === 'precision') {
      const updatedStrokes = eraseStrokesPrecision(strokes, eraserPoint, eraserRadius);
      if (updatedStrokes.length !== strokes.length || JSON.stringify(updatedStrokes) !== JSON.stringify(strokes)) {
        onStrokesChange(updatedStrokes);
      }
    } else {
      const remainingStrokes = strokes.filter(
        stroke => !isStrokeHitByEraser(stroke, eraserPoint, eraserRadius)
      );
      if (remainingStrokes.length !== strokes.length) {
        onStrokesChange(remainingStrokes);
      }
    }
  };

  const handleTextChange = (id, newText) => {
    onTextElementsChange(
      textElements.map(t => (t.id === id ? { ...t, text: newText } : t))
    );
  };

  const handleTextDelete = (id) => {
    onTextElementsChange(textElements.filter(t => t.id !== id));
    setActiveTextId(null);
  };

  const handleImageDelete = (id) => {
    const remaining = imageElements.filter(img => img.id !== id);
    if (onBatchUpdatePage) {
      onBatchUpdatePage({ imageElements: remaining });
    } else if (onImageElementsChange) {
      onImageElementsChange(remaining);
    }
    if (selectedImageId === id) setSelectedImageId(null);
  };

  // 5. Image Element True Drag-and-Drop Handlers:
  // - Click to select without moving or sticking to mouse
  // - Press & Hold & Drag with threshold (> 4px) for 60fps GPU movement
  // - Release mouse/pen anywhere on window to drop and commit immediately
  const handleImagePointerDown = (e, img) => {
    // Ignore if clicking action buttons or handles
    if (e.target.closest('.bn-image-action-bar') || e.target.closest('.bn-image-resize-handle') || e.target.closest('.bn-image-delete-btn')) {
      return;
    }
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialImg = { ...img };
    const el = document.getElementById(`img-${img.id}`);

    setSelectedImageId(img.id);

    let hasDragged = false;
    let currentDx = 0;
    let currentDy = 0;

    const onPointerMove = (moveEv) => {
      const dx = (moveEv.clientX - startX) / zoom;
      const dy = (moveEv.clientY - startY) / zoom;

      // Enter dragging state only if moved beyond 4px threshold
      if (!hasDragged && Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY) > 4) {
        hasDragged = true;
        if (el) el.classList.add('bn-image-dragging');
      }

      if (hasDragged) {
        currentDx = dx;
        currentDy = dy;
        // Direct GPU hardware-accelerated transform without React re-render thrashing
        if (el) {
          el.style.transform = `translate3d(${dx * zoom}px, ${dy * zoom}px, 0)`;
        }
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (el) {
        el.classList.remove('bn-image-dragging');
        el.style.transform = '';
      }

      if (hasDragged) {
        const finalX = Math.round(initialImg.x + currentDx);
        const finalY = Math.round(initialImg.y + currentDy);

        const updatedImages = imageElements.map(it => 
          it.id === img.id ? { ...it, x: finalX, y: finalY } : it
        );

        if (onBatchUpdatePage) {
          onBatchUpdatePage({ imageElements: updatedImages });
        } else if (onImageElementsChange) {
          onImageElementsChange(updatedImages);
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Image Element Corner Resize Handlers with Window-level Drop Guarantee
  const handleImageResizeStart = (e, img, handle) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const init = { ...img };
    const el = document.getElementById(`img-${img.id}`);

    let currentW = init.width;
    let currentH = init.height;
    let currentX = init.x;
    let currentY = init.y;

    const onResizeMove = (moveEv) => {
      const dx = (moveEv.clientX - startX) / zoom;
      const dy = (moveEv.clientY - startY) / zoom;

      let newX = init.x;
      let newY = init.y;
      let newW = init.width;
      let newH = init.height;

      if (handle === 'se') {
        newW = Math.max(50, Math.round(init.width + dx));
        newH = Math.max(50, Math.round(init.height + dy));
      } else if (handle === 'sw') {
        newW = Math.max(50, Math.round(init.width - dx));
        newH = Math.max(50, Math.round(init.height + dy));
        newX = Math.round(init.x + (init.width - newW));
      } else if (handle === 'ne') {
        newW = Math.max(50, Math.round(init.width + dx));
        newH = Math.max(50, Math.round(init.height - dy));
        newY = Math.round(init.y + (init.height - newH));
      } else if (handle === 'nw') {
        newW = Math.max(50, Math.round(init.width - dx));
        newH = Math.max(50, Math.round(init.height - dy));
        newX = Math.round(init.x + (init.width - newW));
        newY = Math.round(init.y + (init.height - newH));
      }

      currentX = newX;
      currentY = newY;
      currentW = newW;
      currentH = newH;

      if (el) {
        el.style.left = `${(newX / canvasWidth) * 100}%`;
        el.style.top = `${(newY / canvasHeight) * 100}%`;
        el.style.width = `${(newW / canvasWidth) * 100}%`;
        el.style.height = `${(newH / canvasHeight) * 100}%`;
      }
    };

    const onResizeUp = () => {
      window.removeEventListener('pointermove', onResizeMove);
      window.removeEventListener('pointerup', onResizeUp);
      window.removeEventListener('pointercancel', onResizeUp);

      const updatedImages = imageElements.map(it => 
        it.id === img.id ? { ...it, x: currentX, y: currentY, width: currentW, height: currentH } : it
      );

      if (onBatchUpdatePage) {
        onBatchUpdatePage({ imageElements: updatedImages });
      } else if (onImageElementsChange) {
        onImageElementsChange(updatedImages);
      }
    };

    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeUp);
    window.addEventListener('pointercancel', onResizeUp);
  };

  // Lasso Selection Drag (Move) Handlers - Zero-Flicker 60fps
  const handleLassoBoxPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!lassoSelection) return;
    
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    if (lassoBoxRef.current) lassoBoxRef.current.classList.add('dragging');
    setShowLassoColorPicker(false);

    // Snapshot selected/unselected strokes ONCE at drag start from latest ref
    const currentStrokes = latestStrokesRef.current || strokes;
    const selectedStrokes = currentStrokes.filter((_, idx) => lassoSelection.strokeIndices.includes(idx));
    const unselectedStrokes = currentStrokes.filter((_, idx) => !lassoSelection.strokeIndices.includes(idx));

    // Remove selected strokes from static canvas so they aren't drawn twice during drag
    const staticCanvas = staticCanvasRef.current;
    if (staticCanvas) {
      const dpr = getDpr();
      const sCtx = staticCanvas.getContext('2d');
      sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      renderAllStrokes(sCtx, unselectedStrokes);
    }

    // Immediately render selected strokes on activeCanvas (at offset 0,0)
    const activeCanvas = activeCanvasRef.current;
    if (activeCanvas) {
      const dpr = getDpr();
      const aCtx = activeCanvas.getContext('2d');
      aCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      aCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      renderAllStrokes(aCtx, selectedStrokes);
    }

    lassoDragRef.current = {
      isDragging: true,
      isResizing: false,
      handle: null,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      initialBbox: { ...lassoSelection.bbox },
      initialStrokes: [...currentStrokes],
      selectedStrokes,
      unselectedStrokes,
      initialTexts: [...textElements],
      initialImages: [...imageElements]
    };
  };

  const handleLassoBoxPointerMove = (e) => {
    if (!lassoDragRef.current.isDragging || !lassoSelection) return;
    e.preventDefault();
    e.stopPropagation();

    const dx = (e.clientX - lassoDragRef.current.startX) / zoom;
    const dy = (e.clientY - lassoDragRef.current.startY) / zoom;
    lassoDragRef.current.dx = dx;
    lassoDragRef.current.dy = dy;

    // Use rAF for direct GPU transform without React re-render thrashing
    if (lassoRafRef.current) cancelAnimationFrame(lassoRafRef.current);
    lassoRafRef.current = requestAnimationFrame(() => {
      // 1. Direct hardware-accelerated transform on lasso bounding box
      if (lassoBoxRef.current) {
        lassoBoxRef.current.style.transform = `translate3d(${dx * zoom}px, ${dy * zoom}px, 0)`;
      }

      // 2. Direct transform on selected text elements
      lassoSelection.textIds.forEach(id => {
        const el = document.getElementById(`txt-${id}`);
        if (el) el.style.transform = `translate3d(${dx * zoom}px, ${dy * zoom}px, 0)`;
      });

      // 3. Direct transform on selected image elements
      lassoSelection.imageIds.forEach(id => {
        const el = document.getElementById(`img-${id}`);
        if (el) el.style.transform = `translate3d(${dx * zoom}px, ${dy * zoom}px, 0)`;
      });

      // 4. Redraw selected strokes on activeCanvas with current offset
      const activeCanvas = activeCanvasRef.current;
      if (activeCanvas && lassoDragRef.current.selectedStrokes) {
        const dpr = getDpr();
        const aCtx = activeCanvas.getContext('2d');
        aCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        aCtx.clearRect(0, 0, canvasWidth, canvasHeight);

        const transformedSelected = lassoDragRef.current.selectedStrokes.map(s => 
          transformStroke(s, { dx, dy })
        );
        renderAllStrokes(aCtx, transformedSelected);
      }
      lassoRafRef.current = null;
    });
  };

  const handleLassoBoxPointerUp = (e) => {
    if (lassoDragRef.current.isDragging) {
      lassoDragRef.current.isDragging = false;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}

      if (lassoRafRef.current) {
        cancelAnimationFrame(lassoRafRef.current);
        lassoRafRef.current = null;
      }

      let { dx, dy, initialBbox, initialStrokes, initialTexts, initialImages } = lassoDragRef.current;

      // Compute precise dx, dy up to the exact moment of pointerup
      if (e.clientX !== undefined && e.clientY !== undefined && lassoDragRef.current.startX !== undefined) {
        const calcDx = (e.clientX - lassoDragRef.current.startX) / zoom;
        const calcDy = (e.clientY - lassoDragRef.current.startY) / zoom;
        if (!isNaN(calcDx) && !isNaN(calcDy)) {
          dx = calcDx;
          dy = calcDy;
        }
      }

      const hasMoved = Math.abs(dx) > 1 || Math.abs(dy) > 1;

      if (hasMoved) {
        const newStrokes = lassoSelection.strokeIndices.length > 0
          ? initialStrokes.map((s, idx) => {
              if (lassoSelection.strokeIndices.includes(idx)) {
                return transformStroke(s, { dx, dy });
              }
              return s;
            })
          : initialStrokes;

        // 1. Synchronously render newStrokes onto staticCanvas BEFORE clearing activeCanvas!
        // This completely eliminates the vanishing glitch so strokes never disappear for even a single frame.
        const staticCanvas = staticCanvasRef.current;
        if (staticCanvas) {
          const dpr = getDpr();
          const sCtx = staticCanvas.getContext('2d');
          sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          sCtx.clearRect(0, 0, canvasWidth, canvasHeight);
          renderAllStrokes(sCtx, newStrokes);
        }

        // 2. Clear active canvas now that staticCanvas is displaying newStrokes
        const activeCanvas = activeCanvasRef.current;
        if (activeCanvas) {
          const dpr = getDpr();
          const aCtx = activeCanvas.getContext('2d');
          aCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          aCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        }

        // 3. Immediately store latest strokes in ref for immediate consecutive actions
        latestStrokesRef.current = newStrokes;

        // 4. Update Lasso Box DOM position immediately to prevent visual jumping/twitching
        if (lassoBoxRef.current) {
          lassoBoxRef.current.classList.remove('dragging');
          lassoBoxRef.current.style.left = `${((initialBbox.x + dx) / canvasWidth) * 100}%`;
          lassoBoxRef.current.style.top = `${((initialBbox.y + dy) / canvasHeight) * 100}%`;
          lassoBoxRef.current.style.transform = '';
        }

        const newTexts = lassoSelection.textIds.length > 0
          ? initialTexts.map(t => {
              if (lassoSelection.textIds.includes(t.id)) {
                return { ...t, x: t.x + dx, y: t.y + dy };
              }
              return t;
            })
          : initialTexts;

        const newImages = lassoSelection.imageIds.length > 0
          ? initialImages.map(img => {
              if (lassoSelection.imageIds.includes(img.id)) {
                return { ...img, x: img.x + dx, y: img.y + dy };
              }
              return img;
            })
          : initialImages;

        // Reset direct styles on text & image elements
        lassoSelection.textIds.forEach(id => {
          const el = document.getElementById(`txt-${id}`);
          if (el) el.style.transform = '';
        });
        lassoSelection.imageIds.forEach(id => {
          const el = document.getElementById(`img-${id}`);
          if (el) el.style.transform = '';
        });

        // 5. Atomic Batch Update to parent state to permanently commit new coordinates
        if (onBatchUpdatePage) {
          onBatchUpdatePage({
            ...(lassoSelection.strokeIndices.length > 0 ? { strokes: newStrokes } : {}),
            ...(lassoSelection.textIds.length > 0 ? { textElements: newTexts } : {}),
            ...(lassoSelection.imageIds.length > 0 ? { imageElements: newImages } : {})
          });
        } else {
          if (lassoSelection.strokeIndices.length > 0) onStrokesChange(newStrokes);
          if (lassoSelection.textIds.length > 0) onTextElementsChange(newTexts);
          if (lassoSelection.imageIds.length > 0 && onImageElementsChange) onImageElementsChange(newImages);
        }

        // 6. Update lasso selection bbox in React state
        setLassoSelection(prev => prev ? ({
          ...prev,
          bbox: {
            ...prev.bbox,
            x: initialBbox.x + dx,
            y: initialBbox.y + dy
          }
        }) : null);
      } else {
        // Just clicked: restore all strokes on static canvas
        if (lassoBoxRef.current) {
          lassoBoxRef.current.classList.remove('dragging');
          lassoBoxRef.current.style.transform = '';
        }
        const staticCanvas = staticCanvasRef.current;
        if (staticCanvas) {
          const dpr = getDpr();
          const sCtx = staticCanvas.getContext('2d');
          sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          sCtx.clearRect(0, 0, canvasWidth, canvasHeight);
          renderAllStrokes(sCtx, initialStrokes);
        }
        const activeCanvas = activeCanvasRef.current;
        if (activeCanvas) {
          const dpr = getDpr();
          const aCtx = activeCanvas.getContext('2d');
          aCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          aCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        }
      }
    }
  };

  // Lasso Selection 4-Corner Resize Handlers
  const handleLassoResizePointerDown = (e, handle = 'se') => {
    e.preventDefault();
    e.stopPropagation();
    if (!lassoSelection) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    setShowLassoColorPicker(false);
    const currentStrokes = latestStrokesRef.current || strokes;
    lassoDragRef.current = {
      isDragging: false,
      isResizing: true,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      initialBbox: { ...lassoSelection.bbox },
      initialStrokes: [...currentStrokes],
      initialTexts: [...textElements],
      initialImages: [...imageElements]
    };
  };

  const handleLassoResizePointerMove = (e) => {
    if (!lassoDragRef.current.isResizing || !lassoSelection) return;
    e.preventDefault();
    e.stopPropagation();
    const { handle, startX, startY, initialBbox } = lassoDragRef.current;
    const dx = (e.clientX - startX) / zoom;
    const dy = (e.clientY - startY) / zoom;
    lassoDragRef.current.dx = dx;
    lassoDragRef.current.dy = dy;

    let newX = initialBbox.x;
    let newY = initialBbox.y;
    let newW = initialBbox.width;
    let newH = initialBbox.height;

    if (handle === 'se') {
      newW = Math.max(48, initialBbox.width + dx);
      newH = Math.max(48, initialBbox.height + dy);
    } else if (handle === 'sw') {
      newW = Math.max(48, initialBbox.width - dx);
      newX = initialBbox.x + (initialBbox.width - newW);
      newH = Math.max(48, initialBbox.height + dy);
    } else if (handle === 'ne') {
      newW = Math.max(48, initialBbox.width + dx);
      newH = Math.max(48, initialBbox.height - dy);
      newY = initialBbox.y + (initialBbox.height - newH);
    } else if (handle === 'nw') {
      newW = Math.max(48, initialBbox.width - dx);
      newX = initialBbox.x + (initialBbox.width - newW);
      newH = Math.max(48, initialBbox.height - dy);
      newY = initialBbox.y + (initialBbox.height - newH);
    }

    setLassoSelection(prev => prev ? ({
      ...prev,
      bbox: { x: newX, y: newY, width: newW, height: newH }
    }) : null);
  };

  const handleLassoResizePointerUp = (e) => {
    if (lassoDragRef.current.isResizing) {
      lassoDragRef.current.isResizing = false;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}

      const { initialBbox, initialStrokes, initialTexts, initialImages } = lassoDragRef.current;
      const currentBbox = lassoSelection?.bbox;
      if (currentBbox && (Math.abs(currentBbox.width - initialBbox.width) > 2 || Math.abs(currentBbox.height - initialBbox.height) > 2)) {
        const scaleX = currentBbox.width / initialBbox.width;
        const scaleY = currentBbox.height / initialBbox.height;
        const uniformScale = (scaleX + scaleY) / 2;

        const newStrokes = initialStrokes.map((s, idx) => {
          if (lassoSelection.strokeIndices.includes(idx)) {
            return transformStroke(s, { originX: initialBbox.x, originY: initialBbox.y, scale: uniformScale });
          }
          return s;
        });

        // Immediately paint new scaled strokes to static canvas
        const staticCanvas = staticCanvasRef.current;
        if (staticCanvas) {
          const dpr = getDpr();
          const sCtx = staticCanvas.getContext('2d');
          sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          sCtx.clearRect(0, 0, canvasWidth, canvasHeight);
          renderAllStrokes(sCtx, newStrokes);
        }
        latestStrokesRef.current = newStrokes;

        const newTexts = initialTexts.map(t => {
          if (lassoSelection.textIds.includes(t.id)) {
            return {
              ...t,
              x: currentBbox.x + (t.x - initialBbox.x) * scaleX,
              y: currentBbox.y + (t.y - initialBbox.y) * scaleY,
              fontSize: Math.max(10, Math.round((t.fontSize || 20) * uniformScale))
            };
          }
          return t;
        });

        const newImages = initialImages.map(img => {
          if (lassoSelection.imageIds.includes(img.id)) {
            return {
              ...img,
              x: currentBbox.x + (img.x - initialBbox.x) * scaleX,
              y: currentBbox.y + (img.y - initialBbox.y) * scaleY,
              width: Math.max(30, Math.round(img.width * scaleX)),
              height: Math.max(30, Math.round(img.height * scaleY))
            };
          }
          return img;
        });

        if (onBatchUpdatePage) {
          onBatchUpdatePage({
            ...(lassoSelection.strokeIndices.length > 0 ? { strokes: newStrokes } : {}),
            ...(lassoSelection.textIds.length > 0 ? { textElements: newTexts } : {}),
            ...(lassoSelection.imageIds.length > 0 ? { imageElements: newImages } : {})
          });
        } else {
          if (lassoSelection.strokeIndices.length > 0) onStrokesChange(newStrokes);
          if (lassoSelection.textIds.length > 0) onTextElementsChange(newTexts);
          if (lassoSelection.imageIds.length > 0 && onImageElementsChange) onImageElementsChange(newImages);
        }
      }
    }
  };

  // Lasso Quick Actions: Recolor, Duplicate, Delete
  const handleLassoRecolor = (colorToApply = activeColor) => {
    if (!lassoSelection) return;
    const currentStrokes = latestStrokesRef.current || strokes;
    const newStrokes = currentStrokes.map((s, idx) => {
      if (lassoSelection.strokeIndices.includes(idx)) {
        return transformStroke(s, { newColor: colorToApply });
      }
      return s;
    });

    const staticCanvas = staticCanvasRef.current;
    if (staticCanvas) {
      const dpr = getDpr();
      const sCtx = staticCanvas.getContext('2d');
      sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      renderAllStrokes(sCtx, newStrokes);
    }
    latestStrokesRef.current = newStrokes;

    if (onBatchUpdatePage) {
      onBatchUpdatePage({ strokes: newStrokes });
    } else {
      onStrokesChange(newStrokes);
    }
    setShowLassoColorPicker(false);
    showToast(`เปลี่ยนสีลายเส้นที่เลือกแล้ว! 🎨`);
  };

  const handleLassoDuplicate = () => {
    if (!lassoSelection) return;
    const currentStrokes = latestStrokesRef.current || strokes;
    const offset = 35;
    const dupeStrokes = lassoSelection.strokeIndices.map(idx => transformStroke(currentStrokes[idx], { dx: offset, dy: offset }));
    const dupeTexts = lassoSelection.textIds.map(id => {
      const orig = textElements.find(t => t.id === id);
      return orig ? { ...orig, id: `txt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, x: orig.x + offset, y: orig.y + offset } : null;
    }).filter(Boolean);
    const dupeImages = lassoSelection.imageIds.map(id => {
      const orig = imageElements.find(i => i.id === id);
      return orig ? { ...orig, id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, x: orig.x + offset, y: orig.y + offset } : null;
    }).filter(Boolean);

    const newAllStrokes = [...currentStrokes, ...dupeStrokes];
    const startIndex = currentStrokes.length;
    const newIndices = dupeStrokes.map((_, i) => startIndex + i);

    const staticCanvas = staticCanvasRef.current;
    if (staticCanvas) {
      const dpr = getDpr();
      const sCtx = staticCanvas.getContext('2d');
      sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      renderAllStrokes(sCtx, newAllStrokes);
    }
    latestStrokesRef.current = newAllStrokes;

    const newTexts = dupeTexts.length > 0 ? [...textElements, ...dupeTexts] : textElements;
    const newImages = dupeImages.length > 0 ? [...imageElements, ...dupeImages] : imageElements;

    if (onBatchUpdatePage) {
      onBatchUpdatePage({
        strokes: newAllStrokes,
        ...(dupeTexts.length > 0 ? { textElements: newTexts } : {}),
        ...(dupeImages.length > 0 ? { imageElements: newImages } : {})
      });
    } else {
      onStrokesChange(newAllStrokes);
      if (dupeTexts.length > 0) onTextElementsChange(newTexts);
      if (dupeImages.length > 0 && onImageElementsChange) onImageElementsChange(newImages);
    }

    setLassoSelection({
      strokeIndices: newIndices,
      textIds: dupeTexts.map(t => t.id),
      imageIds: dupeImages.map(i => i.id),
      bbox: {
        x: lassoSelection.bbox.x + offset,
        y: lassoSelection.bbox.y + offset,
        width: lassoSelection.bbox.width,
        height: lassoSelection.bbox.height
      }
    });
    showToast('คัดลอกส่วนที่เลือกแล้ว (Duplicated) 📋');
  };

  const handleLassoDelete = () => {
    if (!lassoSelection) return;
    const currentStrokes = latestStrokesRef.current || strokes;
    const remainingStrokes = currentStrokes.filter((_, idx) => !lassoSelection.strokeIndices.includes(idx));
    const remainingTexts = textElements.filter(t => !lassoSelection.textIds.includes(t.id));
    const remainingImages = imageElements.filter(img => !lassoSelection.imageIds.includes(img.id));

    const staticCanvas = staticCanvasRef.current;
    if (staticCanvas) {
      const dpr = getDpr();
      const sCtx = staticCanvas.getContext('2d');
      sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      renderAllStrokes(sCtx, remainingStrokes);
    }
    latestStrokesRef.current = remainingStrokes;

    if (onBatchUpdatePage) {
      onBatchUpdatePage({
        strokes: remainingStrokes,
        textElements: remainingTexts,
        imageElements: remainingImages
      });
    } else {
      onStrokesChange(remainingStrokes);
      onTextElementsChange(remainingTexts);
      if (onImageElementsChange) onImageElementsChange(remainingImages);
    }
    setLassoSelection(null);
    setShowLassoColorPicker(false);
    showToast('ลบส่วนที่เลือกแล้ว 🗑️');
  };

  return (
    <div 
      className="bn-canvas-container" 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ 
        cursor: activeTool === 'hand' ? 'grab' : activeTool === 'snip' ? 'crosshair' : 'crosshair' 
      }}
    >
      {/* Toast Notification */}
      {gestureToast && (
        <div className="bn-gesture-toast">
          <Sparkles size={16} className="text-amber-400" />
          <span>{gestureToast}</span>
        </div>
      )}



      <div 
        ref={sheetRef}
        className="bn-paper-sheet"
        style={{
          width: `${canvasWidth * zoom}px`,
          height: `${canvasHeight * zoom}px`
        }}
      >
        {/* Layer 1: Background Paper / PDF Canvas (Hi-DPI) */}
        <canvas 
          ref={bgCanvasRef}
          className="bn-layer-bg"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Layer 2: Finalized Static Strokes Canvas (Hi-DPI) */}
        <canvas 
          ref={staticCanvasRef}
          className="bn-layer-static"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Layer 3: Hardware Inking Canvas (desynchronized, Hi-DPI) */}
        <canvas 
          ref={activeCanvasRef}
          className="bn-layer-active"
          style={{ width: '100%', height: '100%' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={handleContextMenu}
        />

        {/* Snipping Tool Full-Screen Dark Overlay & Marching Ants Marquee */}
        {activeTool === 'snip' && (
          <div className="bn-snip-dark-overlay">
            {snipBox && (
              <div 
                className="bn-snip-cutout"
                style={{
                  left: `${(snipBox.x / canvasWidth) * 100}%`,
                  top: `${(snipBox.y / canvasHeight) * 100}%`,
                  width: `${(snipBox.width / canvasWidth) * 100}%`,
                  height: `${(snipBox.height / canvasHeight) * 100}%`
                }}
              >
                <div className="bn-snip-dimensions-tag">
                  {Math.round(snipBox.width)} × {Math.round(snipBox.height)} px
                </div>
              </div>
            )}
          </div>
        )}

        {/* Layer 4: Pasted Image Elements (Move, Resize Handles, Crop Action Bar) */}
        {imageElements.map(img => {
          const isSelected = selectedImageId === img.id;
          return (
            <div
              key={img.id}
              id={`img-${img.id}`}
              className={`bn-image-element ${isSelected ? 'bn-image-element-selected' : ''}`}
              style={{
                left: `${(img.x / canvasWidth) * 100}%`,
                top: `${(img.y / canvasHeight) * 100}%`,
                width: `${(img.width / canvasWidth) * 100}%`,
                height: `${(img.height / canvasHeight) * 100}%`
              }}
              onPointerDown={(e) => handleImagePointerDown(e, img)}
            >
              <img 
                src={img.src} 
                alt="Pasted" 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'fill',
                  display: 'block',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
                className="pointer-events-none select-none" 
              />

              {/* Floating Action Bar above selected image - STOP ALL PROPAGATION */}
              {isSelected && (
                <div 
                  className="bn-image-action-bar" 
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    className="bn-image-action-btn flex items-center gap-1 text-xs"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCropModalImg(img);
                    }}
                    title="ครอบตัดรูปภาพ"
                  >
                    <Crop size={13} className="text-blue-400" />
                    <span>ครอบตัด</span>
                  </button>
                  <div className="w-px h-3 bg-zinc-700 mx-0.5" />
                  <button 
                    className="bn-image-action-btn text-red-400 hover:text-red-300"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImageDelete(img.id);
                    }}
                    title="ลบรูปภาพ"
                  >
                    <Trash2 size={13} />
                  </button>
                  <div className="w-px h-3 bg-zinc-700 mx-0.5" />
                  <button 
                    className="bn-image-action-btn text-zinc-400 hover:text-white"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImageId(null);
                    }}
                    title="ยกเลิกการเลือก"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* 4 Corner Resize Handles */}
              {isSelected && (
                <>
                  <div 
                    className="bn-image-resize-handle bn-handle-nw"
                    onPointerDown={(e) => handleImageResizeStart(e, img, 'nw')}
                  />
                  <div 
                    className="bn-image-resize-handle bn-handle-ne"
                    onPointerDown={(e) => handleImageResizeStart(e, img, 'ne')}
                  />
                  <div 
                    className="bn-image-resize-handle bn-handle-sw"
                    onPointerDown={(e) => handleImageResizeStart(e, img, 'sw')}
                  />
                  <div 
                    className="bn-image-resize-handle bn-handle-se"
                    onPointerDown={(e) => handleImageResizeStart(e, img, 'se')}
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Layer 5: Interactive Text Elements */}
        {textElements.map(txt => {
          return (
            <div
              key={txt.id}
              id={`txt-${txt.id}`}
              className={`bn-text-box ${activeTextId === txt.id ? 'bn-text-box-active' : ''}`}
              style={{
                left: `${(txt.x / canvasWidth) * 100}%`,
                top: `${(txt.y / canvasHeight) * 100}%`,
                color: txt.color || '#000000',
                fontSize: `${(txt.fontSize || 20) * zoom}px`,
                fontFamily: txt.fontFamily || 'Inter'
              }}
              onClick={() => setActiveTextId(txt.id)}
            >
              <textarea
                className="bn-text-textarea"
                value={txt.text}
                onChange={(e) => handleTextChange(txt.id, e.target.value)}
                rows={txt.text.split('\n').length || 1}
                style={{ color: txt.color || '#000000' }}
              />
              {activeTextId === txt.id && (
                <button 
                  className="bn-text-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTextDelete(txt.id);
                  }}
                  title="ลบข้อความ"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}

        {/* Layer 6: Lasso Selection Bounding Box & Floating Action Bar (Precision Grade) */}
        {lassoSelection && (
          <div 
            ref={lassoBoxRef}
            className="bn-lasso-selection-box"
            style={{
              left: `${(lassoSelection.bbox.x / canvasWidth) * 100}%`,
              top: `${(lassoSelection.bbox.y / canvasHeight) * 100}%`,
              width: `${(lassoSelection.bbox.width / canvasWidth) * 100}%`,
              height: `${(lassoSelection.bbox.height / canvasHeight) * 100}%`,
              pointerEvents: 'auto'
            }}
            onPointerDown={handleLassoBoxPointerDown}
            onPointerMove={handleLassoBoxPointerMove}
            onPointerUp={handleLassoBoxPointerUp}
            onPointerCancel={handleLassoBoxPointerUp}
          >
            {/* Floating Action Bar above Lasso Box */}
            <div 
              className="bn-lasso-action-bar" 
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Recolor Button with Inline Palette Popover */}
              <div className="relative">
                <button 
                  className="bn-lasso-action-btn text-zinc-200 hover:text-white"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowLassoColorPicker(!showLassoColorPicker); 
                  }}
                  title="เปลี่ยนสีลายเส้นที่เลือก"
                >
                  <Palette size={13} className="text-blue-400" />
                  <span>เปลี่ยนสี</span>
                </button>

                {/* Studio style Color Palette Popover */}
                {showLassoColorPicker && (
                  <div 
                    className="bn-lasso-color-popover"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {['#1e293b', '#2563eb', '#dc2626', '#059669', '#7c3aed', '#ea580c', '#eab308'].map(col => (
                      <button
                        key={col}
                        className="w-5 h-5 rounded-full border border-white/40 hover:scale-125 transition flex-shrink-0"
                        style={{ backgroundColor: col }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          handleLassoRecolor(col); 
                        }}
                        title={`เปลี่ยนเป็นสี ${col}`}
                      />
                    ))}
                    <div className="relative w-5 h-5 rounded-full flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 border border-white/40 cursor-pointer overflow-hidden flex-shrink-0" title="เลือกสีอื่น...">
                      <span className="text-[10px] font-bold text-white pointer-events-none">+</span>
                      <input 
                        type="color"
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        value={activeColor}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation(); 
                          handleLassoRecolor(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="w-px h-3 bg-zinc-700 mx-0.5" />

              <button 
                className="bn-lasso-action-btn text-zinc-200 hover:text-white"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  handleLassoDuplicate(); 
                }}
                title="ทำสำเนาส่วนที่เลือก"
              >
                <Copy size={13} />
                <span>คัดลอก</span>
              </button>

              <div className="w-px h-3 bg-zinc-700 mx-0.5" />

              <button 
                className="bn-lasso-action-btn text-red-400 hover:text-red-300"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  handleLassoDelete(); 
                }}
                title="ลบส่วนที่เลือก"
              >
                <Trash2 size={13} />
                <span>ลบ</span>
              </button>

              <div className="w-px h-3 bg-zinc-700 mx-0.5" />

              {/* Close Button X: Immediate Reliable Deselect */}
              <button 
                className="bn-lasso-action-btn text-zinc-400 hover:text-white hover:bg-zinc-700/60"
                onPointerDown={(e) => { 
                  e.stopPropagation(); 
                  setLassoSelection(null); 
                  setShowLassoColorPicker(false);
                }}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setLassoSelection(null); 
                  setShowLassoColorPicker(false);
                }}
                title="ยกเลิกการเลือก (Close)"
              >
                <X size={14} />
              </button>
            </div>

            {/* 4 Corner Resize Handles (Surface Pro 7 Touch-Friendly 28px Targets) */}
            <div 
              className="bn-lasso-corner-handle bn-lasso-corner-nw"
              onPointerDown={(e) => handleLassoResizePointerDown(e, 'nw')}
              onPointerMove={handleLassoResizePointerMove}
              onPointerUp={handleLassoResizePointerUp}
              title="ย่อ/ขยาย (บนซ้าย)"
            />
            <div 
              className="bn-lasso-corner-handle bn-lasso-corner-ne"
              onPointerDown={(e) => handleLassoResizePointerDown(e, 'ne')}
              onPointerMove={handleLassoResizePointerMove}
              onPointerUp={handleLassoResizePointerUp}
              title="ย่อ/ขยาย (บนขวา)"
            />
            <div 
              className="bn-lasso-corner-handle bn-lasso-corner-se"
              onPointerDown={(e) => handleLassoResizePointerDown(e, 'se')}
              onPointerMove={handleLassoResizePointerMove}
              onPointerUp={handleLassoResizePointerUp}
              title="ย่อ/ขยาย (ล่างขวา)"
            />
            <div 
              className="bn-lasso-corner-handle bn-lasso-corner-sw"
              onPointerDown={(e) => handleLassoResizePointerDown(e, 'sw')}
              onPointerMove={handleLassoResizePointerMove}
              onPointerUp={handleLassoResizePointerUp}
              title="ย่อ/ขยาย (ล่างซ้าย)"
            />
          </div>
        )}

        {/* Floating Paste Menu (Triggered by Long Press or Context Menu) */}
        {floatingPasteMenu && (
          <div 
            className="bn-floating-paste-menu"
            style={{
              left: `${(floatingPasteMenu.x / canvasWidth) * 100}%`,
              top: `${(floatingPasteMenu.y / canvasHeight) * 100}%`
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="bn-floating-paste-btn"
              onClick={() => handleExecutePaste(floatingPasteMenu.canvasX, floatingPasteMenu.canvasY)}
              title="วางรูปภาพจากคลิปบอร์ด (Paste Image)"
            >
              <ClipboardPaste size={15} />
              <span>วาง</span>
            </button>
            <button 
              className="bn-floating-paste-close"
              onClick={() => setFloatingPasteMenu(null)}
              title="ปิดเมนู"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Snipping Tool Instant Preview & Interactive Crop Modal */}
      {snipModalData && (
        <SnipModal 
          snipImage={snipModalData}
          onConfirm={(dataUrl, width, height, x, y) => handleConfirmSnipPlacement(dataUrl, width, height, x, y)}
          onClose={handleCloseSnipModal}
        />
      )}

      {/* Interactive Image Cropping Modal */}
      {cropModalImg && (
        <ImageCropModal 
          image={cropModalImg}
          onCrop={(croppedDataUrl, newW, newH) => {
            // Check if this is a snip crop (pre-paste workflow)
            if (cropModalImg._isSnipCrop) {
              handleSnipCropResult(croppedDataUrl, newW, newH);
              return;
            }
            if (onImageElementsChange) {
              onImageElementsChange(imageElements.map(it => it.id === cropModalImg.id ? {
                ...it,
                src: croppedDataUrl,
                width: newW,
                height: newH
              } : it));
            }
            setCropModalImg(null);
            showToast('ครอบตัดรูปภาพสำเร็จ! ✂️');
          }}
          onClose={() => setCropModalImg(null)}
        />
      )}
    </div>
  );
};
