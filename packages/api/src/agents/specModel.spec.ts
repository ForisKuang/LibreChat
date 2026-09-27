import type { TModelSpec } from 'librechat-data-provider';
import {
  EModelEndpoint,
  AnthropicEffort,
  bedrockInputParser,
  bedrockOutputParser,
} from 'librechat-data-provider';
import {
  withAgentModel,
  getModelSpecAgentModel,
  getModelSpecAgentParams,
  resolveRequestSpecModel,
} from './specModel';

const spec = (preset: Record<string, unknown>): TModelSpec =>
  ({
    name: 'spec',
    label: 'Spec',
    preset: { endpoint: EModelEndpoint.agents, ...preset },
  }) as TModelSpec;

describe('getModelSpecAgentModel', () => {
  it('returns the spec model when the spec targets the agent', () => {
    expect(
      getModelSpecAgentModel({ id: 'agent_1' }, spec({ agent_id: 'agent_1', model: 'sonnet' })),
    ).toBe('sonnet');
  });

  it('ignores specs pointing at a different agent', () => {
    expect(
      getModelSpecAgentModel({ id: 'agent_1' }, spec({ agent_id: 'agent_2', model: 'sonnet' })),
    ).toBeUndefined();
  });

  it('ignores specs without a model', () => {
    expect(
      getModelSpecAgentModel({ id: 'agent_1' }, spec({ agent_id: 'agent_1' })),
    ).toBeUndefined();
    expect(
      getModelSpecAgentModel({ id: 'agent_1' }, spec({ agent_id: 'agent_1', model: '' })),
    ).toBeUndefined();
  });

  it('handles missing agent or spec', () => {
    expect(getModelSpecAgentModel(undefined, spec({ agent_id: 'a', model: 'm' }))).toBeUndefined();
    expect(getModelSpecAgentModel({ id: 'a' }, null)).toBeUndefined();
    expect(getModelSpecAgentModel({}, spec({ agent_id: undefined, model: 'm' }))).toBeUndefined();
  });
});

describe('getModelSpecAgentParams', () => {
  it('returns only allowlisted generation params from the spec preset', () => {
    expect(
      getModelSpecAgentParams(
        { id: 'agent_1' },
        spec({
          agent_id: 'agent_1',
          model: 'sonnet',
          thinking: false,
          thinkingBudget: 2000,
          effort: 'low',
          maxOutputTokens: 4096,
          promptCache: true,
          promptCacheTtl: '1h',
          temperature: 0.2,
          topP: 0.5,
          instructions: 'ignored',
          greeting: 'ignored',
        }),
      ),
    ).toEqual({
      thinking: false,
      thinkingBudget: 2000,
      effort: 'low',
      maxOutputTokens: 4096,
      promptCache: true,
      temperature: 0.2,
    });
  });

  it('keeps falsy-but-set values', () => {
    expect(
      getModelSpecAgentParams(
        { id: 'agent_1' },
        spec({ agent_id: 'agent_1', thinking: false, temperature: 0, promptCache: false }),
      ),
    ).toEqual({ thinking: false, temperature: 0, promptCache: false });
  });

  it('ignores specs pointing at a different agent', () => {
    expect(
      getModelSpecAgentParams({ id: 'agent_1' }, spec({ agent_id: 'agent_2', effort: 'low' })),
    ).toBeUndefined();
  });

  it('returns undefined when the preset sets none of the params', () => {
    expect(
      getModelSpecAgentParams({ id: 'agent_1' }, spec({ agent_id: 'agent_1', model: 'sonnet' })),
    ).toBeUndefined();
    expect(
      getModelSpecAgentParams(
        { id: 'agent_1' },
        spec({ agent_id: 'agent_1', effort: null, maxOutputTokens: undefined }),
      ),
    ).toBeUndefined();
  });

  it('handles missing agent or spec', () => {
    expect(
      getModelSpecAgentParams(undefined, spec({ agent_id: 'a', effort: 'low' })),
    ).toBeUndefined();
    expect(getModelSpecAgentParams({ id: 'a' }, null)).toBeUndefined();
    expect(
      getModelSpecAgentParams({}, spec({ agent_id: undefined, effort: 'low' })),
    ).toBeUndefined();
  });
});

