// Lightweight, Zero-Dependency Bilingual Localization (i18n) Engine for BetterNote Pro Studio
// Supports Thai ('th') and English ('en') with instant reactive updates across all components

import React from 'react';

const LANGUAGE_STORAGE_KEY = 'betternote_language';
const LANGUAGE_EVENT_NAME = 'betternote_language_changed';

export const TRANSLATIONS = {
  th: {
    // App & Navigation
    appName: 'BetterNote Pro Studio',
    allNotebooks: 'สมุดโน้ตทั้งหมด',
    home: 'หน้าหลัก',
    library: 'คลังสมุดโน้ต',
    searchPlaceholder: 'ค้นหาสมุดโน้ต หรือ โฟลเดอร์...',
    newNotebook: 'สร้างสมุดโน้ตใหม่',
    newFolder: 'สร้างโฟลเดอร์',
    importPdf: 'นำเข้าเอกสาร PDF',
    favorites: 'รายการโปรด',
    trash: 'ถังขยะ',
    settings: 'การตั้งค่า',
    export: 'ส่งออก',
    exportPdf: 'ส่งออกเป็น PDF',
    close: 'ปิด',
    save: 'บันทึก',
    cancel: 'ยกเลิก',
    delete: 'ลบ',
    rename: 'เปลี่ยนชื่อ',
    duplicate: 'ทำสำเนา',
    move: 'ย้าย',
    restore: 'กู้คืน',
    emptyTrash: 'ล้างถังขยะทั้งหมด',
    back: 'ย้อนกลับ',

    // Toolbar Tools & Tooltips
    pen: 'ปากกา',
    penFountain: 'ปากกาหมึกซึม',
    penBallpoint: 'ปากกาลูกลื่น',
    penBrush: 'พู่กัน',
    penSettings: 'ตั้งค่าหัวปากกา & แรงกด',
    nibType: 'ชนิดหัวปากกา',
    fountainNib: 'หมึกซึม',
    ballpointNib: 'ลูกลื่น',
    brushNib: 'พู่กัน',
    penPressure: 'แรงกดปากกา Surface Pen',
    pressureSensitivity: 'ความไวต่อแรงกด',
    pressureLow: 'เบา',
    pressureMedium: 'ปานกลาง',
    pressureHigh: 'หนัก',
    taperedLine: 'คมต้นคมปลาย (Tapering)',
    highlighter: 'ปากกาเน้นข้อความ (Highlighter)',
    eraser: 'ยางลบ (Eraser)',
    eraserMode: 'โหมดยางลบ',
    eraserPrecision: 'ลบเฉพาะจุดที่แตะ (Precision)',
    eraserStroke: 'ลบทั้งเส้นทีเดียว (Stroke)',
    scribbleToErase: 'ขยี้ลายเส้นเพื่อลบ (Scribble to Erase)',
    clearPage: 'ล้างทั้งหน้า',
    shape: 'รูปทรงเรขาคณิต (Shapes)',
    rectangle: 'สี่เหลี่ยม',
    circle: 'วงกลม / วงรี',
    line: 'เส้นตรง',
    arrow: 'ลูกศร',
    triangle: 'สามเหลี่ยม',
    lasso: 'เครื่องมือบ่วงบาศก์ (Lasso)',
    lassoHint: 'ลากคลุมลายเส้น/ข้อความ/รูป เพื่อย้าย ย่อขยาย เปลี่ยนสี',
    text: 'กล่องข้อความ (Text)',
    imageTool: 'จัดการรูปภาพ (Image Tool)',
    snip: 'แคปเจอร์เฉพาะจุด (Snipping Tool)',
    hand: 'เลื่อนหน้าจอ (Hand Pan)',
    paste: 'วางภาพจากคลิปบอร์ด',
    palmRejection: 'โหมดกันอุ้งมือ (Surface Pen Only)',
    palmRejectionOn: 'เปิดอยู่: โหมด Surface Pen Only (ป้องกันอุ้งมือสัมผัสจอ ไม่เลื่อนขณะเขียน)',
    palmRejectionOff: 'ปิดอยู่: อนุญาตให้นิ้วมือเขียนได้',
    scrollVertical: 'โหมดเลื่อนแนวตั้ง (บนลงล่างต่อเนื่อง)',
    scrollHorizontal: 'โหมดพลิกหน้าแนวนอน',
    undo: 'เลิกทำ (Undo)',
    redo: 'ทำซ้ำ (Redo)',
    zoomIn: 'ขยายเข้า',
    zoomOut: 'ย่อออก',
    zoomReset: 'รีเซ็ต 100%',
    thumbnails: 'มุมมองหน้าทั้งหมด (Thumbnails)',
    addPage: 'เพิ่มหน้ากระดาษใหม่',
    starPage: 'ติดดาวหน้านี้',
    unstarPage: 'ยกเลิกติดดาว',

    // Pen Width Slider & Slots
    strokeWidth: 'ขนาดเส้น',
    adjustWidth: 'เลื่อนปรับระดับขนาดเส้น',
    widthSlot: 'สล็อตขนาด',
    slotSaved: 'บันทึกลงสล็อตเรียบร้อย',
    fine: 'เส้นบาง',
    medium: 'เส้นปานกลาง',
    bold: 'เส้นหนา',

    // Layer System & Images
    layer: 'ระบบเลเยอร์',
    layerUnderInk: 'อยู่ใต้รอยเขียน (เขียนทับภาพได้)',
    layerAboveInk: 'อยู่บนรอยเขียน',
    sendBehindInk: 'ส่งไปใต้รอยเขียน',
    bringInFrontOfInk: 'นำขึ้นหน้ารอยเขียน',
    lockImage: 'ล็อกตำแหน่งรูปภาพ',
    unlockImage: 'ปลดล็อกรูปภาพ',
    cropImage: 'ครอบตัดรูปภาพ',
    deleteImage: 'ลบรูปภาพ',
    imageLockedHint: 'รูปภาพถูกล็อกตำแหน่งไว้ (ปลดล็อกเพื่อแก้ไข)',

    // Settings Modal
    settingsTitle: 'การตั้งค่าระบบ (BetterNote Studio Settings)',
    backupTab: 'สำรองข้อมูล & คลาวด์',
    defaultsTab: 'ค่าเริ่มต้นกระดาษ',
    themeTab: 'ธีมหน้าจอ (Theme)',
    languageTab: 'ภาษา (Language)',
    backupStatus: 'สถานะระบบสำรองข้อมูลอัตโนมัติ',
    backupPathLabel: 'ตำแหน่งโฟลเดอร์ปัจจุบัน:',
    backupHint: 'ระบบจะสำรองข้อมูลอัตโนมัติทุกๆ 1 ชั่วโมง และสำรองก่อนปิดแอปพลิเคชัน (ทั้ง PDF และ .bnote)',
    syncNow: 'ซิงค์และสำรองข้อมูลทันที',
    syncing: 'กำลังซิงค์ข้อมูล...',
    browseFolder: 'เลือกโฟลเดอร์ในเครื่อง / Google Drive...',
    restoreTitle: 'กู้คืนข้อมูลสำรองจากโฟลเดอร์ (Restore Notebooks)',
    restoreDesc: 'นำเข้าสมุดโน้ตทั้งหมดที่บันทึกไว้ในโฟลเดอร์สำรองข้อมูลกลับเข้าสู่แอปพลิเคชัน',
    restoreBtn: 'ดึงสมุดโน้ตกลับเข้าเครื่อง',
    clearCacheTitle: 'ล้างหน่วยความจำแคช (Clear Cache)',
    clearCacheDesc: 'เพิ่มประสิทธิภาพและคืนพื้นที่หน่วยความจำ โดยล้างแคชการเรนเดอร์ PDF และประวัติเส้นเขียน',
    clearCacheBtn: 'ล้างแคชระบบ',
    cacheCleared: '✓ ล้างหน่วยความจำแคชเรียบร้อยแล้ว',
    paperSizes: 'ขนาดหน้ากระดาษมาตรฐาน',
    recommendedPatterns: 'รูปแบบลายเส้นที่แนะนำ',
    themeChoice: 'เลือกรูปแบบธีมที่ต้องการใช้งาน (Theme Settings)',
    themeDark: 'โหมดมืด (Dark)',
    themeDarkDesc: 'ถนอมสายตาสำหรับใช้งานในที่มืด หรือประหยัดแบตเตอรี่',
    themeLight: 'โหมดสว่าง (Light)',
    themeLightDesc: 'สบายตา คมชัด เหมาะสำหรับการพิมพ์หรืออ่านกลางวัน',
    inUse: '✓ ใช้งานอยู่',
    languageChoice: 'เลือกภาษาของแอปพลิเคชัน (Language Settings)',
    langThai: 'ภาษาไทย (Thai)',
    langThaiDesc: 'เมนู เครื่องมือ และคำแนะนำการใช้งานภาษาไทยอย่างเป็นธรรมชาติ',
    langEnglish: 'English (US)',
    langEnglishDesc: 'Global English interface, tooltips, and terminology',

    // Page Navigation
    page: 'หน้า',
    of: 'จาก'
  },
  en: {
    // App & Navigation
    appName: 'BetterNote Pro Studio',
    allNotebooks: 'All Notebooks',
    home: 'Home',
    library: 'Notebook Library',
    searchPlaceholder: 'Search notebooks or folders...',
    newNotebook: 'New Notebook',
    newFolder: 'New Folder',
    importPdf: 'Import PDF Document',
    favorites: 'Favorites',
    trash: 'Trash',
    settings: 'Settings',
    export: 'Export',
    exportPdf: 'Export to PDF',
    close: 'Close',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    rename: 'Rename',
    duplicate: 'Duplicate',
    move: 'Move',
    restore: 'Restore',
    emptyTrash: 'Empty All Trash',
    back: 'Back',

    // Toolbar Tools & Tooltips
    pen: 'Pen',
    penFountain: 'Fountain Pen',
    penBallpoint: 'Ballpoint Pen',
    penBrush: 'Artistic Brush',
    penSettings: 'Pen Nib & Pressure Settings',
    nibType: 'Nib Type',
    fountainNib: 'Fountain',
    ballpointNib: 'Ballpoint',
    brushNib: 'Brush',
    penPressure: 'Surface Pen Pressure Sensitivity',
    pressureSensitivity: 'Pressure Sensitivity',
    pressureLow: 'Light',
    pressureMedium: 'Medium',
    pressureHigh: 'Firm',
    taperedLine: 'Stroke Tapering',
    highlighter: 'Highlighter',
    eraser: 'Eraser',
    eraserMode: 'Eraser Mode',
    eraserPrecision: 'Precision Point Eraser',
    eraserStroke: 'Full Stroke Eraser',
    scribbleToErase: 'Scribble to Erase',
    clearPage: 'Clear Entire Page',
    shape: 'Geometric Shapes',
    rectangle: 'Rectangle',
    circle: 'Circle / Ellipse',
    line: 'Straight Line',
    arrow: 'Arrow',
    triangle: 'Triangle',
    lasso: 'Lasso Selection',
    lassoHint: 'Circle strokes, text, or images to move, resize, recolor, copy, or delete',
    text: 'Text Box',
    imageTool: 'Image Tool (Move, Resize, Layer)',
    snip: 'Visual Snipping Tool',
    hand: 'Hand Pan',
    paste: 'Paste Image from Clipboard',
    palmRejection: 'Surface Palm Rejection (Pen Only)',
    palmRejectionOn: 'Active: Surface Pen Only (Protects from palm touches while writing)',
    palmRejectionOff: 'Inactive: Finger drawing allowed',
    scrollVertical: 'Vertical Continuous Scrolling',
    scrollHorizontal: 'Horizontal Page Flip',
    undo: 'Undo',
    redo: 'Redo',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    zoomReset: 'Reset Zoom (100%)',
    thumbnails: 'Page Thumbnails Overview',
    addPage: 'Add New Page',
    starPage: 'Bookmark This Page',
    unstarPage: 'Remove Bookmark',

    // Pen Width Slider & Slots
    strokeWidth: 'Stroke Thickness',
    adjustWidth: 'Adjust Stroke Thickness',
    widthSlot: 'Width Slot',
    slotSaved: 'Saved to slot',
    fine: 'Fine',
    medium: 'Medium',
    bold: 'Bold',

    // Layer System & Images
    layer: 'Layer System',
    layerUnderInk: 'Under Ink (Write over image)',
    layerAboveInk: 'Above Ink',
    sendBehindInk: 'Send Behind Ink',
    bringInFrontOfInk: 'Bring in Front of Ink',
    lockImage: 'Lock Image Position',
    unlockImage: 'Unlock Image',
    cropImage: 'Crop Image',
    deleteImage: 'Delete Image',
    imageLockedHint: 'Image position is locked (unlock to reposition)',

    // Settings Modal
    settingsTitle: 'BetterNote Studio Settings',
    backupTab: 'Backup & Cloud',
    defaultsTab: 'Paper Defaults',
    themeTab: 'Theme',
    languageTab: 'Language',
    backupStatus: 'Automated Backup Status',
    backupPathLabel: 'Current Backup Directory:',
    backupHint: 'System automatically backs up notebooks every 1 hour and upon closing (both PDF and .bnote formats)',
    syncNow: 'Sync & Backup Now',
    syncing: 'Syncing Data...',
    browseFolder: 'Browse Local / Google Drive Folder...',
    restoreTitle: 'Restore Backup from Directory',
    restoreDesc: 'Import all notebooks stored in your backup directory back into the application',
    restoreBtn: 'Restore Notebooks to App',
    clearCacheTitle: 'Clear Rendering Cache',
    clearCacheDesc: 'Improve performance and reclaim memory by clearing PDF render caches and stroke history',
    clearCacheBtn: 'Clear System Cache',
    cacheCleared: '✓ System cache cleared successfully',
    paperSizes: 'Standard Paper Sizes',
    recommendedPatterns: 'Recommended Paper Patterns',
    themeChoice: 'Select Application Theme',
    themeDark: 'Dark Mode',
    themeDarkDesc: 'Eye-comfort mode for low-light environments and battery saving',
    themeLight: 'Light Mode',
    themeLightDesc: 'Clean, crisp high-contrast theme for daytime reading and writing',
    inUse: '✓ Active',
    languageChoice: 'Select Application Language',
    langThai: 'ภาษาไทย (Thai)',
    langThaiDesc: 'Native Thai user interface, tools, and hints',
    langEnglish: 'English (US)',
    langEnglishDesc: 'Global English interface, tooltips, and terminology',

    // Page Navigation
    page: 'Page',
    of: 'of'
  }
};

