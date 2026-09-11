import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Pen, 
  Highlighter, 
  Eraser, 
  Square, 
  Type, 
  Hand, 
  RotateCcw, 
  RotateCw, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  LayoutGrid,
  ChevronDown,
  ShieldCheck,
  MousePointer,
  Scissors,
  Feather,
  Paintbrush,
  ScrollText,
  Copy,
  Camera,
  ClipboardPaste,
  SlidersHorizontal,
  FileText,
  LassoSelect,
  Triangle,
  FilePlus,
  Star
} from 'lucide-react';

const DEFAULT_PRESET_COLORS = [
  '#1e293b', // Midnight Black
  '#2563eb', // Royal Blue
  '#dc2626', // Crimson Red
  '#16a34a', // Emerald Green
  '#ea580c'  // Sunset Orange
];

const TOOL_PRESET_WIDTHS = {
  pen: [
    { label: 'Fine', value: 2, dotSize: 4 },
    { label: 'Medium', value: 4, dotSize: 7 },
    { label: 'Broad', value: 8, dotSize: 11 }
  ],
  highlighter: [
    { label: 'Fine', value: 12, dotSize: 6 },
    { label: 'Medium', value: 20, dotSize: 10 },
    { label: 'Broad', value: 32, dotSize: 14 }
  ],
  eraser: [
    { label: 'Small', value: 10, dotSize: 6 },
    { label: 'Medium', value: 20, dotSize: 10 },
    { label: 'Large', value: 40, dotSize: 15 }
  ],
  shape: [
    { label: 'Fine', value: 2, dotSize: 4 },
    { label: 'Medium', value: 4, dotSize: 7 },
    { label: 'Bold', value: 6, dotSize: 10 }
  ]
};

