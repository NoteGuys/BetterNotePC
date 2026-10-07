import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Infinity as InfinityIcon } from 'lucide-react';
import { CanvasBoard } from './CanvasBoard';
import { getElementBounds, getWhiteboardContentBounds, intersectsViewport, mergeVisibleElements } from '../../utils/whiteboard';
import { useLanguage } from '../../services/i18n';

const transformElement = (item, kind, view, zoom, toWorld = false) => {
  const scale = toWorld ? 1 / zoom : zoom;
  const dx = toWorld ? view.x : -view.x * zoom, dy = toWorld ? view.y : -view.y * zoom;
  if (kind === 'strokes') return { ...item, width: item.width * scale, points: (item.points || []).map(p => ({ ...p, x: p.x * scale + dx, y: p.y * scale + dy })) };
  const result = { ...item, x: item.x * scale + dx, y: item.y * scale + dy };
  if (kind === 'imageElements') { result.width = item.width * scale; result.height = item.height * scale; }
  else result.fontSize = (item.fontSize || 20) * scale;
  return result;
};

export const WhiteboardBoard = ({ page, zoom = 1, onViewportChange, ...props }) => {
  const { t } = useLanguage();
  const viewportRef = useRef(null), gestureRef = useRef(null), contactsRef = useRef(new Set());
  const rafRef = useRef(null), pendingViewRef = useRef(null), lastZoomRef = useRef(zoom), wheelTimerRef = useRef(null);
  const lastTouchTapRef = useRef(0);
  const navigationResetRef = useRef(false);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [view, setView] = useState(() => { const b = getWhiteboardContentBounds(page); return { x: b.empty ? 0 : b.x, y: b.empty ? 0 : b.y }; });
  const [generation, setGeneration] = useState(0);
  const viewRef = useRef(view), sizeRef = useRef(size), zoomRef = useRef(zoom), propsRef = useRef(props);
  viewRef.current = view; sizeRef.current = size; zoomRef.current = zoom; propsRef.current = props;

  const queueView = next => {
    pendingViewRef.current = next;
    if (!rafRef.current) rafRef.current = requestAnimationFrame(() => {
      if (navigationResetRef.current) { navigationResetRef.current = false; setGeneration(value => value + 1); }
      rafRef.current = null; const next = pendingViewRef.current; pendingViewRef.current = null; viewRef.current = next; setView(next);
    });
  };
  useLayoutEffect(() => {
    const node = viewportRef.current;
    const measure = () => { const r = node.getBoundingClientRect(); setSize({ width: Math.max(100, Math.round(r.width)), height: Math.max(100, Math.round(r.height)) }); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const previous = lastZoomRef.current;
    if (previous !== zoom) {
      const s = sizeRef.current, v = viewRef.current;
      const next = { x: v.x + s.width / previous / 2 - s.width / zoom / 2, y: v.y + s.height / previous / 2 - s.height / zoom / 2 };
      viewRef.current = next; setView(next); setGeneration(value => value + 1); lastZoomRef.current = zoom;
    }
  }, [zoom]);
  useLayoutEffect(() => {
    onViewportChange?.({ pageId: page.id, ...view, width: size.width / zoom, height: size.height / zoom });
  }, [page.id, view, size, zoom, onViewportChange]);
  useEffect(() => {
    const release = event => contactsRef.current.delete(event.pointerId);
    const blur = () => { contactsRef.current.clear(); gestureRef.current = null; };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('blur', blur);
    window.addEventListener('lostpointercapture', release);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
    return () => { window.removeEventListener('blur', blur); window.removeEventListener('lostpointercapture', release);
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); cancelAnimationFrame(rafRef.current); clearTimeout(wheelTimerRef.current); };
  }, []);
  useEffect(() => {
    const node = viewportRef.current;
    const wheel = event => {
      event.preventDefault(); event.stopPropagation();
      if (event.target.closest('textarea, input, .bn-modal-backdrop')) return;
      if (contactsRef.current.size || window.__bn_pen_active || window.__bn_drag_active) return;
      if (!wheelTimerRef.current) navigationResetRef.current = true;
      clearTimeout(wheelTimerRef.current); wheelTimerRef.current = setTimeout(() => { wheelTimerRef.current = null; }, 180);
      const v = pendingViewRef.current || viewRef.current, z = zoomRef.current;
      if (event.ctrlKey) {
        const nextZoom = Math.min(3.5, Math.max(0.01, z * Math.exp(-event.deltaY * 0.002)));
        const r = node.getBoundingClientRect(), x = event.clientX - r.left, y = event.clientY - r.top;
        lastZoomRef.current = nextZoom; queueView({ x: v.x + x / z - x / nextZoom, y: v.y + y / z - y / nextZoom });
        propsRef.current.onZoomChange?.(nextZoom);
      } else {
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? sizeRef.current.height : 1;
        queueView({ x: v.x + (event.shiftKey ? event.deltaY : event.deltaX) * unit / z, y: v.y + (event.shiftKey ? 0 : event.deltaY) * unit / z });
      }
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);

  const records = useMemo(() => Object.fromEntries(['strokes', 'imageElements', 'textElements'].map(kind => [kind, (page[kind] || []).map(item => ({ item, box: getElementBounds(item, kind) }))])), [page.strokes, page.imageElements, page.textElements]);
  const worldViewport = { ...view, width: size.width / zoom, height: size.height / zoom };
  const visible = Object.fromEntries(Object.entries(records).map(([kind, entries]) => [kind, entries.filter(record => intersectsViewport(record.box, worldViewport) || (kind === 'textElements' && !record.item.text?.trim())).map(record => record.item)]));
  const viewportPage = { ...page, pageWidth: size.width, pageHeight: size.height, ...Object.fromEntries(Object.entries(visible).map(([kind, items]) => [kind, items.map(item => transformElement(item, kind, view, zoom))])) };
  const update = (updates, options) => {
    const worldUpdates = {};
    for (const kind of ['strokes', 'imageElements', 'textElements']) if (updates[kind] !== undefined) {
      const edited = updates[kind].map(item => {
        const unchangedIndex = viewportPage[kind].indexOf(item);
        if (unchangedIndex >= 0) return visible[kind][unchangedIndex];
        const worldItem = transformElement(item, kind, view, zoom, true);
        const previousIndex = viewportPage[kind].findIndex(previous => previous.id === item.id);
        if (previousIndex >= 0) {
          const previous = viewportPage[kind][previousIndex], original = visible[kind][previousIndex];
          for (const field of ['x', 'y', 'width', 'height', 'fontSize']) if (item[field] === previous[field]) {
            if (Object.hasOwn(original, field)) worldItem[field] = original[field];
            else delete worldItem[field];
          }
          if (kind === 'strokes' && item.points === previous.points) worldItem.points = original.points;
        }
        return worldItem;
      });
      worldUpdates[kind] = mergeVisibleElements(page[kind] || [], visible[kind], edited);
    }
    if (props.onBatchUpdatePage) return props.onBatchUpdatePage(worldUpdates, options);
    for (const [kind, items] of Object.entries(worldUpdates)) {
      const callback = kind === 'strokes' ? props.onStrokesChange : kind === 'imageElements' ? props.onImageElementsChange : props.onTextElementsChange;
      callback?.(items, options);
    }
  };

  const beginPointer = event => {
    if (event.target.closest('.bn-whiteboard-controls')) return;
    if (event.pointerType === 'touch') { event.stopPropagation(); return; }
    // Keep the last visible origin fixed if ink starts before a queued pan frame.
    if (pendingViewRef.current) {
      cancelAnimationFrame(rafRef.current); rafRef.current = null; pendingViewRef.current = null;
      navigationResetRef.current = false; clearTimeout(wheelTimerRef.current); wheelTimerRef.current = null;
    }
    if (props.activeTool === 'hand' || event.button === 1) {
      event.preventDefault(); event.stopPropagation();
      viewportRef.current.setPointerCapture(event.pointerId); setGeneration(value => value + 1);
      gestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view: { ...viewRef.current } };
    } else contactsRef.current.add(event.pointerId);
  };
  const movePointer = event => {
    const gesture = gestureRef.current;
    if (gesture?.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    queueView({ x: gesture.view.x - (event.clientX - gesture.x) / zoom, y: gesture.view.y - (event.clientY - gesture.y) / zoom });
  };
  const endPointer = event => {
    contactsRef.current.delete(event.pointerId);
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    event.stopPropagation(); gestureRef.current = null;
    try { viewportRef.current.releasePointerCapture(event.pointerId); } catch (_) {}
  };
  const touchSnapshot = touches => {
    const a = touches[0], b = touches[1] || a;
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)), count: touches.length };
  };
  const beginTouch = event => {
    event.preventDefault(); event.stopPropagation();
    if (window.__bn_pen_active || window.__bn_drag_active || (window.__bn_pen_last_time && Date.now() - window.__bn_pen_last_time < 1200)) return;
    if (event.touches.length < 2 && props.activeTool !== 'hand') return;
    setGeneration(value => value + 1);
    gestureRef.current = { touch: true, ...touchSnapshot(event.touches), view: { ...viewRef.current }, zoom, startedAt: Date.now(), moved: false };
  };
  const moveTouch = event => {
    event.preventDefault(); event.stopPropagation();
    const gesture = gestureRef.current;
    if (!gesture?.touch || !event.touches.length || window.__bn_pen_active) return;
    const next = touchSnapshot(event.touches);
    if (next.count !== gesture.count) { beginTouch(event); return; }
    const z = next.count > 1 ? Math.min(3.5, Math.max(0.01, gesture.zoom * next.distance / gesture.distance)) : gesture.zoom;
    const r = viewportRef.current.getBoundingClientRect();
    const moved = Math.hypot(next.x - gesture.x, next.y - gesture.y) > 6 || Math.abs(next.distance - gesture.distance) > 6;
    gesture.moved ||= moved;
    lastZoomRef.current = z; props.onZoomChange?.(z);
    queueView({ x: gesture.view.x + (gesture.x - r.left) / gesture.zoom - (next.x - r.left) / z, y: gesture.view.y + (gesture.y - r.top) / gesture.zoom - (next.y - r.top) / z });
  };
  const endTouch = event => {
    event.preventDefault(); event.stopPropagation();
    const gesture = gestureRef.current;
    if (gesture?.touch && !event.touches.length) {
      if (gesture.count > 1 && !gesture.moved && Date.now() - gesture.startedAt < 300) {
        if (lastTouchTapRef.current && Date.now() - lastTouchTapRef.current < 400) { props.onUndo?.(); lastTouchTapRef.current = 0; }
        else lastTouchTapRef.current = Date.now();
      }
      gestureRef.current = null;
    }
  };
  const fit = () => {
    const bounds = getWhiteboardContentBounds(page);
    const z = Math.min(3.5, Math.max(0.000001, Math.min((size.width - 80) / bounds.width, (size.height - 80) / bounds.height)));
    setGeneration(value => value + 1); lastZoomRef.current = z; props.onZoomChange?.(z);
    queueView({ x: bounds.x - (size.width / z - bounds.width) / 2, y: bounds.y - (size.height / z - bounds.height) / 2 });
  };

  return <div ref={viewportRef} className="bn-whiteboard-viewport" data-origin-x={view.x} data-origin-y={view.y}
    onPointerDownCapture={beginPointer} onPointerMoveCapture={movePointer} onPointerUpCapture={endPointer} onPointerCancelCapture={endPointer} onLostPointerCaptureCapture={endPointer}
    onTouchStartCapture={beginTouch} onTouchMoveCapture={moveTouch} onTouchEndCapture={endTouch} onTouchCancelCapture={endTouch}>
    <CanvasBoard key={`${page.id}-${generation}`} {...props} page={viewportPage} zoom={1} activeWidth={props.activeWidth * zoom}
      onBatchUpdatePage={update} onStrokesChange={(strokes, options) => update({ strokes }, options)} onTextElementsChange={textElements => update({ textElements })}
      onImageElementsChange={imageElements => update({ imageElements })} />
    <div className="bn-whiteboard-controls">
      <span><InfinityIcon size={16} /> {t('template_whiteboard', 'Whiteboard')}</span>
      <span className="bn-whiteboard-hint">{t('whiteboardPanHint', 'Use Hand or two fingers to pan')}</span>
      <button type="button" onClick={fit} title={t('whiteboardFit', 'Show all content')}><Maximize size={16} /><span>{t('whiteboardFit', 'Show all content')}</span></button>
    </div>
  </div>;
};
