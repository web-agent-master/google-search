# Google 搜索 CLI 工具

这是一个基于 Playwright 的 Node.js CLI 工具，可以打开 Google 搜索页面，获取搜索结果，并以 JSON 格式返回给用户。

## 功能特点

- 使用 TypeScript 开发
- 基于 Playwright 实现浏览器自动化
- 支持命令行参数输入搜索关键词
- 返回搜索结果的标题、链接和摘要
- 以 JSON 格式输出结果
- 支持无头模式和有头模式（调试用）
- 提供详细的日志输出
- 健壮的错误处理机制
- 支持保存和恢复浏览器状态，避免反机器人检测

## 安装

```bash
# 从 npm 安装
pnpm add google-search-cli

# 或者从源码安装
git clone <repository-url>
cd google-search
pnpm install
# 安装 Playwright 浏览器
pnpm run postinstall
# 编译 TypeScript 代码
pnpm build
# 将包链接到全局（可选）
pnpm run link
```

## 使用方法

```bash
# 直接使用命令行
google-search "搜索关键词"

# 使用命令行选项
google-search --limit 5 --timeout 60000 --no-headless "搜索关键词"

# 使用状态文件（避免反机器人检测）
google-search --state-file "./my-state.json" "搜索关键词"

# 不保存状态
google-search --no-save-state "搜索关键词"

# 或者使用 npx
npx google-search-cli "搜索关键词"

# 开发模式运行
pnpm dev "搜索关键词"

# 调试模式运行（显示浏览器界面）
pnpm debug "搜索关键词"
```

### 命令行选项

- `-l, --limit <number>`: 结果数量限制（默认：10）
- `-t, --timeout <number>`: 超时时间（毫秒，默认：60000）
- `--no-headless`: 显示浏览器界面（调试用）
- `--remote-debugging-port <number>`: 启用远程调试端口（默认：9222）
- `--state-file <path>`: 浏览器状态文件路径（默认：./browser-state.json）
- `--no-save-state`: 不保存浏览器状态
- `-V, --version`: 显示版本号
- `-h, --help`: 显示帮助信息

## 输出示例

```json
{
  "query": "playwright typescript",
  "results": [
    {
      "title": "TypeScript",
      "link": "https://playwright.dev/docs/test-typescript",
      "snippet": "Playwright supports TypeScript out of the box. You just write tests in TypeScript, and Playwright will read them, transform to JavaScript and run. Note that ..."
    },
    {
      "title": "TypeScript - Playwright",
      "link": "https://playwright.dev/docs/test-typescript",
      "snippet": ""
    }
    // 更多结果...
  ]
}
```

## 项目结构

```
google-search/
├── package.json          # 项目配置和依赖
├── tsconfig.json         # TypeScript 配置
├── src/
│   ├── index.ts          # 入口文件（命令行解析和主逻辑）
│   ├── search.ts         # 搜索功能实现（Playwright 浏览器自动化）
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
- **pnpm**: 高效的包管理工具，节省磁盘空间和安装时间

## 开发

```bash
# 安装依赖
pnpm install

# 安装 Playwright 浏览器
pnpm run postinstall

# 开发模式运行
pnpm dev "搜索关键词"

# 调试模式运行（显示浏览器界面）
pnpm debug "搜索关键词"

# 编译
pnpm build

# 运行编译后的代码
pnpm start "搜索关键词"

# 测试搜索功能
pnpm test

# 清理编译输出
pnpm clean
```

## 错误处理

工具内置了健壮的错误处理机制：

- 浏览器启动失败时提供友好的错误信息
- 网络连接问题时自动返回错误状态
- 搜索结果解析失败时提供详细日志
- 超时情况下优雅退出并返回有用信息

## 注意事项

- 本工具仅用于学习和研究目的
- 请遵守 Google 的使用条款和政策
- 不要过于频繁地发送请求，以避免被 Google 封锁
- 某些地区可能需要使用代理才能访问 Google
- Playwright 需要安装浏览器，首次使用时会自动下载
- 状态文件包含浏览器 cookies 和存储数据，请妥善保管
- 使用状态文件可以有效避免 Google 的反机器人检测，提高搜索成功率
