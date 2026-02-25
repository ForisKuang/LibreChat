import { atom } from 'jotai';

const FEATURE_FLAG_KEY = 'featureFlags';
const DELIMITER = ',';

/**
 * Define feature flags here. Each flag gates a specific feature
 * that can be enabled via URL param or localStorage for testing
 * before a public rollout.
 *
 * Usage:
 *   - URL:          ?featureFlags=PRODUCT_FEEDBACK,ANOTHER_FLAG
 *   - localStorage: featureFlags = "PRODUCT_FEEDBACK,ANOTHER_FLAG"
 *
 * Flags set via URL are automatically persisted to localStorage.
 */
export enum FeatureFlag {
  PRODUCT_FEEDBACK = 'PRODUCT_FEEDBACK',
}

function readFlags(): Set<string> {
  const stored = localStorage.getItem(FEATURE_FLAG_KEY);
  const fromStorage = stored ? stored.split(DELIMITER).filter(Boolean) : [];

  const url = new URL(window.location.href);
  const param = url.searchParams.get(FEATURE_FLAG_KEY);
  const fromUrl = param ? param.split(DELIMITER).filter(Boolean) : [];

  const merged = new Set([...fromStorage, ...fromUrl]);

  if (fromUrl.length > 0) {
    localStorage.setItem(FEATURE_FLAG_KEY, [...merged].join(DELIMITER));
  }

  return merged;
}

const initialFlags = typeof window !== 'undefined' ? readFlags() : new Set<string>();

export const featureFlagsAtom = atom<Set<string>>(initialFlags);

export const addFeatureFlagAtom = atom(null, (get, set, flag: string) => {
  const current = get(featureFlagsAtom);
  const next = new Set(current);
  next.add(flag);
  set(featureFlagsAtom, next);
  localStorage.setItem(FEATURE_FLAG_KEY, [...next].join(DELIMITER));
});

export const removeFeatureFlagAtom = atom(null, (get, set, flag: string) => {
  const current = get(featureFlagsAtom);
  const next = new Set(current);
  next.delete(flag);
  set(featureFlagsAtom, next);
  localStorage.setItem(FEATURE_FLAG_KEY, [...next].join(DELIMITER));
});

export const clearFeatureFlagsAtom = atom(null, (_get, set) => {
  set(featureFlagsAtom, new Set<string>());
  localStorage.removeItem(FEATURE_FLAG_KEY);
});

export default {
  featureFlagsAtom,
  addFeatureFlagAtom,
  removeFeatureFlagAtom,
  clearFeatureFlagsAtom,
};
