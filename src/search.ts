import { chromium } from "playwright";
import { SearchResponse, SearchResult, CommandOptions } from "./types";

/**
 * 执行Google搜索并返回结果
 * @param query 搜索关键词
 * @param options 搜索选项
 * @returns 搜索结果
 */
export async function googleSearch(
  query: string,
  options: CommandOptions = {}
): Promise<SearchResponse> {
  // 设置默认选项
  const { limit = 10, timeout = 60000, headless = true } = options;

  console.log("======================================");
  console.log("正在初始化浏览器...");
  console.log(`命令行选项: ${JSON.stringify(options)}`);
  
  // 如果设置了远程调试端口，则显示日志
  if (options.remoteDebuggingPort) {
    console.log(`启用远程调试端口: ${options.remoteDebuggingPort}`);
  }
  
  // 准备浏览器启动参数
  const launchArgs = options.remoteDebuggingPort
    ? [`--remote-debugging-port=${options.remoteDebuggingPort}`]
    : undefined;
    
  if (launchArgs) {
    console.log(`浏览器启动参数: ${JSON.stringify(launchArgs)}`);
  }
  
  console.log("准备启动浏览器...");
  
  // 初始化浏览器
  const browser = await chromium.launch({
    headless,
    timeout: timeout * 2, // 增加浏览器启动超时时间
    args: launchArgs,
  });
  
  console.log("浏览器已成功启动!");
  
  // 浏览器启动后显示连接信息
  if (options.remoteDebuggingPort) {
    console.log(`远程调试地址: http://localhost:${options.remoteDebuggingPort}`);
    console.log(`可以使用Chrome浏览器访问上述地址进行调试`);
  }
  
  console.log("======================================");
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  try {
    console.log("正在访问Google搜索页面...");
    // 访问Google搜索页面
    await page.goto("https://www.google.com", {
      timeout,
      waitUntil: "networkidle",
    });

    console.log("正在输入搜索关键词:", query);
    // 等待搜索框出现 - 使用通用textarea选择器
    await page.waitForSelector('textarea', { timeout });

    // 输入搜索关键词
    await page.fill('textarea', query);
    await page.press('textarea', "Enter");

    console.log("正在等待搜索结果加载...");
    // 等待搜索结果加载
    await page.waitForSelector("#search", { timeout });

    console.log("正在提取搜索结果...");
    // 提取搜索结果
    const results: SearchResult[] = await page.$$eval(
      "#search .g",
      (elements, maxResults) => {
        return elements.slice(0, maxResults).map((el) => {
          const titleElement = el.querySelector("h3");
          const linkElement = el.querySelector("a");
          const snippetElement = el.querySelector(".VwiC3b");

          return {
            title: titleElement ? titleElement.textContent || "" : "",
            link: linkElement ? linkElement.href : "",
            snippet: snippetElement ? snippetElement.textContent || "" : "",
          };
        });
      },
      limit
    );

    console.log(`成功获取到 ${results.length} 条搜索结果`);

    // 返回搜索结果
    return {
      query,
      results,
    };
  } catch (error) {
    console.error("搜索过程中发生错误:", error);

    // 创建一个模拟的搜索结果，以便在出错时仍能返回一些信息
    return {
      query,
      results: [
        {
          title: "搜索失败",
          link: "",
          snippet: `无法完成搜索，错误信息: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  } finally {
    // 关闭浏览器
    console.log("正在关闭浏览器...");
    await browser.close();
  }
}
