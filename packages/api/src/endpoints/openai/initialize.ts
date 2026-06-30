import { ErrorTypes, EModelEndpoint, mapModelToAzureConfig } from 'librechat-data-provider';
import type {
  BaseInitializeParams,
  InitializeResultBase,
  OpenAIConfigOptions,
  UserKeyValues,
} from '~/types';
import { getAzureCredentials, resolveHeaders, isUserProvided, checkUserKeyExpiry } from '~/utils';
import { getOpenAIConfig } from './config';

/**
 * Initializes OpenAI options for agent usage. This function always returns configuration
 * options and never creates a client instance (equivalent to optionsOnly=true behavior).
 *
 * @param params - Configuration parameters
 * @returns Promise resolving to OpenAI configuration options
 * @throws Error if API key is missing or user key has expired
 */
export async function initializeOpenAI({
  req,
  endpoint,
  model_parameters,
  db,
}: BaseInitializeParams): Promise<InitializeResultBase> {
  const appConfig = req.config;
  const { PROXY, OPENAI_API_KEY, AZURE_API_KEY, OPENAI_REVERSE_PROXY, AZURE_OPENAI_BASEURL } =
    process.env;

  const { key: expiresAt } = req.body;
  const modelName = model_parameters?.model as string | undefined;

  const credentials = {
    [EModelEndpoint.openAI]: OPENAI_API_KEY,
    [EModelEndpoint.azureOpenAI]: AZURE_API_KEY,
  };

  const baseURLOptions = {
    [EModelEndpoint.openAI]: OPENAI_REVERSE_PROXY,
    [EModelEndpoint.azureOpenAI]: AZURE_OPENAI_BASEURL,
  };

  const userProvidesKey = isUserProvided(credentials[endpoint as keyof typeof credentials]);
  const userProvidesURL = isUserProvided(baseURLOptions[endpoint as keyof typeof baseURLOptions]);

  let userValues: UserKeyValues | null = null;

  // Try optional BYOK: load user key values when user has stored one, even if env key is set
  try {
    const optionalUserValues = await db.getUserKeyValues({ userId: req.user?.id ?? '', name: endpoint });
    if (optionalUserValues?.apiKey) {
      if (expiresAt) {
        checkUserKeyExpiry(expiresAt, endpoint);
      }
      userValues = optionalUserValues;
    }
  } catch {
    // No user key stored — fall through to server key below
  }

  // Required BYOK path: env var is USER_PROVIDED, so user must have set a key
  if (!userValues && expiresAt && (userProvidesKey || userProvidesURL)) {
    checkUserKeyExpiry(expiresAt, endpoint);
    userValues = await db.getUserKeyValues({ userId: req.user?.id ?? '', name: endpoint });
  }

  let apiKey = userValues?.apiKey ?? (userProvidesKey ? undefined : credentials[endpoint as keyof typeof credentials]);
  const baseURL = userValues?.baseURL ?? (userProvidesURL ? undefined : baseURLOptions[endpoint as keyof typeof baseURLOptions]);

  const clientOptions: OpenAIConfigOptions = {
    proxy: PROXY ?? undefined,
    reverseProxyUrl: baseURL || undefined,
    streaming: true,
  };

  const isAzureOpenAI = endpoint === EModelEndpoint.azureOpenAI;
  const azureConfig = isAzureOpenAI && appConfig?.endpoints?.[EModelEndpoint.azureOpenAI];
  let isServerless = false;

  if (isAzureOpenAI && azureConfig) {
    const { modelGroupMap, groupMap } = azureConfig;
    const {
      azureOptions,
      baseURL: configBaseURL,
      headers = {},
      serverless,
    } = mapModelToAzureConfig({
      modelName: modelName || '',
      modelGroupMap,
      groupMap,
    });
    isServerless = serverless === true;

    clientOptions.reverseProxyUrl = configBaseURL ?? clientOptions.reverseProxyUrl;
    clientOptions.headers = resolveHeaders({
      headers: { ...headers, ...(clientOptions.headers ?? {}) },
      user: req.user,
    });

    const groupName = modelGroupMap[modelName || '']?.group;
    if (groupName && groupMap[groupName]) {
      clientOptions.addParams = groupMap[groupName]?.addParams;
      clientOptions.dropParams = groupMap[groupName]?.dropParams;
    }

    apiKey = azureOptions.azureOpenAIApiKey;
    clientOptions.azure = !isServerless ? azureOptions : undefined;

    if (isServerless) {
      clientOptions.defaultQuery = azureOptions.azureOpenAIApiVersion
        ? { 'api-version': azureOptions.azureOpenAIApiVersion }
        : undefined;

      if (!clientOptions.headers) {
        clientOptions.headers = {};
      }
      clientOptions.headers['api-key'] = apiKey;
    }
  } else if (isAzureOpenAI) {
    clientOptions.azure =
      userProvidesKey && userValues?.apiKey ? JSON.parse(userValues.apiKey) : getAzureCredentials();
    apiKey = clientOptions.azure ? clientOptions.azure.azureOpenAIApiKey : undefined;
  }

  if (userProvidesKey && !apiKey) {
    throw new Error(
      JSON.stringify({
        type: ErrorTypes.NO_USER_KEY,
      }),
    );
  }

  if (!apiKey) {
    throw new Error(`${endpoint} API Key not provided.`);
  }

  const modelOptions = {
    ...(model_parameters ?? {}),
    model: modelName,
    user: req.user?.id,
  };

  const finalClientOptions: OpenAIConfigOptions = {
    ...clientOptions,
    modelOptions,
  };

  const options = getOpenAIConfig(apiKey, finalClientOptions, endpoint);

  /** Set useLegacyContent for Azure serverless deployments */
  if (isServerless) {
    (options as InitializeResultBase).useLegacyContent = true;
  }

  const openAIConfig = appConfig?.endpoints?.[EModelEndpoint.openAI];
  const allConfig = appConfig?.endpoints?.all;
  const azureRate = modelName?.includes('gpt-4') ? 30 : 17;

  let streamRate: number | undefined;

  if (isAzureOpenAI && azureConfig) {
    streamRate = azureConfig.streamRate ?? azureRate;
  } else if (!isAzureOpenAI && openAIConfig) {
    streamRate = openAIConfig.streamRate;
  }

  if (allConfig?.streamRate) {
    streamRate = allConfig.streamRate;
  }

  if (streamRate) {
    options.llmConfig._lc_stream_delay = streamRate;
  }

  return options;
}
