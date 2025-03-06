# Search Tool

A Playwright-based Node.js tool that bypasses search engine anti-scraping mechanisms to execute Google and Bing searches and extract results. It can be used directly as a command-line tool or as a Model Context Protocol (MCP) server to provide real-time search capabilities to AI assistants like Claude.

[![Star History Chart](https://api.star-history.com/svg?repos=web-agent-master/google-search&type=Date)](https://star-history.com/#web-agent-master/google-search&Date)

[中文文档](README.zh-CN.md)

## Key Features

- **Local SERP API Alternative**: No need to rely on paid search engine results API services, all searches are executed locally
- **Multiple Search Engines Support**: Currently supports Google and Bing search engines
- **URL Content Crawler**: Extract content from any web page with customizable selectors and metadata extraction
- **Advanced Anti-Bot Detection Bypass Techniques**:
  - Intelligent browser fingerprint management that simulates real user behavior
  - Automatic saving and restoration of browser state to reduce verification frequency
  - Smart headless/headed mode switching, automatically switching to headed mode when verification is needed
  - Randomization of device and locale settings to reduce detection risk
- **MCP Server Integration**: Provides real-time search capabilities to AI assistants like Claude without requiring additional API keys
- **Completely Open Source and Free**: All code is open source with no usage restrictions, freely customizable and extensible

## Technical Features

- Developed with TypeScript, providing type safety and better development experience
- Browser automation based on Playwright, supporting multiple browser engines
- Command-line parameter support for search keywords
- MCP server support for AI assistant integration
- Returns search results with title, link, and snippet
- URL crawler with customizable content extraction and metadata support
- JSON format output
- Support for both headless and headed modes (for debugging)
- Detailed logging output
- Robust error handling
- Browser state saving and restoration to effectively avoid anti-bot detection

## Installation

```bash
# Install from source
git clone https://github.com/web-agent-master/google-search.git
cd google-search
# Install dependencies
npm install
# Or using yarn
yarn
# Or using pnpm
pnpm install

# Compile TypeScript code
npm run build
# Or using yarn
yarn build
# Or using pnpm
pnpm build

# Link package globally (required for MCP functionality)
npm link
# Or using yarn
yarn link
# Or using pnpm
pnpm link
```

### Windows Environment Notes

This tool has been specially adapted for Windows environments:

1. `.cmd` files are provided to ensure command-line tools work properly in Windows Command Prompt and PowerShell
2. Log files are stored in the system temporary directory instead of the Unix/Linux `/tmp` directory
3. Windows-specific process signal handling has been added to ensure proper server shutdown
4. Cross-platform file path handling is used to support Windows path separators

## Usage

### Command Line

```bash
# Google search
npx google-search "your search query"
# Or with options
npx google-search --limit 5 "your search query"

# Bing search
npx bing-search "your search query"
# Or with options
npx bing-search --limit 5 "your search query"

# URL crawler
npx url-crawler "https://example.com"
# Or with options
npx url-crawler -s "article.main-content" -w "div.loaded-content" -t 30000 "https://example.com"
```

You can also use the subcommands:

```bash
# Google search
npx google-search google "your search query"

# Bing search
npx google-search bing "your search query"
```

### Options

#### Search Options
- `--limit <number>`: Limit the number of results (default: 10)
- `--timeout <number>`: Set timeout in milliseconds (default: 30000)
- `--state-file <path>`: Specify browser state file path (default: ./browser-state.json)
- `--no-save-state`: Don't save browser state
- `--locale <locale>`: Specify search result language (default: zh-CN)

#### URL Crawler Options
- `-s, --selector <selector>`: CSS selector to extract specific content
- `-w, --wait-for <selector>`: Wait for specified element to appear before extracting content
- `-t, --timeout <ms>`: Timeout in milliseconds (default: 30000)
- `--no-metadata`: Don't extract metadata
- `--no-headless`: Run browser in headed mode
- `--no-save-state`: Don't save browser state
- `--state-file <path>`: Specify browser state file path (default: ~/.url-crawler-browser-state.json)

#### Output Example

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
    // More results...
  ]
}
```

#### URL Crawler Output Example

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

### MCP Server

This project provides Model Context Protocol (MCP) server functionality, allowing AI assistants like Claude to directly use Google search capabilities. MCP is an open protocol that enables AI assistants to safely access external tools and data.

```bash
# Start the MCP server
npx google-search-mcp
```

The MCP server provides three tools:
- `google-search`: For Google search
- `bing-search`: For Bing search
- `url-crawler`: For crawling and extracting content from URLs

#### Integration with Claude Desktop

1. Edit the Claude Desktop configuration file:
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
     - Usually located at `C:\Users\username\AppData\Roaming\Claude\claude_desktop_config.json`
     - You can access it directly by entering `%APPDATA%\Claude` in Windows Explorer address bar

2. Add server configuration and restart Claude

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

For Windows environments, you can also use the following configurations:

1. Using cmd.exe with npx:

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

2. Using node with full path (recommended if you encounter issues with the above method):

```json
{
  "mcpServers": {
    "google-search": {
      "command": "node",
      "args": ["C:/path/to/your/google-search/dist/mcp-server.js"]
    }
  }
}
```

Note: For the second method, you must replace `C:/path/to/your/google-search` with the actual full path to where you installed the google-search package.

After integration, you can directly use search functionality in Claude, such as "search for the latest AI research".

## Project Structure

```
google-search/
├── package.json          # Project configuration and dependencies
├── tsconfig.json         # TypeScript configuration
├── src/
│   ├── index.ts          # Entry file (command line parsing and main logic)
│   ├── search.ts         # Search functionality implementation (Playwright browser automation)
│   ├── mcp-server.ts     # MCP server implementation
│   └── types.ts          # Type definitions (interfaces and type declarations)
├── dist/                 # Compiled JavaScript files
├── bin/                  # Executable files
│   └── google-search     # Command line entry script
├── README.md             # Project documentation
└── .gitignore            # Git ignore file
```

## Technology Stack

- **TypeScript**: Development language, providing type safety and better development experience
- **Node.js**: Runtime environment for executing JavaScript/TypeScript code
- **Playwright**: For browser automation, supporting multiple browsers
- **Commander**: For parsing command line arguments and generating help information
- **Model Context Protocol (MCP)**: Open protocol for AI assistant integration
- **MCP SDK**: Development toolkit for implementing MCP servers
- **Zod**: Schema definition library for validation and type safety
- **pnpm**: Efficient package management tool, saving disk space and installation time

## Development Guide

All commands can be run in the project root directory:

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm run postinstall

# Compile TypeScript code
pnpm build

# Clean compiled output
pnpm clean
```

