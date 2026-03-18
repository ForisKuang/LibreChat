import { useMemo, useCallback } from 'react';
import * as Select from '@ariakit/react/select';
import { ChevronDown } from 'lucide-react';
import { EModelEndpoint, isAgentsEndpoint } from 'librechat-data-provider';
import type { TModelSpec } from 'librechat-data-provider';
import { useChatContext, useAgentsMapContext } from '~/Providers';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import SpecIcon from '~/components/Chat/Menus/Endpoints/components/SpecIcon';
import useSelectMention from '~/hooks/Input/useSelectMention';
import { cn } from '~/utils';

export default function AgentSelectorDropdown() {
  const { conversation, newConversation } = useChatContext();
  const agentsMap = useAgentsMapContext();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig } = useGetEndpointsQuery();

  const modelSpecs = useMemo(() => {
    const specs = startupConfig?.modelSpecs?.list ?? [];
    if (!agentsMap) {
      return specs;
    }
    return specs.filter((spec) => {
      if (spec.preset?.endpoint === EModelEndpoint.agents && spec.preset?.agent_id) {
        return spec.preset.agent_id in agentsMap;
      }
      return true;
    });
  }, [startupConfig, agentsMap]);

  const allAgentSpecs = useMemo(() => {
    if (!modelSpecs || modelSpecs.length === 0) {
      return false;
    }
    return modelSpecs.every(
      (spec) => spec.preset?.endpoint && isAgentsEndpoint(spec.preset.endpoint),
    );
  }, [modelSpecs]);

  const { onSelectSpec } = useSelectMention({
    modelSpecs,
    conversation,
    endpointsConfig,
    newConversation,
    returnHandlers: true,
  });

  const handleSelectSpec = useCallback(
    (spec: TModelSpec) => {
      onSelectSpec?.(spec);
    },
    [onSelectSpec],
  );

  const currentSpecName = conversation?.spec ?? '';
  const currentSpec = useMemo(
    () => modelSpecs.find((s) => s.name === currentSpecName) ?? modelSpecs[0],
    [modelSpecs, currentSpecName],
  );

  // Only render when all specs are agent endpoints and there are multiple to choose from
  if (!allAgentSpecs || !modelSpecs || modelSpecs.length < 2) {
    return null;
  }

  return (
    <div className="animate-fadeIn mt-4 flex flex-col items-center gap-1.5">
      <span className="text-xs text-text-secondary">Switch agent</span>
      <Select.SelectProvider
        value={currentSpec?.name ?? ''}
        setValue={(value) => {
          const spec = modelSpecs.find((s) => s.name === value);
          if (spec) {
            handleSelectSpec(spec);
          }
        }}
      >
        <Select.Select
          className={cn(
            'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors duration-200',
            'border-border-light bg-presentation text-text-primary hover:bg-surface-active-alt',
          )}
          aria-label="Select agent"
        >
          {currentSpec && endpointsConfig && (
            <div className="flex flex-shrink-0 items-center justify-center overflow-hidden">
              <SpecIcon currentSpec={currentSpec} endpointsConfig={endpointsConfig} />
            </div>
          )}
          <span className="truncate">{currentSpec?.name ?? 'Select Agent'}</span>
          <ChevronDown className="size-4 text-text-secondary" aria-hidden="true" />
        </Select.Select>
        <Select.SelectPopover
          className="popover-ui z-[9999] w-56 rounded-lg"
          placement="top"
          portal={true}
          gutter={4}
        >
          {modelSpecs.map((spec) => {
            const isSelected = spec.name === currentSpec?.name;
            return (
              <Select.SelectItem
                key={spec.name}
                value={spec.name}
                className={cn('select-item gap-2 text-sm', isSelected && 'font-semibold')}
              >
                {endpointsConfig && (
                  <div className="flex flex-shrink-0 items-center justify-center overflow-hidden">
                    <SpecIcon currentSpec={spec} endpointsConfig={endpointsConfig} />
                  </div>
                )}
                <span className="flex-grow truncate">{spec.name}</span>
                {isSelected && (
                  <span className="ml-auto text-text-primary" aria-hidden="true">
                    &#10003;
                  </span>
                )}
              </Select.SelectItem>
            );
          })}
        </Select.SelectPopover>
      </Select.SelectProvider>
    </div>
  );
}
