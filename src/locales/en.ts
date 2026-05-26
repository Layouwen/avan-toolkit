export default {
  nav: {
    home: 'Home',
    blogSync: 'Blog Sync',
    agent: 'Agent Lab',
    about: 'About',
  },
  home: {
    title: 'Tools',
    tools: {
      blogSync: {
        title: 'Blog Sync',
        description: 'Sync Obsidian notes to Hexo blog and auto-deploy',
      },
      agent: {
        title: 'Agent Lab',
        description: 'A workspace for AI agent development, debugging, and demos',
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
  agentPage: {
    steps: {
      config: 'Configure OpenAI API key and model parameters',
      singleTurn: 'Implement the minimum single input -> single output loop',
      history: 'Reserve a message history area for multi-turn extension',
      rawPayload: 'Show raw request/response payloads for debugging',
    },
    demos: {
      promptTemplate: 'Prompt templates and variable injection',
      toolCalling: 'Tool calling workflow',
      rag: 'RAG retrieval QA pipeline',
      memory: 'Agent memory for session context',
      multiAgent: 'Multi-agent orchestration',
      tracing: 'Visual execution traces and logs',
    },
  },
}