### CLI Development

```bash
# Run in development mode
pnpm dev "search keywords"

# Run in debug mode (showing browser interface)
pnpm debug "search keywords"

# Run compiled code
pnpm start "search keywords"

# Test search functionality
pnpm test
```

### MCP Server Development

```bash
# Run MCP server in development mode
pnpm mcp

# Run compiled MCP server
pnpm mcp:build
```

## Error Handling

The tool has built-in robust error handling mechanisms:

- Friendly error messages when browser startup fails
- Automatic error status return for network connection issues
- Detailed logs for search result parsing failures
- Graceful exit and useful information return in timeout situations

## Notes

### General Notes

- This tool is for learning and research purposes only
- Please comply with Google's terms of service and policies
- Do not send requests too frequently to avoid being blocked by Google
- Some regions may require a proxy to access Google
- Playwright needs to install browsers, which will be automatically downloaded on first use

### State Files

- State files contain browser cookies and storage data, please keep them secure
- Using state files can effectively avoid Google's anti-bot detection and improve search success rate

### MCP Server

- MCP server requires Node.js v16 or higher
- When using the MCP server, please ensure Claude Desktop is updated to the latest version
- When configuring Claude Desktop, use absolute paths to the MCP server file

### Windows-Specific Notes

- In Windows environments, you may need administrator privileges to install Playwright browsers for the first time
- If you encounter permission issues, try running Command Prompt or PowerShell as administrator
- Windows Firewall may block Playwright browser network connections; allow access when prompted
- Browser state files are saved by default in the user's home directory as `.google-search-browser-state.json`
- Log files are stored in the system temporary directory under the `google-search-logs` folder

## Comparison with Commercial SERP APIs

Compared to paid search engine results API services (such as SerpAPI), this project offers the following advantages:

- **Completely Free**: No API call fees
- **Local Execution**: All searches are executed locally, no dependency on third-party services
- **Privacy Protection**: Search queries are not recorded by third parties
- **Customizability**: Fully open source, can be modified and extended as needed
- **No Usage Limits**: Not subject to API call count or frequency limitations
- **MCP Integration**: Native support for integration with AI assistants like Claude
