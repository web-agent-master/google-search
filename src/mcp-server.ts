#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { googleSearch } from "./search.js";
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
  "执行Google搜索并返回结果",
  {
    query: z.string().describe("搜索关键词"),
    limit: z.number().optional().describe("结果数量限制 (默认: 10)"),
    timeout: z.number().optional().describe("超时时间(毫秒) (默认: 30000)"),
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
      const results = await googleSearch(query, {
        limit: limit,
        timeout: timeout,
        stateFile: stateFilePath,
      }, globalBrowser);

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
    process.on('exit', async () => {
      await cleanupBrowser();
    });

    process.on('SIGINT', async () => {
      logger.info("收到SIGINT信号，正在关闭服务器...");
      await cleanupBrowser();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info("收到SIGTERM信号，正在关闭服务器...");
      await cleanupBrowser();
      process.exit(0);
    });
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
