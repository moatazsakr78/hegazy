/**
 * Image Preloader Utility
 * Preloads images in the background to improve perceived performance
 */

// Global cache to track preloaded images
const preloadedImages = new Set<string>();
const loadingImages = new Map<string, Promise<void>>();

/**
 * Preload a single image
 */
export function preloadImage(src: string | null | undefined): Promise<void> {
  if (!src) return Promise.resolve();

  // Already preloaded
  if (preloadedImages.has(src)) {
    return Promise.resolve();
  }

  // Already loading
  if (loadingImages.has(src)) {
    return loadingImages.get(src)!;
  }

  // Start loading
  const loadPromise = new Promise<void>((resolve) => {
    const img = new Image();

    img.onload = () => {
      preloadedImages.add(src);
      loadingImages.delete(src);
      resolve();
    };

    img.onerror = () => {
      // Mark as "preloaded" even on error to avoid retry loops
      preloadedImages.add(src);
      loadingImages.delete(src);
      resolve();
    };

    img.src = src;
  });

  loadingImages.set(src, loadPromise);
  return loadPromise;
}

/**
 * Preload multiple images with concurrency control
 * @param urls Array of image URLs to preload
 * @param concurrency Maximum number of concurrent loads (default: 4)
 * @param onProgress Optional callback for progress updates
 */
export async function preloadImages(
  urls: (string | null | undefined)[],
  concurrency: number = 4,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const validUrls = urls.filter((url): url is string => !!url && !preloadedImages.has(url));

  if (validUrls.length === 0) {
    onProgress?.(0, 0);
    return;
  }

  let loaded = 0;
  const total = validUrls.length;

  // Process in batches for controlled concurrency
  for (let i = 0; i < validUrls.length; i += concurrency) {
    const batch = validUrls.slice(i, i + concurrency);
    await Promise.all(batch.map(url => preloadImage(url)));
    loaded += batch.length;
    onProgress?.(loaded, total);
  }
}

/**
 * Preload images in the background without blocking
 * Uses requestIdleCallback for better performance
 */
export function preloadImagesInBackground(
  urls: (string | null | undefined)[],
  onComplete?: () => void
): void {
  const validUrls = urls.filter((url): url is string => !!url && !preloadedImages.has(url));

  if (validUrls.length === 0) {
    onComplete?.();
    return;
  }

  let index = 0;

  const loadNext = () => {
    if (index >= validUrls.length) {
      onComplete?.();
      return;
    }

    // Load 2 images per idle callback
    const batch = validUrls.slice(index, index + 2);
    index += 2;

    Promise.all(batch.map(url => preloadImage(url))).then(() => {
      // Use requestIdleCallback if available, otherwise setTimeout
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(loadNext, { timeout: 100 });
      } else {
        setTimeout(loadNext, 10);
      }
    });
  };

  // Start loading after a small delay to not interfere with initial render
  setTimeout(loadNext, 100);
}

/**
 * Check if an image is already preloaded
 */
export function isImagePreloaded(src: string | null | undefined): boolean {
  return !!src && preloadedImages.has(src);
}

/**
 * Get preloading statistics
 */
export function getPreloadStats(): { preloaded: number; loading: number } {
  return {
    preloaded: preloadedImages.size,
    loading: loadingImages.size
  };
}

/**
 * Clear the preload cache (useful for memory management)
 */
export function clearPreloadCache(): void {
  preloadedImages.clear();
  loadingImages.clear();
}
