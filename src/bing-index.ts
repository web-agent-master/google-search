#!/usr/bin/env node

import { Command } from "commander";
import { bingSearch } from "./search.js";
import { CommandOptions } from "./types.js";

// 获取包信息
import packageJson from "../package.json" with { type: "json" };

// 创建命令行程序
const program = new Command();

// 配置命令行选项
program
  .name("bing-search")
  .description("基于 Playwright 的 Bing 搜索 CLI 工具")
  .version(packageJson.version)
  .argument("<query>", "搜索关键词")
  .option("-l, --limit <number>", "结果数量限制", parseInt, 10)
  .option("-t, --timeout <number>", "超时时间(毫秒)", parseInt, 30000)
  .option("--no-headless", "已废弃: 现在总是先尝试无头模式，如果遇到人机验证会自动切换到有头模式")
  .option("--state-file <path>", "浏览器状态文件路径", "./browser-state.json")
  .option("--no-save-state", "不保存浏览器状态")
  .option("--locale <locale>", "搜索结果语言", "zh-CN")
  .action(async (query: string, options: CommandOptions) => {
    try {
      // 执行搜索
      const results = await bingSearch(query, options);

      // 输出结果
      console.log(JSON.stringify(results, null, 2));
    } catch (error) {
      console.error("错误:", error);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse(process.argv); 