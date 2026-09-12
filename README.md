# 🖊️ BetterNote Pro Studio (Surface PC Edition)

<div align="center">

<img src="app-icon.png" width="128" height="128" alt="BetterNote Pro Studio Icon" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);" />

**High-Performance Digital Handwriting, Stylus Notebook, and PDF Annotation Studio for Windows PC & Surface**
*Ultra-Responsive, Zero-Lag, Offline-First Digital Inking with Multi-Document Studio Tabs*

[![Electron](https://img.shields.io/badge/Electron-44.2.0-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailored for Windows](https://img.shields.io/badge/Platform-Windows%2010%2F11%20%7C%20Surface-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://www.microsoft.com/surface)
[![Download for Windows](https://img.shields.io/badge/⬇️_Download-v1.1.0_(Windows_x64)-2ea44f?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/NoteGuys/BetterNotePC/releases/download/v1.1.0/BetterNotePC-v1.1.0-Windows-x64.zip)
[![Latest Release](https://img.shields.io/badge/Release-v1.1.0-blue?style=for-the-badge)](https://github.com/NoteGuys/BetterNotePC/releases/latest)

</div>

---

## 🚀 Instant Download & Run (No Setup Required)

For Windows 10 and Windows 11 users, a pre-compiled standalone package is available without requiring Node.js or additional dependencies:

📦 **👉 [Download BetterNotePC v1.1.0 (Windows 64-bit .zip)](https://github.com/NoteGuys/BetterNotePC/releases/download/v1.1.0/BetterNotePC-v1.1.0-Windows-x64.zip)** *(~151 MB)*

> **💡 Quick Start Guide:**
> 1. Download the `.zip` archive from the link above.
> 2. Right-click the file and select **Extract All...**.
> 3. Double-click **`BetterNotePC.exe`** to launch the studio and start inking immediately!

---

## 🌟 Overview & Vision

Traditional note-taking applications on Windows often suffer from high pen latency, inconsistent stylus pressure curves, accidental palm touches, slow document switching, and heavy sync routines that cause Windows to freeze with "(Not Responding)" dialogs.

**BetterNote Pro Studio** is built from the ground up to solve these challenges:
- **120Hz Hardware-Accelerated Inking**: 3-layer decoupled canvas architecture with Pointer Events and coalesced event sampling.
- **Multi-Document Top Tab Bar**: Keep up to 5 notebooks open simultaneously with exact page retention, instant tab switching, and dedicated home navigation.
- **Zero-Lag Dual-Agent Backup Engine**: Background differential synchronization to Google Drive and local drives that yields to the UI thread every 20ms.
- **Viewport Virtualization**: GPU-efficient rendering that unmounts offscreen canvases to prevent VRAM starvation on documents with 100+ pages.

---

## 🚀 Comprehensive Features

### 1. 📑 Multi-Document Top Tab Bar (Multi-Tasking Studio)
- **Tabbed Multitasking (Max 5 Stacked Tabs)**: Open multiple notebooks and switch between them in milliseconds.
- **Exact Page Retention**: Remembers the exact page where you left off on each notebook. Switching back returns directly to that page.
- **LRU Automatic Eviction**: Strictly maintains the 5-tab maximum by intelligently closing the least recently used tab when opening a sixth document.
- **Live Page Badges**: Displays current active page number on each tab pill.
- **Quick Tab Closing & Re-Ordering**: Individual close buttons with smooth transition animations.

---

### 2. ✍️ Professional Inking Engine (Low-Latency Stylus)
- **3-Layer Decoupled Canvas Architecture**:
  - *Layer 1 (Background)*: Vector paper templates and high-DPI PDF page renders.
  - *Layer 2 (Static Ink)*: Committed strokes, text boxes, and snip stickers.
  - *Layer 3 (Active In-Flight)*: Transparent real-time layer updating at 60–120 FPS.
- **3 Realistic Pen Nibs**:
  - ✒️ **Fountain Pen**: Dynamic line variation with pressure sensitivity and classic nib characteristics.
  - 🖊️ **Ballpoint Pen**: Consistent line thickness ideal for extensive lecture notes and writing.
  - 🖌️ **Brush / Calligraphy**: Broad pressure response curve creating expressive strokes.
- **Tapered Stroke Physics**: Natural entry and exit tapering mimicking real ink pen physics.
- **Independent Tool Width Memory**: Pen, highlighter, eraser, and shapes remember their individual stroke widths independently.
- **Smart Semi-Transparent Highlighter**: Rendered via `multiply` blending, allowing text underneath to remain crisp and legible.

---

### 3. 🤹 Smart Gestures & Surface Palm Rejection
- **Scribble-to-Erase**:
  - Cross out any incorrect word or stroke with 2–4 quick back-and-forth pen strokes to erase it instantly.
  - Supports wide headlines up to **1,600px** with bounding box density checks to prevent false triggers during cursive writing.
  - Erases targeted strokes while keeping adjacent lines and surrounding text intact.
- **Two-Finger Double-Tap Undo**:
  - Double tap with two fingers within 480ms to trigger instant Undo with a visual toast notification.
  - Protected against accidental triggers from resting palms or single-finger taps.
- **Fluid Pinch-to-Zoom & Pan**:
  - Seamless two-finger navigation with viewport anchor lock preventing canvas jumping.
- **Hardware-Grade Palm Rejection & Screen Lock (New in v1.1.0)**:
  - Complete screen-lock while writing with pen: prevents resting palms from accidentally scrolling or shifting pages.
  - 1,200ms active protection window after stylus lift to prevent palm shifts between words.
  - Contact geometry filtering rejects touches with width/height > 28px.
  - Radiant glowing neon emerald shield button with pulsing animation when active.

---

### 4. 📐 QuickShape Recognition & Snapping
- Draw a shape and hold the stylus stationary for 400ms to snap into precise geometric vectors:
  - 📏 **Straight Lines** with automatic angle snapping (0°, 45°, 90°, 180°).
  - 🔺 **Triangles** with corner snapping and center-scale transformation.
  - ⬛ **Rectangles & Squares**.
  - ⭕ **Circles & Ellipses**.
  - ⬡ **Regular Polygons**.

---

### 5. 📄 PDF Import & Real-Time Annotation
- Import multi-page PDF textbooks, assignments, and slides powered by local `pdfjs-dist`.
- High-DPI background rendering supporting direct handwriting, highlighting, and sticky notes on every page.
- **High-Fidelity PDF Export**: Converts all pages, strokes, images, and templates back into native PDF files compatible with Adobe Acrobat and Microsoft Edge.

---

### 6. ✂️ Snip, Lasso Selection & External Image Pasting
- **External Image Paste (New in v1.1.0)**:
  - Paste images directly from the Windows system clipboard into any note page.
  - Full support for **Windows Snipping Tool (`Win + Shift + S`)**, File Explorer copied image files (`.png`, `.jpg`, `.webp`), web browsers, and screenshots.
  - Easily paste via the Canvas Long-Press / Right-Click Context Menu ("วาง") or the Top Toolbar Paste button.
  - Zero-lag image scaling, drag-to-reposition, and corner resizing.
- **Snip Area Tool**: Draw a selection box to crop any handwritten note or image and copy it to the clipboard.
- **Lasso Selection**: Freehand outline strokes, text, and images to move, duplicate, resize, recolor, or delete them in one click.
- **Object Drag Lock**: Screen never pans or shifts while dragging or resizing images and lasso selections.

---

### 7. 🛡️ Dual-Agent Cloud Sync & Backup Engine
- **Automated Backup to Google Drive and Local Storage**:
  - Primary Cloud Directory: `H:\My Drive\BetterNote.AppPC` (or mapped Google Drive path).
  - Local Backup Directory: `BetterNote_Backups/`.
- **Tri-Format Redundant Storage**:
  1. `PDF_Documents/*.pdf`: Complete rendered PDF documents.
  2. `Editable_Notes/*.bnote`: Editable note files containing vector strokes and metadata.
  3. `Full_System/BetterNote_Latest_Backup.json`: System-wide database backup for instant device migration.
- **Zero-Lag Differential Sync**: Only writes modified notebooks (`updatedAt > lastBackupTime`) with non-blocking 20ms execution slices.
- **Native File Reveal**: Click "Reveal File ↗" in the Backup Status dialog to open and highlight the file directly in Windows Explorer.

---

## 🛠️ Technology Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Desktop Framework** | [Electron 44](https://www.electronjs.org/) | Windows desktop runtime, native IPC, and file system management |
| **UI Framework** | [React 18](https://reactjs.org/) | Modular UI components, reactive state, and tab lifecycle |
| **Build Tool** | [Vite 6](https://vitejs.dev/) | Sub-second HMR and optimized production bundling |
| **Styling** | Pure Vanilla CSS (`.bn-*`) | Glassmorphic design system without utility compiler overhead |
| **Database** | HTML5 IndexedDB (`idb`) | 100% offline-first local persistence for strokes, pages, and notebooks |
| **PDF Engine** | `pdfjs-dist` & `jspdf` | PDF parsing, high-DPI rendering, and binary PDF export |
| **Icons** | [Lucide React](https://lucide.dev/) | Clean, modern vector icon set |

---

## 📂 Project Structure

```text
BetterNote/
├── electron/
│   ├── main.cjs            # Electron Main Process (IPC Handlers, Window Management, File Reveal)
│   └── preload.cjs         # Context Bridge Preload API (Secure Renderer Exposure)
├── src/
│   ├── components/
│   │   ├── Common/         # DocumentTabBar, Navbar, Modals, Export Dialogs
│   │   ├── Editor/         # CanvasBoard, NoteEditor, EditorToolbar, ThumbnailSidebar
│   │   └── Library/        # LibraryView, FolderCard, NotebookCard, BackupStatusModal
│   ├── services/
│   │   ├── appCacheService.js    # Deduplicated LRU Cache Engine
│   │   ├── autoBackupService.js  # Non-blocking Background Sync & Restore Engine
│   │   ├── db.js                 # IndexedDB Local Storage Manager
│   │   └── fileSystemService.js  # Import/Export .bnote and .json Backup Files
│   ├── utils/
│   │   ├── inkingEngine.js       # Stylus Rendering, Tapering, Scribble-to-Erase
│   │   ├── pdfExportEngine.js    # Multi-page PDF Generator
│   │   └── shapeRecognition.js   # Geometric QuickShape Snapping Engine
│   ├── index.css                 # Vanilla CSS Design System & Theme Engine
│   ├── App.jsx                   # Root Application & Multi-Document Tab Manager
│   └── main.jsx                  # React DOM Entrypoint
├── package.json
├── vite.config.js
└── README.md
```

---

## 💻 Installation & Development

### System Requirements
- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Recommended Hardware**: Touchscreen device with stylus support (Surface Pro, Surface Laptop Studio, or Windows Ink 2-in-1 laptop)
- **Node.js**: v18.0.0 or later

### Running Locally in Development Mode
```bash
# 1. Install dependencies
npm install

# 2. Run the Vite development server
npm run dev

# 3. Launch the Electron Desktop application
npm run app
```

### Production Build
```bash
# 1. Compile the React bundle
npm run build

# 2. Package into a Windows standalone executable
npm run pack
```

---

## ⌨️ Shortcuts & Gesture Reference

| Gesture / Shortcut | Action | Description |
| :--- | :--- | :--- |
| **Two-Finger Double Tap** | Double Tap Undo | Undoes the last stroke or action |
| **Two-Finger Pinch** | Pinch-to-Zoom | Smoothly scales page view (35% to 350%) |
| **Two-Finger Drag** | Two-Finger Pan | Navigates the canvas without inking |
| **Single-Finger Horizontal Swipe** | Flip Page | Flips between pages in horizontal mode |
| **Pen Scribble (Back-and-Forth)** | Scribble-to-Erase | Erases targeted handwriting immediately |
| **Stroke Hold (400ms)** | QuickShape Snap | Snaps freehand stroke into geometric shape |
| `Ctrl + Z` | Undo | Reverts last canvas change |
| `Ctrl + Y` | Redo | Reapplies reverted canvas change |
| `Ctrl + V` | Paste Image | Pastes cropped snip onto current page |
| `Ctrl + Wheel` | Trackpad Zoom | Zooms in/out anchored to cursor |

---

## 📄 License

BetterNote Pro Studio is developed for high-performance stylus note-taking on Windows & Surface devices.  
Copyright © 2026 BetterNote Studio. All rights reserved.
