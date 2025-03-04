# Google 搜索工具

这是一个基于 Playwright 的 Node.js 工具，能够绕过搜索引擎的反爬虫机制，执行 Google 搜索并提取结果。它可作为命令行工具直接使用，或通过 Model Context Protocol (MCP) 服务器为 Claude 等 AI 助手提供实时搜索能力。

## 核心亮点

- **本地化 SERP API 替代方案**：无需依赖付费的搜索引擎结果 API 服务，完全在本地执行搜索操作
- **先进的反机器人检测绕过技术**：
  - 智能浏览器指纹管理，模拟真实用户行为
  - 自动保存和恢复浏览器状态，减少验证频率
  - 无头/有头模式智能切换，遇到验证时自动转为有头模式让用户完成验证
  - 多种设备和区域设置随机化，降低被检测风险
- **MCP 服务器集成**：为 Claude 等 AI 助手提供实时搜索能力，无需额外 API 密钥
- **完全开源免费**：所有代码开源，无使用限制，可自由定制和扩展

## 技术特性

- 使用 TypeScript 开发，提供类型安全和更好的开发体验
- 基于 Playwright 实现浏览器自动化，支持多种浏览器引擎
- 支持命令行参数输入搜索关键词
- 支持作为 MCP 服务器，为 Claude 等 AI 助手提供搜索能力
- 返回搜索结果的标题、链接和摘要
- 以 JSON 格式输出结果
- 支持无头模式和有头模式（调试用）
- 提供详细的日志输出
- 健壮的错误处理机制
- 支持保存和恢复浏览器状态，有效避免反机器人检测

## 安装

```bash
# 或者从源码安装
git clone https://github.com/web-agent-master/google-search.git
cd google-search
pnpm install
# 编译 TypeScript 代码
pnpm build
# 将包链接到全局（可选）
pnpm run link
```

## 使用方法

### 命令行工具

```bash
# 直接使用命令行
google-search "搜索关键词"

# 使用命令行选项
google-search --limit 5 --timeout 60000 --no-headless "搜索关键词"


# 或者使用 npx
npx google-search-cli "搜索关键词"

# 开发模式运行
pnpm dev "搜索关键词"

# 调试模式运行（显示浏览器界面）
pnpm debug "搜索关键词"
```

#### 命令行选项

- `-l, --limit <number>`: 结果数量限制（默认：10）
- `-t, --timeout <number>`: 超时时间（毫秒，默认：60000）
- `--no-headless`: 显示浏览器界面（调试用）
- `--remote-debugging-port <number>`: 启用远程调试端口（默认：9222）
- `--state-file <path>`: 浏览器状态文件路径（默认：./browser-state.json）
- `--no-save-state`: 不保存浏览器状态
- `-V, --version`: 显示版本号
- `-h, --help`: 显示帮助信息

#### 输出示例

```json
{
  "query": "deepseek",
  "results": [
    {
      "title": "DeepSeek",
      "link": "https://www.deepseek.com/",
      "snippet": "DeepSeek-R1 is now live and open source, rivaling OpenAI's Model o1. Available on web, app, and API. Click for details. Into ..."
    },
    {
      "title": "DeepSeek",
      "link": "https://www.deepseek.com/",
      "snippet": "DeepSeek-R1 is now live and open source, rivaling OpenAI's Model o1. Available on web, app, and API. Click for details. Into ..."
    },
    {
      "title": "deepseek-ai/DeepSeek-V3",
      "link": "https://github.com/deepseek-ai/DeepSeek-V3",
      "snippet": "We present DeepSeek-V3, a strong Mixture-of-Experts (MoE) language model with 671B total parameters with 37B activated for each token."
    }
    // 更多结果...
  ]
}
```

### MCP 服务器

本项目提供 Model Context Protocol (MCP) 服务器功能，让 Claude 等 AI 助手直接使用 Google 搜索能力。MCP 是一个开放协议，使 AI 助手能安全访问外部工具和数据。

```bash
# 构建项目
pnpm build
```

#### 与 Claude Desktop 集成

