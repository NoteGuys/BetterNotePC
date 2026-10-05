// Microsoft Store & GitHub Release Update Service for BetterNote Pro Studio
// Checks for new version updates once per day upon entering the app, or manually from Settings.
import { getAppLanguage, t } from './i18n.js';

export const CURRENT_APP_VERSION = '1.2.1';
export const LAST_UPDATE_CHECK_DATE_KEY = 'betternote_last_update_check_date';
export const STORE_PRODUCT_ID = '9WZDNCRFHVJL';
export const STORE_URL = `ms-windows-store://pdp/?productid=${STORE_PRODUCT_ID}`;
export const STORE_WEB_URL = 'https://apps.microsoft.com/detail/betternotepc';

/**
 * Compare two semver strings: returns 1 if vA > vB, -1 if vA < vB, 0 if equal
 */
export function compareVersions(versionA, versionB) {
  if (!versionA || !versionB) return 0;
  const cleanA = String(versionA).replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
  const cleanB = String(versionB).replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
  const maxLen = Math.max(cleanA.length, cleanB.length);

  for (let i = 0; i < maxLen; i++) {
    const a = cleanA[i] || 0;
    const b = cleanB[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Returns true if targetVersion is newer than currentVersion
 */
export function isNewerVersion(currentVersion, targetVersion) {
  return compareVersions(targetVersion, currentVersion) > 0;
}

/**
 * Check if today has already been checked
 */
export function hasCheckedToday() {
  try {
    const todayStr = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'
    const lastCheck = localStorage.getItem(LAST_UPDATE_CHECK_DATE_KEY);
    return lastCheck === todayStr;
  } catch (_) {
    return false;
  }
}

/**
 * Mark today as checked
 */
export function markTodayChecked() {
  try {
    const todayStr = new Date().toLocaleDateString('en-CA');
    localStorage.setItem(LAST_UPDATE_CHECK_DATE_KEY, todayStr);
  } catch (_) {}
}

/**
 * Clear check date (for testing or manual force)
 */
export function clearCheckDate() {
  try {
    localStorage.removeItem(LAST_UPDATE_CHECK_DATE_KEY);
  } catch (_) {}
}

/**
 * Check for updates from Microsoft Store / remote update feed
 * @param {Object} options
 * @param {boolean} options.force - If true, bypasses the once-a-day throttle
 */
export async function checkForStoreUpdate(options = {}) {
  const force = !!options.force;

  // 1. Once per day throttle check
  if (!force && hasCheckedToday()) {
    return {
      hasUpdate: false,
      throttled: true,
      reason: 'already-checked-today',
      currentVersion: CURRENT_APP_VERSION
    };
  }

  // 2. Mark checked immediately so we never spam the user even if check fails
  markTodayChecked();

  // 3. Check for demo / mock flag
  try {
    const testMode = localStorage.getItem('betternote_test_update_demo');
    if (testMode === 'true') {
      const currentLang = getAppLanguage();
      const localeMap = { en: 'en-US', th: 'th-TH', zh: 'zh-CN', ru: 'ru-RU' };
      const currentLocale = localeMap[currentLang] || 'en-US';
      return {
        hasUpdate: true,
        isMock: true,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: '1.2.2',
        releaseDateRaw: new Date().toISOString(),
        releaseDate: new Date().toLocaleDateString(currentLocale, { year: 'numeric', month: 'long', day: 'numeric' }),
        title: `BetterNote Pro Studio Update v1.2.2`,
        storeUrl: STORE_URL,
        storeWebUrl: STORE_WEB_URL,
        bugFixKeys: ['updateFix1', 'updateFix2', 'updateFix3', 'updateFix4'],
        featureKeys: ['updateFeat1', 'updateFeat2', 'updateFeat3', 'updateFeat4'],
        bugFixes: [
          t('updateFix1'),
          t('updateFix2'),
          t('updateFix3'),
          t('updateFix4')
        ],
        features: [
          t('updateFeat1'),
          t('updateFeat2'),
          t('updateFeat3'),
          t('updateFeat4')
        ]
      };
    }
  } catch (_) {}

  // 4. Remote Version Manifest Fetch with timeout
  const timeoutMs = 4000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // You can set a custom remote version manifest URL in localStorage for production
  let feedUrl = null;
  try {
    feedUrl = localStorage.getItem('betternote_update_feed_url');
  } catch (_) {}

  if (!feedUrl) {
    // Default public endpoint for BetterNote releases
    feedUrl = 'https://raw.githubusercontent.com/NoteGuys/BetterNotePC/main/release-info.json';
  }

  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      cache: 'no-cache',
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const remoteVersion = data.version || data.latestVersion;

      if (remoteVersion && compareVersions(remoteVersion, CURRENT_APP_VERSION) > 0) {
        return {
          hasUpdate: true,
          currentVersion: CURRENT_APP_VERSION,
          latestVersion: remoteVersion,
          releaseDate: data.releaseDate || new Date().toISOString().slice(0, 10),
          title: data.title || `BetterNote Pro Studio v${remoteVersion}`,
          storeUrl: data.storeUrl || STORE_URL,
          storeWebUrl: data.storeWebUrl || STORE_WEB_URL,
          bugFixes: data.bugFixes || [],
          features: data.features || []
        };
      }
    }
  } catch (err) {
    // Offline, timeout, or unreachable: silently return no update
  } finally {
    clearTimeout(timer);
  }

  return {
    hasUpdate: false,
    currentVersion: CURRENT_APP_VERSION,
    latestVersion: CURRENT_APP_VERSION
  };
}

/**
 * Open Microsoft Store link
 */
export async function openMicrosoftStore(url = null) {
  const targetUrl = url || STORE_URL;
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
      await window.electronAPI.openExternal(targetUrl);
      return true;
    } else if (typeof window !== 'undefined') {
      window.open(STORE_WEB_URL, '_blank');
      return true;
    }
  } catch (err) {
    // Fallback to web link if ms-windows-store protocol fails
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(STORE_WEB_URL);
      } else if (typeof window !== 'undefined') {
        window.open(STORE_WEB_URL, '_blank');
      }
    } catch (_) {}
  }
  return false;
}