let inMemoryLanguage = 'th';

/**
 * Get current application language ('th' | 'en')
 */
export const getAppLanguage = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'en' || saved === 'th') return saved;
    }
  } catch (_) {}
  return inMemoryLanguage || 'th';
};

/**
 * Change application language and dispatch reactive update event
 */
export const setAppLanguage = (lang) => {
  const normalized = lang === 'en' ? 'en' : 'th';
  inMemoryLanguage = normalized;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT_NAME, { detail: normalized }));
    }
  } catch (_) {}
  return normalized;
};

/**
 * Translation helper function
 */
export const t = (key, fallback = '') => {
  const lang = getAppLanguage();
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.th;
  if (dict && dict[key] !== undefined) {
    return dict[key];
  }
  // Fallback to English, then Thai, then provided fallback, then key
  if (TRANSLATIONS.en[key] !== undefined) return TRANSLATIONS.en[key];
  if (TRANSLATIONS.th[key] !== undefined) return TRANSLATIONS.th[key];
  return fallback || key;
};

/**
 * React Hook for reactive language updates
 */
export const useLanguage = () => {
  const [lang, setLang] = React.useState(() => getAppLanguage());

  React.useEffect(() => {
    const handleLanguageChange = (e) => {
      setLang(e.detail);
    };
    window.addEventListener(LANGUAGE_EVENT_NAME, handleLanguageChange);
    return () => {
      window.removeEventListener(LANGUAGE_EVENT_NAME, handleLanguageChange);
    };
  }, []);

  const translate = React.useCallback((key, fallback) => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.th;
    if (dict && dict[key] !== undefined) return dict[key];
    if (TRANSLATIONS.en[key] !== undefined) return TRANSLATIONS.en[key];
    return fallback || key;
  }, [lang]);

  return {
    language: lang,
    setLanguage: setAppLanguage,
    t: translate
  };
};
