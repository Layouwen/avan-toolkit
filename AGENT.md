# AGENT.md

本文件面向在 `avan-toolkit` 仓库中工作的 AI agent，说明项目背景、开发约定与安全边界。修改代码前请先阅读根目录 `README.md` 与相关源码。

## 项目定位

`avan-toolkit` 是一个基于 Electron + Vue 3 + TypeScript 的跨平台桌面工具箱，面向开发者与创作者，聚焦高频、可自动化的本地工作流。

当前核心能力：

- Blog Sync：将 Obsidian 博客目录同步到 Hexo 项目，并自动执行 git 与 Hexo 发布流程。
- Agent Demo：通过用户配置的 OpenAI 兼容接口演示单轮 agent 调用。
- 多语言：内置 `zh-CN` 与 `en`，默认中文。

## 技术栈

- Electron Forge + Vite
- Vue 3 + TypeScript
- Vue Router + Pinia
- Naive UI + Tailwind CSS
- vue-i18n
- gray-matter、uuid
- ESLint 使用 `@antfu/eslint-config`，项目开启分号风格。

## 常用命令

```bash
npm install
npm run dev
npm run lint
npm run package
npm run make
```

本地 Node 版本以 `.nvmrc` 为准。

## 目录职责

- `src/main.ts`：Electron 主进程入口、窗口创建与 IPC handler 注册。
- `src/preload.ts`：通过 `contextBridge` 暴露安全的 `window.electronAPI`。
- `src/electron-api.d.ts`：渲染进程可用 API 与共享类型声明。
- `src/main/`：主进程业务模块，例如配置管理、博客管理、同步流水线、agent 调用。
- `src/views/`：页面级 Vue 组件。
- `src/router/`：路由定义。
- `src/stores/`：Pinia 状态。
- `src/locales/`：中英文文案资源。
- `src/index.css`：全局样式与 Tailwind 入口。

## 代码风格

- 使用 TypeScript 与 Vue `<script setup lang="ts">`。
- 保留分号，遵循现有 Antfu ESLint 规则。
- 优先使用单引号。
- 文件和接口命名沿用现有风格，不做无关重命名。
- 注释保持克制，只在复杂流程或安全边界处补充说明。
- UI 优先使用 Naive UI 组件，布局和间距可配合 Tailwind class, 能用 Tailwind 实现就不用 style 标签。
- 新增用户可见文案必须同步维护 `src/locales/zh-CN.ts` 与 `src/locales/en.ts`。

## Electron 与 IPC 约定

- 渲染进程不要直接访问 Node.js API、文件系统或 shell。
- 新增主进程能力时按以下链路维护类型和边界：
  1. 在 `src/main.ts` 注册 `ipcMain.handle(...)` 或事件发送逻辑。
  2. 在 `src/preload.ts` 通过 `contextBridge.exposeInMainWorld` 暴露最小 API。
  3. 在 `src/electron-api.d.ts` 补齐类型声明。
  4. 在 Vue 组件中通过 `window.electronAPI` 调用。
- IPC 参数需要在主进程侧校验，尤其是路径、URL、命令参数和用户输入。
- 不要将 `apiKey`、本地路径等敏感信息写入日志或 UI 调试输出。

## 配置与本地数据

- 应用配置由 `src/main/configManager.ts` 读写，保存在 Electron `userData` 下。
- 修改配置 schema 时，同步更新：
  - `AppConfig` / `AgentConfig` 等类型。
  - `preload.ts` 中的配置类型。
  - README 中的配置说明。
- 配置字段应提供安全默认值，避免旧用户配置缺字段时报错。

## Blog Sync 注意事项

- 同步流程位于 `src/main/syncPipeline.ts`。
- 该流程会复制 markdown、补写 frontmatter `uuid`、执行 `git add/commit/push` 与 Hexo 命令。
- 修改同步逻辑时必须谨慎处理路径拼接、递归复制、文件覆盖和外部命令执行。
- 运行真实同步前确认测试目录，避免误改用户的 Obsidian 或 Hexo 仓库。
- 日志应保持中文、步骤化、可定位失败原因。

## UI 与体验约定

- 当前应用整体为深色桌面工具风格，避免引入营销页式的大面积装饰。
- 页面应聚焦工作流本身：配置、操作、状态、日志、结果。
- 组件状态要覆盖 loading、empty、error、success。
- 操作按钮应防重复点击，长任务需要可见状态反馈。
- 新增页面需更新路由、导航菜单和多语言文案。

## 验证要求

- 代码修改后至少运行：

```bash
npm run lint
```

- 涉及 Electron、IPC、UI 交互或外部命令的修改，应尽量启动开发环境手动验证：

```bash
npm run dev
```

- 打包或发布相关改动需要额外验证 `npm run package` 或 `npm run make`。

## 协作边界

- 不要还原用户未要求还原的改动。
- 不要提交密钥、绝对私人路径、构建产物或 `node_modules`。
- 不要在未确认的情况下执行会修改外部仓库、发布博客、推送 git 远端或部署 Hexo 的操作。
- 变更应保持小而清晰，优先贴合现有目录结构与实现方式。
