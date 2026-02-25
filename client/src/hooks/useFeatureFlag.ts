import { useAtomValue } from 'jotai';
import { featureFlagsAtom, FeatureFlag } from '~/store/featureFlags';

/**
 * Check if a feature flag is enabled.
 *
 * Flags can be activated by:
 * 1. URL query param: ?featureFlags=PRODUCT_FEEDBACK
 * 2. localStorage: featureFlags = "PRODUCT_FEEDBACK"
 *
 * Flags set via URL are persisted to localStorage automatically.
 *
 * @example
 * const isEnabled = useFeatureFlag(FeatureFlag.PRODUCT_FEEDBACK);
 */
export default function useFeatureFlag(flag: FeatureFlag): boolean {
  const flags = useAtomValue(featureFlagsAtom);
  return flags.has(flag);
}
