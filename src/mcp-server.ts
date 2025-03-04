#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { googleSearch } from "./search.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

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
    headless: z.boolean().optional().describe("是否使用无头模式 (默认: true)"),
  },
  async (params) => {
    try {
      const { query, limit, timeout, headless } = params;
      console.log(`执行Google搜索: "${query}"`);

      // 获取用户主目录下的状态文件路径
      const stateFilePath = path.join(
        os.homedir(),
        ".google-search-browser-state.json"
      );
      console.log(`使用状态文件路径: ${stateFilePath}`);

      // 检查状态文件是否存在
      const stateFileExists = fs.existsSync(stateFilePath);

      // 如果状态文件不存在，且用户使用的是无头模式，提醒用户
      let userHeadlessMode = headless !== false; // 默认为true
      let warningMessage = "";

      if (!stateFileExists && userHeadlessMode) {
        warningMessage =
          "⚠️ 注意：浏览器状态文件不存在。首次使用时，建议使用有头模式 (headless: false) 打开浏览器，以便手动完成可能出现的人机验证。完成后，系统会保存状态文件，后续搜索将更加顺畅。";
        console.log(warningMessage);
      }

      // 设置超时处理
      let searchPromise = googleSearch(query, {
        limit: limit,
        timeout: timeout,
        headless: headless && stateFileExists,
        stateFile: stateFilePath,
      });

      // 创建一个超时检测
      const timeoutDuration = timeout || 30000;
      const timeoutThreshold = Math.min(
        timeoutDuration * 0.8,
        timeoutDuration - 5000
      ); // 设置为超时时间的80%或少5秒

      let results;
      try {
        // 使用Promise.race实现超时检测
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("TIMEOUT_WARNING"));
          }, timeoutThreshold);
        });

        results = await Promise.race([searchPromise, timeoutPromise]);
      } catch (error) {
        // 如果是我们设置的警告超时，继续等待原始搜索，但添加警告信息
        if (error instanceof Error && error.message === "TIMEOUT_WARNING") {
          console.log("搜索时间较长，可能遇到了人机验证...");
          results = await searchPromise; // 继续等待原始搜索完成

          // 添加长时间等待的警告
          if (!warningMessage) {
            warningMessage =
              "⚠️ 注意：搜索耗时较长，可能遇到了Google的人机验证。如果搜索结果不理想，建议使用有头模式 (headless: false) 重试，手动完成验证后将大幅提高后续搜索的成功率。";
          }
        } else {
          // 其他错误，继续抛出
          throw error;
        }
      }

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
      console.error("搜索工具执行错误:", error);

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
    console.log("正在启动Google搜索MCP服务器...");

    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.log("Google搜索MCP服务器已启动，等待连接...");
  } catch (error) {
    console.error("服务器启动失败:", error);
    process.exit(1);
  }
}

main();
