// Small in-memory TTL cache (per server process). Nothing is written to disk.
// Shopify's Catalog usage guidelines cap caching: product metadata and images 24h,
// price and availability 10 minutes. We cache search results for 10 minutes so
// prices are never older than that.

export const TTL = {
  priceAndAvailability: 10 * 60_000,
  metadata: 24 * 60 * 60_000,
  token: 55 * 60_000, // tokens live 60 minutes
  holidays: 24 * 60 * 60_000,
};

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load();
  store.set(key, { value, expires: Date.now() + ttlMs });
  if (store.size > 500) {
    const now = Date.now();
    for (const [k, v] of store) if (v.expires <= now) store.delete(k);
  }
  return value;
}

export function forget(key: string) {
  store.delete(key);
}
