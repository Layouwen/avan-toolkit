# avan-toolkit

[![License](LICENSE_BADGE_URL)](LICENSE_LINK)
[![Release](RELEASE_BADGE_URL)](RELEASES_PAGE_URL)
[![CI](CI_BADGE_URL)](CI_WORKFLOW_URL)
[![Downloads](DOWNLOAD_BADGE_URL)](RELEASES_PAGE_URL)

A cross-platform desktop toolkit built with Electron + Vue 3 for developers and creators, focused on high-frequency and automatable workflows.

Current built-in capability: Blog Sync (Obsidian -> Hexo sync and publish).

中文文档: [README.md](README.md)

## Table of Contents

- [avan-toolkit](#avan-toolkit)
  - [Table of Contents](#table-of-contents)
  - [Positioning](#positioning)
  - [Key Features](#key-features)
    - [1. One-click Blog Sync and Publish](#1-one-click-blog-sync-and-publish)
    - [2. Cross-platform Desktop Experience](#2-cross-platform-desktop-experience)
    - [3. Internationalization](#3-internationalization)
  - [Screenshots](#screenshots)
  - [Quick Start](#quick-start)
    - [Prerequisites](#prerequisites)
    - [Install Dependencies](#install-dependencies)
    - [Start Development](#start-development)
    - [Build Installers](#build-installers)
  - [Usage Guide](#usage-guide)
    - [Typical Blog Sync Flow](#typical-blog-sync-flow)
  - [Configuration](#configuration)
  - [Scripts](#scripts)
  - [Architecture](#architecture)
    - [Stack](#stack)
  - [Release and Distribution](#release-and-distribution)
    - [Default Targets](#default-targets)
    - [Release Placeholders](#release-placeholders)
  - [Troubleshooting](#troubleshooting)
    - [1. Directory Validation Failed](#1-directory-validation-failed)
    - [2. git commit Failed](#2-git-commit-failed)
    - [3. hexo generate or deploy Failed](#3-hexo-generate-or-deploy-failed)
    - [4. Empty or Interrupted Logs](#4-empty-or-interrupted-logs)
  - [Roadmap](#roadmap)
  - [Contributing](#contributing)
  - [Security and Privacy](#security-and-privacy)
  - [License](#license)

## Positioning

avan-toolkit turns scattered scripts into one desktop entry point.

- User goal: complete common workflows with near-zero command-line effort.
- Developer goal: expand tools quickly with a modular main/renderer architecture.
- Current stage: MVP with stable Blog Sync support.

## Key Features

### 1. One-click Blog Sync and Publish

- Reads markdown files from your Obsidian blog directory.
- Copies files into Hexo source/\_posts folders.
- Removes indexed filename prefixes (for example, 001-title.md -> title.md).
- Auto-generates missing frontmatter uuid and writes back to source file.
- Runs git add, git commit, and git push automatically.
- Runs hexo generate and hexo deploy automatically.
- Shows streaming logs and status states (idle, syncing, success, error).

### 2. Cross-platform Desktop Experience

- Supports Windows, macOS, Linux (via Electron Forge makers).
- Persists local settings so paths do not need to be re-selected every run.

### 3. Internationalization

- Built-in zh-CN and en locales.
- Locale can be switched in-app and persisted to local config.

## Screenshots

> Put screenshots in docs/images or another stable path, then replace placeholders below.

- Home: ![Home](SCREENSHOT_HOME_URL)
- Blog Sync Config: ![BlogSync Config](SCREENSHOT_SYNC_CONFIG_URL)
- Blog Sync Logs: ![BlogSync Logs](SCREENSHOT_SYNC_LOGS_URL)

## Quick Start

### Prerequisites

- Node.js: >= <NODE_VERSION_MIN>
- npm: >= <NPM_VERSION_MIN>
- Git: >= <GIT_VERSION_MIN>
- Hexo CLI: <HEXO_CLI_REQUIREMENT>

### Install Dependencies

```bash
npm install
```

### Start Development

```bash
npm start
```

### Build Installers

```bash
npm run make
```

## Usage Guide

### Typical Blog Sync Flow

1. Open the app and go to Blog Sync.
2. Select Obsidian blog directory.
3. Select Hexo project directory.
4. Click Sync and Publish.
5. Confirm completion in the log panel.

## Configuration

App config is stored in config.json under Electron userData directory:

```json
{
  "obsidianBlogDir": "<ABS_PATH_TO_OBSIDIAN_BLOG_DIR>",
  "hexoBlogDir": "<ABS_PATH_TO_HEXO_PROJECT_DIR>",
  "locale": "zh-CN"
}
```

- Config path examples: <CONFIG_PATH_EXAMPLE_BY_OS>
- Default locale: zh-CN
- Migration policy: <CONFIG_MIGRATION_POLICY>

## Scripts

```bash
npm start        # Start development mode
npm run lint     # Lint source files
npm run install:playwright  # Install packaged Playwright Chromium
npm run package  # Package app directory
npm run make     # Build platform installers
npm run publish  # Publish (requires setup)
```

`npm run package` and `npm run make` run `npm run install:playwright` first, downloading Chromium into `.playwright-browsers/` and packaging it as an Electron `Resources` asset. After packaging, Qzone automation loads Chromium from the embedded resource directory instead of requiring Playwright browsers to be installed on the target machine.

## App Updates

The About page provides a manual update check. This implementation queries the GitHub Releases API for the latest stable release, then opens the matching installer or release page for manual installation; unsigned macOS builds do not use automatic replacement installs.

Before publishing a new version, increment the `package.json` version and run `npm run publish` to upload a published stable release. Drafts and prereleases are ignored by the app update check.

## Architecture

```text
main process
  |- configManager.ts    # local config read/write
  |- syncPipeline.ts     # sync and publish pipeline

renderer process
  |- views/BlogSync.vue  # sync config and log UI
  |- views/HomeView.vue  # tool navigation
  |- views/About.vue     # project info and locale switch

shared
  |- electron-api.d.ts   # preload-exposed API types
  |- locales/            # i18n resources
```

### Stack

- Electron 42
- Vue 3 + TypeScript
- Vite + Electron Forge
- Pinia + Vue Router
- Naive UI + Tailwind CSS
- gray-matter + uuid

## Release and Distribution

### Default Targets

- Windows: Squirrel
- macOS: ZIP
- Linux: RPM / DEB

### Release Placeholders

- Latest Release: <RELEASES_PAGE_URL>
- Changelog: <CHANGELOG_URL>
- Windows Download: <WINDOWS_INSTALLER_URL>
- macOS Download: <MACOS_INSTALLER_URL>
- Linux Download: <LINUX_INSTALLER_URL>

## Troubleshooting

### 1. Directory Validation Failed

- Verify Obsidian and Hexo paths exist.
- Verify read/write permissions.

### 2. git commit Failed

- Ensure Hexo directory is a git repo.
- Ensure git user.name and user.email are configured.
- Check whether pre-commit hooks block the commit.

### 3. hexo generate or deploy Failed

- Ensure Hexo dependencies are installed.
- Ensure deploy config and remote credentials are valid.
- Ensure network connectivity for local or CI environment.

### 4. Empty or Interrupted Logs

- Restart the app and retry.
- Check main-process console logs for crashes.

## Roadmap

- [ ] More blog targets (for example Notion, Juejin, Dev.to)
- [ ] Incremental sync strategy and conflict detection
- [ ] Task templates and scheduled execution
- [ ] Plugin-style tool marketplace
- [ ] E2E and integration test coverage

## Contributing

Issues and pull requests are welcome.

1. Fork the repo and create a feature branch.
2. Run npm run lint before submitting.
3. Use clear commit messages (Conventional Commits recommended).
4. In PR description, include motivation, implementation, and validation steps.

Contribution entry points:

- Issues: <ISSUES_URL>
- Pull Requests: <PULL_REQUESTS_URL>
- CONTRIBUTING: <CONTRIBUTING_DOC_URL>
- Code of Conduct: <CODE_OF_CONDUCT_URL>

## Security and Privacy

- By default, only local files and local commands are processed.
- User content is not uploaded to third-party services by default.
- If cloud capabilities are added later, data collection and permission details will be documented here.
- Security contact: <SECURITY_CONTACT>

## License

This project is licensed under MIT.

- License file: [LICENSE](LICENSE)
- Copyright: <COPYRIGHT_NOTICE>
