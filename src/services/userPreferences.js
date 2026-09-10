// Persistent User Preferences Service for BetterNote (Goodnotes 6 style)
// Stores and restores pen, color, width, pressure, palm rejection, and view modes

const PREFERENCES_STORAGE_KEY = 'betternote_user_preferences';

export const DEFAULT_TOOL_WIDTHS = {
  pen: 4,
  highlighter: 18,
  eraser: 20,
  shape: 3
};

export const DEFAULT_PREFERENCES = {
  theme: 'dark', // 'dark' | 'light'
  activeTool: 'pen',
  activeColor: '#2563eb', // Royal Blue
  activeWidth: 4,
  toolWidths: { ...DEFAULT_TOOL_WIDTHS },
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

    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      toolWidths: mergedToolWidths
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
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
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

