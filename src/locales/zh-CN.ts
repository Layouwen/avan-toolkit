export default {
  nav: {
    home: 'Home',
    blogSync: '博客同步',
    about: '关于',
  },
  home: {
    title: '工具导航',
    tools: {
      blogSync: {
        title: '博客同步',
        description: '将 Obsidian 笔记同步到 Hexo 博客并自动部署',
      },
    },
  },
  blogSync: {
    config: {
      title: '⚙️ 配置',
      obsidianBlogDir: 'Obsidian Blog 目录',
      obsidianPlaceholder: '例如：D:\\Obsidian\\blog',
      hexoBlogDir: 'Hexo 项目目录',
      hexoPlaceholder: '例如：D:\\code\\blog',
      browse: '浏览',
    },
    action: {
      sync: '一键同步并发布',
      syncing: '同步中...',
    },
    status: {
      idle: 'Idle',
      syncing: 'Syncing',
      success: 'Success',
      error: 'Error',
    },
    logs: {
      title: '📋 日志',
      clear: '清空',
      empty: '暂无日志，点击「一键同步并发布」开始',
      failed: '失败: {error}',
      done: '── 同步完成 ✓',
    },
  },
  about: {
    title: '关于',
    language: 'English',
    links: {
      github: 'GitHub',
      blog: '博客',
      twitter: 'Twitter / X',
      juejin: '掘金',
      email: '邮箱',
    },
  },
}
