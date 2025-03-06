#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { googleSearch, bingSearch } from "./search.js";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import logger from "./logger.js";
import { chromium, Browser } from "playwright";

// 全局浏览器实例
let globalBrowser: Browser | undefined = undefined;

// 创建MCP服务器实例
const server = new McpServer({
  name: "search-server",
  version: "1.0.0",
});

// 注册Google搜索工具
server.tool(
  "google-search",
  "使用Google搜索引擎查询实时网络信息，返回包含标题、链接和摘要的搜索结果。适用于需要获取最新信息、查找特定主题资料、研究当前事件或验证事实的场景。结果以JSON格式返回，包含查询内容和匹配结果列表。",
  {
    query: z
      .string()
      .describe(
        "搜索查询字符串。为获得最佳结果：1)使用具体关键词而非模糊短语；2)可使用引号\"精确短语\"强制匹配；3)使用site:域名限定特定网站；4)使用-排除词过滤结果；5)使用OR连接备选词；6)优先使用专业术语；7)控制在2-5个关键词以获得平衡结果。例如:'气候变化 研究报告 2024 site:gov -观点' 或 '\"机器学习算法\" 教程 (Python OR Julia)'"
      ),
    limit: z
      .number()
      .optional()
      .describe("返回的搜索结果数量 (默认: 10，建议范围: 1-20)"),
    timeout: z
      .number()
      .optional()
      .describe("搜索操作的超时时间(毫秒) (默认: 30000，可根据网络状况调整)"),
  },
  async (params) => {
    try {
      const { query, limit, timeout } = params;
      logger.info({ query }, "执行Google搜索");

      // 获取用户主目录下的状态文件路径
      const stateFilePath = path.join(
        os.homedir(),
        ".google-search-browser-state.json"
      );
      logger.info({ stateFilePath }, "使用状态文件路径");

      // 检查状态文件是否存在
      const stateFileExists = fs.existsSync(stateFilePath);

      // 初始化警告消息
      let warningMessage = "";

      if (!stateFileExists) {
        warningMessage =
          "⚠️ 注意：浏览器状态文件不存在。首次使用时，如果遇到人机验证，系统会自动切换到有头模式让您完成验证。完成后，系统会保存状态文件，后续搜索将更加顺畅。";
        logger.warn(warningMessage);
      }

      // 使用全局浏览器实例执行搜索
      const results = await googleSearch(
        query,
        {
          limit: limit,
          timeout: timeout,
          stateFile: stateFilePath,
        },
        globalBrowser
      );

      // 构建返回结果，包含警告信息
      let responseText = JSON.stringify(results, null, 2);
      if (warningMessage) {
        responseText = warningMessage + "\n\n" + responseText;
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      logger.error({ error }, "搜索工具执行错误");

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `搜索失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// 注册Bing搜索工具
server.tool(
  "bing-search",
  "使用Bing搜索引擎查询实时网络信息，返回包含标题、链接和摘要的搜索结果。适用于需要获取最新信息、查找特定主题资料、研究当前事件或验证事实的场景。结果以JSON格式返回，包含查询内容和匹配结果列表。",
  {
    query: z
      .string()
      .describe(
        "搜索查询字符串。为获得最佳结果：1)使用具体关键词而非模糊短语；2)可使用引号\"精确短语\"强制匹配；3)使用site:域名限定特定网站；4)使用-排除词过滤结果；5)使用OR连接备选词；6)优先使用专业术语；7)控制在2-5个关键词以获得平衡结果。例如:'气候变化 研究报告 2024 site:gov -观点' 或 '\"机器学习算法\" 教程 (Python OR Julia)'"
      ),
    limit: z
      .number()
      .optional()
      .describe("返回的搜索结果数量 (默认: 10，建议范围: 1-20)"),
    timeout: z
      .number()
      .optional()
      .describe("搜索操作的超时时间(毫秒) (默认: 30000，可根据网络状况调整)"),
  },
  async (params) => {
    try {
      const { query, limit, timeout } = params;
      logger.info({ query }, "执行Bing搜索");

      // 获取用户主目录下的状态文件路径
      const stateFilePath = path.join(
        os.homedir(),
        ".bing-search-browser-state.json"
      );
      logger.info({ stateFilePath }, "使用状态文件路径");

      // 检查状态文件是否存在
      const stateFileExists = fs.existsSync(stateFilePath);

      // 初始化警告消息
      let warningMessage = "";

      if (!stateFileExists) {
        warningMessage =
          "⚠️ 注意：浏览器状态文件不存在。首次使用时，如果遇到人机验证，系统会自动切换到有头模式让您完成验证。完成后，系统会保存状态文件，后续搜索将更加顺畅。";
        logger.warn(warningMessage);
      }

      // 使用全局浏览器实例执行搜索
      const results = await bingSearch(
        query,
        {
          limit: limit,
          timeout: timeout,
          stateFile: stateFilePath,
        },
        globalBrowser
      );

      // 构建返回结果，包含警告信息
      let responseText = JSON.stringify(results, null, 2);
      if (warningMessage) {
        responseText = warningMessage + "\n\n" + responseText;
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      logger.error({ error }, "搜索工具执行错误");

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `搜索失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// 注册URL爬取工具
server.tool(
  "url-crawler",
  "爬取指定URL的网页内容，返回页面标题、正文内容和元数据。适用于需要获取特定网页详细内容、提取文章正文、分析网页结构或获取网页元数据的场景。结果以JSON格式返回，包含URL和提取的内容。",
  {
    url: z
      .string()
      .describe(
        "要爬取的完整URL地址，必须包含协议前缀(http://或https://)。例如:'https://example.com/article/123'"
      ),
    selector: z
      .string()
      .optional()
      .describe(
        "可选的CSS选择器，用于提取页面特定部分内容。不提供时将提取整个页面内容。例如:'article.main-content'或'div.news-body'"
      ),
    timeout: z
      .number()
      .optional()
      .describe("爬取操作的超时时间(毫秒) (默认: 30000，可根据网络状况调整)"),
    waitForSelector: z
      .string()
      .optional()
      .describe(
        "可选的CSS选择器，指定在提取内容前等待该元素出现。适用于动态加载内容的网页。例如:'div.loaded-content'"
      ),
    extractMetadata: z
      .boolean()
      .optional()
      .describe(
        "是否提取页面元数据，如Open Graph标签、Twitter卡片信息等 (默认: true)"
      ),
  },
  async (params) => {
    try {
      const { url, selector, timeout = 30000, waitForSelector, extractMetadata = true } = params;
      logger.info({ url }, "执行URL爬取");

      // 获取用户主目录下的状态文件路径
      const stateFilePath = path.join(
        os.homedir(),
        ".url-crawler-browser-state.json"
      );
      logger.info({ stateFilePath }, "使用状态文件路径");

      // 检查状态文件是否存在
      const stateFileExists = fs.existsSync(stateFilePath);

      // 初始化警告消息
      let warningMessage = "";

      if (!stateFileExists) {
        warningMessage =
          "⚠️ 注意：浏览器状态文件不存在。首次使用时，如果遇到人机验证，系统会自动切换到有头模式让您完成验证。完成后，系统会保存状态文件，后续爬取将更加顺畅。";
        logger.warn(warningMessage);
      }

      // 使用全局浏览器实例
      if (!globalBrowser) {
        throw new Error("浏览器实例未初始化");
      }

      // 创建新的浏览器上下文
      const context = await globalBrowser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        storageState: stateFileExists ? stateFilePath : undefined,
      });

      // 创建新页面
      const page = await context.newPage();

      try {
        // 设置超时
        page.setDefaultTimeout(timeout);

        // 导航到URL
        await page.goto(url, { waitUntil: "domcontentloaded" });

        // 如果指定了等待选择器，则等待该元素出现
        if (waitForSelector) {
          await page.waitForSelector(waitForSelector, { timeout });
        }

        // 提取页面标题
        const title = await page.title();

        // 提取页面内容
        let content = "";
        if (selector) {
          // 如果提供了选择器，则提取特定元素的内容
          const elements = await page.$$(selector);
          for (const element of elements) {
            const text = await element.textContent();
            if (text) {
              content += text.trim() + "\n";
            }
          }
        } else {
          // 否则提取整个页面的文本内容
          content = await page.evaluate(() => {
            // 移除脚本、样式和隐藏元素
            const scripts = Array.from(document.querySelectorAll('script, style, [style*="display:none"], [style*="display: none"]'));
            scripts.forEach(s => s.remove());
            
            // 获取正文内容
            return document.body.innerText;
          });
        }

        // 提取元数据
        let metadata: Record<string, string> = {};
        if (extractMetadata) {
          metadata = await page.evaluate(() => {
            const meta: Record<string, string> = {};
            
            // 提取所有meta标签
            const metaTags = document.querySelectorAll('meta');
            metaTags.forEach(tag => {
              const name = tag.getAttribute('name') || tag.getAttribute('property');
              const content = tag.getAttribute('content');
              if (name && content) {
                meta[name] = content;
              }
            });
            
            // 提取Open Graph标签
            const ogTags = document.querySelectorAll('meta[property^="og:"]');
            ogTags.forEach(tag => {
              const property = tag.getAttribute('property');
              const content = tag.getAttribute('content');
              if (property && content) {
                meta[property] = content;
              }
            });
            
            // 提取Twitter卡片信息
            const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
            twitterTags.forEach(tag => {
              const name = tag.getAttribute('name');
              const content = tag.getAttribute('content');
              if (name && content) {
                meta[name] = content;
              }
            });
            
            return meta;
          });
        }

        // 如果启用了状态保存，保存浏览器状态
        if (!stateFileExists) {
          await context.storageState({ path: stateFilePath });
          logger.info("已保存浏览器状态到文件");
        }

        // 构建结果
        const result = {
          url,
          title,
          content: content.trim(),
          metadata,
          timestamp: new Date().toISOString(),
        };

        // 关闭上下文
        await context.close();

        // 构建返回结果，包含警告信息
        let responseText = JSON.stringify(result, null, 2);
        if (warningMessage) {
          responseText = warningMessage + "\n\n" + responseText;
        }

        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        };
      } catch (error) {
        // 确保关闭上下文
        await context.close();
        throw error;
      }
    } catch (error) {
      logger.error({ error }, "URL爬取工具执行错误");

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `URL爬取失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// 启动服务器
async function main() {
  try {
    logger.info("正在启动Google搜索MCP服务器...");

    // 初始化全局浏览器实例
    logger.info("正在初始化全局浏览器实例...");
    globalBrowser = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-site-isolation-trials",
        "--disable-web-security",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--hide-scrollbars",
        "--mute-audio",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-component-extensions-with-background-pages",
        "--disable-extensions",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        "--disable-renderer-backgrounding",
        "--enable-features=NetworkService,NetworkServiceInProcess",
        "--force-color-profile=srgb",
        "--metrics-recording-only",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    logger.info("全局浏览器实例初始化成功");

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info("Google搜索MCP服务器已启动，等待连接...");

    // 设置进程退出时的清理函数
    process.on("exit", async () => {
      await cleanupBrowser();
    });

    // 处理Ctrl+C (Windows和Unix/Linux)
    process.on("SIGINT", async () => {
      logger.info("收到SIGINT信号，正在关闭服务器...");
      await cleanupBrowser();
      process.exit(0);
    });

    // 处理进程终止 (Unix/Linux)
    process.on("SIGTERM", async () => {
      logger.info("收到SIGTERM信号，正在关闭服务器...");
      await cleanupBrowser();
      process.exit(0);
    });

    // Windows特定处理
    if (process.platform === "win32") {
      // 处理Windows的CTRL_CLOSE_EVENT、CTRL_LOGOFF_EVENT和CTRL_SHUTDOWN_EVENT
      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.on("SIGINT", async () => {
        logger.info("Windows: 收到SIGINT信号，正在关闭服务器...");
        await cleanupBrowser();
        process.exit(0);
      });
    }
  } catch (error) {
    logger.error({ error }, "服务器启动失败");
    await cleanupBrowser();
    process.exit(1);
  }
}

// 清理浏览器资源
async function cleanupBrowser() {
  if (globalBrowser) {
    logger.info("正在关闭全局浏览器实例...");
    try {
      await globalBrowser.close();
      globalBrowser = undefined;
      logger.info("全局浏览器实例已关闭");
    } catch (error) {
      logger.error({ error }, "关闭浏览器实例时发生错误");
    }
  }
}

main();
