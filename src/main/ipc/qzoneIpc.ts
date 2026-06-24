import { ipcMain } from 'electron';
import { getConfig } from '../configManager';
import { listQzoneShuoshuo, loadMoreQzoneShuoshuo, publishQzoneShuoshuo, testQzoneLogin } from '../qzoneAutomation';

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function registerQzoneIpcHandlers(): void {
  ipcMain.handle('qzone:testLogin', async () => {
    const config = await getConfig();
    return testQzoneLogin(config.qzone);
  });

  ipcMain.handle('qzone:publishShuoshuo', async (_event, content: string) => {
    const config = await getConfig();
    return publishQzoneShuoshuo(config.qzone, content);
  });

  ipcMain.handle('qzone:listShuoshuo', async () => {
    try {
      const config = await getConfig();
      return await listQzoneShuoshuo(config.qzone);
    }
    catch (error) {
      return {
        success: false,
        message: toErrorMessage(error),
        steps: [`执行失败: ${toErrorMessage(error)}`],
        items: [],
        hasMore: false,
      };
    }
  });

  ipcMain.handle('qzone:loadMoreShuoshuo', async () => {
    try {
      return await loadMoreQzoneShuoshuo();
    }
    catch (error) {
      return {
        success: false,
        message: toErrorMessage(error),
        steps: [`执行失败: ${toErrorMessage(error)}`],
        items: [],
        hasMore: false,
      };
    }
  });
}
