import { useAtom } from 'jotai';
import { Lightbulb } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { showReasoningActionsAtom } from '~/store/showReasoningActions';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export default function ReasoningActionsToggle() {
  const localize = useLocalize();
  const [showReasoningActions, setShowReasoningActions] = useAtom(showReasoningActionsAtom);
  const label = localize(
    showReasoningActions ? 'com_ui_hide_reasoning_actions' : 'com_ui_show_reasoning_actions',
  );

  return (
    <TooltipAnchor
      description={label}
      render={
        <button
          id="reasoning-actions-toggle"
          type="button"
          aria-label={label}
          aria-pressed={showReasoningActions}
          onClick={() => setShowReasoningActions((prev) => !prev)}
          className={cn(
            'flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover',
            showReasoningActions ? 'bg-surface-hover text-text-primary' : 'text-text-secondary',
          )}
          title={label}
        >
          <Lightbulb className="size-5" aria-hidden="true" />
        </button>
      }
    />
  );
}
