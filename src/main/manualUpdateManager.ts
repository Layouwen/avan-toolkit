import process from 'node:process';
import { app, shell } from 'electron';

const RELEASES_API_URL = 'https://api.github.com/repos/layouwen/avan-toolkit/releases';
const RELEASES_PAGE_URL = 'https://github.com/layouwen/avan-toolkit/releases/latest';

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  assets: GitHubReleaseAsset[];
}

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string;
  releaseNotes: string;
  releaseUrl: string;
  downloadUrl: string;
  downloadAssetName: string;
}

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

export function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersion(left).split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right).split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart > rightPart) {
      return 1;
    }
    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

function sortReleases(releases: GitHubRelease[]): GitHubRelease[] {
  return [...releases].sort((left, right) => {
    const versionCompare = compareVersions(right.tag_name, left.tag_name);
    if (versionCompare !== 0) {
      return versionCompare;
    }

    return (right.published_at ?? '').localeCompare(left.published_at ?? '');
  });
}

function scoreAsset(assetName: string): number {
  const name = assetName.toLowerCase();
  const arch = process.arch;
  const platform = process.platform;

  if (platform === 'darwin') {
    if (!name.endsWith('.dmg')) {
      return 0;
    }
    if (arch === 'arm64' && name.includes('arm64')) {
      return 40;
    }
    if (arch === 'x64' && (name.includes('x64') || name.includes('x86_64'))) {
      return 40;
    }
    return 20;
  }

  if (platform === 'win32') {
    if (!name.endsWith('.exe')) {
      return 0;
    }
    if (arch === 'arm64' && name.includes('arm64')) {
      return 40;
    }
    if (arch === 'x64' && (name.includes('x64') || name.includes('x86_64'))) {
      return 40;
    }
    return 20;
  }

  if (platform === 'linux') {
    if (name.endsWith('.appimage')) {
      return 40;
    }
    if (name.endsWith('.deb')) {
      return 30;
    }
    if (name.endsWith('.rpm')) {
      return 20;
    }
  }

  return 0;
}

export function selectDownloadAsset(assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
  return assets
    .map(asset => ({ asset, score: scoreAsset(asset.name) }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.asset.name.localeCompare(right.asset.name))[0]
    ?.asset ?? null;
}

function buildUpdateInfo(release: GitHubRelease | null): AppUpdateInfo {
  const currentVersion = app.getVersion();
  if (!release) {
    return {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releaseName: '',
      releaseNotes: '',
      releaseUrl: RELEASES_PAGE_URL,
      downloadUrl: '',
      downloadAssetName: '',
    };
  }

  const latestVersion = normalizeVersion(release.tag_name);
  const asset = selectDownloadAsset(release.assets);

  return {
    currentVersion,
    latestVersion,
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
    releaseName: release.name || release.tag_name,
    releaseNotes: release.body || '',
    releaseUrl: release.html_url,
    downloadUrl: asset?.browser_download_url ?? '',
    downloadAssetName: asset?.name ?? '',
  };
}

export async function getUpdateInfo(): Promise<AppUpdateInfo> {
  const response = await fetch(RELEASES_API_URL, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': `AvanToolkit/${app.getVersion()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub Releases 请求失败: ${response.status} ${response.statusText}`);
  }

  const releases = await response.json() as GitHubRelease[];
  const latestStableRelease = sortReleases(releases.filter(release => !release.draft && !release.prerelease))[0] ?? null;
  return buildUpdateInfo(latestStableRelease);
}

export async function openUpdateDownload(url: string): Promise<void> {
  const target = url.trim();
  if (!target.startsWith('https://github.com/layouwen/avan-toolkit/releases/')) {
    throw new Error('Invalid update URL.');
  }

  await shell.openExternal(target);
}
