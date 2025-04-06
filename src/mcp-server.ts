#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { googleSearch, getGoogleSearchPageHtml } from "./search.js";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import logger from "./logger.js";
import { chromium, Browser } from "playwright";

// 全局浏览器实例
let globalBrowser: Browser | undefined = undefined;

// 创建MCP服务器实例
const server = new McpServer({
  name: "google-search-server",
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
        "搜索查询字符串。为获得最佳结果：1)优先使用英语关键词搜索，因为英语内容通常更丰富、更新更及时，特别是技术和学术领域；2)使用具体关键词而非模糊短语；3)可使用引号\"精确短语\"强制匹配；4)使用site:域名限定特定网站；5)使用-排除词过滤结果；6)使用OR连接备选词；7)优先使用专业术语；8)控制在2-5个关键词以获得平衡结果；9)根据目标内容选择合适的语言（如需要查找特定中文资源时再使用中文）。例如:'climate change report 2024 site:gov -opinion' 或 '\"machine learning algorithms\" tutorial (Python OR Julia)'"
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
