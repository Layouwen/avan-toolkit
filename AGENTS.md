# AGENT.md

本仓库 AI 约定；产品细节见 `README.md`。

## 项目

Electron + Vue 3 + TS 桌面工具箱：Blog Sync（Obsidian→Hexo + git/发布）、Agent Demo（OpenAI 兼容 API）、i18n（zh-CN/en，默认中文）。

**命令**：`npm install` · `dev` · `lint` · `package` · `make`（Node 见 `.nvmrc`）

**目录**：`main.ts` / `preload.ts` / `electron-api.d.ts` — 主进程、bridge、类型；`src/main/` — 配置、博客、sync、agent；`views` · `router` · `stores` · `locales` · `index.css`

## 开发

- 使用 TypeScript + Naive UI + Tailwind CSS 开发；
- 文案同步 `locales/zh-CN.ts` 与 `en.ts`;
- **IPC**：渲染进程禁 Node/fs/shell。新能力：`main.ts` → `preload.ts` → `electron-api.d.ts` → `electronAPI`；主进程校验路径/URL/命令/输入；勿日志 apiKey 等
- **配置**：`configManager.ts`（userData）；改 schema 同步类型、preload、README；字段有默认值
- **Blog Sync**（`syncPipeline.ts`）：慎路径/覆盖/外部命令；真跑前确认目录；日志中文、步骤化
- **UI**：深色工具风；loading/empty/error/success；长任务防重复；新页补路由/导航/i18n

## 验证与边界

`lint` 只做局部, 禁止全局；IPC/UI/外部命令尽量 `dev`；打包改动验 `package`/`make`。勿提交密钥/私路径/产物；未确认勿 push git、发博客、跑 Hexo；小步、贴合现有结构。
