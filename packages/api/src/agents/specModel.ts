import type { TModelSpec, TModelSpecPreset } from 'librechat-data-provider';

/**
 * Returns the model an admin-configured modelSpec pins for a saved agent, so a
 * single agent can be offered under several specs (e.g. Haiku vs Sonnet).
 * Only honored when the spec's `preset.agent_id` matches the agent; the model
 * always comes from server config, never from the request body.
 */
export function getModelSpecAgentModel(
  agent: { id?: string } | null | undefined,
  modelSpec: TModelSpec | null | undefined,
): string | undefined {
  const preset = modelSpec?.preset;
  if (!agent?.id || !preset || preset.agent_id !== agent.id) {
    return undefined;
  }
  const model = preset.model;
  return typeof model === 'string' && model.length > 0 ? model : undefined;
}

/**
 * Generation params a saved-agent modelSpec preset may override.
 *
 * Precedence for the primary agent's model_parameters:
 * - allowlisted keys the preset sets: spec preset > agent record, so one agent
 *   can be offered as e.g. "Haiku, no thinking" and "Sonnet, low effort";
 * - allowlisted keys the preset omits (or sets to null): agent record wins;
 * - every other key (instructions, tools, provider, topP, ...): agent record
 *   only; the preset cannot touch them.
 */
export const MODEL_SPEC_AGENT_PARAM_KEYS = [
  'thinking',
  'thinkingBudget',
  'effort',
  'maxOutputTokens',
  'temperature',
  'promptCache',
] as const;

export type ModelSpecAgentParams = Pick<
  TModelSpecPreset,
  (typeof MODEL_SPEC_AGENT_PARAM_KEYS)[number]
>;

/**
 * Returns the allowlisted generation params (thinking, effort, maxOutputTokens,
 * ...) an admin-configured modelSpec sets for a saved agent. Gated like
 * `getModelSpecAgentModel`; values come from server config, never the request.
 * Returns `undefined` when the spec doesn't target the agent or sets none.
 */
export function getModelSpecAgentParams(
  agent: { id?: string } | null | undefined,
  modelSpec: TModelSpec | null | undefined,
): ModelSpecAgentParams | undefined {
  const preset = modelSpec?.preset;
  if (!agent?.id || !preset || preset.agent_id !== agent.id) {
    return undefined;
  }
  const entries = MODEL_SPEC_AGENT_PARAM_KEYS.filter((key) => preset[key] != null).map(
    (key) => [key, preset[key]] as const,
  );
  return entries.length > 0 ? (Object.fromEntries(entries) as ModelSpecAgentParams) : undefined;
}

export type RequestSpecModelResult =
  | { ok: true; model?: string; params?: ModelSpecAgentParams }
  | { ok: false; error: string };

/**
 * Resolves the optional `spec` field of an API request to the model that spec
 * pins for the requested agent. Absent spec → no override; an unknown spec or
 * one that doesn't target this agent is rejected rather than silently ignored.
 */
export function resolveRequestSpecModel(
  agent: { id?: string } | null | undefined,
  specName: unknown,
  modelSpecs: TModelSpec[] | null | undefined,
): RequestSpecModelResult {
  if (specName === undefined || specName === null) {
    return { ok: true };
  }
  if (typeof specName !== 'string' || specName.length === 0) {
    return { ok: false, error: 'spec must be a non-empty string' };
  }
  const modelSpec = modelSpecs?.find((candidate) => candidate.name === specName);
  if (!modelSpec) {
    return { ok: false, error: `Unknown model spec: ${specName}` };
  }
  const model = getModelSpecAgentModel(agent, modelSpec);
  if (!model) {
    return {
      ok: false,
      error: `Model spec "${specName}" does not select a model for agent ${agent?.id ?? ''}`,
    };
  }
  const params = getModelSpecAgentParams(agent, modelSpec);
  return { ok: true, model, ...(params && { params }) };
}

/**
 * Returns a copy of the agent running `model` with any spec `params` merged
 * over its model_parameters, leaving the original untouched.
 */
export function withAgentModel<T extends { model?: string | null; model_parameters?: object }>(
  agent: T,
  model: string,
  params?: ModelSpecAgentParams,
): T {
  return {
    ...agent,
    model,
    ...((agent.model_parameters != null || params != null) && {
      model_parameters: { ...agent.model_parameters, ...params, model },
    }),
  };
}
