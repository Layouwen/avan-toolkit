export default {
  nav: {
    home: 'Home',
    blogSync: 'Blog Sync',
    about: 'About',
  },
  home: {
    title: 'Tools',
    tools: {
      blogSync: {
        title: 'Blog Sync',
        description: 'Sync Obsidian notes to Hexo blog and auto-deploy',
      },
    },
  },
  blogSync: {
    config: {
      title: '⚙️ Config',
      obsidianBlogDir: 'Obsidian Blog Directory',
      obsidianPlaceholder: 'e.g. D:\\Obsidian\\blog',
      hexoBlogDir: 'Hexo Project Directory',
      hexoPlaceholder: 'e.g. D:\\code\\blog',
      browse: 'Browse',
    },
    action: {
      sync: 'Sync & Publish',
      syncing: 'Syncing...',
    },
    status: {
      idle: 'Idle',
      syncing: 'Syncing',
      success: 'Success',
      error: 'Error',
    },
    logs: {
      title: '📋 Logs',
      clear: 'Clear',
      empty: 'No logs yet. Click "Sync & Publish" to start.',
      failed: 'Failed: {error}',
      done: '── Sync complete ✓',
    },
  },
  about: {
    title: 'About',
    language: '中文',
    links: {
      github: 'GitHub',
      blog: 'Blog',
      twitter: 'Twitter / X',
      juejin: 'Juejin',
      email: 'Email',
    },
  },
}
