#!/usr/bin/env node

import { Command } from "commander";
import { googleSearch } from "./search";
import { CommandOptions } from "./types";

// 获取包信息
const packageJson = require("../package.json");

// 创建命令行程序
const program = new Command();

// 配置命令行选项
program
  .name("google-search")
  .description("基于 Playwright 的 Google 搜索 CLI 工具")
  .version(packageJson.version)
  .argument("<query>", "搜索关键词")
  .option("-l, --limit <number>", "结果数量限制", parseInt, 10)
  .option("-t, --timeout <number>", "超时时间(毫秒)", parseInt, 30000)
  .option("--no-headless", "显示浏览器界面")
  .action(async (query: string, options: CommandOptions) => {
    try {
      // 执行搜索
      const results = await googleSearch(query, options);

      // 输出结果
      console.log(JSON.stringify(results, null, 2));
    } catch (error) {
      console.error("错误:", error);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse(process.argv);
