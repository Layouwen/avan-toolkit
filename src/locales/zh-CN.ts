export default {
  nav: {
    home: 'Home',
    blogSync: '博客同步',
    agent: 'Agent 实验室',
    about: '关于',
  },
  home: {
    title: '工具导航',
    tools: {
      blogSync: {
        title: '博客同步',
        description: '将 Obsidian 笔记同步到 Hexo 博客并自动部署',
      },
      agent: {
        title: 'Agent 实验室',
        description: '用于 AI Agent 开发、调试与功能演示的工作台',
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
  agentPage: {
    title: 'Agent 最小演示区',
    inputPlaceholder: '请输入你的问题...',
    send: '发送',
    outputTitle: '输出区',
    waiting: '等待输入...',
    stepTitle: '实现步骤',
    demoTitle: '能力演示',
    steps: {
      config: '配置 OpenAI API Key 与模型参数',
      singleTurn: '实现一次输入 -> 一次输出的最小对话循环',
      history: '预留消息历史区，便于后续多轮扩展',
      rawPayload: '在页面展示原始请求/响应用于调试',
    },
    demos: {
      promptTemplate: 'Prompt 模板与变量注入',
      toolCalling: '工具调用（Tool Calling）流程',
      rag: 'RAG 检索问答链路',
      memory: 'Agent Memory 会话记忆',
      multiAgent: '多 Agent 协作编排',
      tracing: '可视化执行轨迹与日志',
    },
  },
};
