# avan-toolkit

[![License](LICENSE_BADGE_URL)](LICENSE_LINK)
[![Release](RELEASE_BADGE_URL)](RELEASES_PAGE_URL)
[![CI](CI_BADGE_URL)](CI_WORKFLOW_URL)
[![Downloads](DOWNLOAD_BADGE_URL)](RELEASES_PAGE_URL)

一款基于 Electron + Vue 3 的跨平台桌面工具箱，面向开发者与创作者，聚焦高频、可自动化的日常工作流。

当前内置核心能力：Blog Sync（Obsidian -> Hexo 自动同步与发布）。

English README: [README.en.md](README.en.md)

## 目录

- [avan-toolkit](#avan-toolkit)
  - [目录](#目录)
  - [项目定位](#项目定位)
  - [核心特性](#核心特性)
    - [1. Blog Sync 一键同步并发布](#1-blog-sync-一键同步并发布)
    - [2. 跨平台桌面体验](#2-跨平台桌面体验)
    - [3. 中英文切换](#3-中英文切换)
  - [界面预览](#界面预览)
  - [快速开始](#快速开始)
    - [环境要求](#环境要求)
    - [安装依赖](#安装依赖)
    - [启动开发环境](#启动开发环境)
    - [构建安装包](#构建安装包)
  - [使用指南](#使用指南)
    - [Blog Sync 典型流程](#blog-sync-典型流程)
  - [配置说明](#配置说明)
  - [脚本命令](#脚本命令)
  - [项目架构](#项目架构)
    - [技术栈](#技术栈)
  - [发布与分发](#发布与分发)
    - [默认构建目标](#默认构建目标)
    - [Release 占位](#release-占位)
  - [排障建议](#排障建议)
    - [1. 目录校验失败](#1-目录校验失败)
    - [2. git commit 失败](#2-git-commit-失败)
    - [3. hexo generate / deploy 失败](#3-hexo-generate--deploy-失败)
    - [4. 日志为空或中断](#4-日志为空或中断)
  - [路线图](#路线图)
  - [贡献指南](#贡献指南)
  - [安全与隐私](#安全与隐私)
  - [许可证](#许可证)

## 项目定位

avan-toolkit 旨在将零散脚本工具沉淀为统一桌面入口，降低重复操作成本。

- 用户侧目标：零命令门槛完成常见流程。
- 开发侧目标：通过模块化主进程 + 渲染层架构快速扩展新工具。
- 当前阶段：MVP，可稳定支撑博客同步场景。

## 核心特性

### 1. Blog Sync 一键同步并发布

- 自动读取 Obsidian 博客目录中的 markdown 文件。
- 自动复制至 Hexo 站点 source/\_posts 子目录。
- 自动去除文件名前缀编号（如 001-title.md -> title.md）。
- 自动补全 frontmatter uuid（缺失时写回源文件）。
- 自动执行 git add、git commit、git push。
- 自动执行 hexo generate、hexo deploy。
- 提供同步日志流与状态可视化（idle、syncing、success、error）。

### 2. 跨平台桌面体验

- 支持 Windows、macOS、Linux（基于 Electron Forge makers）。
- 本地配置持久化，无需每次重新选择目录。

### 3. 中英文切换

- 内置 zh-CN 与 en 语言包。
- 可在关于页切换界面语言，并持久化至本地配置。

## 界面预览

> 请将截图放置在 docs/images 或其他固定目录，并替换以下占位路径。

- 工具首页：![Home](SCREENSHOT_HOME_URL)
- Blog Sync 配置页：![BlogSync Config](SCREENSHOT_SYNC_CONFIG_URL)
- 同步日志页：![BlogSync Logs](SCREENSHOT_SYNC_LOGS_URL)

## 快速开始

### 环境要求

- Node.js: >= <NODE_VERSION_MIN>
- npm: >= <NPM_VERSION_MIN>
- Git: >= <GIT_VERSION_MIN>
- Hexo CLI: <HEXO_CLI_REQUIREMENT>

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm dev
```

### 构建安装包

```bash
npm run make
```

## 使用指南

### Blog Sync 典型流程

1. 打开应用，进入 Blog Sync 页面。
2. 设置 Obsidian Blog 目录。
3. 设置 Hexo 项目目录。
4. 点击 一键同步并发布。
5. 在日志区确认流程完成。

## 配置说明

应用配置保存于 Electron userData 目录下的 config.json，包含：

```json
{
  "obsidianBlogDir": "<ABS_PATH_TO_OBSIDIAN_BLOG_DIR>",
  "hexoBlogDir": "<ABS_PATH_TO_HEXO_PROJECT_DIR>",
  "locale": "zh-CN"
}
```

- 配置文件路径（平台相关）：<CONFIG_PATH_EXAMPLE_BY_OS>
- 默认语言：zh-CN
- 配置迁移策略：<CONFIG_MIGRATION_POLICY>

## 脚本命令

```bash
npm start      # 启动开发模式
npm run lint   # 代码检查
npm run install:playwright  # 安装打包内置的 Playwright Chromium
npm run package  # 打包应用目录
npm run make     # 生成平台安装包
npm run publish  # 发布（需预先配置）
```

`npm run package` 和 `npm run make` 会先执行 `npm run install:playwright`，把 Chromium 下载到 `.playwright-browsers/` 并作为 Electron `Resources` 资源随应用打包。Qzone 自动化在打包后会从内置资源加载 Chromium，不依赖目标机器预先安装 Playwright 浏览器。

## 版本更新

应用在“关于”页提供手动检查更新。当前方案通过 GitHub Releases API 检查最新 stable release，发现新版本后引导用户下载对应平台安装包并手动安装；macOS 未签名阶段不使用自动替换安装。

发布新版本前递增 `package.json` 版本号，执行 `npm run publish` 上传 published stable release。不要使用 draft 或 prerelease，否则应用不会将其作为更新候选。

## 项目架构

```text
main process
  |- configManager.ts    # 本地配置读写
  |- syncPipeline.ts     # 同步与发布流水线

renderer process
  |- views/BlogSync.vue  # 同步配置与日志 UI
  |- views/HomeView.vue  # 工具导航
  |- views/About.vue     # 项目信息与语言切换

shared
  |- electron-api.d.ts   # preload 暴露接口类型
  |- locales/            # 多语言资源
```

### 技术栈

- Electron 42
- Vue 3 + TypeScript
- Vite + Electron Forge
- Pinia + Vue Router
- Naive UI + Tailwind CSS
- gray-matter + uuid

## 发布与分发

### 默认构建目标

- Windows: Squirrel
- macOS: ZIP
- Linux: RPM / DEB

### Release 占位

- Latest Release: <RELEASES_PAGE_URL>
- Changelog: <CHANGELOG_URL>
- Windows 下载: <WINDOWS_INSTALLER_URL>
- macOS 下载: <MACOS_INSTALLER_URL>
- Linux 下载: <LINUX_INSTALLER_URL>

## 排障建议

### 1. 目录校验失败

- 检查 Obsidian 与 Hexo 路径是否存在。
- 检查路径读写权限。

### 2. git commit 失败

- 检查 Hexo 目录是否为 git 仓库。
- 检查是否存在未配置 user.name / user.email。
- 检查是否有 pre-commit hook 阻断。

### 3. hexo generate / deploy 失败

- 检查 Hexo 依赖是否已安装。
- 检查 deploy 配置与远端凭据。
- 检查本地或 CI 网络可达性。

### 4. 日志为空或中断

- 重启应用后重试。
- 检查主进程是否异常退出（查看控制台日志）。

## 路线图

- [ ] 支持更多博客平台（如 Notion、掘金、Dev.to）
- [ ] 支持增量同步策略与冲突检测
- [ ] 支持任务模板与定时执行
- [ ] 支持插件化工具市场
- [ ] 补齐 E2E 与集成测试

## 贡献指南

欢迎提交 Issue 与 PR。

1. Fork 项目并创建功能分支。
2. 提交前运行 npm run lint。
3. 使用清晰的提交信息（建议 Conventional Commits）。
4. 在 PR 中说明变更动机、实现方式和验证步骤。

贡献入口：

- Issues: <ISSUES_URL>
- Pull Requests: <PULL_REQUESTS_URL>
- CONTRIBUTING: <CONTRIBUTING_DOC_URL>
- Code of Conduct: <CODE_OF_CONDUCT_URL>

## 安全与隐私

- 默认仅处理本地文件与本地命令执行。
- 不主动上传用户内容到第三方服务。
- 若未来引入云能力，将在此补充数据采集与权限说明。
- 漏洞报告渠道：<SECURITY_CONTACT>

## 许可证

本项目基于 MIT License 开源。

- License 文件: [LICENSE](LICENSE)
- Copyright: <COPYRIGHT_NOTICE>
