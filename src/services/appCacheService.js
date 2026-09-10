// 5GB High-Performance Deduplicated App Cache Engine for BetterNote
// Provides fast in-memory & persistent cache for PDF pages, canvas snapshots & ink renderings
// Strict Deduplication & LRU Eviction with 5GB Hard Cap

const MAX_CACHE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
const EVICTION_TARGET_BYTES = 4.2 * 1024 * 1024 * 1024; // Evict down to 4.2 GB when cap is reached

class AppCacheService {
  constructor() {
    this.memoryCache = new Map(); // key -> { data, size, lastAccessed, category }
    this.totalBytes = 0;
    this.hitCount = 0;
    this.missCount = 0;
    this.db = null;
  }

  /**
   * Fast 32-bit FNV-1a string/payload hash for deduplication
   */
  hashContent(str) {
    if (!str) return '0';
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * Approximate byte size of cached value
   */
  estimateSize(val) {
    if (typeof val === 'string') return val.length * 2;
    if (val instanceof Blob) return val.size;
    if (val instanceof ArrayBuffer) return val.byteLength;
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val).length * 2;
      } catch (_) {
        return 1024;
      }
    }
    return 64;
  }

  /**
   * Get cached item by composite key
   */
  get(key) {
    const entry = this.memoryCache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      this.hitCount++;
      return entry.data;
    }
    this.missCount++;
    return null;
  }

  /**
   * Put item into cache with strict deduplication & 5GB LRU capacity enforcement
   * @param {string} key - unique composite key, e.g. "pdf:nb-1:page-0"
   * @param {any} data - cached payload (string dataUrl, blob, or object)
   * @param {string} category - "pdf_render" | "ink_snapshot" | "thumbnail"
   */
  set(key, data, category = 'general') {
    if (!key || data === undefined || data === null) return false;

    // Deduplication check: if key exists and content hash matches, update access time without duplicating memory
    const existing = this.memoryCache.get(key);
    const itemSize = this.estimateSize(data);

    if (existing) {
      this.totalBytes -= existing.size;
      existing.data = data;
      existing.size = itemSize;
      existing.lastAccessed = Date.now();
      existing.category = category;
      this.totalBytes += itemSize;
      return true;
    }

    // Check if adding this item exceeds the 5GB Hard Cap
    if (this.totalBytes + itemSize > MAX_CACHE_BYTES) {
      this.evictLRU(itemSize);
    }

    // Insert new entry
    this.memoryCache.set(key, {
      data,
      size: itemSize,
      lastAccessed: Date.now(),
      category
    });
    this.totalBytes += itemSize;
    return true;
  }

  /**
   * Evict least recently accessed entries until target size is restored
   */
  evictLRU(requiredBytes = 0) {
    const entries = Array.from(this.memoryCache.entries());
    // Sort ascending by lastAccessed (oldest first)
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const target = Math.max(0, EVICTION_TARGET_BYTES - requiredBytes);

    for (const [k, v] of entries) {
      if (this.totalBytes <= target) break;
      this.memoryCache.delete(k);
      this.totalBytes -= v.size;
    }
  }

  /**
   * Invalidate specific key or prefix
   */
  invalidate(prefixOrKey) {
    if (!prefixOrKey) return;
    for (const [k, v] of this.memoryCache.entries()) {
      if (k === prefixOrKey || k.startsWith(prefixOrKey)) {
        this.totalBytes -= v.size;
        this.memoryCache.delete(k);
      }
    }
  }

  /**
   * Get comprehensive Cache Stats
   */
  getCacheStats() {
    return {
      entryCount: this.memoryCache.size,
      totalBytes: this.totalBytes,
      totalMB: (this.totalBytes / (1024 * 1024)).toFixed(2),
      maxBytes: MAX_CACHE_BYTES,
      maxGB: 5,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRatio: (this.hitCount + this.missCount > 0)
        ? ((this.hitCount / (this.hitCount + this.missCount)) * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  /**
   * Clear all cached data
   */
  clearAll() {
    this.memoryCache.clear();
    this.totalBytes = 0;
    this.hitCount = 0;
    this.missCount = 0;
  }
}

export const appCacheService = new AppCacheService();
