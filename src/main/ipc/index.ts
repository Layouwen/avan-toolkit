import type { IpcRegistrationContext } from './types';
import { registerAgentIpcHandlers } from './agentIpc';
import { registerAppIpcHandlers } from './appIpc';
import { registerBlogIpcHandlers } from './blogIpc';
import { registerEditorExtensionsIpcHandlers } from './editorExtensionsIpc';
import { registerLogIpcHandlers } from './logIpc';
import { registerQzoneIpcHandlers } from './qzoneIpc';

export function registerIpcHandlers(context: IpcRegistrationContext): void {
  registerAppIpcHandlers(context);
  registerBlogIpcHandlers(context);
  registerLogIpcHandlers();
  registerEditorExtensionsIpcHandlers();
  registerAgentIpcHandlers();
  registerQzoneIpcHandlers();
}
