import { useSyncExternalStore } from "react";

export const PASEO_APP_SETTINGS_KEY = "@paseo:app-settings";
export const DEFAULT_BASE_FONT_SIZE = 14;

export interface FontScale {
  /** 10px @ base 14: micro chips, badges, priority, timestamps, meta */
  readonly micro: number;
  /** 11px @ base 14: IDs, counts, captions, hints, secondary labels */
  readonly caption: number;
  /** 12px @ base 14: secondary buttons, chips, filter tabs, warnings */
  readonly secondary: number;
  /** 13px @ base 14: standard body text, titles, inputs, dropdown items */
  readonly body: number;
  /** 14px @ base 14: modal headers, project titles, remove buttons */
  readonly title: number;
  /** 15px @ base 14: summary values, large numbers */
  readonly stat: number;
}

export function computeFontScale(base: number = DEFAULT_BASE_FONT_SIZE): FontScale {
  const r = base / DEFAULT_BASE_FONT_SIZE;
  return {
    micro: Math.max(8, Math.round(10 * r)),
    caption: Math.max(9, Math.round(11 * r)),
    secondary: Math.max(10, Math.round(12 * r)),
    body: Math.max(11, Math.round(13 * r)),
    title: Math.max(12, Math.round(14 * r)),
    stat: Math.max(13, Math.round(15 * r)),
  };
}

export const DEFAULT_FONT_SCALE: FontScale = computeFontScale(DEFAULT_BASE_FONT_SIZE);

export function parsePaseoBaseFontSize(raw: string | null): number {
  if (!raw) return DEFAULT_BASE_FONT_SIZE;
  try {
    const data = JSON.parse(raw);
    const size = data?.uiBaseFontSize;
    if (typeof size === "number" && Number.isFinite(size) && size >= 8 && size <= 32) {
      return size;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return DEFAULT_BASE_FONT_SIZE;
}

let cachedBase = DEFAULT_BASE_FONT_SIZE;
let cachedScale: FontScale = DEFAULT_FONT_SCALE;
const listeners = new Set<() => void>();
let initialized = false;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface WindowLike {
  window?: unknown;
  localStorage?: StorageLike;
  addEventListener?(type: string, listener: (event: { key?: string }) => void): void;
}

const env = globalThis as unknown as WindowLike;

function getStorage(): StorageLike | null {
  if (typeof env.window !== "undefined" && env.localStorage) {
    return env.localStorage;
  }
  return null;
}

function updateSnapshot() {
  const storage = getStorage();
  const nextBase = storage ? parsePaseoBaseFontSize(storage.getItem(PASEO_APP_SETTINGS_KEY)) : DEFAULT_BASE_FONT_SIZE;
  if (nextBase !== cachedBase) {
    cachedBase = nextBase;
    cachedScale = computeFontScale(cachedBase);
    listeners.forEach((listener) => listener());
  }
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  const storage = getStorage();
  if (storage) {
    cachedBase = parsePaseoBaseFontSize(storage.getItem(PASEO_APP_SETTINGS_KEY));
    cachedScale = computeFontScale(cachedBase);

    // Intercept localStorage.setItem in the same window so updates take effect immediately
    try {
      const originalSetItem = storage.setItem.bind(storage);
      storage.setItem = (key: string, value: string) => {
        originalSetItem(key, value);
        if (key === PASEO_APP_SETTINGS_KEY) {
          updateSnapshot();
        }
      };
    } catch {
      // Storage cannot be patched; fallback to event listeners
    }

    if (env.addEventListener) {
      env.addEventListener("storage", (e) => {
        if (e.key === PASEO_APP_SETTINGS_KEY) {
          updateSnapshot();
        }
      });
      env.addEventListener("focus", updateSnapshot);
    }
  }
}

export function subscribeFontScale(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFontScaleSnapshot(): FontScale {
  ensureInitialized();
  return cachedScale;
}


/**
 * Hook to retrieve the active FontScale, dynamically adapting to Paseo's UI font size setting.
 */
export function useFontScale(): FontScale {
  return useSyncExternalStore(subscribeFontScale, getFontScaleSnapshot, () => DEFAULT_FONT_SCALE);
}

export function _resetFontScaleForTesting(newBase: number = DEFAULT_BASE_FONT_SIZE): void {
  cachedBase = newBase;
  cachedScale = computeFontScale(newBase);
  listeners.forEach((listener) => listener());
}