export const EditorToolbar = ({
  notebookTitle,
  onRenameTitle,
  onBackToLibrary,
  onDuplicateNotebook,
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  activeWidth,
  setActiveWidth,
  toolWidths = {},
  onToolWidthChange,
  activeShape,
  setActiveShape,
  penNib,
  setPenNib,
  isTapered,
  setIsTapered,
  usePressure = true,
  setUsePressure,
  pressureSensitivity,
  setPressureSensitivity,
  eraserMode,
  setEraserMode,
  scribbleToErase = true,
  setScribbleToErase,
  penOnly,
  setPenOnly,
  scrollDirection,
  setScrollDirection,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onOpenExport,
  onExportCurrentPagePdf,
  showThumbnails,
  setShowThumbnails,
  onOpenAddPage,
  isCurrentPageFavorite = false,
  onToggleFavoriteCurrentPage,
  hasClipboardImage,
  onPasteClipboardImage,
  onCaptureFullPage
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(notebookTitle);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showPenSettings, setShowPenSettings] = useState(false);
  const [showEraserMenu, setShowEraserMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // 5 Quick Color Slots (Persisted in localStorage for Studio style palette)
  const [colorSlots, setColorSlots] = useState(() => {
    try {
      const saved = localStorage.getItem('betternote_quick_color_slots');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (parsed.length >= 5) return parsed.slice(0, 5);
          // If previously saved with fewer slots (e.g. 3), pad with defaults up to 5
          const merged = [...parsed];
          for (let i = merged.length; i < 5; i++) {
            merged.push(DEFAULT_PRESET_COLORS[i]);
          }
          return merged;
        }
      }
    } catch (_) {}
    return DEFAULT_PRESET_COLORS;
  });

  const handleSelectSlotColor = (col) => {
    setActiveColor(col);
  };

  const handleCustomColorChange = (newColor) => {
    setActiveColor(newColor);
    // Replace the slot closest to or currently active, or the last (5th) slot
    setColorSlots(prev => {
      const updated = [...prev];
      const matchIdx = updated.findIndex(c => c.toLowerCase() === activeColor.toLowerCase());
      if (matchIdx !== -1) {
        updated[matchIdx] = newColor;
      } else {
        updated[updated.length - 1] = newColor; // update last slot (5th slot)
      }
      try {
        localStorage.setItem('betternote_quick_color_slots', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const handleTitleSubmit = (e) => {
    e.preventDefault();
    if (tempTitle.trim()) {
      onRenameTitle(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  // Close menus when clicking outside
  const closeAllPopovers = () => {
    setShowPenSettings(false);
    setShowShapeMenu(false);
    setShowEraserMenu(false);
    setShowExportMenu(false);
  };

  return (
    <div className="bn-editor-toolbar-container" onClick={(e) => {
      // Don't close if clicking inside a dropdown
      if (!e.target.closest('.bn-pen-settings-dropdown') && !e.target.closest('.bn-shape-dropdown')) {
        closeAllPopovers();
      }
    }}>
      {/* Left Section: Back, Page Thumbnails, Document Title */}
      <div className="bn-editor-toolbar-left">
        <button 
          className="bn-btn-icon" 
          onClick={onBackToLibrary}
          title="กลับไปที่เอกสารทั้งหมด (Back to Library)"
        >
          <ArrowLeft size={19} />
        </button>

        <button 
          className={`bn-btn-icon ${showThumbnails ? 'bn-btn-icon-active' : ''}`}
          onClick={() => setShowThumbnails(!showThumbnails)}
          title="มุมมองหน้าทั้งหมด (Page Thumbnails)"
        >
          <LayoutGrid size={18} />
        </button>

        {/* Add Page Button (Standard placement) */}
        <button 
          className="bn-btn-icon text-blue-400 hover:text-white"
          onClick={onOpenAddPage}
          title="เพิ่มหน้ากระดาษใหม่ (A2, A3, A4, ลายจุด, เส้นแคบ, เส้นกว้าง)"
        >
          <FilePlus size={18} />
        </button>

        {/* Favorite Current Page Button */}
        <button 
          className={`bn-toolbar-star-btn ${isCurrentPageFavorite ? 'bn-star-active' : ''}`}
          onClick={onToggleFavoriteCurrentPage}
          title={isCurrentPageFavorite ? 'ยกเลิกติดดาวหน้านี้' : 'ติดดาวหน้านี้ (เพิ่มในรายการโปรด)'}
        >
          <Star 
            size={18} 
            fill={isCurrentPageFavorite ? '#f59e0b' : 'none'} 
            color={isCurrentPageFavorite ? '#f59e0b' : 'currentColor'}
            className={isCurrentPageFavorite ? 'bn-star-gold' : ''}
          />
        </button>

        <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

        {/* Notebook Title (Click to rename) */}
        <div className="bn-toolbar-title-wrapper">
          {isEditingTitle ? (
            <form onSubmit={handleTitleSubmit}>
              <input 
                type="text" 
                className="bn-title-input"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                autoFocus
              />
            </form>
          ) : (
            <span 
              className="bn-toolbar-title" 
              onClick={() => {
                setTempTitle(notebookTitle);
                setIsEditingTitle(true);
              }}
              title="คลิกเพื่อเปลี่ยนชื่อสมุดโน้ต"
            >
              {notebookTitle}
            </span>
          )}
        </div>
      </div>

      {/* Center Section: Floating Glass Pill */}
      <div className="bn-editor-toolbar-center">
        <div className="bn-tool-pill">
          {/* Pen with Sub-Pip & Settings Dropdown */}
          <div className="relative">
            <button 
              className={`bn-tool-btn ${activeTool === 'pen' ? 'bn-tool-btn-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (activeTool === 'pen') {
                  setShowPenSettings(!showPenSettings);
                } else {
                  setActiveTool('pen');
                  setShowPenSettings(false);
                }
              }}
              title={`ปากกา: ${penNib === 'fountain' ? 'หมึกซึม' : penNib === 'ballpoint' ? 'ลูกลื่น' : 'พู่กัน'} (แตะซ้ำเพื่อตั้งค่าหัวปากกา)`}
            >
              {penNib === 'fountain' ? <Feather size={17} /> : penNib === 'brush' ? <Paintbrush size={17} /> : <Pen size={17} />}
              {/* Color pip under pen icon */}
              <div 
                className="bn-tool-color-pip" 
                style={{ backgroundColor: activeColor }}
              />
            </button>

            {/* Minimalist Studio Pen Settings Popover */}
            {showPenSettings && (
              <div 
                className="bn-pen-settings-dropdown" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-[12px] font-bold text-zinc-100 border-b border-white/10 pb-2 mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal size={14} className="text-blue-400" />
                    <span>ตั้งค่าหัวปากกา & แรงกด</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">Surface Inking</span>
                </div>

                {/* Nib Types Segmented Choice */}
                <div className="space-y-1 mb-3">
                  <div className="text-[11px] font-medium text-zinc-400">ชนิดหัวปากกา</div>
                  <div className="grid grid-cols-3 gap-1 bg-zinc-900/60 p-1 rounded-lg border border-white/10">
                    <button 
                      className={`bn-nib-choice-btn ${penNib === 'fountain' ? 'bn-nib-choice-active' : ''}`}
                      onClick={() => setPenNib('fountain')}
                    >
                      <Feather size={13} />
                      <span>หมึกซึม</span>
                    </button>
                    <button 
                      className={`bn-nib-choice-btn ${penNib === 'ballpoint' ? 'bn-nib-choice-active' : ''}`}
                      onClick={() => setPenNib('ballpoint')}
                    >
                      <Pen size={13} />
                      <span>ลูกลื่น</span>
                    </button>
                    <button 
                      className={`bn-nib-choice-btn ${penNib === 'brush' ? 'bn-nib-choice-active' : ''}`}
                      onClick={() => setPenNib('brush')}
                    >
                      <Paintbrush size={13} />
                      <span>พู่กัน</span>
                    </button>
                  </div>
                </div>

                {/* Tapered Stroke Setting */}
                <div className="mb-2.5 pt-2 border-t border-white/10">
                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <span className="text-xs text-zinc-200 font-medium">คมต้น-คมปลาย (Tapered)</span>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                      checked={isTapered}
                      onChange={(e) => setIsTapered(e.target.checked)}
                    />
                  </label>
                  <span className="text-[10px] text-zinc-400 block">
                    {isTapered ? 'เปิด: ปลายเรียวแหลมพลิ้วไหว สไตล์ปากกาคัดลายมือ' : 'ปิด: เส้นหัวมนสม่ำเสมอคงที่'}
                  </span>
                </div>

                {/* Pen Pressure Switch Setting */}
                <div className="mb-2.5 pt-2 border-t border-white/10">
                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <span className="text-xs text-zinc-200 font-medium">น้ำหนักกดปากกา (Pressure)</span>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                      checked={usePressure}
                      onChange={(e) => setUsePressure && setUsePressure(e.target.checked)}
                    />
                  </label>
                  <span className="text-[10px] text-zinc-400 block">
                    {usePressure ? 'เปิด: เส้นหนาบางตามแรงกดจริงของ Surface Pen' : 'ปิด: เส้นคงที่'}
                  </span>
                </div>

                {/* Pressure Sensitivity Levels (when pressure is ON) */}
                {usePressure && (
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-medium text-zinc-400 mb-1.5">ความไวต่อแรงกด</div>
                    <div className="grid grid-cols-3 gap-1 bg-zinc-900/60 p-1 rounded-lg border border-white/10">
                      {['low', 'medium', 'high'].map(lvl => (
                        <button
                          key={lvl}
                          className={`bn-nib-choice-btn ${pressureSensitivity === lvl ? 'bn-nib-choice-active' : ''}`}
                          onClick={() => setPressureSensitivity(lvl)}
                        >
                          {lvl === 'low' ? 'เบา' : lvl === 'medium' ? 'ปกติ' : 'สูง'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scribble to Erase Toggle Setting */}
                <div className="mb-2.5 pt-2 border-t border-white/10">
                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <span className="text-xs text-zinc-200 font-medium">ขยี้เส้นเพื่อลบ (Scribble to Erase)</span>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                      checked={scribbleToErase}
                      onChange={(e) => setScribbleToErase && setScribbleToErase(e.target.checked)}
                    />
                  </label>
                  <span className="text-[10px] text-zinc-400 block">
                    {scribbleToErase ? 'เปิด: ขยี้ลายเส้นซ้ำๆ รวดเร็วเพื่อลบ' : 'ปิด: ปิดระบบขยี้ลบ (เขียนตัวหนังสือหยักได้ไม่เผลอลบ)'}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-white/10 flex justify-end">
                  <button 
                    className="bn-btn-primary bn-btn-sm py-1 px-3 text-xs" 
                    onClick={() => setShowPenSettings(false)}
                  >
                    เรียบร้อย
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Highlighter */}
          <button 
            className={`bn-tool-btn ${activeTool === 'highlighter' ? 'bn-tool-btn-active' : ''}`}
            onClick={() => { setActiveTool('highlighter'); closeAllPopovers(); }}
            title="ปากกาไฮไลท์ (Highlighter)"
          >
            <Highlighter size={17} />
          </button>

          {/* Eraser */}
          <div className="relative">
            <button 
              className={`bn-tool-btn ${activeTool === 'eraser' ? 'bn-tool-btn-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (activeTool === 'eraser') {
                  setShowEraserMenu(!showEraserMenu);
                } else {
                  setActiveTool('eraser');
                  setShowEraserMenu(false);
                }
              }}
              title={`ยางลบ: ${eraserMode === 'precision' ? 'ลบเฉพาะจุดสัมผัส (Precision)' : 'ลบทั้งเส้น (Whole Stroke)'} (แตะซ้ำเพื่อเปลี่ยนโหมด)`}
            >
              <Eraser size={17} />
            </button>

            {showEraserMenu && (
              <div 
                className="bn-shape-dropdown" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-[11px] font-bold text-zinc-400 px-2 py-1">โหมดยางลบ</div>
                <button 
                  className={`bn-shape-item ${eraserMode === 'precision' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('eraser'); setEraserMode('precision'); setShowEraserMenu(false); }}
                >
                  <Scissors size={14} />
                  <span>ลบเฉพาะจุดสัมผัส (Precision)</span>
                </button>
                <button 
                  className={`bn-shape-item ${eraserMode === 'stroke' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('eraser'); setEraserMode('stroke'); setShowEraserMenu(false); }}
                >
                  <Eraser size={14} />
                  <span>ลบทั้งเส้น (Stroke Eraser)</span>
                </button>
              </div>
            )}
          </div>

          {/* Shapes Tool */}
          <div className="relative">
            <button 
              className={`bn-tool-btn ${activeTool === 'shape' ? 'bn-tool-btn-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (activeTool === 'shape') {
                  setShowShapeMenu(!showShapeMenu);
                } else {
                  setActiveTool('shape');
                  setShowShapeMenu(false);
                }
              }}
              title="วาดรูปทรงเรขาคณิต (Shapes)"
            >
              {activeShape === 'circle' ? (
                <div className="w-4 h-4 rounded-full border border-current" />
              ) : activeShape === 'triangle' ? (
                <Triangle size={17} />
              ) : (
                <Square size={17} />
              )}
            </button>

            {showShapeMenu && (
              <div 
                className="bn-shape-dropdown" 
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  className={`bn-shape-item ${activeShape === 'rectangle' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('shape'); setActiveShape('rectangle'); setShowShapeMenu(false); }}
                >
                  <Square size={15} />
                  <span>สี่เหลี่ยม</span>
                </button>
                <button 
                  className={`bn-shape-item ${activeShape === 'triangle' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('shape'); setActiveShape('triangle'); setShowShapeMenu(false); }}
                >
                  <Triangle size={15} />
                  <span>สามเหลี่ยม</span>
                </button>
                <button 
                  className={`bn-shape-item ${activeShape === 'circle' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('shape'); setActiveShape('circle'); setShowShapeMenu(false); }}
                >
                  <div className="w-3.5 h-3.5 rounded-full border border-current" />
                  <span>วงกลม / วงรี</span>
                </button>
                <button 
                  className={`bn-shape-item ${activeShape === 'line' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('shape'); setActiveShape('line'); setShowShapeMenu(false); }}
                >
                  <span className="font-bold text-xs">—</span>
                  <span>เส้นตรง</span>
                </button>
                <button 
                  className={`bn-shape-item ${activeShape === 'arrow' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('shape'); setActiveShape('arrow'); setShowShapeMenu(false); }}
                >
                  <span className="font-bold text-xs">➔</span>
                  <span>ลูกศร</span>
                </button>
              </div>
            )}
          </div>

          {/* Lasso Selection Tool */}
          <button 
            className={`bn-tool-btn ${activeTool === 'lasso' ? 'bn-tool-btn-active' : ''}`}
            onClick={() => { setActiveTool('lasso'); closeAllPopovers(); }}
            title="เครื่องมือบ่วงบาศก์ (Lasso Tool) - ลากคลุมลายเส้น/ข้อความ/รูป เพื่อย้าย ย่อขยาย เปลี่ยนสี คัดลอก ลบ"
          >
            <LassoSelect size={17} />
          </button>

          {/* Text Tool */}
          <button 
            className={`bn-tool-btn ${activeTool === 'text' ? 'bn-tool-btn-active' : ''}`}
            onClick={() => { setActiveTool('text'); closeAllPopovers(); }}
            title="กล่องข้อความ (Text)"
          >
            <Type size={17} />
          </button>

          {/* Snipping Tool (Windows Snipping Tool Style) */}
          <button 
            className={`bn-tool-btn ${activeTool === 'snip' ? 'bn-tool-btn-active' : ''}`}
            onClick={() => { 
              setActiveTool(activeTool === 'snip' ? 'pen' : 'snip'); 
              closeAllPopovers(); 
            }}
            title="แคปเจอร์เฉพาะจุด (Snipping Tool) - ลากกรอบเพื่อแคปภาพนำไปแปะหน้าอื่น"
          >
            <Scissors size={17} />
          </button>

          {/* Hand Pan Tool */}
          <button 
            className={`bn-tool-btn ${activeTool === 'hand' ? 'bn-tool-btn-active' : ''}`}
            onClick={() => { setActiveTool('hand'); closeAllPopovers(); }}
            title="เลื่อนหน้าจอ (Hand Pan)"
          >
            <Hand size={17} />
          </button>

          {/* Divider */}
          <div className="w-[1px] h-4 bg-white/15 mx-1" />

          {/* Quick 3-Color Swatches + Custom (+) Picker (Studio style) */}
          <div className="bn-quick-colors flex items-center gap-1.5 px-1">
            {colorSlots.map((col, idx) => {
              const isSelected = activeColor.toLowerCase() === col.toLowerCase();
              return (
                <button
                  key={`${col}-${idx}`}
                  className={`bn-quick-color-btn ${isSelected ? 'bn-quick-color-active' : ''}`}
                  style={{ backgroundColor: col }}
                  onClick={() => handleSelectSlotColor(col)}
                  title={`สีสล็อต #${idx + 1}: ${col}`}
                />
              );
            })}

            {/* Custom Color (+) Button */}
            <div 
              className="relative w-5 h-5 rounded-full flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-white/20 cursor-pointer flex-shrink-0 transition-transform hover:scale-110" 
              title="เลือกสีเพิ่มเติม (อัปเดตสล็อตสีอัตโนมัติ)"
            >
              <span className="text-[11px] font-bold text-zinc-300 pointer-events-none leading-none">+</span>
              <input 
                type="color"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={activeColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="w-[1px] h-4 bg-white/15 mx-1" />

          {/* Quick Stroke Width Slots (Context-aware for Pen, Highlighter, Eraser, Shape) */}
          {(() => {
            const presets = TOOL_PRESET_WIDTHS[activeTool] || TOOL_PRESET_WIDTHS.pen;
            const currentWidth = (toolWidths && toolWidths[activeTool] !== undefined)
              ? toolWidths[activeTool] 
              : activeWidth;

            return (
              <div className="bn-quick-widths flex items-center gap-1">
                {presets.map(w => (
                  <button
                    key={w.value}
                    className={`bn-width-btn ${currentWidth === w.value ? 'bn-width-btn-active' : ''}`}
                    onClick={() => {
                      setActiveWidth(w.value);
                      if (onToolWidthChange) onToolWidthChange(activeTool, w.value);
                    }}
                    title={`ขนาด${activeTool === 'eraser' ? 'ยางลบ' : activeTool === 'highlighter' ? 'ไฮไลท์' : 'เส้น'}: ${w.label} (${w.value}px)`}
                  >
                    <div 
                      className="bn-width-circle" 
                      style={{ width: `${w.dotSize}px`, height: `${w.dotSize}px` }}
                    />
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Right Section: Page Tools, Palm Rejection, Undo/Redo, Zoom & Export */}
      <div className="bn-editor-toolbar-right">
        {/* Snip Action Shortcuts (Capture full page & paste) */}
        <div className="flex items-center gap-0.5">
          <button
            className="bn-btn-icon"
            onClick={onCaptureFullPage}
            title="แคปภาพทั้งหน้า (Capture Page)"
          >
            <Camera size={17} />
          </button>

          <button
            className={`bn-btn-icon ${hasClipboardImage ? 'text-amber-400 font-bold' : 'text-zinc-600'}`}
            onClick={onPasteClipboardImage}
            disabled={!hasClipboardImage}
            title={hasClipboardImage ? "วางรูปภาพที่แคปไว้ (Paste Snippet)" : "ยังไม่มีภาพในคลิปบอร์ด"}
          >
            <ClipboardPaste size={17} />
          </button>
        </div>

        <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

        {/* Palm Rejection Shield (Surface Pen Only Toggle) */}
        <button 
          className={`bn-btn-icon ${penOnly ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' : 'text-zinc-400'}`}
          onClick={() => setPenOnly(!penOnly)}
          title={penOnly ? 'เปิดอยู่: โหมด Surface Pen Only (ป้องกันอุ้งมือสัมผัสจอ ไม่เลื่อนขณะเขียน)' : 'ปิดอยู่: อนุญาตให้นิ้วมือเขียนได้'}
        >
          <ShieldCheck size={18} />
        </button>

        {/* Scroll Mode Toggle (Continuous Vertical vs Horizontal) */}
        <button 
          className={`bn-btn-icon ${scrollDirection === 'vertical' ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30' : 'text-zinc-400'}`}
          onClick={() => setScrollDirection(scrollDirection === 'vertical' ? 'horizontal' : 'vertical')}
          title={scrollDirection === 'vertical' ? 'โหมดเลื่อนแนวตั้ง (บนลงล่างต่อเนื่อง) - คลิกเพื่อสลับเป็นแนวนอน' : 'โหมดพลิกหน้าแนวนอน - คลิกเพื่อสลับเป็นเลื่อนแนวตั้ง'}
        >
          <ScrollText size={17} />
        </button>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-zinc-900/60 p-0.5 rounded-lg border border-white/10">
          <button 
            className="bn-btn-icon bn-btn-undo" 
            onClick={onUndo} 
            disabled={!canUndo}
            title="ย้อนกลับ (Undo: แตะ 2 นิ้ว หรือ Ctrl+Z)"
          >
            <RotateCcw size={16} />
          </button>
          <button 
            className="bn-btn-icon bn-btn-undo" 
            onClick={onRedo} 
            disabled={!canRedo}
            title="ทำซ้ำ (Redo: Ctrl+Y)"
          >
            <RotateCw size={16} />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="bn-zoom-controls">
          <button className="bn-zoom-btn" onClick={onZoomOut} title="ซูมออก (-)">
            <ZoomOut size={13} />
          </button>
          <span className="bn-zoom-label" onClick={onResetZoom} title="คลิกเพื่อรีเซ็ต 100%">
            {Math.round(zoom * 100)}%
          </span>
          <button className="bn-zoom-btn" onClick={onZoomIn} title="ซูมเข้า (+)">
            <ZoomIn size={13} />
          </button>
        </div>

        <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

        {/* Duplicate Notebook */}
        <button 
          className="bn-btn-icon text-zinc-400 hover:text-white"
          onClick={onDuplicateNotebook}
          title="ทำสำเนาสมุดเล่มนี้ (Duplicate Notebook)"
        >
          <Copy size={16} />
        </button>

        {/* Dedicated Export PDF Button with Quick Dropdown */}
        <div className="relative">
          <button 
            className="bn-btn-export-pdf bn-btn-sm flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            onClick={(e) => {
              e.stopPropagation();
              setShowExportMenu(!showExportMenu);
            }}
            title="ส่งออกเอกสารเป็น PDF คุณภาพสูง (คลิกเพื่อเลือกหน้าหรือทั้งเล่ม)"
          >
            <FileText size={14} className="text-red-200" />
            <span>PDF</span>
            <ChevronDown size={11} className="opacity-80" />
          </button>

          {showExportMenu && (
            <div 
              className="bn-shape-dropdown right-0 left-auto min-w-[210px]" 
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                className="bn-shape-item font-medium text-red-300 hover:text-white"
                onClick={() => {
                  setShowExportMenu(false);
                  if (onExportCurrentPagePdf) onExportCurrentPagePdf();
                }}
              >
                <FileText size={14} className="text-red-400" />
                <span>ส่งออกเฉพาะหน้านี้ (.pdf)</span>
              </button>
              <button 
                className="bn-shape-item text-zinc-200"
                onClick={() => {
                  setShowExportMenu(false);
                  onOpenExport();
                }}
              >
                <Download size={14} className="text-blue-400" />
                <span>ส่งออกทั้งเล่ม / ตัวเลือกอื่น...</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
