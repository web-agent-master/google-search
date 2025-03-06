# 搜索工具

一个基于 Playwright 的 Node.js 工具，能够绕过搜索引擎的反爬虫机制，执行 Google 和 Bing 搜索并提取结果。它可以直接作为命令行工具使用，也可以作为 Model Context Protocol (MCP) 服务器为 Claude 等 AI 助手提供实时搜索能力。

[![Star History Chart](https://api.star-history.com/svg?repos=web-agent-master/google-search&type=Date)](https://star-history.com/#web-agent-master/google-search&Date)

[English Documentation](README.md)

## 主要特点

- **本地 SERP API 替代方案**：无需依赖付费的搜索引擎结果 API 服务，所有搜索在本地执行
- **多搜索引擎支持**：目前支持 Google 和 Bing 搜索引擎
- **URL 内容爬取器**：可提取任何网页内容，支持自定义选择器和元数据提取
- **先进的反机器人检测绕过技术**：
  - 智能浏览器指纹管理，模拟真实用户行为
  - 自动保存和恢复浏览器状态，减少验证频率
  - 智能无头/有头模式切换，在需要验证时自动切换到有头模式
  - 设备和区域设置的随机化，降低检测风险
- **MCP 服务器集成**：为 Claude 等 AI 助手提供实时搜索能力，无需额外的 API 密钥
- **完全开源和免费**：所有代码开源，无使用限制，可自由定制和扩展

## 技术特性

- 使用 TypeScript 开发，提供类型安全和更好的开发体验
- 基于 Playwright 实现浏览器自动化，支持多种浏览器引擎
- 支持命令行参数输入搜索关键词
- 支持作为 MCP 服务器，为 Claude 等 AI 助手提供搜索能力
- 返回搜索结果的标题、链接和摘要
- URL 爬取器支持自定义内容提取和元数据支持
- 以 JSON 格式输出结果
- 支持无头模式和有头模式（调试用）
- 提供详细的日志输出
- 健壮的错误处理机制
- 支持保存和恢复浏览器状态，有效避免反机器人检测

## 安装

```bash
# 从源码安装
git clone https://github.com/web-agent-master/google-search.git
cd google-search
# 安装依赖
npm install
# 或使用 yarn
yarn
# 或使用 pnpm
pnpm install

# 编译 TypeScript 代码
npm run build
# 或使用 yarn
yarn build
# 或使用 pnpm
pnpm build

# 将包链接到全局（使用MCP功能必需）
npm link
# 或使用 yarn
yarn link
# 或使用 pnpm
pnpm link
```

### Windows 环境特别说明

在 Windows 环境下，本工具已经做了特殊适配：

1. 提供了 `.cmd` 文件，确保命令行工具在 Windows 命令提示符和 PowerShell 中正常工作
2. 日志文件存储在系统临时目录，而不是 Unix/Linux 的 `/tmp` 目录
3. 添加了 Windows 特定的进程信号处理，确保服务器能够正常关闭
4. 使用跨平台的文件路径处理，支持 Windows 的路径分隔符

## 使用方法

### 命令行

```bash
# Google 搜索
npx google-search "你的搜索查询"
# 或者带选项
npx google-search --limit 5 "你的搜索查询"

# Bing 搜索
npx bing-search "你的搜索查询"
# 或者带选项
npx bing-search --limit 5 "你的搜索查询"

# URL 爬取器
npx url-crawler "https://example.com"
# 或者带选项
npx url-crawler -s "article.main-content" -w "div.loaded-content" -t 30000 "https://example.com"
```

你也可以使用子命令：

```bash
# Google 搜索
npx google-search google "你的搜索查询"

# Bing 搜索
npx google-search bing "你的搜索查询"
```

### 选项

#### 搜索选项
- `--limit <number>`：限制结果数量（默认：10）
- `--timeout <number>`：设置超时时间（毫秒）（默认：30000）
- `--state-file <path>`：指定浏览器状态文件路径（默认：./browser-state.json）
- `--no-save-state`：不保存浏览器状态
- `--locale <locale>`：指定搜索结果语言（默认：zh-CN）

#### URL 爬取器选项
- `-s, --selector <selector>`：CSS选择器，用于提取特定内容
- `-w, --wait-for <selector>`：等待指定元素出现后再提取内容
- `-t, --timeout <ms>`：超时时间(毫秒)（默认：30000）
- `--no-metadata`：不提取元数据
- `--no-headless`：使用有头模式运行浏览器
- `--no-save-state`：不保存浏览器状态
- `--state-file <path>`：指定浏览器状态文件路径（默认：~/.url-crawler-browser-state.json）

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

#### URL 爬取器输出示例

```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "content": "Example Domain\n\nThis domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.\n\nMore information...",
  "metadata": {
    "viewport": "width=device-width, initial-scale=1"
  },
  "timestamp": "2025-03-06T07:44:05.698Z"
}
```

### MCP 服务器

```bash
# 启动 MCP 服务器
npx google-search-mcp
```

MCP 服务器提供两个工具：
- `google-search`：用于 Google 搜索
- `bing-search`：用于 Bing 搜索
- `url-crawler`：用于爬取和提取URL内容

#### 与 Claude Desktop 集成

1. 编辑 Claude Desktop 配置文件
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
     - 通常位于 `C:\Users\用户名\AppData\Roaming\Claude\claude_desktop_config.json`
     - 可以在 Windows 资源管理器地址栏输入 `%APPDATA%\Claude` 直接访问

2. 添加服务器配置并重启 Claude

```json
{
  "mcpServers": {
    "google-search": {
      "command": "npx",
      "args": ["google-search-mcp"]
    }
  }
}
```

Windows 环境下，也可以使用以下配置方案：

1. 使用cmd.exe与npx：

```json
{
  "mcpServers": {
    "google-search": {
      "command": "cmd.exe",
      "args": ["/c", "npx", "google-search-mcp"]
    }
  }
}
```

2. 使用node与完整路径（如果上述方法遇到问题，推荐使用此方法）：

```json
{
  "mcpServers": {
    "google-search": {
      "command": "node",
      "args": ["C:/你的路径/google-search/dist/mcp-server.js"]
    }
  }
}
```

注意：对于第二种方法，你必须将`C:/你的路径/google-search`替换为你实际安装google-search包的完整路径。

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

### Windows 环境特别注意事项

- 在 Windows 环境下，首次运行可能需要管理员权限安装 Playwright 浏览器
- 如果遇到权限问题，可以尝试以管理员身份运行命令提示符或 PowerShell
- Windows 防火墙可能会阻止 Playwright 浏览器的网络连接，请在提示时允许访问
- 浏览器状态文件默认保存在用户主目录下的 `.google-search-browser-state.json`
- 日志文件保存在系统临时目录下的 `google-search-logs` 文件夹中

## 与商业 SERP API 的对比

与付费的搜索引擎结果 API 服务（如 SerpAPI）相比，本项目提供了以下优势：

- **完全免费**：无需支付 API 调用费用
- **本地执行**：所有搜索在本地执行，无需依赖第三方服务
- **隐私保护**：搜索查询不会被第三方记录
- **可定制性**：完全开源，可根据需要修改和扩展功能
- **无使用限制**：不受 API 调用次数或频率限制
- **MCP 集成**：原生支持与 Claude 等 AI 助手集成