1. 编辑 Claude Desktop 配置文件（Mac: `~/Library/Application Support/Claude/claude_desktop_config.json` 或 Windows: `%APPDATA%\Claude\claude_desktop_config.json`）
2. 添加服务器配置并重启 Claude

```json
{
  "mcpServers": {
    "google-search": {
      "command": "node",
      "args": ["/绝对路径/到/google-search/dist/src/mcp-server.js"]
    }
  }
}
```

集成后，可在 Claude 中直接使用搜索功能，如"搜索最新的 AI 研究"。

## 项目结构

```
google-search/
├── package.json          # 项目配置和依赖
├── tsconfig.json         # TypeScript 配置
├── src/
│   ├── index.ts          # 入口文件（命令行解析和主逻辑）
│   ├── search.ts         # 搜索功能实现（Playwright 浏览器自动化）
│   ├── mcp-server.ts     # MCP 服务器实现
│   └── types.ts          # 类型定义（接口和类型声明）
├── dist/                 # 编译后的 JavaScript 文件
├── bin/                  # 可执行文件
│   └── google-search     # 命令行入口脚本
├── README.md             # 项目说明文档
└── .gitignore            # Git 忽略文件
```

## 技术栈

- **TypeScript**: 开发语言，提供类型安全和更好的开发体验
- **Node.js**: 运行环境，用于执行 JavaScript/TypeScript 代码
- **Playwright**: 用于浏览器自动化，支持多种浏览器
- **Commander**: 用于解析命令行参数和生成帮助信息
- **Model Context Protocol (MCP)**: 用于与 AI 助手集成的开放协议
- **MCP SDK**: 用于实现 MCP 服务器的开发工具包
- **Zod**: 用于验证和类型安全的 Schema 定义库
- **pnpm**: 高效的包管理工具，节省磁盘空间和安装时间

## 开发指南

所有命令都可以在项目根目录下运行：

```bash
# 安装依赖
pnpm install

# 安装 Playwright 浏览器
pnpm run postinstall

# 编译 TypeScript 代码
pnpm build

# 清理编译输出
pnpm clean
```

### CLI 开发

```bash
# 开发模式运行
pnpm dev "搜索关键词"

# 调试模式运行（显示浏览器界面）
pnpm debug "搜索关键词"

# 运行编译后的代码
pnpm start "搜索关键词"

# 测试搜索功能
pnpm test
```

### MCP 服务器开发

```bash
# 开发模式运行 MCP 服务器
pnpm mcp

# 运行编译后的 MCP 服务器
pnpm mcp:build
```

## 错误处理

工具内置了健壮的错误处理机制：

- 浏览器启动失败时提供友好的错误信息
- 网络连接问题时自动返回错误状态
- 搜索结果解析失败时提供详细日志
- 超时情况下优雅退出并返回有用信息

## 注意事项

### 通用注意事项

- 本工具仅用于学习和研究目的
- 请遵守 Google 的使用条款和政策
- 不要过于频繁地发送请求，以避免被 Google 封锁
- 某些地区可能需要使用代理才能访问 Google
- Playwright 需要安装浏览器，首次使用时会自动下载

### 状态文件

- 状态文件包含浏览器 cookies 和存储数据，请妥善保管
- 使用状态文件可以有效避免 Google 的反机器人检测，提高搜索成功率

### MCP 服务器

- MCP 服务器需要 Node.js v16 或更高版本
- 使用 MCP 服务器时，请确保 Claude Desktop 已更新到最新版本
- 配置 Claude Desktop 时，请使用绝对路径指向 MCP 服务器文件

## 与商业 SERP API 的对比

与付费的搜索引擎结果 API 服务（如 SerpAPI）相比，本项目提供了以下优势：

- **完全免费**：无需支付 API 调用费用
- **本地执行**：所有搜索在本地执行，无需依赖第三方服务
- **隐私保护**：搜索查询不会被第三方记录
- **可定制性**：完全开源，可根据需要修改和扩展功能
- **无使用限制**：不受 API 调用次数或频率限制
- **MCP 集成**：原生支持与 Claude 等 AI 助手集成
