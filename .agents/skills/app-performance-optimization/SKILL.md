---
name: app-performance-optimization
description: Master engineering guide for high-performance, zero-lag desktop and web applications. Expert patterns for eliminating UI thread freezes (Not Responding), IndexedDB memory bloat, Canvas GPU starvation, and virtual drive blocking in Electron, React, and Canvas apps.
---

# Zero-Lag High-Performance Application Engineering Guide

This skill provides architectural mandates and battle-tested patterns for building lightning-fast, zero-lag applications (especially Electron, React, HTML5 Canvas, and offline-first desktop systems) that NEVER trigger Windows "(Not Responding)" freezes.

---

## 1. The Golden Rule of the UI Thread

> **CRITICAL RULE**: The JavaScript Main Thread is sacred. Any task that takes longer than **16 milliseconds** (1 frame at 60Hz) will cause visual micro-stutter. Any task taking longer than **100 milliseconds** causes noticeable UI lag. Any task taking longer than **5,000 milliseconds** causes the Windows operating system to mark the window as **"(Not Responding)"**.

### Anti-Patterns to NEVER Commit:
1. **Never perform synchronous PDF generation or image encoding on the main thread.**
   - *Bad*: Calling `html2canvas` or `jsPDF` for multiple pages in an automated background loop.
   - *Good*: Offload to a Web Worker, or perform lazily only on explicit user export with non-blocking chunks (`await new Promise(r => setTimeout(r, 0))`).
2. **Never call `store.getAll()` on IndexedDB tables that contain raw images or base64 blobs.**
   - *Bad*: `store.getAll()` on a `pages` table containing 100MB of PDF page images. This forces V8 to deserialize tens of megabytes of strings in one blocking tick, freezing the event loop.
   - *Good*: Use `openCursor` to stream, or separate metadata (`id`, `notebookId`, `pageIndex`, `updatedAt`) into a lightweight index and store large media blobs separately.
3. **Never fetch database records or render offscreen canvases inside list/grid item components.**
   - *Bad*: Having `<NotebookCard>` call `getPagesByNotebookId()` and `renderPageToCanvasDataUrl()` on mount. If the library has 20 cards, 20 heavy queries and canvas operations execute simultaneously!
   - *Good*: The list/grid should only display pre-computed metadata or lightweight covers. Deep page data is loaded ONLY when the user actually opens that specific notebook.
4. **Never execute synchronous filesystem calls on network or virtual drives.**
   - *Bad*: `fs.existsSync('H:\\My Drive')` or `fs.writeFileSync(...)` on mapped Google Drive / OneDrive virtual mounts. Windows network timeouts can freeze the Electron Main process for 30 seconds.
   - *Good*: Always use asynchronous non-blocking I/O (`fs.promises` or callback with timeout guards).

---

## 2. IndexedDB & Data Layer Performance

### 2.1 Separation of Metadata and Heavy Blobs
When storing documents with rich media:
- **Metadata Store**: `{ id, notebookId, pageIndex, title, strokeCount, isFavorite, updatedAt }` (lightweight, instant queries).
- **Media Store**: `{ pageId, pdfPageImage, fullResCanvas }` (lazy-loaded on demand).

### 2.2 Streaming Cursors for Favorites & Search
Instead of `store.getAll().filter(...)`:
```javascript
export const getFavoritePagesFast = async () => {
  const store = await getStore('pages', 'readonly');
  return new Promise((resolve, reject) => {
    const favorites = [];
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        if (cursor.value.isFavorite) {
          // Only collect lightweight fields
          const { id, notebookId, pageIndex, isFavorite, thumbnailUrl, updatedAt } = cursor.value;
          favorites.push({ id, notebookId, pageIndex, isFavorite, thumbnailUrl, updatedAt });
        }
        cursor.continue();
      } else {
        resolve(favorites);
      }
    };
    req.onerror = () => reject(req.error);
  });
};
```

---

## 3. Viewport Virtualization for Canvas & Large Documents

### 3.1 The 4GB GPU Memory Trap
- A single high-DPI HTML5 Canvas (2400x3200 at 32-bit RGBA) consumes **~30.7 MB** of GPU VRAM.
- A 3-layer inking architecture (Background, Static Ink, Active Stroke) consumes **~92 MB per page**.
- Mounting 50 pages simultaneously consumes **4.6 GB of GPU memory**, instantly crashing or freezing Chromium's GPU process.

### 3.2 Viewport Windowing Pattern
In multi-page vertical scroll views, only mount `<CanvasBoard>` for pages within the active viewport buffer ($\pm 2$ pages from current page):
```jsx
{pages.map((p, idx) => {
  const isNearViewport = Math.abs(idx - currentPageIndex) <= 2;
  const pWidth = p.pageWidth || 1200;
  const pHeight = p.pageHeight || 1600;

  return (
    <div key={p.id} id={`page-${idx}`} data-page-index={idx}>
      {isNearViewport ? (
        <CanvasBoard page={p} ... />
      ) : (
        /* Zero-GPU Placeholder preserving exact scroll height and aspect ratio */
        <div 
          className="page-placeholder" 
          style={{ width: pWidth * zoom, height: pHeight * zoom }}
        >
          {p.thumbnailUrl && <img src={p.thumbnailUrl} loading="lazy" />}
        </div>
      )}
    </div>
  );
})}
```

---

## 4. Multi-Touch, Stylus & 120Hz Inking

### 4.1 RequestAnimationFrame Throttling for Gestures
Touch events (pinch-to-zoom, two-finger pan) fire at 120Hz-240Hz on Surface screens.
Never trigger React state re-renders synchronously on every `touchmove` event:
```javascript
const pinchRafRef = useRef(null);

const handleTouchMove = (e) => {
  if (e.touches.length === 2) {
    if (e.cancelable) e.preventDefault();
    latestTouchData.current = calculatePinch(e);
    
    if (!pinchRafRef.current) {
      pinchRafRef.current = requestAnimationFrame(() => {
        pinchRafRef.current = null;
        applyZoomAndScroll(latestTouchData.current);
      });
    }
  }
};
```

### 4.2 Desynchronized 2D Canvas Bug on Windows
Never use `{ desynchronized: true }` on a 2D canvas that can be scrolled offscreen in Electron on Windows. Chromium's compositor buffer corrupts and turns solid black when offscreen desynchronized canvases re-enter the viewport. Use standard `getContext('2d')`.

---

## 5. Background Tasks & Auto-Sync Guidelines

1. **Never block boot sequence.** Defer background auto-backups to `requestIdleCallback` after user interaction has settled (at least 15 seconds after app launch).
2. **Cooperative Multitasking**: Whenever looping through items (e.g. importing a 50-page PDF), insert a tick yield after every item:
   ```javascript
   await new Promise(resolve => setTimeout(resolve, 0));
   ```
   This gives the browser event loop time to breathe, run garbage collection, and process UI events.
3. **Electron Main Process Isolation**: Keep `main.cjs` minimal and never run heavy data processing or synchronous file I/O inside IPC handler callbacks.