describe('resolveRequestSpecModel', () => {
  const specs: TModelSpec[] = [
    { ...spec({ agent_id: 'agent_1', model: 'haiku' }), name: 'haiku-spec' },
    { ...spec({ agent_id: 'agent_1', model: 'sonnet' }), name: 'sonnet-spec' },
    { ...spec({ agent_id: 'agent_2', model: 'sonnet' }), name: 'other-agent-spec' },
    { ...spec({ agent_id: 'agent_1' }), name: 'no-model-spec' },
    {
      ...spec({ agent_id: 'agent_1', model: 'sonnet', effort: 'low', maxOutputTokens: 4096 }),
      name: 'sonnet-low-spec',
    },
  ];

  it('applies no override when the request has no spec', () => {
    expect(resolveRequestSpecModel({ id: 'agent_1' }, undefined, specs)).toEqual({ ok: true });
    expect(resolveRequestSpecModel({ id: 'agent_1' }, null, specs)).toEqual({ ok: true });
  });

  it('returns the model of the named spec for the matching agent', () => {
    expect(resolveRequestSpecModel({ id: 'agent_1' }, 'sonnet-spec', specs)).toEqual({
      ok: true,
      model: 'sonnet',
    });
  });

  it('includes the spec generation params when the spec sets any', () => {
    expect(resolveRequestSpecModel({ id: 'agent_1' }, 'sonnet-low-spec', specs)).toEqual({
      ok: true,
      model: 'sonnet',
      params: { effort: 'low', maxOutputTokens: 4096 },
    });
    expect(resolveRequestSpecModel({ id: 'agent_1' }, 'sonnet-spec', specs)).not.toHaveProperty(
      'params',
    );
  });

  it('rejects unknown specs, specs for other agents, and specs without a model', () => {
    for (const name of ['missing', 'other-agent-spec', 'no-model-spec']) {
      expect(resolveRequestSpecModel({ id: 'agent_1' }, name, specs).ok).toBe(false);
    }
  });

  it('rejects non-string or empty spec values', () => {
    expect(resolveRequestSpecModel({ id: 'agent_1' }, 42, specs).ok).toBe(false);
    expect(resolveRequestSpecModel({ id: 'agent_1' }, '', specs).ok).toBe(false);
  });

  it('rejects any spec when no modelSpecs are configured', () => {
    expect(resolveRequestSpecModel({ id: 'agent_1' }, 'sonnet-spec', undefined).ok).toBe(false);
  });
});

describe('withAgentModel', () => {
  it('returns a copy with the model set, leaving the original untouched', () => {
    const agent = { id: 'agent_1', model: 'haiku', model_parameters: { promptCache: true } };
    const copy = withAgentModel(agent, 'sonnet');
    expect(copy).toEqual({
      id: 'agent_1',
      model: 'sonnet',
      model_parameters: { promptCache: true, model: 'sonnet' },
    });
    expect(agent).toEqual({
      id: 'agent_1',
      model: 'haiku',
      model_parameters: { promptCache: true },
    });
    expect(copy.model_parameters).not.toBe(agent.model_parameters);
  });

  it('does not invent model_parameters when the agent has none', () => {
    expect(withAgentModel({ id: 'agent_1', model: 'haiku' }, 'sonnet')).toEqual({
      id: 'agent_1',
      model: 'sonnet',
    });
  });

  it('merges spec params over model_parameters and pins the model', () => {
    const agent = {
      id: 'agent_1',
      model: 'haiku',
      model_parameters: { model: 'haiku', promptCache: true, effort: 'high' },
    };
    const copy = withAgentModel(agent, 'sonnet', {
      effort: AnthropicEffort.low,
      maxOutputTokens: 4096,
    });
    expect(copy.model_parameters).toEqual({
      model: 'sonnet',
      promptCache: true,
      effort: 'low',
      maxOutputTokens: 4096,
    });
    expect(agent.model_parameters).toEqual({ model: 'haiku', promptCache: true, effort: 'high' });
  });

  it('creates model_parameters for spec params when the agent has none', () => {
    expect(
      withAgentModel({ id: 'agent_1', model: 'haiku' }, 'sonnet', { thinking: false }),
    ).toEqual({
      id: 'agent_1',
      model: 'sonnet',
      model_parameters: { thinking: false, model: 'sonnet' },
    });
  });
});

/**
 * End-to-end shape check: the merged model_parameters, as initializeAgent would
 * hand them to the Bedrock endpoint, produce the expected Converse fields.
 */
describe('spec params through the Bedrock parsers', () => {
  const toBedrock = (modelParameters: Record<string, unknown>) =>
    bedrockOutputParser(bedrockInputParser.parse(modelParameters)) as Record<string, unknown> & {
      additionalModelRequestFields?: Record<string, unknown>;
    };

  const merged = (model: string, preset: Record<string, unknown>) =>
    withAgentModel(
      { id: 'agent_1', model: 'stored', model_parameters: { model: 'stored', promptCache: true } },
      model,
      getModelSpecAgentParams({ id: 'agent_1' }, spec({ agent_id: 'agent_1', model, ...preset })),
    ).model_parameters as Record<string, unknown>;

  it('Haiku with thinking:false sends no thinking config', () => {
    const haiku = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';
    const llmConfig = toBedrock(merged(haiku, { thinking: false, maxOutputTokens: 2048 }));
    expect(llmConfig.model).toBe(haiku);
    expect(llmConfig.additionalModelRequestFields?.thinking).toBeUndefined();
    expect(llmConfig.maxTokens).toBe(2048);
  });

  it('Sonnet 5 with effort:low sends output_config.effort=low with adaptive thinking', () => {
    const sonnet = 'us.anthropic.claude-sonnet-5';
    const llmConfig = toBedrock(merged(sonnet, { effort: 'low', maxOutputTokens: 8192 }));
    expect(llmConfig.model).toBe(sonnet);
    expect(llmConfig.additionalModelRequestFields?.output_config).toEqual({ effort: 'low' });
    expect(llmConfig.additionalModelRequestFields?.thinking).toEqual(
      expect.objectContaining({ type: 'adaptive' }),
    );
    expect(llmConfig.maxTokens).toBe(8192);
  });
});
