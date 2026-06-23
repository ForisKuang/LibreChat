import { createStorageAtom } from './jotai-utils';

const DEFAULT_SHOW_REASONING_ACTIONS = false;

/**
 * Controls whether chat reasoning and action details are shown inline.
 */
export const showReasoningActionsAtom = createStorageAtom<boolean>(
  'showReasoningActions',
  DEFAULT_SHOW_REASONING_ACTIONS,
);
