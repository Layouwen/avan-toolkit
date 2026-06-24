import type { AgentRuntimeConfig } from '../agentDemo';
import { ipcMain } from 'electron';
import { runAgentRecommendation } from '../agentDemo';
import { createModuleLogger } from '../logger';

export function registerAgentIpcHandlers(): void {
  ipcMain.handle('agent:recommendActivity', async (_event, userInput: string, config: AgentRuntimeConfig) => {
    const text = userInput.trim();
    if (!text) {
      throw new Error('Prompt cannot be empty.');
    }
    if (!config || !config.baseURL || !config.model || !config.apiKey) {
      throw new Error('Agent config baseURL/model/apiKey is required.');
    }

    const logger = createModuleLogger({ module: 'agent', scope: 'recommendActivity' });
    return runAgentRecommendation(text, config, logger);
  });
}
