// Disposable previews only. Saved pages and pending writes never enter this cache.
export class AppCacheService {
  constructor(maxBytes = 32 * 1024 * 1024) {
    this.maxBytes = maxBytes; this.memoryCache = new Map();
    this.totalBytes = 0; this.hitCount = this.missCount = 0; this.listeners = new Set();
  }
  estimateSize(value) {
    if (typeof value === 'string') return value.length * 2;
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value.byteLength;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return value.size;
    return 0;
  }
  get(key) {
    const entry = this.memoryCache.get(key);
    if (!entry) { this.missCount++; return null; }
    this.hitCount++; this.memoryCache.delete(key); this.memoryCache.set(key, entry);
    return entry.data;
  }
  set(key, data, category = 'general') {
    const size = this.estimateSize(data);
    if (!key || !size || size > this.maxBytes) return false;
    this.invalidate(key, true);
    while (this.totalBytes + size > this.maxBytes) this.invalidate(this.memoryCache.keys().next().value, true);
    this.memoryCache.set(key, { data, size, category }); this.totalBytes += size;
    return true;
  }
  invalidate(key, exact = false) {
    for (const [id, entry] of this.memoryCache) if (id === key || (!exact && id.startsWith(key))) {
      this.memoryCache.delete(id); this.totalBytes -= entry.size;
    }
  }
  getCacheStats() {
    return { entryCount: this.memoryCache.size, totalBytes: this.totalBytes,
      totalMB: (this.totalBytes / 1048576).toFixed(2), maxBytes: this.maxBytes,
      maxGB: this.maxBytes / 1073741824, hitCount: this.hitCount, missCount: this.missCount,
      hitRatio: ((this.hitCount / (this.hitCount + this.missCount || 1)) * 100).toFixed(1) + '%' };
  }
  subscribeClear(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  clearAll() {
    this.memoryCache.clear(); this.totalBytes = this.hitCount = this.missCount = 0;
    this.listeners.forEach(listener => listener());
  }
}
export const appCacheService = new AppCacheService();
