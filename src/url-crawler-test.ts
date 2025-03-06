#!/usr/bin/env node

import { Command } from "commander";
import { chromium } from "playwright";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import logger from "./logger.js";

// 定义命令行参数
const program = new Command();
program
  .name("url-crawler")
  .description("爬取指定URL的网页内容")
  .version("1.0.0")
  .argument("<url>", "要爬取的URL")
  .option("-s, --selector <selector>", "CSS选择器，用于提取特定内容")
  .option("-w, --wait-for <selector>", "等待指定元素出现后再提取内容")
  .option("-t, --timeout <ms>", "超时时间(毫秒)", "30000")
  .option("--no-metadata", "不提取元数据")
  .option("--no-headless", "使用有头模式运行浏览器")
  .option("--no-save-state", "不保存浏览器状态")
  .option("--state-file <path>", "浏览器状态文件路径", path.join(os.homedir(), ".url-crawler-browser-state.json"))
  .parse(process.argv);

// 获取命令行参数
const url = program.args[0];
const options = program.opts();

// 主函数
async function main() {
  logger.info({ url, options }, "开始爬取URL");

  // 检查状态文件是否存在
  const stateFileExists = fs.existsSync(options.stateFile);
  let storageState: string | undefined = undefined;

  if (stateFileExists && !options.noSaveState) {
    logger.info({ stateFile: options.stateFile }, "使用保存的浏览器状态");
    storageState = options.stateFile;
  }

  // 启动浏览器
  const browser = await chromium.launch({
    headless: options.headless,
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

  try {
    // 创建新的浏览器上下文
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      storageState: storageState,
    });

    // 创建新页面
    const page = await context.newPage();

    try {
      // 设置超时
      page.setDefaultTimeout(parseInt(options.timeout));

      // 导航到URL
      await page.goto(url, { waitUntil: "domcontentloaded" });

      // 如果指定了等待选择器，则等待该元素出现
      if (options.waitFor) {
        await page.waitForSelector(options.waitFor, { timeout: parseInt(options.timeout) });
      }

      // 提取页面标题
      const title = await page.title();

      // 提取页面内容
      let content = "";
      if (options.selector) {
        // 如果提供了选择器，则提取特定元素的内容
        const elements = await page.$$(options.selector);
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
      if (options.metadata) {
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
      if (!stateFileExists && !options.noSaveState) {
        await context.storageState({ path: options.stateFile });
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

      // 输出结果
      console.log(JSON.stringify(result, null, 2));

    } finally {
      // 关闭上下文
      await context.close();
    }
  } finally {
    // 关闭浏览器
    await browser.close();
  }
}

// 执行主函数
main().catch(error => {
  logger.error({ error }, "URL爬取失败");
  process.exit(1);
}); 