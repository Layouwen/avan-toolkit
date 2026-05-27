import OpenAI from 'openai';
import 'dotenv/config';

type Role = 'system' | 'user' | 'assistant' | 'tool';

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ChatMessage {
  role: Role;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    finish_reason: string;
    message: ChatMessage;
  }>;
}

interface ChatToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };
}

interface LocationInfo {
  city: string;
  region: string;
  country: string;
  latitude: string;
  longitude: string;
  ip: string;
}

interface WeatherInfo {
  latitude: string;
  longitude: string;
  current_weather: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
  };
}

export interface AgentRunResult {
  answer: string;
  model: string;
  baseURL: string;
  trace: string[];
}

export interface AgentRuntimeConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function formatRequestError(error: unknown, config: AgentRuntimeConfig): Error {
  const message = toErrorMessage(error);
  const details = [
    `baseURL=${config.baseURL}`,
    `model=${config.model}`,
  ];

  if (/connection error|fetch failed|econnrefused|enotfound|etimedout/i.test(message)) {
    return new Error(
      `Cannot connect to model service (${details.join(', ')}). `
      + 'Please verify: 1) Base URL contains protocol (http/https), '
      + '2) endpoint includes /v1, 3) service is running and reachable. '
      + `Original: ${message}`,
    );
  }

  return new Error(`LLM request failed (${details.join(', ')}): ${message}`);
}

function normalizeRuntimeConfig(config: AgentRuntimeConfig): AgentRuntimeConfig {
  const normalizedBaseURL = config.baseURL.trim().replace(/\/+$/, '');
  return {
    baseURL: normalizedBaseURL,
    model: config.model.trim(),
    apiKey: config.apiKey.trim(),
  };
}

function createOpenAIClient(config: AgentRuntimeConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

async function getLocation(): Promise<LocationInfo> {
  return {
    city: 'Guangzhou',
    region: 'Guangdong',
    country: 'China',
    latitude: '23.1291',
    longitude: '113.2644',
    ip: '127.0.0.1',
  };
}

async function getCurrentWeather(
  latitude: string,
  longitude: string,
): Promise<WeatherInfo> {
  return {
    latitude,
    longitude,
    current_weather: {
      temperature: 38.5,
      windspeed: 10.2,
      winddirection: 180,
      weathercode: 1,
    },
  };
}

type ToolFunction = (args: Record<string, unknown>) => Promise<unknown>;

const availableTools: Record<string, ToolFunction> = {
  getLocation: async () => getLocation(),
  getCurrentWeather: async (args) => {
    const latitude = String(args.latitude ?? '23.1291');
    const longitude = String(args.longitude ?? '113.2644');
    return getCurrentWeather(latitude, longitude);
  },
};

const tools: ChatToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'getCurrentWeather',
      description: '根据经纬度获取当前天气',
      parameters: {
        type: 'object',
        properties: {
          latitude: { type: 'string', description: 'Latitude.' },
          longitude: { type: 'string', description: 'Longitude.' },
        },
        required: ['latitude', 'longitude'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getLocation',
      description: '获取用户的当前地理位置（基于 IP）',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

function parseToolArgs(rawArgs: string): Record<string, unknown> {
  if (!rawArgs.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(rawArgs) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return {};
  }
  catch {
    return {};
  }
}

async function createChatCompletion(
  client: OpenAI,
  model: string,
  messages: ChatMessage[],
): Promise<ChatCompletionResponse> {
  const response = await client.chat.completions.create({
    model,
    messages: messages as never,
    tools,
    tool_choice: 'auto',
  }) as unknown as ChatCompletionResponse;

  return response;
}

function getMessageText(message: ChatMessage): string {
  return typeof message.content === 'string' ? message.content : '';
}

export async function runAgentRecommendation(
  userInput: string,
  runtimeConfig: AgentRuntimeConfig,
): Promise<AgentRunResult> {
  const config = normalizeRuntimeConfig(runtimeConfig);
  if (!config.baseURL || !config.model || !config.apiKey) {
    throw new Error('Agent config baseURL/model/apiKey cannot be empty.');
  }

  const client = createOpenAIClient(config);
  const trace: string[] = [
    `Runtime config: baseURL=${config.baseURL}, model=${config.model}`,
  ];
  let lastLocation: LocationInfo | null = null;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: '你是一个严格执行指令的助手。用户要求"根据我的位置和天气推荐活动"，你必须按以下顺序调用工具：\n'
        + '1. 首先调用 getLocation 获取位置（不需要任何参数）。\n'
        + '2. 然后调用 getCurrentWeather 获取天气（需要 latitude 和 longitude）。\n'
        + '3. 最后基于返回的数据给出活动建议。\n'
        + '不要向用户提问，不要解释流程，直接调用工具。',
    },
    {
      role: 'user',
      content: userInput,
    },
  ];

  for (let round = 0; round < 5; round++) {
    let completion: ChatCompletionResponse;

    try {
      completion = await createChatCompletion(client, config.model, messages);
    }
    catch (error) {
      throw formatRequestError(error, config);
    }

    const choice = completion.choices[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      throw new Error('LLM response is missing a message.');
    }

    messages.push(assistantMessage);
    trace.push(`Round ${round + 1}: finish_reason=${choice.finish_reason}`);

    if (assistantMessage.tool_calls?.length) {
      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const tool = availableTools[functionName];
        if (!tool) {
          throw new Error(`Tool not found: ${functionName}`);
        }

        const args = parseToolArgs(toolCall.function.arguments);
        const finalArgs = functionName === 'getCurrentWeather' && lastLocation
          ? {
              latitude: String(args.latitude ?? lastLocation.latitude),
              longitude: String(args.longitude ?? lastLocation.longitude),
            }
          : args;

        trace.push(`Call tool: ${functionName}`);
        const toolResult = await tool(finalArgs);

        if (functionName === 'getLocation') {
          if (toolResult && typeof toolResult === 'object') {
            lastLocation = toolResult as LocationInfo;
          }
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: functionName,
          content: JSON.stringify(toolResult),
        });
      }
      continue;
    }

    const answer = getMessageText(assistantMessage).trim();
    if (answer) {
      return {
        answer,
        model: config.model,
        baseURL: config.baseURL,
        trace,
      };
    }
  }

  return {
    answer: 'Timed out: the model did not produce a final answer in 5 rounds.',
    model: config.model,
    baseURL: config.baseURL,
    trace,
  };
}
