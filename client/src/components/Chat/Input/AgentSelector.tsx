import { memo, useMemo } from 'react';
import * as Select from '@ariakit/react/select';
import { Constants, EModelEndpoint, isAgentsEndpoint } from 'librechat-data-provider';
import type { TModelSpec } from 'librechat-data-provider';
import { ChevronDown, Check } from 'lucide-react';
import { useChatContext, useAgentsMapContext } from '~/Providers';
import { useGetStartupConfig, useGetEndpointsQuery } from '~/data-provider';
import useSelectMention from '~/hooks/Input/useSelectMention';
import SpecIcon from '~/components/Chat/Menus/Endpoints/components/SpecIcon';

const AgentSelector = memo(function AgentSelector() {
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

  const conversationId = conversation?.conversationId ?? Constants.NEW_CONVO;
  const isNewConversation = !conversationId || conversationId === Constants.NEW_CONVO;

  const { onSelectSpec } = useSelectMention({
    modelSpecs,
    conversation: conversation ?? null,
    endpointsConfig: endpointsConfig ?? {},
    newConversation,
    returnHandlers: true,
  }) as { onSelectSpec: (spec: TModelSpec) => void };

  const selectedSpecName = conversation?.spec ?? '';

  const selectedSpec = useMemo(
    () => modelSpecs.find((s) => s.name === selectedSpecName) ?? modelSpecs[0],
    [modelSpecs, selectedSpecName],
  );

  const selectStore = Select.useSelectStore({
    value: selectedSpec?.name ?? '',
    setValue: (value: string) => {
      const spec = modelSpecs.find((s) => s.name === value);
      if (spec) {
        onSelectSpec(spec);
      }
    },
    placement: 'top',
  });

  // Only render when all specs are agents and there are 2+ agents, on new conversations
  if (!allAgentSpecs || modelSpecs.length < 2 || !isNewConversation) {
    return null;
  }

  return (
    <div className="relative flex items-center">
      <Select.Select
        store={selectStore}
        className="flex items-center gap-1 rounded-full border border-border-light bg-transparent px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-active-alt hover:text-text-primary"
        aria-label="Select agent"
      >
        <span className="max-w-[120px] truncate">{selectedSpec?.name ?? 'Agent'}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
      </Select.Select>
      <Select.SelectPopover
        store={selectStore}
        portal={true}
        className="popover-ui z-50 min-w-[240px] max-w-[320px] overflow-y-auto"
      >
        {modelSpecs.map((spec) => {
          const isSelected = spec.name === selectedSpec?.name;
          return (
            <Select.SelectItem
              key={spec.name}
              value={spec.name}
              className="select-item"
            >
              <div className="flex w-full items-center gap-2.5">
                {endpointsConfig && (
                  <div className="flex shrink-0 items-center justify-center">
                    <SpecIcon currentSpec={spec} endpointsConfig={endpointsConfig} />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-text-primary">
                    {spec.name}
                  </span>
                  {spec.label && (
                    <span className="truncate text-xs text-text-secondary">
                      {spec.label}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <Check className="ml-auto h-4 w-4 shrink-0 text-text-primary" />
                )}
              </div>
            </Select.SelectItem>
          );
        })}
      </Select.SelectPopover>
    </div>
  );
});

export default AgentSelector;
