import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Infinity as InfinityIcon } from 'lucide-react';
import { CanvasBoard } from './CanvasBoard';
import { getElementBounds, getWhiteboardContentBounds, intersectsViewport, mergeVisibleElements } from '../../utils/whiteboard';
import { useLanguage } from '../../services/i18n';
import { createTouchGuard, createTwoFingerTap, touchSnapshot, normalizeWheel } from '../../utils/touchNavigation';

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
  const touchGuardRef = useRef(null), touchTapRef = useRef(null);
  if (!touchGuardRef.current) touchGuardRef.current = createTouchGuard();
  if (!touchTapRef.current) touchTapRef.current = createTwoFingerTap();
  const pendingZoomRef = useRef(null);
  const navigationResetRef = useRef(false);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [view, setView] = useState(() => { const b = getWhiteboardContentBounds(page); return { x: b.empty ? 0 : b.x, y: b.empty ? 0 : b.y }; });
  const [generation, setGeneration] = useState(0);
  const viewRef = useRef(view), sizeRef = useRef(size), zoomRef = useRef(zoom), propsRef = useRef(props);
  viewRef.current = view; sizeRef.current = size; zoomRef.current = zoom; propsRef.current = props;

  const queueView = (next, nextZoom = null) => {
    pendingViewRef.current = next;
    if (nextZoom !== null) pendingZoomRef.current = nextZoom;
    if (!rafRef.current) rafRef.current = requestAnimationFrame(() => {
      if (window.__bn_pen_active || window.__bn_drag_active || contactsRef.current.size) {
        rafRef.current = null; pendingViewRef.current = null; pendingZoomRef.current = null; navigationResetRef.current = false;
        return;
      }
      if (navigationResetRef.current) { navigationResetRef.current = false; setGeneration(value => value + 1); }
      rafRef.current = null; const next = pendingViewRef.current; pendingViewRef.current = null;
      const nextZoom = pendingZoomRef.current; pendingZoomRef.current = null;
      if (nextZoom !== null) { lastZoomRef.current = nextZoom; zoomRef.current = nextZoom; propsRef.current.onZoomChange?.(nextZoom); }
      viewRef.current = next; setView(next);
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
    const hoverRelease = event => { if(event.pointerType==='pen' && event.buttons===0) contactsRef.current.delete(event.pointerId); };
    const blur = () => {
      contactsRef.current.clear(); gestureRef.current = null;
      touchGuardRef.current.suspend(); touchTapRef.current.cancel();
      cancelAnimationFrame(rafRef.current); rafRef.current = null; pendingViewRef.current = null; pendingZoomRef.current = null;
      navigationResetRef.current = false; clearTimeout(wheelTimerRef.current); wheelTimerRef.current = null;
    };
    const pointerDown = event => { if (event.pointerType !== 'touch' || !viewportRef.current?.contains(event.target) || event.target.closest?.('.bn-whiteboard-controls, input, textarea, button')) { touchGuardRef.current.block(); touchTapRef.current.cancel(); gestureRef.current = null; cancelAnimationFrame(rafRef.current); rafRef.current = null; pendingViewRef.current = null; pendingZoomRef.current = null; } };
    const outsideRelease = event => {
      if (viewportRef.current?.contains(event.target)) return;
      touchGuardRef.current.update(event.touches, !!(window.__bn_pen_active || window.__bn_drag_active));
      touchGuardRef.current.suspend(); touchTapRef.current.cancel(); gestureRef.current = null;
      cancelAnimationFrame(rafRef.current); rafRef.current = null; pendingViewRef.current = null; pendingZoomRef.current = null;
    };
    window.addEventListener('touchend', outsideRelease);
    window.addEventListener('touchcancel', outsideRelease);
    window.addEventListener('pointerdown', pointerDown, true);
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('blur', blur);
    window.addEventListener('pointermove', hoverRelease, true);
    window.addEventListener('lostpointercapture', release);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
    return () => { blur(); window.removeEventListener('touchend', outsideRelease); window.removeEventListener('touchcancel', outsideRelease); window.removeEventListener('pointerdown', pointerDown, true); window.removeEventListener('blur', blur); window.removeEventListener('lostpointercapture', release);
      window.removeEventListener('pointermove', hoverRelease, true); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); cancelAnimationFrame(rafRef.current); clearTimeout(wheelTimerRef.current); };
  }, []);
  useEffect(() => {
    const node = viewportRef.current;
    const wheel = event => {
      event.preventDefault(); event.stopPropagation();
      if (event.target.closest('textarea, input, .bn-modal-backdrop')) return;
      if (contactsRef.current.size || touchGuardRef.current.size || window.__bn_pen_active || window.__bn_drag_active) return;
      touchTapRef.current.cancel();
      if (!wheelTimerRef.current) navigationResetRef.current = true;
      clearTimeout(wheelTimerRef.current); wheelTimerRef.current = setTimeout(() => { wheelTimerRef.current = null; }, 180);
      const v = pendingViewRef.current || viewRef.current, z = pendingZoomRef.current ?? zoomRef.current;
      const delta = normalizeWheel(event, sizeRef.current.height);
      if (event.ctrlKey) {
        const nextZoom = Math.min(3.5, Math.max(0.01, z * Math.exp(-delta.y * 0.002)));
        const r = node.getBoundingClientRect(), x = event.clientX - r.left, y = event.clientY - r.top;
        queueView({ x: v.x + x / z - x / nextZoom, y: v.y + y / z - y / nextZoom }, nextZoom);
      } else {
        queueView({ x: v.x + (event.shiftKey ? delta.y : delta.x) / z, y: v.y + (event.shiftKey ? 0 : delta.y) / z });
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
      cancelAnimationFrame(rafRef.current); rafRef.current = null; pendingViewRef.current = null; pendingZoomRef.current = null;
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
    if (event.type !== 'pointerup') { cancelAnimationFrame(rafRef.current); rafRef.current = null; pendingViewRef.current = null; pendingZoomRef.current = null; }
    try { viewportRef.current.releasePointerCapture(event.pointerId); } catch (_) {}
  };
  const touchLocked = () => !!(window.__bn_pen_active || window.__bn_drag_active || contactsRef.current.size);
  const beginTouch = event => {
    if (event.target.closest('.bn-whiteboard-controls, input, textarea, button')) return;
    event.preventDefault(); event.stopPropagation();
    const touches = touchGuardRef.current.update(event.touches, touchLocked());
    if (touchLocked() || touches.length !== event.touches.length) { touchTapRef.current.cancel(); return; }
    touchTapRef.current.start(touches);
    if (touches.length > 2) { gestureRef.current = null; touchTapRef.current.cancel(); touchGuardRef.current.block(); cancelAnimationFrame(rafRef.current); rafRef.current = null; pendingViewRef.current = null; pendingZoomRef.current = null; return; }
    if (!touches.length) return;
    // Stop a queued wheel/previous contact frame before taking this visible origin.
    cancelAnimationFrame(rafRef.current); rafRef.current = null; pendingViewRef.current = null; pendingZoomRef.current = null;
    navigationResetRef.current = false;
    gestureRef.current = { touch: true, ...touchSnapshot(touches), view: { ...viewRef.current }, zoom: zoomRef.current, moved: false };
  };
  const moveTouch = event => {
    event.preventDefault(); event.stopPropagation();
    const touches = touchGuardRef.current.update(event.touches, touchLocked()), gesture = gestureRef.current;
    if (touchLocked()) { touchTapRef.current.cancel(); gestureRef.current = null; return; }
    touchTapRef.current.move(touches);
    if (!gesture?.touch || !touches.length || touches.length !== event.touches.length) return;
    const next = touchSnapshot(touches);
    if (next.count !== gesture.count) return;
    const moved = Math.hypot(next.x - gesture.x, next.y - gesture.y) > 8 || Math.abs(next.distance - gesture.distance) > 8;
    gesture.moved ||= moved;
    if (!gesture.moved) return;
    touchTapRef.current.cancel();
    const z = next.count > 1 ? Math.min(3.5, Math.max(0.01, gesture.zoom * next.distance / gesture.distance)) : gesture.zoom;
    const r = viewportRef.current.getBoundingClientRect();
    queueView({ x: gesture.view.x + (gesture.x - r.left) / gesture.zoom - (next.x - r.left) / z,
      y: gesture.view.y + (gesture.y - r.top) / gesture.zoom - (next.y - r.top) / z }, z);
  };
  const endTouch = event => {
    event.preventDefault(); event.stopPropagation();
    touchGuardRef.current.update(event.touches, touchLocked());
    touchTapRef.current.move(event.changedTouches);
    if (touchLocked()) touchTapRef.current.cancel();
    if (!event.touches.length && touchTapRef.current.end(event.touches)) props.onUndo?.();
    // Remaining fingers after a pinch do not silently turn into a new drag.
    if (gestureRef.current?.touch && event.touches.length < gestureRef.current.count) gestureRef.current = null;
  };
  const cancelTouch = event => {
    event.preventDefault(); event.stopPropagation();
    touchGuardRef.current.update(event.touches, true); touchTapRef.current.cancel(); gestureRef.current = null;
    cancelAnimationFrame(rafRef.current); rafRef.current = null; pendingViewRef.current = null; pendingZoomRef.current = null;
  };
  useLayoutEffect(() => () => {
    touchGuardRef.current.suspend(); touchTapRef.current.cancel(); gestureRef.current = null;
    cancelAnimationFrame(rafRef.current); rafRef.current = null; pendingViewRef.current = null; pendingZoomRef.current = null;
  }, [page.id, props.activeTool]);

  const fit = () => {
    const bounds = getWhiteboardContentBounds(page);
    const z = Math.min(3.5, Math.max(0.000001, Math.min((size.width - 80) / bounds.width, (size.height - 80) / bounds.height)));
    setGeneration(value => value + 1); lastZoomRef.current = z; props.onZoomChange?.(z);
    queueView({ x: bounds.x - (size.width / z - bounds.width) / 2, y: bounds.y - (size.height / z - bounds.height) / 2 });
  };

  return <div ref={viewportRef} className="bn-whiteboard-viewport" data-origin-x={view.x} data-origin-y={view.y}
    onPointerDownCapture={beginPointer} onPointerMoveCapture={movePointer} onPointerUpCapture={endPointer} onPointerCancelCapture={endPointer} onLostPointerCaptureCapture={endPointer}
    onTouchStartCapture={beginTouch} onTouchMoveCapture={moveTouch} onTouchEndCapture={endTouch} onTouchCancelCapture={cancelTouch}>
    <CanvasBoard key={`${page.id}-${generation}`} {...props} page={viewportPage} zoom={1} activeWidth={props.activeWidth * zoom}
      onBatchUpdatePage={update} onStrokesChange={(strokes, options) => update({ strokes }, options)} onTextElementsChange={textElements => update({ textElements })}
      onImageElementsChange={imageElements => update({ imageElements })} />
    <div className="bn-whiteboard-controls">
      <span><InfinityIcon size={16} /> {t('template_whiteboard', 'Whiteboard')}</span>
      <span className="bn-whiteboard-hint">{t('whiteboardPanHint', 'One finger to pan; two fingers to zoom')}</span>
      <button type="button" onClick={fit} title={t('whiteboardFit', 'Show all content')}><Maximize size={16} /><span>{t('whiteboardFit', 'Show all content')}</span></button>
    </div>
  </div>;
};
