// Cache for assets fetched during the loading screen so later code (e.g. the
// 3D viewer) can reuse them without re-downloading.
export const preloadedModels = new Map<string, Blob>();

// The big 3D model we warm up on first load. The gallery furniture is now
// built procedurally in three.js, so only the cat needs preloading.
export const MODEL_URLS = ["/models/cat.glb"];

/**
 * Stream-fetch a file, reporting bytes as they arrive. Stores the resulting
 * Blob in `preloadedModels`. Resolves once fully downloaded.
 */
export async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    // Can't stream — still mark complete so loading doesn't stall.
    onProgress(1, 1);
    return;
  }
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.length;
      onProgress(loaded, total);
    }
  }
  try {
    preloadedModels.set(url, new Blob(chunks as BlobPart[]));
  } catch {
    /* ignore — caching is best-effort */
  }
  onProgress(loaded, total || loaded);
}
