// Persistent User Preferences Service for BetterNote Studio
// Stores and restores pen, color, width, pressure, palm rejection, and view modes

const PREFERENCES_STORAGE_KEY = 'betternote_user_preferences';

export const DEFAULT_TOOL_WIDTHS = {
  pen: 4,
  highlighter: 18,
  eraser: 20,
  shape: 3
};

export const DEFAULT_TOOL_WIDTH_SLOTS = {
  pen: [1.5, 3.5, 6.0],
  highlighter: [12, 18, 28],
  eraser: [15, 25, 40],
  shape: [2, 4, 8]
};

export const DEFAULT_PREFERENCES = {
  theme: 'dark', // 'dark' | 'light'
  language: 'th', // 'th' | 'en'
  activeTool: 'pen',
  activeColor: '#2563eb', // Royal Blue
  activeWidth: 3.5,
  toolWidths: { ...DEFAULT_TOOL_WIDTHS },
  toolWidthSlots: { ...DEFAULT_TOOL_WIDTH_SLOTS },
  activeShape: 'rectangle',
  penNib: 'fountain', // 'fountain' | 'ballpoint' | 'brush'
  isTapered: true, // คมต้นคมปลาย
  usePressure: true, // แรงกดปากกา Surface Pen
  pressureSensitivity: 'medium', // 'low' | 'medium' | 'high'
  eraserMode: 'precision', // 'precision' | 'stroke'
  scribbleToErase: true, // ขยี้ลายเส้นเพื่อลบ (Scribble to erase toggle)
  scribbleSensitivity: 'normal', // 'normal' | 'low'
  penOnly: true, // Surface Pro 7 Palm Rejection
  scrollDirection: 'horizontal', // 'horizontal' | 'vertical'
  zoom: 1.0
};

/**
 * Load user preferences from localStorage with fallback to defaults
 */
export const loadEditorPreferences = () => {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFERENCES };
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    const mergedToolWidths = {
      ...DEFAULT_TOOL_WIDTHS,
      ...(parsed.toolWidths || {})
    };
    if (parsed.activeWidth && (!parsed.toolWidths || !parsed.toolWidths.pen)) {
      mergedToolWidths.pen = parsed.activeWidth;
    }

    const mergedToolWidthSlots = {
      ...DEFAULT_TOOL_WIDTH_SLOTS,
      ...(parsed.toolWidthSlots || {})
    };

    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      toolWidths: mergedToolWidths,
      toolWidthSlots: mergedToolWidthSlots
    };
  } catch (err) {
    console.warn('Could not load editor preferences, using defaults:', err);
    return { ...DEFAULT_PREFERENCES };
  }
};

/**
 * Save updated user preferences
 */
export const saveEditorPreferences = (updates) => {
  try {
    const current = loadEditorPreferences();
    const updated = {
      ...current,
      ...updates
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch (err) {
    console.warn('Could not save editor preferences:', err);
    return null;
  }
};

/**
 * Get current theme ('dark' | 'light')
 */
export const getAppTheme = () => {
  const prefs = loadEditorPreferences();
  return prefs.theme || 'dark';
};

/**
 * Set theme and apply to document element immediately
 */
export const setAppTheme = (theme) => {
  const normalized = theme === 'light' ? 'light' : 'dark';
  saveEditorPreferences({ theme: normalized });
  applyThemeToDom(normalized);
  return normalized;
};

/**
 * Apply theme to document element
 */
export const applyThemeToDom = (theme) => {
  const normalized = theme === 'light' ? 'light' : 'dark';
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', normalized);
  }
};

/**
 * Get current language ('th' | 'en')
 */
export const getAppLanguage = () => {
  try {
    const saved = localStorage.getItem('betternote_language');
    if (saved === 'en' || saved === 'th') return saved;
  } catch (_) {}
  const prefs = loadEditorPreferences();
  return prefs.language || 'th';
};

/**
 * Set application language
 */
export const setAppLanguage = (lang) => {
  const normalized = lang === 'en' ? 'en' : 'th';
  saveEditorPreferences({ language: normalized });
  try {
    localStorage.setItem('betternote_language', normalized);
    window.dispatchEvent(new CustomEvent('betternote_language_changed', { detail: normalized }));
  } catch (_) {}
  return normalized;
};

