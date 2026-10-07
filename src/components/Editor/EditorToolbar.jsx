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
  Star,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { useLanguage } from '../../services/i18n';
import { localizeNotebookCopyName } from '../../utils/notebookNames';
import { DEFAULT_TOOL_WIDTH_SLOTS, DEFAULT_QUICK_COLORS } from '../../services/userPreferences';
import { ColorWheelPicker } from '../Common/ColorWheelPicker';

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
  colorSlots = DEFAULT_QUICK_COLORS,
  onCustomColorChange,
  activeWidth,
  setActiveWidth,
  toolWidths = {},
  onToolWidthChange,
  activeShape,
  setActiveShape,
  penNib,
  setPenNib,
  highlighterTip = 'square',
  setHighlighterTip,
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
  onImportImage,
  onCaptureFullPage
}) => {
  const { t, language } = useLanguage();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(notebookTitle);
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showPenSettings, setShowPenSettings] = useState(false);
  const [showHighlighterSettings, setShowHighlighterSettings] = useState(false);
  const [showEraserMenu, setShowEraserMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showWidthSlider, setShowWidthSlider] = useState(false);
  const [activeSlotIdx, setActiveSlotIdx] = useState(1);

  // 3 Custom Width Slots per Tool (Persisted in localStorage)
  const [widthSlots, setWidthSlots] = useState(() => {
    try {
      const saved = localStorage.getItem('betternote_tool_width_slots');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            pen: Array.isArray(parsed.pen) && parsed.pen.length === 3 ? parsed.pen : DEFAULT_TOOL_WIDTH_SLOTS.pen,
            highlighter: Array.isArray(parsed.highlighter) && parsed.highlighter.length === 3 ? parsed.highlighter : DEFAULT_TOOL_WIDTH_SLOTS.highlighter,
            eraser: Array.isArray(parsed.eraser) && parsed.eraser.length === 3 ? parsed.eraser : DEFAULT_TOOL_WIDTH_SLOTS.eraser,
            shape: Array.isArray(parsed.shape) && parsed.shape.length === 3 ? parsed.shape : DEFAULT_TOOL_WIDTH_SLOTS.shape,
          };
        }
      }
    } catch (_) {}
    return DEFAULT_TOOL_WIDTH_SLOTS;
  });

  const getToolSliderConfig = (tool) => {
    switch(tool) {
      case 'highlighter':
        return { min: 4, max: 60, step: 1, chips: [8, 14, 20, 28, 36, 48] };
      case 'eraser':
        return { min: 4, max: 80, step: 2, chips: [10, 20, 30, 45, 60] };
      case 'shape':
        return { min: 0.5, max: 24, step: 0.5, chips: [1, 2, 3, 5, 8, 12] };
      case 'pen':
      default:
        return { min: 0.5, max: 24, step: 0.5, chips: [1, 1.5, 2.5, 3.5, 5, 8, 12] };
    }
  };

  const handleWidthChangeAndSaveToSlot = (newVal) => {
    const rounded = Math.round(Number(newVal) * 10) / 10;
    setActiveWidth(rounded);
    if (onToolWidthChange) onToolWidthChange(activeTool, rounded);

    // Save into active slot for activeTool
    setWidthSlots(prev => {
      const toolKey = ['pen', 'highlighter', 'eraser', 'shape'].includes(activeTool) ? activeTool : 'pen';
      const curSlots = [...(prev[toolKey] || DEFAULT_TOOL_WIDTH_SLOTS[toolKey])];
      curSlots[activeSlotIdx] = rounded;
      const updated = {
        ...prev,
        [toolKey]: curSlots
      };
      try {
        localStorage.setItem('betternote_tool_width_slots', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const handleSelectSlot = (idx) => {
    const toolKey = ['pen', 'highlighter', 'eraser', 'shape'].includes(activeTool) ? activeTool : 'pen';
    const slots = widthSlots[toolKey] || DEFAULT_TOOL_WIDTH_SLOTS[toolKey];
    const val = slots[idx] || 4;

    if (activeSlotIdx === idx) {
      setShowWidthSlider(prev => !prev);
    } else {
      setActiveSlotIdx(idx);
      setActiveWidth(val);
      if (onToolWidthChange) onToolWidthChange(activeTool, val);
    }
  };

  const handleSelectSlotColor = (color) => setActiveColor(color);

  const handleTitleSubmit = (e) => {
    e.preventDefault();
    if (tempTitle.trim()) {
      onRenameTitle(tempTitle.trim());
    }
    setIsEditingTitle(false);
  };

  // Close menus when clicking outside
  const closeAllPopovers = () => {
    setShowHighlighterSettings(false);
    setShowPenSettings(false);
    setShowShapeMenu(false);
    setShowEraserMenu(false);
    setShowExportMenu(false);
    setShowWidthSlider(false);
  };

  return (
    <div className="bn-editor-toolbar-container" onClick={(e) => {
      // Don't close if clicking inside a dropdown
      if (!e.target.closest('.bn-pen-settings-dropdown') && !e.target.closest('.bn-shape-dropdown') && !e.target.closest('.bn-width-slider-dropdown')) {
        closeAllPopovers();
      }
    }}>
      {/* Left Section: Back, Page Thumbnails, Document Title */}
      <div className="bn-editor-toolbar-left">
        <button 
          className="bn-btn-icon" 
          onClick={onBackToLibrary}
          title={t('backToLibrary', 'กลับไปที่เอกสารทั้งหมด (Back to Library)')}
        >
          <ArrowLeft size={19} />
        </button>

        <button 
          className={`bn-btn-icon ${showThumbnails ? 'bn-btn-icon-active' : ''}`}
          onClick={() => setShowThumbnails(!showThumbnails)}
          title={t('thumbnails', 'มุมมองหน้าทั้งหมด (Page Thumbnails)')}
        >
          <LayoutGrid size={18} />
        </button>

        {/* Add Page Button (Standard placement) */}
        <button 
          className="bn-btn-icon text-blue-400 hover:text-white"
          onClick={onOpenAddPage}
          title={t('addPage', 'เพิ่มหน้ากระดาษใหม่ (A2, A3, A4, ลายจุด, เส้นแคบ, เส้นกว้าง)')}
        >
          <FilePlus size={18} />
        </button>

        {/* Favorite Current Page Button */}
        <button 
          className={`bn-toolbar-star-btn ${isCurrentPageFavorite ? 'bn-star-active' : ''}`}
          onClick={onToggleFavoriteCurrentPage}
          title={isCurrentPageFavorite ? t('unstarPage', 'ยกเลิกติดดาวหน้านี้') : t('starPage', 'ติดดาวหน้านี้ (เพิ่มในรายการโปรด)')}
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
              title={t('renameNotebookPrompt', 'คลิกเพื่อเปลี่ยนชื่อสมุดโน้ต')}
            >
              {localizeNotebookCopyName(notebookTitle, t('notebookCopySuffix'))}
            </span>
          )}
        </div>
      </div>

      {/* Center Section: Floating Glass Pill */}
      <div className="bn-editor-toolbar-center">
        <div className="bn-tool-pill">
          {/* Pen with Sub-Pip & Settings Dropdown */}
          <div className="bn-pen-tool">
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
              title={`${t('pen', 'ปากกา')}: ${penNib === 'fountain' ? t('fountainNib', 'หมึกซึม') : penNib === 'ballpoint' ? t('ballpointNib', 'ลูกลื่น') : t('brushNib', 'พู่กัน')} (${t('penNibTapAgain', 'แตะซ้ำเพื่อตั้งค่าหัวปากกา')})`}
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
                <div className="bn-pen-settings-header">
                  <div className="bn-pen-settings-title">
                    <SlidersHorizontal size={14} className="bn-pen-settings-icon" />
                    <span>{t('penSettings', 'ตั้งค่าหัวปากกา & แรงกด')}</span>
                  </div>
                  <span className="bn-pen-settings-caption">Surface Inking</span>
                </div>

                {/* Nib Types Segmented Choice */}
                <div className="bn-pen-settings-nibs">
                  <div className="bn-pen-settings-section-title">{t('nibType', 'ชนิดหัวปากกา')}</div>
                  <div className="bn-pen-settings-choices">
                    <button 
                      className={`bn-nib-choice-btn ${penNib === 'fountain' ? 'bn-nib-choice-active' : ''}`}
                      onClick={() => setPenNib('fountain')}
                    >
                      <Feather size={13} />
                      <span>{t('fountainNib', 'หมึกซึม')}</span>
                    </button>
                    <button 
                      className={`bn-nib-choice-btn ${penNib === 'ballpoint' ? 'bn-nib-choice-active' : ''}`}
                      onClick={() => setPenNib('ballpoint')}
                    >
                      <Pen size={13} />
                      <span>{t('ballpointNib', 'ลูกลื่น')}</span>
                    </button>
                    <button 
                      className={`bn-nib-choice-btn ${penNib === 'brush' ? 'bn-nib-choice-active' : ''}`}
                      onClick={() => setPenNib('brush')}
                    >
                      <Paintbrush size={13} />
                      <span>{t('brushNib', 'พู่กัน')}</span>
                    </button>
                  </div>
                </div>

                {/* Tapered Stroke Setting */}
                <div className="bn-pen-settings-section">
                  <label className="bn-pen-settings-toggle">
                    <span className="bn-pen-settings-label">{t('taperedLine', 'คมต้น-คมปลาย (Tapered)')}</span>
                    <input 
                      type="checkbox" 
                      className="bn-pen-settings-checkbox"
                      checked={isTapered}
                      onChange={(e) => setIsTapered(e.target.checked)}
                    />
                  </label>
                  <span className="bn-pen-settings-description">
                    {isTapered ? t('taperOnDesc', 'เปิด: ปลายเรียวแหลมพลิ้วไหว สไตล์ปากกาคัดลายมือ') : t('taperOffDesc', 'ปิด: เส้นหัวมนสม่ำเสมอคงที่')}
                  </span>
                </div>

                {/* Pen Pressure Switch Setting */}
                <div className="bn-pen-settings-section">
                  <label className="bn-pen-settings-toggle">
                    <span className="bn-pen-settings-label">{t('penPressure', 'น้ำหนักกดปากกา (Pressure)')}</span>
                    <input 
                      type="checkbox" 
                      className="bn-pen-settings-checkbox"
                      checked={usePressure}
                      onChange={(e) => setUsePressure && setUsePressure(e.target.checked)}
                    />
                  </label>
                  <span className="bn-pen-settings-description">
                    {usePressure ? t('pressureOnDesc', 'เปิด: เส้นหนาบางตามแรงกดจริงของ Surface Pen') : t('pressureOffDesc', 'ปิด: เส้นคงที่')}
                  </span>
                </div>

                {/* Pressure Sensitivity Levels (when pressure is ON) */}
                {usePressure && (
                  <div className="bn-pen-settings-section">
                    <div className="bn-pen-settings-section-title">{t('pressureSensitivity', 'ความไวต่อแรงกด')}</div>
                    <div className="bn-pen-settings-choices bn-pen-settings-choices-pressure">
                      {['low', 'medium', 'high'].map(lvl => (
                        <button
                          key={lvl}
                          className={`bn-nib-choice-btn ${pressureSensitivity === lvl ? 'bn-nib-choice-active' : ''}`}
                          onClick={() => setPressureSensitivity(lvl)}
                        >
                          {lvl === 'low' ? t('pressureLow', 'เบา') : lvl === 'medium' ? t('pressureMedium', 'ปกติ') : t('pressureHigh', 'สูง')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scribble to Erase Toggle Setting */}
                <div className="bn-pen-settings-section">
                  <label className="bn-pen-settings-toggle">
                    <span className="bn-pen-settings-label">{t('scribbleToErase', 'ขยี้เส้นเพื่อลบ (Scribble to Erase)')}</span>
                    <input 
                      type="checkbox" 
                      className="bn-pen-settings-checkbox"
                      checked={scribbleToErase}
                      onChange={(e) => setScribbleToErase && setScribbleToErase(e.target.checked)}
                    />
                  </label>
                  <span className="bn-pen-settings-description">
                    {scribbleToErase ? t('scribbleOnDesc', 'เปิด: ขยี้ลายเส้นซ้ำๆ รวดเร็วเพื่อลบ') : t('scribbleOffDesc', 'ปิด: ปิดระบบขยี้ลบ')}
                  </span>
                </div>

                <div className="bn-pen-settings-footer">
                  <button 
                    className="bn-btn-primary bn-btn-sm bn-pen-settings-done"
                    onClick={() => setShowPenSettings(false)}
                  >
                    {t('done', 'เรียบร้อย')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Highlighter: tap again for its two tip choices. */}
          <div className="bn-pen-tool">
            <button
              className={`bn-tool-btn ${activeTool === 'highlighter' ? 'bn-tool-btn-active' : ''}`}
              onClick={event => {
                event.stopPropagation();
                const open = activeTool === 'highlighter' && !showHighlighterSettings;
                closeAllPopovers();
                setActiveTool('highlighter');
                setShowHighlighterSettings(open);
              }}
              title={t('highlighter', 'ปากกาไฮไลท์ (Highlighter)')}
              aria-label={t('highlighter', 'ปากกาไฮไลท์ (Highlighter)')}
              aria-expanded={showHighlighterSettings && activeTool === 'highlighter'}
            >
              <Highlighter size={17} />
            </button>
            {showHighlighterSettings && activeTool === 'highlighter' && (
              <div className="bn-pen-settings-dropdown bn-highlighter-settings"
                role="dialog" aria-label={t('highlighterSettings', 'ตั้งค่าหัวไฮไลต์')}
                onClick={event => event.stopPropagation()}>
                <div className="bn-pen-settings-header">
                  <div className="bn-pen-settings-title">
                    <SlidersHorizontal size={14} />
                    <span>{t('highlighterSettings', 'ตั้งค่าหัวไฮไลต์')}</span>
                  </div>
                </div>
                <div className="bn-pen-settings-section">
                  <div className="bn-pen-settings-choices">
                    {['round', 'square'].map(tip => (
                      <button key={tip} type="button" aria-pressed={highlighterTip === tip}
                        className={`bn-nib-choice-btn ${highlighterTip === tip ? 'bn-nib-choice-active' : ''}`}
                        onClick={() => setHighlighterTip?.(tip)}>
                        <span aria-hidden="true" style={{width:24,height:8,background:activeColor,
                          borderRadius:tip === 'round' ? 8 : 0,display:'inline-block'}} />
                        <span>{tip === 'round' ? t('highlighterTipRound', 'หัวกลม') : t('highlighterTipSquare', 'หัวเหลี่ยม')}</span>
                      </button>
                    ))}
                  </div>
                  <span className="bn-pen-settings-description">{t('highlighterHoldHint', 'ลากเส้นแล้วค้างปลายปากกาเพื่อปรับเป็นเส้นตรง')}</span>
                </div>
                <div className="bn-pen-settings-footer">
                  <button className="bn-btn-primary bn-btn-sm bn-pen-settings-done"
                    onClick={() => setShowHighlighterSettings(false)}>{t('done', 'เรียบร้อย')}</button>
                </div>
              </div>
            )}
          </div>

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
              title={`${t('eraser', 'ยางลบ')}: ${eraserMode === 'precision' ? t('eraserPrecision', 'ลบเฉพาะจุดสัมผัส (Precision)') : t('eraserStroke', 'ลบทั้งเส้น (Stroke)')} (${t('eraserTapAgain', 'แตะซ้ำเพื่อเปลี่ยนโหมด')})`}
            >
              <Eraser size={17} />
            </button>

            {showEraserMenu && (
              <div 
                className="bn-shape-dropdown" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-[11px] font-bold text-zinc-400 px-2 py-1">{t('eraserMode', 'โหมดยางลบ')}</div>
                <button 
                  className={`bn-shape-item ${eraserMode === 'precision' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('eraser'); setEraserMode('precision'); setShowEraserMenu(false); }}
                >
                  <Scissors size={14} />
                  <span>{t('eraserPrecision', 'ลบเฉพาะจุดสัมผัส (Precision)')}</span>
                </button>
                <button 
                  className={`bn-shape-item ${eraserMode === 'stroke' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('eraser'); setEraserMode('stroke'); setShowEraserMenu(false); }}
                >
                  <Eraser size={14} />
                  <span>{t('eraserStroke', 'ลบทั้งเส้น (Stroke Eraser)')}</span>
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
              title={t('shape', 'วาดรูปทรงเรขาคณิต (Shapes)')}
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
                  <span>{t('rectangle', 'สี่เหลี่ยม')}</span>
                </button>
                <button 
                  className={`bn-shape-item ${activeShape === 'triangle' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('shape'); setActiveShape('triangle'); setShowShapeMenu(false); }}
                >
                  <Triangle size={15} />
                  <span>{t('triangle', 'สามเหลี่ยม')}</span>
                </button>
                <button 
                  className={`bn-shape-item ${activeShape === 'circle' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('shape'); setActiveShape('circle'); setShowShapeMenu(false); }}
                >
                  <div className="w-3.5 h-3.5 rounded-full border border-current" />
                  <span>{t('circle', 'วงกลม / วงรี')}</span>
                </button>
                <button 
                  className={`bn-shape-item ${activeShape === 'line' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('shape'); setActiveShape('line'); setShowShapeMenu(false); }}
                >
                  <span className="font-bold text-xs">—</span>
                  <span>{t('line', 'เส้นตรง')}</span>
                </button>
                <button 
                  className={`bn-shape-item ${activeShape === 'arrow' ? 'bn-shape-item-active' : ''}`}
                  onClick={() => { setActiveTool('shape'); setActiveShape('arrow'); setShowShapeMenu(false); }}
                >
                  <span className="font-bold text-xs">➔</span>
                  <span>{t('arrow', 'ลูกศร')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Lasso Selection Tool */}
          <button 
            className={`bn-tool-btn ${activeTool === 'lasso' ? 'bn-tool-btn-active' : ''}`}
            onClick={() => { setActiveTool('lasso'); closeAllPopovers(); }}
            title={`${t('lasso', 'Lasso')} - ${t('lassoHint', 'ลากคลุมลายเส้น/ข้อความ/รูป เพื่อย้าย ย่อขยาย เปลี่ยนสี')}`}
          >
            <LassoSelect size={17} />
          </button>

          {/* Text Tool */}
          <button 
            className={`bn-tool-btn ${activeTool === 'text' ? 'bn-tool-btn-active' : ''}`}
            onClick={() => { setActiveTool('text'); closeAllPopovers(); }}
            title={t('text')}
          >
            <Type size={17} />
          </button>

          {/* Import image from the computer, then use the existing image controls. */}
          <button 
            className={`bn-tool-btn ${activeTool === 'image' ? 'bn-tool-btn-active' : ''}`}
            onClick={() => { setActiveTool('image'); closeAllPopovers(); onImportImage?.(); }}
            title={t('insertImage', 'Insert image from computer')}
          >
            <ImageIcon size={17} />
          </button>

          {/* Snipping Tool (Windows Snipping Tool Style) */}
          <button 
            className={`bn-tool-btn ${activeTool === 'snip' ? 'bn-tool-btn-active' : ''}`}
            onClick={() => { 
              setActiveTool(activeTool === 'snip' ? 'pen' : 'snip'); 
              closeAllPopovers(); 
            }}
            title={t('snip')}
          >
            <Scissors size={17} />
          </button>

          {/* Hand Pan Tool */}
          <button 
            className={`bn-tool-btn ${activeTool === 'hand' ? 'bn-tool-btn-active' : ''}`}
            onClick={() => { setActiveTool('hand'); closeAllPopovers(); }}
            title={t('hand')}
          >
            <Hand size={17} />
          </button>

          {/* Divider */}
          <div className="w-[1px] h-4 bg-white/15 mx-1" />

          {/* Quick 5-Color Swatches + Rainbow Picker */}
          <div className="bn-quick-colors bn-color-wheel-group flex items-center gap-1.5 px-1">
            {colorSlots.map((col, idx) => {
              const isSelected = activeColor.toLowerCase() === col.toLowerCase();
              return (
                <button
                  key={`${col}-${idx}`}
                  className={`bn-quick-color-btn ${isSelected ? 'bn-quick-color-active' : ''}`}
                  style={{ backgroundColor: col }}
                  onClick={() => handleSelectSlotColor(col)}
                  title={t('colorSlotTitle', `สีสล็อต #${idx + 1}: ${col}`, { slot: idx + 1, color: col })}
                />
              );
            })}

            <ColorWheelPicker value={activeColor} onChange={onCustomColorChange || setActiveColor}
              label={t('chooseColorWheel', 'เลือกสีจากวงล้อสี')} />
          </div>

          {/* Divider */}
          <div className="w-[1px] h-4 bg-white/15 mx-1" />

          {/* Quick Stroke Width Slots with Custom Slider Popover */}
          {(() => {
            const toolKey = ['pen', 'highlighter', 'eraser', 'shape'].includes(activeTool) ? activeTool : 'pen';
            const slots = widthSlots[toolKey] || DEFAULT_TOOL_WIDTH_SLOTS[toolKey];
            const currentWidth = (toolWidths && toolWidths[activeTool] !== undefined)
              ? toolWidths[activeTool] 
              : activeWidth;
            const sliderCfg = getToolSliderConfig(activeTool);

            return (
              <div className="relative flex items-center">
                <div className="bn-quick-widths flex items-center gap-1">
                  {slots.map((val, idx) => {
                    const isSelected = activeSlotIdx === idx;
                    const dotPx = Math.min(14, Math.max(3.5, Math.round(
                      toolKey === 'highlighter' ? val * 0.35 :
                      toolKey === 'eraser' ? val * 0.25 :
                      val * 1.5
                    )));

                    return (
                      <button
                        key={`slot-${idx}-${val}`}
                        className={`bn-width-btn ${isSelected ? 'bn-width-btn-active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSlot(idx);
                        }}
                        title={t('widthSlotTitle', `สล็อต #${idx + 1}: ${val}px (แตะซ้ำเพื่อเลื่อนปรับระดับ)`, { slot: idx + 1, val })}
                      >
                        <div 
                          className="bn-width-circle" 
                          style={{ width: `${dotPx}px`, height: `${dotPx}px` }}
                        />
                      </button>
                    );
                  })}

                  {/* Slider Popover Trigger Icon */}
                  <button
                    className={`bn-btn-icon w-6 h-6 ml-0.5 ${showWidthSlider ? 'text-blue-400 bg-blue-500/20' : 'text-zinc-400 hover:text-zinc-200'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowWidthSlider(!showWidthSlider);
                    }}
                    title={t('adjustWidth')}
                  >
                    <SlidersHorizontal size={13} />
                  </button>
                </div>

                {/* Floating Continuous Width Slider Popover */}
                {showWidthSlider && (
                  <div 
                    className="bn-width-slider-dropdown"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bn-width-slider-header">
                      <div className="flex items-center gap-1.5">
                        <SlidersHorizontal size={13} className="text-blue-400" />
                        <span>{t('strokeWidth')} (Slot #{activeSlotIdx + 1})</span>
                      </div>
                      <button 
                        className="text-zinc-400 hover:text-white p-0.5"
                        onClick={() => setShowWidthSlider(false)}
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {/* Preview Row with dynamic circle */}
                    <div className="bn-width-preview-row">
                      <div className="bn-width-preview-dot-wrap">
                        <div 
                          style={{
                            width: `${Math.min(38, Math.max(2, currentWidth * (toolKey === 'highlighter' ? 0.8 : toolKey === 'eraser' ? 0.6 : 2)))}px`,
                            height: `${Math.min(38, Math.max(2, currentWidth * (toolKey === 'highlighter' ? 0.8 : toolKey === 'eraser' ? 0.6 : 2)))}px`,
                            borderRadius: '50%',
                            backgroundColor: toolKey === 'eraser' ? '#ffffff' : activeColor,
                            opacity: toolKey === 'highlighter' ? 0.6 : 1,
                            boxShadow: '0 0 8px rgba(0,0,0,0.4)'
                          }}
                        />
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-white font-mono">
                          {currentWidth.toFixed(1)} px
                        </span>
                        <span className="text-[10px] text-emerald-400 font-medium">
                          ✓ {t('slotSaved')} #{activeSlotIdx + 1}
                        </span>
                      </div>
                    </div>

                    {/* Continuous Range Slider with - / + Steppers */}
                    <div className="flex items-center gap-2">
                      <button
                        className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-xs font-bold transition"
                        onClick={() => handleWidthChangeAndSaveToSlot(Math.max(sliderCfg.min, currentWidth - sliderCfg.step))}
                      >
                        -
                      </button>
                      <input 
                        type="range"
                        className="bn-width-range-input flex-1"
                        min={sliderCfg.min}
                        max={sliderCfg.max}
                        step={sliderCfg.step}
                        value={currentWidth}
                        onChange={(e) => handleWidthChangeAndSaveToSlot(e.target.value)}
                      />
                      <button
                        className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-xs font-bold transition"
                        onClick={() => handleWidthChangeAndSaveToSlot(Math.min(sliderCfg.max, currentWidth + sliderCfg.step))}
                      >
                        +
                      </button>
                    </div>

                    {/* Quick Preset Chips */}
                    <div className="bn-width-chips">
                      {sliderCfg.chips.map(chipVal => (
                        <button
                          key={chipVal}
                          className={`bn-width-chip ${Math.abs(currentWidth - chipVal) < 0.1 ? 'bn-width-chip-active' : ''}`}
                          onClick={() => handleWidthChangeAndSaveToSlot(chipVal)}
                        >
                          {chipVal}px
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
            title={t('captureEntirePageTooltip', 'แคปภาพทั้งหน้า (Capture Page)')}
          >
            <Camera size={17} />
          </button>

          <button
            className={`bn-btn-icon ${hasClipboardImage ? 'text-amber-400 font-bold' : 'text-zinc-300 hover:text-white'}`}
            onClick={() => onPasteClipboardImage()}
            title={t('pasteImageTooltip', 'วางรูปภาพจากคลิปบอร์ด / แคปหน้าจอ [Ctrl+V]')}
          >
            <ClipboardPaste size={17} />
          </button>
        </div>

        <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

        {/* Palm Rejection Shield (Surface Pen Only Toggle) */}
        <button 
          className={`bn-btn-icon ${penOnly ? 'bn-shield-active' : 'text-zinc-400 hover:text-white'}`}
          onClick={() => setPenOnly(!penOnly)}
          title={penOnly ? t('palmRejectionOn') : t('palmRejectionOff')}
        >
          <ShieldCheck size={18} />
        </button>

        {/* Scroll Mode Toggle (Continuous Vertical vs Horizontal) */}
        <button 
          className={`bn-btn-icon ${scrollDirection === 'vertical' ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30' : 'text-zinc-400'}`}
          onClick={() => setScrollDirection(scrollDirection === 'vertical' ? 'horizontal' : 'vertical')}
          title={scrollDirection === 'vertical' ? t('scrollVertical') : t('scrollHorizontal')}
        >
          <ScrollText size={17} />
        </button>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-zinc-900/60 p-0.5 rounded-lg border border-white/10">
          <button 
            className="bn-btn-icon bn-btn-undo" 
            onClick={onUndo} 
            disabled={!canUndo}
            title={t('undo')}
          >
            <RotateCcw size={16} />
          </button>
          <button 
            className="bn-btn-icon bn-btn-undo" 
            onClick={onRedo} 
            disabled={!canRedo}
            title={t('redo')}
          >
            <RotateCw size={16} />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="bn-zoom-controls">
          <button className="bn-zoom-btn" onClick={onZoomOut} title={t('zoomOut')}>
            <ZoomOut size={13} />
          </button>
          <span className="bn-zoom-label" onClick={onResetZoom} title={t('zoomReset')}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="bn-zoom-btn" onClick={onZoomIn} title={t('zoomIn')}>
            <ZoomIn size={13} />
          </button>
        </div>

        <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

        {/* Duplicate Notebook */}
        <button 
          className="bn-btn-icon text-zinc-400 hover:text-white"
          onClick={onDuplicateNotebook}
          title={t('duplicate')}
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
            title={t('exportPdfTooltip', 'ส่งออกเอกสารเป็น PDF คุณภาพสูง (คลิกเพื่อเลือกหน้าหรือทั้งเล่ม)')}
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
                <span>{t('exportCurrentPage', 'ส่งออกเฉพาะหน้านี้ (.pdf)')}</span>
              </button>
              <button 
                className="bn-shape-item text-zinc-200"
                onClick={() => {
                  setShowExportMenu(false);
                  onOpenExport();
                }}
              >
                <Download size={14} className="text-blue-400" />
                <span>{t('exportAllPages', 'ส่งออกทั้งเล่ม / ตัวเลือกอื่น...')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
