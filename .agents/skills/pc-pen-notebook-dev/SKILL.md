---
name: pc-pen-notebook-dev
description: >-
  Expert engineering patterns for building ultra-responsive, offline-first digital handwriting,
  stylus, and PDF annotation notebook applications for Windows / Surface PC using Electron,
  HTML5 Canvas 2D, Pointer Events, Palm Rejection, and IndexedDB local persistence.
---

# PC & Surface Digital Pen Notebook Application Development Skill

This skill provides comprehensive architectural guidelines, code patterns, and performance optimizations for developing production-grade stylus handwriting notebook applications on Windows / Surface PCs.

---

## 1. Architecture Principles

### 1.1 Pure Offline-First Design
- **No Localhost / Web Server Dependency**: Applications must load production bundles (`dist/index.html`) directly via Electron's `mainWindow.loadFile()`. Never require `npm run dev` or a local HTTP server for normal app launch.
- **Direct Native IPC for Disk Operations**: Disk writes (such as automated folder backups, `.bnote` files, and exported PDFs) must utilize Electron's `ipcMain` and Node.js `fs` module, avoiding HTTP API intermediaries.
- **Local Worker Bundling**: All external workers (such as `pdfjs-dist/build/pdf.worker.min.mjs`) must be bundled locally into `dist/assets/` using Vite's `?url` import syntax rather than fetching from remote CDNs.

---

## 2. Stylus & Surface Pen Handling

### 2.1 Pointer Events & High-Frequency Sampling
To eliminate pen stroke latency and jagged lines, always leverage `PointerEvents` and `getCoalescedEvents()`:

```javascript
const handlePointerMove = (e) => {
  // Capture all intermediate micro-movements provided by the digitizer (up to 240Hz)
  const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
  
  for (const ev of events) {
    const screenX = ev.clientX;
    const screenY = ev.clientY;
    const pressure = ev.pressure || 0.5;
    
    // Transform screen coordinates to canvas space
    const canvasPoint = screenToCanvas(screenX, screenY, zoom, panOffset);
    addPointToCurrentStroke(canvasPoint, pressure);
  }
  
  renderActiveStroke();
};
```

### 2.2 Hardware Palm Rejection & Touch Disambiguation
- **Pen Priority Rule**: When `e.pointerType === 'pen'`, lock the drawing state. Reject all single-finger touch events (`e.pointerType === 'touch'`) while drawing or near the canvas.
- **Multi-Touch Gestures**: Reserve 2-finger touch interactions strictly for Canvas navigation (pinch-to-zoom and two-finger panning). Discard 1-finger touches on drawing canvases unless explicitly in Touch-Drawing mode.
- **CSS Touch Action**: Set `touch-action: none;` on drawing surfaces to prevent native Windows scroll/pan gestures from interfering with stylus strokes.

### 2.3 Quadratic Curve Smoothing
Avoid rendering raw connected lines between raw points. Use quadratic Bézier curves through midpoint interpolation for natural penmanship:

```javascript
function drawSmoothStroke(ctx, points, color, baseSize) {
  if (points.length < 2) return;
  
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(points[0].x, points[0].y);
  
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.lineWidth = baseSize * (points[i].pressure || 1.0);
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  
  ctx.stroke();
}
```

---

## 3. Dual-Layer Canvas Architecture

For high performance, separate the drawing surface into two distinct layers:
1. **Background / Committed Layer**: Contains all completed strokes, text boxes, and background templates. Rendered only when strokes are added, erased, or transformed.
2. **Active / In-Flight Layer**: A lightweight transparent overlay canvas that only renders the current stroke in real time at 60–120 FPS. Upon `pointerup`, commit the stroke to the underlying layer and clear the active overlay.

---

## 4. Multi-Touch Pinch-to-Zoom & Pan Mathematics

Maintain an exact visual anchor under the user's fingers during pinch-to-zoom:

```javascript
// Calculate center midpoint of 2 touches
const midX = (touch1.clientX + touch2.clientX) / 2;
const midY = (touch1.clientY + touch2.clientY) / 2;

// Compute new scale
const newZoom = Math.min(maxZoom, Math.max(minZoom, startZoom * (currentDist / startDist)));

// Adjust scroll / pan offset to keep midpoint stationary
const ratio = newZoom / startZoom;
const targetScrollLeft = (startScrollLeft + midX) * ratio - midX;
const targetScrollTop = (startScrollTop + midY) * ratio - midY;
```

---

## 5. Offline Data Persistence & Auto-Backup

### 5.1 Local Storage Hierarchy
1. **Instant In-Memory / IndexedDB**: Save every stroke atomically upon `pointerup` to Chromium's native IndexedDB (`idb`). IndexedDB has zero network overhead and persists across restarts.
2. **Periodic Disk Sync**: Background timer (e.g., every 10–60 minutes) and `visibilitychange` / `beforeunload` events trigger native Node.js disk writes through Electron IPC:
   - Full system JSON: `BetterNote_Latest_Backup.json`
   - Individual editable notes: `<Notebook_Name>.bnote`
   - High-fidelity PDF documents: `<Notebook_Name>.pdf`
3. **User Folder Configuration**: Allow user selection of backup locations via `dialog.showOpenDialog({ properties: ['openDirectory'] })`, saving path to IndexedDB settings.

---

## 6. Windows Surface Electron Configuration

In `main.cjs`, configure hardware acceleration and DPI scaling flags:

```javascript
app.commandLine.appendSwitch('enable-features', 'TouchEvents,VaapiVideoDecoder');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('high-dpi-support', '1');
```

And configure window preferences:
```javascript
const mainWindow = new BrowserWindow({
  width: 1400,
  height: 940,
  backgroundColor: '#090d16',
  autoHideMenuBar: true,
  icon: path.join(__dirname, '../app-icon.ico'),
  webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'),
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: false
  }
});
```
